import type { LogEntry } from "../types";

/**
 * ソースの種類ごとのアダプタ。
 * listFiles で候補ファイルを集め、parseFile で 1 ファイルを LogEntry にする（ログでなければ null）。
 * parseFile の結果は lib/sources/cache.ts で mtime + size をキーにキャッシュされる。
 */
export type SourceAdapter = {
  listFiles(dir: string): Promise<string[]>;
  parseFile(filePath: string, mtimeMs: number): Promise<LogEntry | null>;
  readConversation(entry: LogEntry, maxChars: number): Promise<string>;
};
