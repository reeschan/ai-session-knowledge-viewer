import { effectiveSettings } from "@/lib/settings";
import { generateSkills, type Period } from "@/lib/skills";

const inputClass =
  "w-full rounded-sm border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring px-2 py-1 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";
const hintClass = "text-xs text-muted-foreground";
const sectionClass =
  "flex flex-col gap-3 rounded-md border border-border bg-card text-card-foreground shadow-md p-4";
const preClass =
  "overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-muted text-foreground p-3 text-xs";
const buttonClass =
  "rounded-full bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/85 disabled:opacity-50 px-4 py-1.5 text-sm";

const PERIOD_LABELS: Record<Period, string> = { daily: "日次 (daily)", weekly: "週次 (weekly)" };

export async function SkillsPage({ query }: { query: URLSearchParams }) {
  const defaults = (await effectiveSettings()).skills;
  const hasQuery = ["storeDir", "slackChannel", "appDir", "periods"].some((k) => query.has(k));

  const storeDir = query.get("storeDir") ?? defaults.storeDir;
  const slackChannel = query.get("slackChannel") ?? defaults.slackChannel;
  const appDir = query.get("appDir") ?? defaults.appDir;
  const queryPeriods = query.getAll("periods").filter((p): p is Period => p === "daily" || p === "weekly");
  const periods: Period[] = hasQuery ? queryPeriods : ["daily"];

  const installedRaw = query.get("installed") ?? undefined;
  const installed = installedRaw !== undefined && /^\d+$/.test(installedRaw) ? Number(installedRaw) : undefined;

  const canPreview = storeDir !== "" && appDir !== "" && periods.length > 0;
  const generated = canPreview ? generateSkills({ storeDir, slackChannel, appDir, periods }) : undefined;

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 class="text-xl font-semibold">スキル生成</h1>

      {installed !== undefined && (
        <div class="rounded-md border border-success/50 bg-success/15 text-success px-3 py-2 text-sm">
          <p>{`${installed} 件のファイルをインストールしました`}</p>
          <p>
            フックを有効にするには、フックの断片を ~/.claude/settings.json の hooks に足してください
            （アプリは settings.json を書き換えません）。
          </p>
        </div>
      )}

      <form method="get" action="/skills" class={sectionClass}>
        <label class={labelClass}>
          <span>保存先フォルダ (storeDir)</span>
          <input type="text" name="storeDir" value={storeDir} class={inputClass} />
        </label>
        <label class={labelClass}>
          <span>Slack チャンネル</span>
          <input type="text" name="slackChannel" value={slackChannel} class={inputClass} />
        </label>
        <label class={labelClass}>
          <span>アプリのフォルダ (appDir)</span>
          <input type="text" name="appDir" value={appDir} class={inputClass} />
        </label>
        <fieldset class="flex gap-4 text-sm">
          <legend class="mb-1">ダイジェストの期間</legend>
          {(["daily", "weekly"] as const).map((p) => (
            <label key={p} class="flex items-center gap-1">
              <input type="checkbox" name="periods" value={p} checked={periods.includes(p)} />
              {PERIOD_LABELS[p]}
            </label>
          ))}
        </fieldset>
        <div>
          <button type="submit" class={buttonClass}>
            プレビュー
          </button>
        </div>
      </form>

      {generated && (
        <section class={sectionClass}>
          <h2 class="text-sm font-semibold text-muted-foreground">プレビュー</h2>
          {generated.files.map((f) => (
            <div key={f.path} class="flex flex-col gap-1">
              <p class="break-all font-mono text-xs font-semibold">~/{f.path}</p>
              <pre class={preClass}>{f.content}</pre>
            </div>
          ))}
          <div class="flex flex-col gap-1">
            <p class="text-sm font-semibold">フックの断片</p>
            <p class={hintClass}>
              ~/.claude/settings.json の hooks に足してください。アプリは settings.json を書き換えません。
            </p>
            <pre class={preClass}>{generated.hookSnippet}</pre>
          </div>
        </section>
      )}

      {canPreview && (
        <form method="post" action="/api/skills/install" class={sectionClass}>
          <input type="hidden" name="storeDir" value={storeDir} />
          <input type="hidden" name="slackChannel" value={slackChannel} />
          <input type="hidden" name="appDir" value={appDir} />
          {periods.map((p) => (
            <input key={p} type="hidden" name="periods" value={p} />
          ))}
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" value="on" />
            ホームの .claude 配下にファイルを書くことを確認しました
          </label>
          <div>
            <button type="submit" class={buttonClass}>
              インストール
            </button>
          </div>
        </form>
      )}

      <section class={sectionClass}>
        <h2 class="text-sm font-semibold text-muted-foreground">定期実行について</h2>
        <p class="text-sm">
          Claude Desktop の定期実行タスクは、Desktop の画面で頻度を選びます。タスクは Claude Desktop
          アプリが起動していて、PC が起きている間だけ動きます。
        </p>
      </section>
    </div>
  );
}
