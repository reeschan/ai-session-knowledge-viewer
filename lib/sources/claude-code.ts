import { readdir } from "node:fs/promises";
import path from "node:path";
import type { LogEntry } from "../types";
import { asRecord, asString, firstLine, lastPathSegment, readJsonLines, toLocalDateTime, type JsonRecord } from "./jsonl";
import type { SourceAdapter } from "./types";

const TITLE_MAX = 80;

/** type: "text" のブロックの text を改行でつなぐ（thinking などは除く）。 */
function textBlocks(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const texts: string[] = [];
  for (const block of content) {
    const record = asRecord(block);
    const text = record?.type === "text" ? asString(record.text) : undefined;
    if (text !== undefined) texts.push(text);
  }
  return texts.join("\n");
}

/**
 * 人間の発言の本文。message.content が文字列、または text ブロックの配列のものだけ。
 * tool_result だけの行、空の行、`<` で始まる注入文（<command-name> など）は null。
 */
function humanText(row: JsonRecord): string | null {
  if (row.type !== "user") return null;
  const content = asRecord(row.message)?.content;
  const text = typeof content === "string" ? content : textBlocks(content);
  if (text.trim() === "" || text.trimStart().startsWith("<")) return null;
  return text;
}

/** `<sessionId>.jsonl` だけを深さ 2 で集める（subagents など下の階層は読まない）。 */
async function listClaudeCodeFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const project of await readdir(dir, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    const projectDir = path.join(dir, project.name);
    try {
      for (const entry of await readdir(projectDir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(path.join(projectDir, entry.name));
      }
    } catch (error) {
      console.warn(`ログのフォルダを読めません: ${projectDir}: ${String(error)}`);
    }
  }
  return files;
}

async function parseClaudeCodeLog(filePath: string, mtimeMs: number): Promise<LogEntry | null> {
  let sessionId: string | undefined;
  let aiTitle = "";
  let firstHuman: string | null = null;
  let project: string | undefined;
  let branch: string | undefined;
  let startedIso: string | undefined;
  let startedMs = Infinity;
  let finalResponse = "";

  await readJsonLines(filePath, (row) => {
    if (row.isSidechain === true) return;
    sessionId ??= asString(row.sessionId);
    if (row.type === "ai-title") {
      const title = asString(row.aiTitle)?.trim();
      if (title) aiTitle = title;
    }
    if (project === undefined) {
      const cwd = asString(row.cwd);
      if (cwd !== undefined) project = lastPathSegment(cwd);
    }
    if (branch === undefined) branch = asString(row.gitBranch);
    const timestamp = asString(row.timestamp);
    if (timestamp !== undefined) {
      const ms = Date.parse(timestamp);
      if (!Number.isNaN(ms) && ms < startedMs) {
        startedMs = ms;
        startedIso = timestamp;
      }
    }
    firstHuman ??= humanText(row);
    if (row.type === "assistant") finalResponse = textBlocks(asRecord(row.message)?.content);
  });

  if (firstHuman === null) return null;
  const id = sessionId ?? path.basename(filePath, ".jsonl");
  return {
    id: `cc-${id}`,
    client: "claude-code",
    source: "claude-code",
    title: aiTitle || firstLine(firstHuman, TITLE_MAX),
    sessionId: id,
    project: project ?? "",
    branch: branch ?? "",
    startedAt: startedIso ? toLocalDateTime(startedIso) : "",
    filePath,
    mtimeMs,
    finalResponse,
  };
}

/** `ユーザー:` / `アシスタント:` の行を時系列に並べ、maxChars を超えたら読むのをやめる。 */
async function readClaudeCodeConversation(filePath: string, maxChars: number): Promise<string> {
  const lines: string[] = [];
  let length = 0;
  await readJsonLines(filePath, (row) => {
    if (row.isSidechain === true) return;
    let line: string | null = null;
    const human = humanText(row);
    if (human !== null) {
      line = `ユーザー: ${human}`;
    } else if (row.type === "assistant") {
      const text = textBlocks(asRecord(row.message)?.content);
      if (text !== "") line = `アシスタント: ${text}`;
    }
    if (line === null) return;
    lines.push(line);
    length += line.length + 1;
    if (length >= maxChars) return false;
  });
  return lines.join("\n").slice(0, maxChars);
}

export const claudeCodeAdapter: SourceAdapter = {
  listFiles: listClaudeCodeFiles,
  parseFile: parseClaudeCodeLog,
  readConversation: (entry, maxChars) => readClaudeCodeConversation(entry.filePath, maxChars),
};
