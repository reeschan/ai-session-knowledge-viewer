import { listLogs } from "./logs";
import { loadAnalyses } from "./analysis";
import type { Analysis, LogEntry } from "./types";

export type KnowledgeEntry = LogEntry & { analysis?: Analysis };

export async function getKnowledge(): Promise<KnowledgeEntry[]> {
  const [logs, analyses] = await Promise.all([listLogs(), loadAnalyses()]);
  return logs.map((log) => ({
    ...log,
    analysis: analyses[log.id],
  }));
}
