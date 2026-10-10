import { stat } from "node:fs/promises";
import { effectiveSettings, expandHome, type SourceType } from "../settings";
import type { LogEntry } from "../types";
import { LogCache } from "./cache";
import { claudeCodeAdapter } from "./claude-code";
import { codexAdapter } from "./codex";
import { markdownAdapter } from "./markdown";
import type { SourceAdapter } from "./types";

export type { SourceAdapter } from "./types";

/** アダプタが無い種類のソースはスキップする。 */
const ADAPTERS: Partial<Record<SourceType, SourceAdapter>> = {
  markdown: markdownAdapter,
  "claude-code": claudeCodeAdapter,
  codex: codexAdapter,
};

const PARSE_CONCURRENCY = 16;

async function readSource(adapter: SourceAdapter, dir: string, cache: LogCache): Promise<LogEntry[]> {
  const files = await adapter.listFiles(dir);
  const results: (LogEntry | null)[] = new Array(files.length).fill(null);
  let cursor = 0;
  async function worker() {
    while (cursor < files.length) {
      const i = cursor++;
      const filePath = files[i];
      try {
        const info = await stat(filePath);
        const cached = cache.get(filePath, info.mtimeMs, info.size);
        if (cached !== undefined) {
          results[i] = cached;
          continue;
        }
        const entry = await adapter.parseFile(filePath, info.mtimeMs);
        cache.set(filePath, info.mtimeMs, info.size, entry);
        results[i] = entry;
      } catch (error) {
        console.warn(`ログを読めません: ${filePath}: ${String(error)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARSE_CONCURRENCY, files.length) }, worker));
  return results.filter((entry): entry is LogEntry => entry !== null);
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/** sessionId が同じエントリを 1 件にまとめる。markdown を最優先し、同順位なら先に読んだものを残す。 */
function dedupeBySession(entries: LogEntry[]): LogEntry[] {
  const chosen = new Map<string, LogEntry>();
  for (const entry of entries) {
    if (!entry.sessionId) continue;
    const current = chosen.get(entry.sessionId);
    if (!current || (current.source !== "markdown" && entry.source === "markdown")) {
      chosen.set(entry.sessionId, entry);
    }
  }
  return entries.filter((entry) => !entry.sessionId || chosen.get(entry.sessionId) === entry);
}

export async function listLogs(): Promise<LogEntry[]> {
  const settings = await effectiveSettings();
  const cache = await LogCache.load();
  const all: LogEntry[] = [];

  for (const source of settings.sources) {
    if (!source.enabled) continue;
    const adapter = ADAPTERS[source.type];
    if (!adapter) continue;
    const dir = expandHome(source.path);
    if (!(await isDirectory(dir))) {
      console.warn(`ログのソースが見つかりません: ${source.id} (${dir})`);
      continue;
    }
    try {
      all.push(...(await readSource(adapter, dir, cache)));
    } catch (error) {
      console.warn(`ログのソースを読めません: ${source.id} (${dir}): ${String(error)}`);
    }
  }

  await cache.save();
  return dedupeBySession(all).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function readConversation(entry: LogEntry, maxChars: number): Promise<string> {
  const adapter = ADAPTERS[entry.source];
  if (!adapter) throw new Error(`未対応のログの種類です: ${entry.source}`);
  return adapter.readConversation(entry, maxChars);
}
