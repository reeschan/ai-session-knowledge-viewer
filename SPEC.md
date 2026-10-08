# Knowledge Viewer — 仕様書

このPCに保存されている AI エージェント (Claude Code / Codex) の会話ログを読み込み、
ローカル LLM でサマリーとカテゴリを付けて、ナレッジとして閲覧できる Next.js アプリ。

## 前提

- 作業ディレクトリ: `D:\llm\knowledge-app` (このファイルがある場所)。ここ以外のファイルを作成・変更しないこと。
- ログの場所 (読み取り専用。絶対に書き込み・削除しないこと):
  - `C:\path\to\AI\claude-code\logs\<YYYY-MM>\*.md`
  - `C:\path\to\AI\codex\logs\<YYYY-MM>\*.md`
  - 各フォルダの `INDEX.md` はログではないので無視する。
- ローカル LLM (OpenAI 互換 API):
  - baseURL: `http://127.0.0.1:8888/v1`
  - apiKey: `local`
  - model: `qwen3.8-27b-exl3-2.0bpw`
  - これらは `.env.local` の `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` / `LOG_ROOT` から読む。`.env.local.example` も用意する。
- 技術: Next.js (App Router) + TypeScript + Tailwind CSS。DB は使わない。追加ライブラリは最小限 (`openai` パッケージのみ可)。
- npm は `npm` を使う。

## ログファイルの形式

```
# <タイトル>

| | |
| --- | --- |
| セッション ID | `<uuid>` |
| プロジェクト | `<パス>` |
| ブランチ | `<branch>` |
| 開始 | 2026-10-01 10:34:10 |
| 最終更新 | 2026-10-01 11:03:09 |
| Claude Code | v2.1.286 |      ← Codex のログでは "Codex"
...

## 作業サマリー

### 最終応答
<本文>

### 統計
| 項目 | 値 |
...

## 会話          ← これ以降が会話全文 (非常に長い場合がある。最大 700KB)
```

## データモデル (`lib/types.ts`)

```ts
type LogEntry = {
  id: string;            // ファイル名 (拡張子なし)
  client: "claude-code" | "codex";
  title: string;
  sessionId: string;
  project: string;       // プロジェクトパスの最後のフォルダ名
  branch: string;
  startedAt: string;     // "2026-10-01 10:34:10"
  filePath: string;
  mtimeMs: number;
  finalResponse: string; // 「### 最終応答」の本文
};

type Analysis = {
  id: string;
  mtimeMs: number;       // 解析時点のファイル mtime。変わっていたら再解析
  summary: string;       // 日本語 3〜5 文
  category: string;      // 下の固定カテゴリから 1 つ
  tags: string[];        // 3〜6 個の短いキーワード
  learnings: string[];   // 再利用できる知見・ハマりどころ (0〜5 個)
};
```

固定カテゴリ: `実装` / `バグ修正` / `レビュー` / `設計・調査` / `インフラ・環境構築` / `ツール・設定` / `その他`

## 機能

1. `lib/logs.ts`: ログを全件走査して `LogEntry[]` を返す (会話全文は読み込まない。ファイル先頭〜`## 会話` の手前だけ使う)。
2. `scripts/analyze.ts` (`npm run analyze` で実行、`tsx` で動かす):
   - 未解析 or mtime が変わったログだけを LLM に送る。
   - 入力はタイトル・プロジェクト・最終応答 + 会話全文の先頭 6000 文字まで。
   - LLM には JSON のみを返させ、パースに失敗したら 1 回だけ再試行、それでもダメならスキップしてログ出力。
   - 結果は `data/analysis.json` (id をキーにしたオブジェクト) に 1 件ごとに保存 (途中で止めても進捗が残るように)。
   - `--limit N` オプションで処理件数を制限できる。
3. 画面 (Server Components でファイルを直接読む):
   - `/` 一覧: カテゴリ別件数のサイドバー、キーワード検索 (タイトル・サマリー・タグ)、クライアント/プロジェクトで絞り込み。新しい順。
   - `/log/[id]` 詳細: メタ情報、サマリー、タグ、学び、最終応答 (Markdown をそのまま `<pre>` で可)。
   - `/learnings` 全ログの「学び」をカテゴリ別に一覧。
   - 未解析のログも一覧に出し、「未解析」バッジを付ける。
4. デザインはシンプルでよい。ダークモード対応 (Tailwind の `dark:`)。

## 完了条件

- `npm run build` が成功する。
- `npm run analyze -- --limit 3` で 3 件が `data/analysis.json` に入る。
- `npm run dev` で上記ページが表示される。
