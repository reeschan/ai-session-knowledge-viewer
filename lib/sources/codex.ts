import { readdir } from "node:fs/promises";
import path from "node:path";
import type { LogEntry } from "../types";
import { asRecord, asString, firstLine, lastPathSegment, readJsonLines, toLocalDateTime, type JsonRecord } from "./jsonl";
import type { SourceAdapter } from "./types";

const TITLE_MAX = 80;

/** 指定した種類（input_text / output_text）のブロックの text を配列で返す。 */
function contentTexts(content: unknown, blockType: string): string[] {
  if (!Array.isArray(content)) return [];
  const texts: string[] = [];
  for (const block of content) {
    const record = asRecord(block);
    const text = record?.type === blockType ? asString(record.text) : undefined;
    if (text !== undefined) texts.push(text);
  }
  return texts;
}

/** ユーザーの input_text のうち、注入文（`<` で始まるもの）を除いたもの。 */
function userTexts(payload: JsonRecord): string[] {
  return contentTexts(payload.content, "input_text").filter((text) => !text.trimStart().startsWith("<"));
}

/** path 以下を再帰的に走査し、`rollout-*.jsonl` を集める。 */
async function listCodexFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listCodexFiles(full)));
    } else if (entry.isFile() && entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl")) {
      files.push(full);
    }
  }
  return files;
}

async function parseCodexLog(filePath: string, mtimeMs: number): Promise<LogEntry | null> {
  let meta: JsonRecord | undefined;
  let metaTimestamp: string | undefined;
  let isSubagent = false;
  let title: string | null = null;
  let taskComplete: string | undefined;
  let lastAssistant = "";
  let updatedIso: string | undefined;
  let updatedMs = -Infinity;

  await readJsonLines(filePath, (row) => {
    const rowTimestamp = asString(row.timestamp);
    if (rowTimestamp !== undefined) {
      const ms = Date.parse(rowTimestamp);
      if (!Number.isNaN(ms) && ms > updatedMs) {
        updatedMs = ms;
        updatedIso = rowTimestamp;
      }
    }
    const payload = asRecord(row.payload);
    if (row.type === "session_meta" && meta === undefined && payload) {
      meta = payload;
      metaTimestamp = asString(row.timestamp);
      isSubagent = payload.thread_source === "subagent" || asRecord(payload.source)?.subagent != null;
      if (isSubagent) return false;
    }
    if (!payload) return;
    if (row.type === "response_item" && payload.type === "message") {
      if (payload.role === "user" && title === null) {
        const first = userTexts(payload)[0];
        if (first !== undefined && first.trim() !== "") title = firstLine(first, TITLE_MAX);
      } else if (payload.role === "assistant") {
        lastAssistant = contentTexts(payload.content, "output_text").join("\n");
      }
    }
    if (row.type === "event_msg" && payload.type === "task_complete") {
      const message = asString(payload.last_agent_message);
      if (message) taskComplete = message;
    }
  });

  if (!meta || isSubagent || title === null) return null;
  const sessionId = asString(meta.id);
  if (!sessionId) return null;
  const cwd = asString(meta.cwd) ?? "";
  const timestamp = asString(meta.timestamp) ?? metaTimestamp ?? "";
  const startedAt = toLocalDateTime(timestamp);
  return {
    id: `codex-${sessionId}`,
    client: "codex",
    source: "codex",
    title,
    sessionId,
    project: cwd ? lastPathSegment(cwd) : "",
    branch: asString(asRecord(meta.git)?.branch) ?? "",
    startedAt,
    updatedAt: (updatedIso ? toLocalDateTime(updatedIso) : "") || startedAt,
    filePath,
    mtimeMs,
    finalResponse: taskComplete ?? lastAssistant,
  };
}

/** role user（`<` で始まるものを除く）と assistant の本文を時系列に並べ、maxChars を超えたら読むのをやめる。 */
async function readCodexConversation(filePath: string, maxChars: number): Promise<string> {
  const lines: string[] = [];
  let length = 0;
  await readJsonLines(filePath, (row) => {
    const payload = asRecord(row.payload);
    if (row.type !== "response_item" || payload?.type !== "message") return;
    let line: string | null = null;
    if (payload.role === "user") {
      const text = userTexts(payload).join("\n");
      if (text !== "") line = `ユーザー: ${text}`;
    } else if (payload.role === "assistant") {
      const text = contentTexts(payload.content, "output_text").join("\n");
      if (text !== "") line = `アシスタント: ${text}`;
    }
    if (line === null) return;
    lines.push(line);
    length += line.length + 1;
    if (length >= maxChars) return false;
  });
  return lines.join("\n").slice(0, maxChars);
}

export const codexAdapter: SourceAdapter = {
  listFiles: listCodexFiles,
  parseFile: parseCodexLog,
  readConversation: (entry, maxChars) => readCodexConversation(entry.filePath, maxChars),
};
