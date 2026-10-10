import { effectiveSettings } from "@/lib/settings";
import { generateSkills, type Period } from "@/lib/skills";

export const dynamic = "force-dynamic";

type Query = { [key: string]: string | string[] | undefined };

const inputClass =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelClass = "flex flex-col gap-1 text-sm";
const hintClass = "text-xs text-zinc-500 dark:text-zinc-400";
const sectionClass =
  "flex flex-col gap-3 rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";
const preClass =
  "overflow-x-auto whitespace-pre-wrap rounded border border-zinc-200 bg-zinc-100 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950";
const buttonClass =
  "rounded bg-zinc-900 px-4 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const PERIOD_LABELS: Record<Period, string> = { daily: "日次 (daily)", weekly: "週次 (weekly)" };

export default async function SkillsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const raw = await searchParams;
  const defaults = (await effectiveSettings()).skills;
  const hasQuery = ["storeDir", "slackChannel", "appDir", "periods"].some((k) => raw[k] !== undefined);

  const storeDir = first(raw.storeDir) ?? defaults.storeDir;
  const slackChannel = first(raw.slackChannel) ?? defaults.slackChannel;
  const appDir = first(raw.appDir) ?? defaults.appDir;
  const queryPeriods = (Array.isArray(raw.periods) ? raw.periods : raw.periods ? [raw.periods] : []).filter(
    (p): p is Period => p === "daily" || p === "weekly",
  );
  const periods: Period[] = hasQuery ? queryPeriods : ["daily"];

  const installedRaw = first(raw.installed);
  const installed = installedRaw !== undefined && /^\d+$/.test(installedRaw) ? Number(installedRaw) : undefined;

  const canPreview = storeDir !== "" && appDir !== "" && periods.length > 0;
  const generated = canPreview ? generateSkills({ storeDir, slackChannel, appDir, periods }) : undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-semibold">スキル生成</h1>

      {installed !== undefined && (
        <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <p>{`${installed} 件のファイルをインストールしました`}</p>
          <p>
            フックを有効にするには、フックの断片を ~/.claude/settings.json の hooks に足してください
            （アプリは settings.json を書き換えません）。
          </p>
        </div>
      )}

      <form method="get" action="/skills" className={sectionClass}>
        <label className={labelClass}>
          <span>保存先フォルダ (storeDir)</span>
          <input type="text" name="storeDir" defaultValue={storeDir} className={inputClass} />
        </label>
        <label className={labelClass}>
          <span>Slack チャンネル</span>
          <input type="text" name="slackChannel" defaultValue={slackChannel} className={inputClass} />
        </label>
        <label className={labelClass}>
          <span>アプリのフォルダ (appDir)</span>
          <input type="text" name="appDir" defaultValue={appDir} className={inputClass} />
        </label>
        <fieldset className="flex gap-4 text-sm">
          <legend className="mb-1">ダイジェストの期間</legend>
          {(["daily", "weekly"] as const).map((p) => (
            <label key={p} className="flex items-center gap-1">
              <input type="checkbox" name="periods" value={p} defaultChecked={periods.includes(p)} />
              {PERIOD_LABELS[p]}
            </label>
          ))}
        </fieldset>
        <div>
          <button type="submit" className={buttonClass}>
            プレビュー
          </button>
        </div>
      </form>

      {generated && (
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">プレビュー</h2>
          {generated.files.map((f) => (
            <div key={f.path} className="flex flex-col gap-1">
              <p className="break-all font-mono text-xs font-semibold">~/{f.path}</p>
              <pre className={preClass}>{f.content}</pre>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">フックの断片</p>
            <p className={hintClass}>
              ~/.claude/settings.json の hooks に足してください。アプリは settings.json を書き換えません。
            </p>
            <pre className={preClass}>{generated.hookSnippet}</pre>
          </div>
        </section>
      )}

      {canPreview && (
        <form method="post" action="/api/skills/install" className={sectionClass}>
          <input type="hidden" name="storeDir" value={storeDir} />
          <input type="hidden" name="slackChannel" value={slackChannel} />
          <input type="hidden" name="appDir" value={appDir} />
          {periods.map((p) => (
            <input key={p} type="hidden" name="periods" value={p} />
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" value="on" />
            ホームの .claude 配下にファイルを書くことを確認しました
          </label>
          <div>
            <button type="submit" className={buttonClass}>
              インストール
            </button>
          </div>
        </form>
      )}

      <section className={sectionClass}>
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">定期実行について</h2>
        <p className="text-sm">
          Claude Desktop の定期実行タスクは、Desktop の画面で頻度を選びます。タスクは Claude Desktop
          アプリが起動していて、PC が起きている間だけ動きます。
        </p>
      </section>
    </div>
  );
}
