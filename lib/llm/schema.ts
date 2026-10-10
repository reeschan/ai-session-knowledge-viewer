import { z } from "zod";
import { CATEGORIES } from "../types";

export type Category = (typeof CATEGORIES)[number];

export const SummarySchema = z.object({
  summary: z.string().min(1),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string()),
  learnings: z.array(z.string()),
});

export type SummaryInput = {
  title: string;
  project: string;
  client: string;
  finalResponse: string;
  conversation: string;
};

export type SummaryResult = {
  summary: string;
  category: Category;
  tags: string[];
  learnings: string[];
};

const FINAL_RESPONSE_MAX_CHARS = 3000;

export function systemPrompt(): string {
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

export function userPrompt(input: SummaryInput): string {
  return [
    "タイトル: " + input.title,
    "プロジェクト: " + input.project,
    "クライアント: " + input.client,
    "",
    "最終応答:",
    input.finalResponse.slice(0, FINAL_RESPONSE_MAX_CHARS),
    "",
    "会話の先頭:",
    input.conversation,
  ].join("\n");
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** LLM の生の結果を検証する。固定外のカテゴリは「その他」、配列の文字列以外は捨てる。summary が空なら例外。 */
export function toSummaryResult(raw: unknown): SummaryResult {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  if (!summary) throw new Error("summary missing");
  return {
    summary,
    category: isCategory(obj.category) ? obj.category : "その他",
    tags: stringArray(obj.tags),
    learnings: stringArray(obj.learnings),
  };
}
