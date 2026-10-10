import OpenAI from "openai";
import type { Settings } from "../settings";
import { systemPrompt, toSummaryResult, userPrompt, type SummaryInput, type SummaryResult } from "./schema";

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("JSON not found");
  return JSON.parse(text.slice(start, end + 1));
}

export async function summarizeWithOpenAI(
  input: SummaryInput,
  config: Settings["llm"]["openai"],
): Promise<SummaryResult> {
  const client = new OpenAI({ baseURL: config.baseUrl, apiKey: config.apiKey || "local" });
  const response = await client.chat.completions.create({
    model: config.model,
    temperature: 0.2,
    max_tokens: 3000,
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(input) },
    ],
  });
  const text = response.choices[0]?.message?.content ?? "";
  return toSummaryResult(extractJson(text));
}
