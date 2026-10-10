import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../settings";
import type { LogEntry } from "../types";

/** entry が null の行は「ログではないファイル」（再解析を避けるために記録する）。 */
type CacheRow = { mtimeMs: number; size: number; entry: LogEntry | null };
type CacheFile = { version: 1; entries: Record<string, CacheRow> };

function cachePath(): string {
  return path.join(dataDir(), "log-index.json");
}

/**
 * 解析結果のキャッシュ (<dataDir>/log-index.json)。キーはファイルパス、mtimeMs と size が同じなら再解析しない。
 * 読み書きに失敗してもキャッシュなしで続ける。save() では今回の走査で見なかった（消えた）ファイルの行を捨てる。
 */
export class LogCache {
  private old: Record<string, CacheRow> = {};
  private next: Record<string, CacheRow> = {};
  private dirty = false;

  static async load(): Promise<LogCache> {
    const cache = new LogCache();
    try {
      const parsed = JSON.parse(await readFile(cachePath(), "utf8")) as Partial<CacheFile>;
      if (parsed.version === 1 && parsed.entries && typeof parsed.entries === "object") {
        cache.old = parsed.entries;
      } else {
        cache.dirty = true;
      }
    } catch {
      cache.dirty = true;
    }
    return cache;
  }

  /** キャッシュが有効なら entry（ログでないファイルは null）、無効なら undefined。 */
  get(filePath: string, mtimeMs: number, size: number): LogEntry | null | undefined {
    const row = this.old[filePath];
    if (!row || row.mtimeMs !== mtimeMs || row.size !== size) return undefined;
    this.next[filePath] = row;
    return row.entry;
  }

  set(filePath: string, mtimeMs: number, size: number, entry: LogEntry | null): void {
    this.next[filePath] = { mtimeMs, size, entry };
    this.dirty = true;
  }

  async save(): Promise<void> {
    const removed = Object.keys(this.old).some((key) => !(key in this.next));
    if (!this.dirty && !removed) return;
    const file = cachePath();
    const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    try {
      await mkdir(path.dirname(file), { recursive: true });
      const data: CacheFile = { version: 1, entries: this.next };
      await writeFile(tmp, JSON.stringify(data), "utf8");
      await rename(tmp, file);
    } catch (error) {
      console.warn(`log-index.json を保存できません: ${String(error)}`);
      await unlink(tmp).catch(() => {});
    }
  }
}
