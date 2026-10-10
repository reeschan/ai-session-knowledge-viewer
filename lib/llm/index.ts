import { effectiveSettings, type Settings } from "../settings";
import { summarizeWithAnthropic } from "./anthropic";
import { summarizeWithOpenAI } from "./openai";
import type { SummaryInput, SummaryResult } from "./schema";

export type { Category, SummaryInput, SummaryResult } from "./schema";

const MAX_ATTEMPTS = 2;

function summarizeOnce(input: SummaryInput, llm: Settings["llm"]): Promise<SummaryResult> {
  switch (llm.provider) {
    case "anthropic":
      return summarizeWithAnthropic(input, llm.anthropic);
    case "openai-compatible":
      return summarizeWithOpenAI(input, llm.openai);
  }
}

/** 設定の provider で LLM を選んで要約する。失敗したら 1 回だけ再試行する。 */
export async function summarize(input: SummaryInput, llm?: Settings["llm"]): Promise<SummaryResult> {
  const config = llm ?? (await effectiveSettings()).llm;
  let lastError: unknown = new Error("unknown error");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await summarizeOnce(input, config);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
