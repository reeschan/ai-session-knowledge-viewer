// 設定の確認と反映を行う CLI（pnpm configure）。Claude Code の knowledge-setup スキルから呼ぶ。
//   pnpm configure detect                 現在の設定・ログの場所の有無・キーの有無を JSON で出す（キーの値は出さない）
//   pnpm configure apply <パッチ JSON>    部分的な設定をファイルの設定にディープマージして保存し、detect と同じ JSON を出す
// API キーはパッチで渡せない。.env.local か設定画面で入れる。
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  SettingsSchema,
  dataDir,
  deepMerge,
  effectiveSettings,
  envOverrides,
  loadSettings,
  saveSettings,
} from "../lib/settings";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const USAGE = "Usage: pnpm configure detect | pnpm configure apply <patch.json>";
const API_KEY_ERROR = "API キーはパッチで渡せません。.env.local か設定画面で入れてください";

function fail(message: string): never {
  console.error(`${message}\n${USAGE}`);
  process.exit(1);
}

function failJson(message: string): never {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

/** どの深さにでも apiKey というキーがあれば true。 */
function hasApiKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasApiKey);
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(([key, v]) => key === "apiKey" || hasApiKey(v));
  }
  return false;
}

async function detect(): Promise<string> {
  const settingsFile = path.join(dataDir(), "settings.json");
  const s = await effectiveSettings();
  const defaults = [
    { type: "claude-code", path: path.join(os.homedir(), ".claude", "projects") },
    { type: "codex", path: path.join(os.homedir(), ".codex", "sessions") },
  ];
  const result = {
    settingsFile,
    settingsExists: existsSync(settingsFile),
    sources: s.sources.map((src) => ({ ...src, exists: existsSync(src.path) })),
    defaults: defaults.map((d) => ({ ...d, exists: existsSync(d.path) })),
    llm: {
      provider: s.llm.provider,
      anthropic: {
        model: s.llm.anthropic.model,
        baseUrl: s.llm.anthropic.baseUrl,
        hasKey: s.llm.anthropic.apiKey !== "",
      },
      openai: {
        baseUrl: s.llm.openai.baseUrl,
        model: s.llm.openai.model,
        hasKey: s.llm.openai.apiKey !== "",
      },
    },
    skills: s.skills,
    envOverrides: envOverrides(),
  };
  return JSON.stringify(result, null, 2);
}

async function apply(patchFile: string | undefined): Promise<void> {
  if (!patchFile) fail("apply requires a patch JSON file");

  let patch: unknown;
  try {
    patch = JSON.parse(await readFile(patchFile, "utf8"));
  } catch {
    // エラー文に入力の断片（キーが入っている可能性がある）を出さない。
    failJson(`パッチを JSON として読めません: ${patchFile}`);
  }
  if (hasApiKey(patch)) failJson(API_KEY_ERROR);

  const parsed = SettingsSchema.safeParse(deepMerge(await loadSettings(), patch));
  if (!parsed.success) failJson(parsed.error.message);

  await saveSettings(parsed.data);
  console.log(await detect());
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "detect") {
    console.log(await detect());
  } else if (command === "apply") {
    await apply(rest[0]);
  } else {
    fail(command === undefined ? "subcommand is required" : `unknown subcommand: ${command}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
