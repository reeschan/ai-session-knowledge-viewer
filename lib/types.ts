export type LogEntry = {
  id: string;
  client: "claude-code" | "codex";
  source: "markdown" | "claude-code" | "codex";
  title: string;
  sessionId: string;
  project: string;
  branch: string;
  startedAt: string;
  /** ログの最終更新時刻（ローカル時刻の `YYYY-MM-DD HH:mm:ss`）。ファイルの mtime ではなく中身から取る。 */
  updatedAt: string;
  filePath: string;
  mtimeMs: number;
  finalResponse: string;
};

export type Analysis = {
  id: string;
  mtimeMs: number;
  summary: string;
  category: string;
  tags: string[];
  learnings: string[];
};

export const CATEGORIES = [
  "実装",
  "バグ修正",
  "レビュー",
  "設計・調査",
  "インフラ・環境構築",
  "ツール・設定",
  "その他",
] as const;
