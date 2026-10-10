import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

import { loadAnalyses, saveAnalyses } from "../lib/analysis";
import { summarize } from "../lib/llm";
import { listLogs, readConversation } from "../lib/sources";
import type { Analysis, LogEntry } from "../lib/types";

const CONVERSATION_MAX_CHARS = 6000;

function parseLimit(argv: string[]): number | null {
  const index = argv.indexOf("--limit");
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value) throw new Error("--limit requires a number");
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("--limit must be a positive integer");
  return parsed;
}

async function analyzeLog(log: LogEntry): Promise<Analysis> {
  const conversation = await readConversation(log, CONVERSATION_MAX_CHARS);
  const result = await summarize({
    title: log.title,
    project: log.project,
    client: log.client,
    finalResponse: log.finalResponse,
    conversation,
  });
  return {
    id: log.id,
    mtimeMs: log.mtimeMs,
    summary: result.summary,
    category: result.category,
    tags: result.tags,
    learnings: result.learnings,
  };
}

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));

  const logs = await listLogs();
  const analyses = await loadAnalyses();

  const pending = logs.filter((log) => {
    const existing = analyses[log.id];
    return !existing || existing.mtimeMs !== log.mtimeMs;
  });

  pending.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const selected = limit === null ? pending : pending.slice(0, limit);

  if (selected.length === 0) {
    console.log("No pending logs to analyze.");
    return;
  }

  for (let i = 0; i < selected.length; i++) {
    const log = selected[i];
    try {
      const analysis = await analyzeLog(log);
      analyses[log.id] = analysis;
      await saveAnalyses(analyses);
      console.log(`[${i + 1}/${selected.length}] ${log.id} -> ${analysis.category}`);
    } catch (error) {
      console.error(`[${i + 1}/${selected.length}] ${log.id} failed:`, error instanceof Error ? error.message : error);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
