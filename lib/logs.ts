import { readdir, readFile, stat } from "node:fs/promises";
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

async function readLogFile(filePath: string, client: "claude-code" | "codex"): Promise<LogEntry> {
  const info = await stat(filePath);
  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");

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
  const content = await readFile(filePath, "utf8");
  const index = content.indexOf(CONVERSATION_HEADING);
  return index === -1 ? content : content.slice(0, index);
}

export async function readLogBody(filePath: string, maxChars: number): Promise<string> {
  const content = await readFile(filePath, "utf8");
  const index = content.indexOf(CONVERSATION_HEADING);
  const body = index === -1 ? "" : content.slice(index + CONVERSATION_HEADING.length);
  return body.slice(0, maxChars);
}
