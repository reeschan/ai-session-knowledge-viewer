import { loadAnalyses } from "./analysis";
import { listLogs } from "./sources";

type Period = "daily" | "weekly";

const PERIOD_MS: Record<Period, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

const PERIOD_LABEL: Record<Period, string> = {
  daily: "日次ダイジェスト",
  weekly: "週次ダイジェスト",
};

const MAX_LEARNINGS = 10;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const index = trimmed.indexOf("。");
  return index === -1 ? trimmed : trimmed.slice(0, index + 1);
}

export async function buildDigest({ period, now }: { period: Period; now: Date }): Promise<string> {
  const end = now.getTime();
  const start = end - PERIOD_MS[period];

  const [logs, analyses] = await Promise.all([listLogs(), loadAnalyses()]);
  const targets = logs
    .filter((log) => log.mtimeMs >= start && log.mtimeMs < end)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const lines: string[] = [`# ${PERIOD_LABEL[period]} ${formatLocal(new Date(start))} 〜 ${formatLocal(now)}`, ""];

  const analyzed = targets.filter((log) => analyses[log.id]).length;
  const pending = targets.length - analyzed;

  if (targets.length === 0) {
    lines.push("セッション: 0 件", "", "この期間のセッションはありません。");
    return lines.join("\n") + "\n";
  }

  lines.push(`セッション: ${targets.length} 件（解析済み ${analyzed} / 未解析 ${pending}）`, "");

  const counts = new Map<string, number>();
  for (const log of targets) {
    const category = analyses[log.id]?.category;
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  lines.push("## カテゴリ別", "");
  for (const [category, count] of sorted) lines.push(`- ${category}: ${count}`);
  if (pending > 0) lines.push(`- 未解析: ${pending}`);
  lines.push("");

  lines.push("## セッション", "");
  for (const log of targets) {
    const analysis = analyses[log.id];
    const summary = analysis ? firstSentence(analysis.summary) : "未解析";
    lines.push(`- [${log.project}] ${log.title}（${log.client}）— ${summary}`);
  }
  lines.push("");

  const learnings: string[] = [];
  for (const log of targets) {
    for (const learning of analyses[log.id]?.learnings ?? []) {
      learnings.push(`- ${learning}（${log.title}）`);
    }
  }
  lines.push("## 学び", "");
  lines.push(...learnings.slice(0, MAX_LEARNINGS));

  return lines.join("\n") + "\n";
}
