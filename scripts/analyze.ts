process.loadEnvFile(".env.local");

import { loadAnalyses, saveAnalyses } from "../lib/analysis";
import { listLogs, readLogBody } from "../lib/logs";
import { CATEGORIES } from "../lib/types";
import type { Analysis, LogEntry } from "../lib/types";
import OpenAI from "openai";

function parseLimit(argv: string[]): number | null {
  const index = argv.indexOf("--limit");
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value) throw new Error("--limit requires a number");
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("--limit must be a positive integer");
  return parsed;
}

function buildPrompt(log: LogEntry, body: string): string {
  const finalResponse = log.finalResponse.slice(0, 3000);
  return [
    "タイトル: " + log.title,
    "プロジェクト: " + log.project,
    "クライアント: " + log.client,
    "",
    "最終応答:",
    finalResponse,
    "",
    "会話の先頭:",
    body,
  ].join("\n");
}

function systemPrompt(): string {
  const categories = CATEGORIES.join(" / ");
  return [
    "あなたは会話ログの分析アシスタントです。",
    "提供されたログを読み、JSON のみで回答してください。",
    "JSON のキーは summary, category, tags, learnings のみです。",
    "summary: 日本語で 3〜5 文のサマリー。",
    "category: " + categories + " のうち 1 つ。",
    "tags: 3〜6 個の短いキーワードの配列。",
    "learnings: 再利用できる知見・ハマりどころの配列 (0〜5 個)。",
    "JSON 以外のテキストは一切出力しないでください。",
  ].join("\n");
}

function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("JSON not found");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function validate(raw: Record<string, unknown>): Analysis {
  const summary = typeof raw.summary === "string" ? raw.summary : "";
  const category = typeof raw.category === "string" && CATEGORIES.includes(raw.category as (typeof CATEGORIES)[number])
    ? raw.category
    : "その他";
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : [];
  const learnings = Array.isArray(raw.learnings)
    ? raw.learnings.filter((l): l is string => typeof l === "string")
    : [];

  if (!summary) throw new Error("summary missing");
  return {
    id: "",
    mtimeMs: 0,
    summary,
    category,
    tags,
    learnings,
  };
}

async function analyzeLog(client: OpenAI, log: LogEntry): Promise<Analysis> {
  const body = await readLogBody(log.filePath, 6000);
  const prompt = buildPrompt(log, body);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: process.env.LLM_MODEL ?? "qwen3.8-27b-exl3-2.0bpw",
        temperature: 0.2,
        max_tokens: 3000,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: prompt },
        ],
      });
      const text = response.choices[0]?.message?.content ?? "";
      const analysis = validate(extractJson(text));
      return {
        id: log.id,
        mtimeMs: log.mtimeMs,
        summary: analysis.summary,
        category: analysis.category,
        tags: analysis.tags,
        learnings: analysis.learnings,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 1) continue;
    }
  }
  throw lastError ?? new Error("unknown error");
}

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
  });

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
      const analysis = await analyzeLog(client, log);
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
