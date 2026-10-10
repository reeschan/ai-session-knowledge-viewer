import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function lastPathSegment(value: string): string {
  const segments = value.split(/[\\/]/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : value;
}

/** 本文の 1 行目を前後の空白を除いて max 文字まで。 */
export function firstLine(text: string, max: number): string {
  return (text.split(/\r?\n/)[0] ?? "").trim().slice(0, max);
}

/** ISO 時刻をローカル時刻の `YYYY-MM-DD HH:mm:ss`（Markdown ログと同じ形）にする。不正な値は空文字。 */
export function toLocalDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * JSONL を 1 行ずつ読む。壊れた行と JSON でない行は飛ばす。
 * onRow が false を返すと読むのをやめる（会話の取り出しで上限に達したとき）。
 */
export function readJsonLines(filePath: string, onRow: (row: JsonRecord) => boolean | void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let stopped = false;
    // 読み取りエラー（ファイルが消えた・開けないなど）は readline が rl の error として出すので、ここで reject する。
    rl.once("error", (error) => {
      stopped = true;
      rl.close();
      reject(error);
    });
    rl.on("line", (line) => {
      if (stopped || !line.trim()) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return;
      }
      const row = asRecord(parsed);
      if (!row) return;
      if (onRow(row) === false) {
        stopped = true;
        rl.close();
      }
    });
    rl.once("close", () => {
      stream.destroy();
      resolve();
    });
  });
}
