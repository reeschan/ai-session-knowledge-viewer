import { envOverrides, loadSettings, maskKey, SOURCE_TYPES } from "@/lib/settings";

const inputClass =
  "w-full rounded-sm border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring px-2 py-1 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";
const hintClass = "text-xs text-muted-foreground";
const sectionClass =
  "flex flex-col gap-3 rounded-md border border-border bg-card text-card-foreground shadow-md p-4";

const PROVIDERS = ["anthropic", "openai-compatible"] as const;

function keyPlaceholder(current: string): string {
  const masked = maskKey(current);
  return masked ? `${masked}（空欄なら変更しない）` : "未設定（空欄なら変更しない）";
}

function TextField({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label class={labelClass}>
      <span>{label}</span>
      <input type="text" name={name} value={value} class={inputClass} />
    </label>
  );
}

/** API キーの値そのものは HTML に出さない (伏せ字を placeholder に出すだけ)。 */
function KeyField({ name, label, current }: { name: string; label: string; current: string }) {
  return (
    <label class={labelClass}>
      <span>{label}</span>
      <input
        type="password"
        name={name}
        placeholder={keyPlaceholder(current)}
        autocomplete="off"
        class={inputClass}
      />
      <span class={hintClass}>空欄なら変更しない</span>
    </label>
  );
}

export async function SettingsPage({ query }: { query: URLSearchParams }) {
  const saved = query.get("saved") === "1";
  const settings = await loadSettings();
  const overrides = envOverrides();
  const rows = [
    ...settings.sources.map((s) => ({ type: s.type as string, path: s.path, enabled: s.enabled })),
    { type: "markdown", path: "", enabled: true },
  ];

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 class="text-xl font-semibold">設定</h1>
      <p class={hintClass}>
        各項目の説明は <a href="/manual" class="text-primary hover:underline">マニュアル</a> を参照。Claude Code では <code>/knowledge-setup</code> で対話しながら設定できます。
      </p>

      {saved && (
        <p class="rounded-md border border-success/50 bg-success/15 text-success px-3 py-2 text-sm">
          保存しました
        </p>
      )}

      {overrides.length > 0 && (
        <p class="rounded-md border border-warning/50 bg-warning/15 text-warning px-3 py-2 text-sm">
          環境変数で上書きされている項目: {overrides.join(", ")}
        </p>
      )}

      <form method="post" action="/api/settings" class="flex flex-col gap-4">
        <section class={sectionClass}>
          <h2 class="text-sm font-semibold text-muted-foreground">ログのソース</h2>
          <p class={hintClass}>パスを空にすると削除します。最後の空行に入力すると追加します。</p>
          {rows.map((row, i) => (
            <div class="flex flex-wrap items-center gap-2">
              <select name={`source.${i}.type`} class={`${inputClass} w-36`}>
                {SOURCE_TYPES.map((t) => (
                  <option value={t} selected={t === row.type}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name={`source.${i}.path`}
                value={row.path}
                placeholder="パス"
                class={`${inputClass} min-w-0 flex-1`}
              />
              <label class="flex items-center gap-1 text-sm">
                <input type="checkbox" name={`source.${i}.enabled`} value="on" checked={row.enabled} />
                有効
              </label>
            </div>
          ))}
        </section>

        <section class={sectionClass}>
          <h2 class="text-sm font-semibold text-muted-foreground">LLM</h2>
          <label class={labelClass}>
            <span>プロバイダ</span>
            <select name="llm.provider" class={inputClass}>
              {PROVIDERS.map((p) => (
                <option value={p} selected={p === settings.llm.provider}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <KeyField name="llm.anthropic.apiKey" label="Anthropic API キー" current={settings.llm.anthropic.apiKey} />
          <TextField name="llm.anthropic.model" label="Anthropic モデル" value={settings.llm.anthropic.model} />
          <TextField name="llm.anthropic.baseUrl" label="Anthropic Base URL" value={settings.llm.anthropic.baseUrl} />
          <TextField name="llm.openai.baseUrl" label="OpenAI 互換 Base URL" value={settings.llm.openai.baseUrl} />
          <KeyField name="llm.openai.apiKey" label="OpenAI 互換 API キー" current={settings.llm.openai.apiKey} />
          <TextField name="llm.openai.model" label="OpenAI 互換モデル" value={settings.llm.openai.model} />
        </section>

        <section class={sectionClass}>
          <h2 class="text-sm font-semibold text-muted-foreground">スキル生成</h2>
          <TextField name="skills.storeDir" label="保存先フォルダ" value={settings.skills.storeDir} />
          <TextField name="skills.slackChannel" label="Slack チャンネル" value={settings.skills.slackChannel} />
          <TextField name="skills.appDir" label="アプリのフォルダ" value={settings.skills.appDir} />
        </section>

        <div>
          <button
            type="submit"
            class="rounded-full bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/85 disabled:opacity-50 px-4 py-1.5 text-sm"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
