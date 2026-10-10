import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Settings } from "../settings";
import { SummarySchema, systemPrompt, toSummaryResult, userPrompt, type SummaryInput, type SummaryResult } from "./schema";

const MAX_TOKENS = 16000;

/** 拒否時にサーバー側で別モデルへ切り替える fallbacks を付けるモデル。 */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export async function summarizeWithAnthropic(
  input: SummaryInput,
  config: Settings["llm"]["anthropic"],
): Promise<SummaryResult> {
  const client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl || undefined });
  const model = config.model;
  const system = systemPrompt();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt(input) }];

  const response = FALLBACK_MODELS.has(model)
    ? await client.beta.messages.parse({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        output_config: { format: betaZodOutputFormat(SummarySchema), effort: "low" },
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      })
    : await client.messages.parse({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        output_config: { format: zodOutputFormat(SummarySchema), effort: "low" },
      });

  if (response.stop_reason === "refusal") throw new Error("Claude が応答を拒否しました");
  if (response.parsed_output === null) throw new Error("構造化出力を取得できません (stop_reason: " + response.stop_reason + ")");
  return toSummaryResult(response.parsed_output);
}
