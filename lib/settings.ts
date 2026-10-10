import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

export const SOURCE_TYPES = ["markdown", "claude-code", "codex"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SettingsSchema = z.object({
  sources: z.array(
    z.object({ id: z.string(), type: z.enum(SOURCE_TYPES), path: z.string(), enabled: z.boolean() }),
  ),
  llm: z.object({
    provider: z.enum(["anthropic", "openai-compatible"]),
    anthropic: z.object({ apiKey: z.string(), model: z.string(), baseUrl: z.string() }),
    openai: z.object({ baseUrl: z.string(), apiKey: z.string(), model: z.string() }),
  }),
  skills: z.object({ storeDir: z.string(), slackChannel: z.string(), appDir: z.string() }),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type SourceConfig = Settings["sources"][number];

const SETTINGS_FILE = "settings.json";
const ENV_NAMES = ["LOG_ROOT", "ANTHROPIC_API_KEY", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"] as const;

/** 空文字は未設定として扱う。 */
function env(name: string): string | undefined {
  const value = process.env[name];
  return value ? value : undefined;
}

export function dataDir(): string {
  return env("KV_DATA_DIR") ?? path.join(process.cwd(), "data");
}

function settingsPath(): string {
  return path.join(dataDir(), SETTINGS_FILE);
}

export function expandHome(p: string): string {
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

export function defaultSettings(): Settings {
  return {
    sources: [
      {
        id: "claude-code",
        type: "claude-code",
        path: path.join(os.homedir(), ".claude", "projects"),
        enabled: true,
      },
      {
        id: "codex",
        type: "codex",
        path: path.join(os.homedir(), ".codex", "sessions"),
        enabled: true,
      },
    ],
    llm: {
      provider: "anthropic",
      anthropic: { apiKey: "", model: "claude-opus-5-5", baseUrl: "" },
      openai: { baseUrl: "http://127.0.0.1:8888/v1", apiKey: "", model: "" },
    },
    skills: { storeDir: "", slackChannel: "", appDir: process.cwd() },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** オブジェクトはキーごとにマージし、配列やその他の値は override で置き換える。 */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      result[key] = key in base ? deepMerge(base[key], value) : value;
    }
    return result;
  }
  return override === undefined ? base : override;
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await readFile(settingsPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return SettingsSchema.parse(deepMerge(defaultSettings(), parsed));
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  SettingsSchema.parse(s);
  await mkdir(dataDir(), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(s, null, 2), "utf8");
}

export async function effectiveSettings(): Promise<Settings> {
  const fileExists = existsSync(settingsPath());
  const s = structuredClone(await loadSettings());

  const logRoot = env("LOG_ROOT");
  if (logRoot && !s.sources.some((src) => src.path === logRoot)) {
    s.sources.push({ id: "env-log-root", type: "markdown", path: logRoot, enabled: true });
  }

  if (s.skills.storeDir !== "") {
    const storePath = path.join(s.skills.storeDir, "claude-code");
    if (!s.sources.some((src) => src.path === storePath)) {
      s.sources.push({ id: "skill-store", type: "claude-code", path: storePath, enabled: true });
    }
  }

  const anthropicKey = env("ANTHROPIC_API_KEY");
  if (anthropicKey) s.llm.anthropic.apiKey = anthropicKey;

  const baseUrl = env("LLM_BASE_URL");
  if (baseUrl) s.llm.openai.baseUrl = baseUrl;
  const apiKey = env("LLM_API_KEY");
  if (apiKey) s.llm.openai.apiKey = apiKey;
  const model = env("LLM_MODEL");
  if (model) s.llm.openai.model = model;

  if (!fileExists && baseUrl) s.llm.provider = "openai-compatible";

  return s;
}

export function envOverrides(): string[] {
  return ENV_NAMES.filter((name) => env(name) !== undefined);
}

export function maskKey(key: string): string {
  if (key === "") return "";
  if (key.length <= 4) return "••••";
  return "••••" + key.slice(-4);
}
