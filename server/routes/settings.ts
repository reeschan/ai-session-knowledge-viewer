import type { Context } from "hono";
import { loadSettings, saveSettings, SettingsSchema, type Settings, type SourceConfig } from "@/lib/settings";

/** 文字列の欄だけ返す。欄が無ければ undefined。 */
function field(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

/** API キーは空欄なら既存の値を残す。 */
function apiKey(form: FormData, name: string, current: string): string {
  const value = field(form, name);
  return value ? value : current;
}

function buildSources(form: FormData, current: SourceConfig[]): unknown[] {
  const indexes = new Set<number>();
  for (const key of form.keys()) {
    const match = /^source\.(\d+)\.path$/.exec(key);
    if (match) indexes.add(Number(match[1]));
  }
  // ソースの欄が 1 つも無いフォームでは、既存のソースをそのまま残す。
  if (indexes.size === 0) return current;
  return [...indexes]
    .sort((a, b) => a - b)
    .filter((i) => (field(form, `source.${i}.path`) ?? "") !== "")
    .map((i) => ({
      id: current[i]?.id ?? crypto.randomUUID(),
      type: field(form, `source.${i}.type`),
      path: field(form, `source.${i}.path`),
      enabled: field(form, `source.${i}.enabled`) === "on",
    }));
}

/** POST /api/settings。Host・Origin の確認は server/guard.ts が全ルートにかけている。 */
export async function postSettings(c: Context): Promise<Response> {
  const form = await c.req.raw.formData();
  const current = await loadSettings();
  const f = (name: string, fallback: string) => field(form, name) ?? fallback;

  const candidate = {
    sources: buildSources(form, current.sources),
    llm: {
      provider: f("llm.provider", current.llm.provider),
      anthropic: {
        apiKey: apiKey(form, "llm.anthropic.apiKey", current.llm.anthropic.apiKey),
        model: f("llm.anthropic.model", current.llm.anthropic.model),
        baseUrl: f("llm.anthropic.baseUrl", current.llm.anthropic.baseUrl),
      },
      openai: {
        baseUrl: f("llm.openai.baseUrl", current.llm.openai.baseUrl),
        apiKey: apiKey(form, "llm.openai.apiKey", current.llm.openai.apiKey),
        model: f("llm.openai.model", current.llm.openai.model),
      },
    },
    skills: {
      storeDir: f("skills.storeDir", current.skills.storeDir),
      slackChannel: f("skills.slackChannel", current.skills.slackChannel),
      appDir: f("skills.appDir", current.skills.appDir),
    },
  };

  const parsed = SettingsSchema.safeParse(candidate);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    return new Response(`設定の値が不正です。\n${summary}\n`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const next: Settings = parsed.data;
  await saveSettings(next);
  return c.redirect("/settings?saved=1", 303);
}
