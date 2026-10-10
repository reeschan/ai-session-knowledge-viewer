import { envOverrides, loadSettings, maskKey, SOURCE_TYPES } from "@/lib/settings";

export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelClass = "flex flex-col gap-1 text-sm";
const hintClass = "text-xs text-zinc-500 dark:text-zinc-400";
const sectionClass =
  "flex flex-col gap-3 rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";

function keyPlaceholder(current: string): string {
  const masked = maskKey(current);
  return masked ? `${masked}（空欄なら変更しない）` : "未設定（空欄なら変更しない）";
}

function TextField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className={labelClass}>
      <span>{label}</span>
      <input type="text" name={name} defaultValue={defaultValue} className={inputClass} />
    </label>
  );
}

function KeyField({ name, label, current }: { name: string; label: string; current: string }) {
  return (
    <label className={labelClass}>
      <span>{label}</span>
      <input
        type="password"
        name={name}
        defaultValue=""
        placeholder={keyPlaceholder(current)}
        autoComplete="off"
        className={inputClass}
      />
      <span className={hintClass}>空欄なら変更しない</span>
    </label>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const saved = raw.saved === "1";
  const settings = await loadSettings();
  const overrides = envOverrides();
  const rows = [
    ...settings.sources.map((s) => ({ type: s.type as string, path: s.path, enabled: s.enabled })),
    { type: "markdown", path: "", enabled: true },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-semibold">設定</h1>

      {saved && (
        <p className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          保存しました
        </p>
      )}

      {overrides.length > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          環境変数で上書きされている項目: {overrides.join(", ")}
        </p>
      )}

      <form method="post" action="/api/settings" className="flex flex-col gap-4">
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">ログのソース</h2>
          <p className={hintClass}>パスを空にすると削除します。最後の空行に入力すると追加します。</p>
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select name={`source.${i}.type`} defaultValue={row.type} className={`${inputClass} w-36`}>
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name={`source.${i}.path`}
                defaultValue={row.path}
                placeholder="パス"
                className={`${inputClass} min-w-0 flex-1`}
              />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name={`source.${i}.enabled`} value="on" defaultChecked={row.enabled} />
                有効
              </label>
            </div>
          ))}
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">LLM</h2>
          <label className={labelClass}>
            <span>プロバイダ</span>
            <select name="llm.provider" defaultValue={settings.llm.provider} className={inputClass}>
              <option value="anthropic">anthropic</option>
              <option value="openai-compatible">openai-compatible</option>
            </select>
          </label>
          <KeyField name="llm.anthropic.apiKey" label="Anthropic API キー" current={settings.llm.anthropic.apiKey} />
          <TextField name="llm.anthropic.model" label="Anthropic モデル" defaultValue={settings.llm.anthropic.model} />
          <TextField name="llm.anthropic.baseUrl" label="Anthropic Base URL" defaultValue={settings.llm.anthropic.baseUrl} />
          <TextField name="llm.openai.baseUrl" label="OpenAI 互換 Base URL" defaultValue={settings.llm.openai.baseUrl} />
          <KeyField name="llm.openai.apiKey" label="OpenAI 互換 API キー" current={settings.llm.openai.apiKey} />
          <TextField name="llm.openai.model" label="OpenAI 互換モデル" defaultValue={settings.llm.openai.model} />
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">スキル生成</h2>
          <TextField name="skills.storeDir" label="保存先フォルダ" defaultValue={settings.skills.storeDir} />
          <TextField name="skills.slackChannel" label="Slack チャンネル" defaultValue={settings.skills.slackChannel} />
          <TextField name="skills.appDir" label="アプリのフォルダ" defaultValue={settings.skills.appDir} />
        </section>

        <div>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
