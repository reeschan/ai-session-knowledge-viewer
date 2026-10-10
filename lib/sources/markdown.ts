import { open, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { LogEntry } from "../types";
import type { SourceAdapter } from "./types";

const CONVERSATION_HEADING = "## 会話";
const FINAL_RESPONSE_HEADING = "### 最終応答";
const HEAD_CHUNK_SIZE = 64 * 1024;

function stripBackticks(value: string): string {
  return value.replace(/^`(.*)`$/, "$1");
}

function lastPathSegment(value: string): string {
  const segments = value.split(/[\\/]/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : value;
}

type HeaderMeta = {
  sessionId?: string;
  project?: string;
  branch?: string;
  startedAt?: string;
  hasSessionRow: boolean;
  isCodex: boolean;
};

function parseMetadata(lines: string[]): HeaderMeta {
  const meta: HeaderMeta = { hasSessionRow: false, isCodex: false };
  for (const line of lines) {
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = stripBackticks(match[2].trim());
    if (key === "セッション ID") {
      meta.hasSessionRow = true;
      meta.sessionId = value;
    } else if (key === "プロジェクト") meta.project = lastPathSegment(value);
    else if (key === "ブランチ") meta.branch = value;
    else if (key === "開始") meta.startedAt = value;
    else if (key === "Codex") meta.isCodex = true;
  }
  return meta;
}

function extractFinalResponse(content: string): string {
  const start = content.indexOf(FINAL_RESPONSE_HEADING);
  if (start === -1) return "";
  const after = content.slice(start + FINAL_RESPONSE_HEADING.length);
  const nextHeading = after.indexOf("\n### ");
  return (nextHeading === -1 ? after : after.slice(0, nextHeading)).trim();
}

/** `## 会話` の手前までだけを読む（会話本文は大きいので読まない）。 */
export async function readHeadText(filePath: string): Promise<string> {
  const handle = await open(filePath, "r");
  try {
    const marker = Buffer.from(CONVERSATION_HEADING, "utf8");
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const buf = Buffer.alloc(HEAD_CHUNK_SIZE);
      const { bytesRead } = await handle.read(buf, 0, HEAD_CHUNK_SIZE, total);
      if (bytesRead === 0) break;
      chunks.push(buf.subarray(0, bytesRead));
      total += bytesRead;
      const all = Buffer.concat(chunks);
      const index = all.indexOf(marker);
      if (index !== -1) return all.subarray(0, index).toString("utf8");
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await handle.close();
  }
}

/** ヘッダに `| セッション ID |` の行が無いファイル（台帳・SKILL.md など）はログでないので null。 */
export async function parseMarkdownLog(filePath: string, mtimeMs: number): Promise<LogEntry | null> {
  const content = await readHeadText(filePath);
  const lines = content.split(/\r?\n/);
  const meta = parseMetadata(lines);
  if (!meta.hasSessionRow) return null;

  const title = lines.find((line) => line.startsWith("# "))?.slice(2).trim() ?? "";
  return {
    id: path.basename(filePath, ".md"),
    client: meta.isCodex ? "codex" : "claude-code",
    source: "markdown",
    title,
    sessionId: meta.sessionId ?? "",
    project: meta.project ?? "",
    branch: meta.branch ?? "",
    startedAt: meta.startedAt ?? "",
    filePath,
    mtimeMs,
    finalResponse: extractFinalResponse(content),
  };
}

/** dir 以下を再帰的に走査し、`.md`（INDEX.md を除く）を集める。 */
async function listMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "INDEX.md") {
      files.push(full);
    }
  }
  return files;
}

/** `## 会話` の見出し行の次の行から maxChars 文字。 */
export async function readMarkdownConversation(filePath: string, maxChars: number): Promise<string> {
  const content = await readFile(filePath, "utf8");
  const index = content.indexOf(CONVERSATION_HEADING);
  if (index === -1) return "";
  const lineEnd = content.indexOf("\n", index);
  const body = lineEnd === -1 ? "" : content.slice(lineEnd + 1);
  return body.slice(0, maxChars);
}

/** 旧 lib/logs.ts の readLogBody と同じ（`## 会話` の直後から maxChars 文字）。scripts/analyze.ts 互換用。 */
export async function readLogBody(filePath: string, maxChars: number): Promise<string> {
  const content = await readFile(filePath, "utf8");
  const index = content.indexOf(CONVERSATION_HEADING);
  const body = index === -1 ? "" : content.slice(index + CONVERSATION_HEADING.length);
  return body.slice(0, maxChars);
}

export const markdownAdapter: SourceAdapter = {
  listFiles: listMarkdownFiles,
  parseFile: parseMarkdownLog,
  readConversation: (entry, maxChars) => readMarkdownConversation(entry.filePath, maxChars),
};
