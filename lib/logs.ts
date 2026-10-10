import { open, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { LogEntry } from "./types";

const CONVERSATION_HEADING = "## 会話";
const FINAL_RESPONSE_HEADING = "### 最終応答";

function stripBackticks(value: string): string {
  return value.replace(/^`(.*)`$/, "$1");
}

function lastPathSegment(value: string): string {
  const segments = value.split(/[\\/]/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : value;
}

function parseMetadata(lines: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = stripBackticks(match[2].trim());
    if (key === "セッション ID") meta.sessionId = value;
    else if (key === "プロジェクト") meta.project = lastPathSegment(value);
    else if (key === "ブランチ") meta.branch = value;
    else if (key === "開始") meta.startedAt = value;
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

const HEAD_CHUNK_SIZE = 64 * 1024;

async function readHeadText(filePath: string): Promise<string> {
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

async function readLogFile(filePath: string, client: "claude-code" | "codex"): Promise<LogEntry> {
  const info = await stat(filePath);
  const content = await readHeadText(filePath);
  const lines = content.split(/\r?\n/);

  const title = lines.find((line) => line.startsWith("# "))?.slice(2).trim() ?? "";
  const meta = parseMetadata(lines);
  const finalResponse = extractFinalResponse(content);

  return {
    id: path.basename(filePath, ".md"),
    client,
    title,
    sessionId: meta.sessionId ?? "",
    project: meta.project ?? "",
    branch: meta.branch ?? "",
    startedAt: meta.startedAt ?? "",
    filePath,
    mtimeMs: info.mtimeMs,
    finalResponse,
  };
}

async function listClientLogs(logRoot: string, client: "claude-code" | "codex"): Promise<LogEntry[]> {
  const logsDir = path.join(logRoot, client, "logs");
  const entries = await readdir(logsDir, { withFileTypes: true });
  const monthDirs = entries.filter((entry) => entry.isDirectory());

  const logs: LogEntry[] = [];
  for (const monthDir of monthDirs) {
    const files = await readdir(path.join(logsDir, monthDir.name), { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".md") || file.name === "INDEX.md") continue;
      logs.push(await readLogFile(path.join(logsDir, monthDir.name, file.name), client));
    }
  }
  return logs;
}

export async function listLogs(): Promise<LogEntry[]> {
  const logRoot = process.env.LOG_ROOT;
  if (!logRoot) throw new Error("LOG_ROOT is not set");

  const [claudeLogs, codexLogs] = await Promise.all([
    listClientLogs(logRoot, "claude-code"),
    listClientLogs(logRoot, "codex"),
  ]);

  return [...claudeLogs, ...codexLogs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function readLogHead(filePath: string): Promise<string> {
  return readHeadText(filePath);
}

export async function readLogBody(filePath: string, maxChars: number): Promise<string> {
  const content = await readFile(filePath, "utf8");
  const index = content.indexOf(CONVERSATION_HEADING);
  const body = index === -1 ? "" : content.slice(index + CONVERSATION_HEADING.length);
  return body.slice(0, maxChars);
}
