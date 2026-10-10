export { listLogs, readConversation } from "./sources";
export type { SourceAdapter } from "./sources";
/** Markdown ログ専用。scripts/analyze.ts 互換（PBI-011 で readConversation に置き換える）。 */
export { readLogBody, readHeadText as readLogHead } from "./sources/markdown";
