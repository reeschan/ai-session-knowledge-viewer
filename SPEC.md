# Knowledge Viewer — 仕様書

このPCに保存されている AI エージェント (Claude Code / Codex) の会話ログを読み込み、
LLM でサマリーとカテゴリを付けて、ナレッジとして閲覧できる Hono (hono/jsx) アプリ。

汎用化後の設計は `docs/design/generalize.md` を参照。

## 前提

- 汎用化後の設計は `docs/design/generalize.md` を参照。
- ログの場所 (読み取り専用。絶対に書き込み・削除しないこと): `/settings` で指定する。3 種類のソースを読む。
  - Claude Code の生ログ: 既定 `~/.claude/projects` (`**/*.jsonl`)
  - Codex の生ログ: 既定 `~/.codex/sessions` (`**/rollout-*.jsonl`)
  - session-log 形式の Markdown: `<YYYY-MM>/*.md`。環境変数 `LOG_ROOT` でも指定できる。各フォルダの `INDEX.md` はログではないので無視する。
  - 同じ sessionId が複数のソースにあるときは 1 件にまとめ、Markdown を優先する。
- LLM は `/settings` で切り替える。環境変数 (`ANTHROPIC_API_KEY` / `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` / `LOG_ROOT`) があれば設定より優先する。
  - Anthropic (既定モデル `claude-opus-5-5`)
  - OpenAI 互換 API (ローカル LLM など。ベース URL の既定は `http://127.0.0.1:8888/v1`)
  - 設定は `data/settings.json` に保存する (API キーは平文)。`.env.local.example` に変数の雛形がある。
- 技術: Hono + hono/jsx (サーバー描画のみ) + `@hono/node-server` + TypeScript (`tsx` で直接実行) + Tailwind CSS v4 + zod。DB は使わない。LLM は `@anthropic-ai/sdk` と `openai`。
- パッケージマネージャーは pnpm を使う（`pnpm-lock.yaml`、`pnpm-workspace.yaml`）。

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
  id: string;            // Markdown はファイル名 (拡張子なし)、生ログは cc-<sessionId> / codex-<sessionId>
  client: "claude-code" | "codex";
  source: "markdown" | "claude-code" | "codex";  // どのソースから読んだか
  title: string;
  sessionId: string;
  project: string;       // プロジェクトパスの最後のフォルダ名
  branch: string;
  startedAt: string;     // "2026-10-01 10:34:10"
  updatedAt: string;     // ログの中の最終更新時刻 (ダイジェストの期間判定に使う)
  filePath: string;
  mtimeMs: number;
  finalResponse: string; // 「### 最終応答」の本文 (生ログでは最後の応答)
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

固定カテゴリから 1 つ
  tags: string[];        // 3〜6 個の短いキーワード
  learnings: string[];   // 再利用できる知見・ハマりどころ (0〜5 個)
};
```

固定カテゴリ: `実装` / `バグ修正` / `レビュー` / `設計・調査` / `インフラ・環境構築` / `ツール・設定` / `その他`

## 機能

1. `lib/settings.ts`: 設定 (`data/settings.json`、zod で検証) の読み書き。環境変数で上書きする。
2. `lib/sources/`: 3 種類のソースを読み、`listLogs()` が sessionId で重複を除いて新しい順の `LogEntry[]` を返す (会話全文は読み込まない)。生ログの読み取り結果は `data/log-index.json` にキャッシュする。
3. `lib/llm/`: 設定に応じて Anthropic / OpenAI 互換を切り替える `summarize()`。
4. `scripts/analyze.ts` (`pnpm analyze`、`tsx` で実行):
   - 未解析 or mtime が変わったログだけを LLM に送る。
   - LLM には JSON のみを返させ、結果は `data/analysis.json` に 1 件ごとに保存する (途中で止めても進捗が残る)。失敗したログは未解析のまま残す。
   - `--limit N` オプションで処理件数を制限できる。
5. `scripts/digest.ts` (`pnpm digest --period daily|weekly [--now <日時>]`): 期間内のログと解析結果から Markdown のダイジェストを標準出力に出す。期間は `updatedAt` で判定する。
6. `lib/skills.ts`: スキルの生成。セッション保管スキル (`~/.claude/skills/session-archive`、Stop フックが必要) と、日次・週次ダイジェストの定期実行タスク (`~/.claude/scheduled-tasks/knowledge-digest-<period>`、Claude Desktop と Slack コネクタが必要)。
7. 画面 (hono/jsx のサーバー描画):
   - `/` 一覧: カテゴリ別件数のサイドバー、キーワード検索 (`q`)、`category` (`未解析` を含む) / `client` / `project` / `tag` で絞り込み。新しい順。
   - `/log/:id` 詳細: メタ情報、サマリー、タグ、学び、最終応答。
   - `/learnings` 全ログの「学び」をカテゴリ別に一覧。
   - `/settings` 設定画面 (ログの場所、LLM、API キー、スキルの設定)。
   - `/skills` スキル生成画面 (プレビュー、ダウンロード、インストール)。
   - 未解析のログも一覧に出し、「未解析」バッジを付ける。
8. セキュリティ: `dev` / `start` は `127.0.0.1` だけで待ち受ける。Host が 127.0.0.1 / localhost 以外のリクエストは、画面の GET も含めて全ルートで 403 で拒否する (Host の確認は全ルートに効く)。設定保存とスキルのインストールの API は、別のサイトや LAN からのリクエストも拒否する。ポートは環境変数 `PORT` で変えられる (既定 3000)。
9. デザインはシンプルでよい。ダークモード対応 (Tailwind の `dark:`)。

## 完了条件

- `pnpm build` が成功する。
- `pnpm test` が通る。
- `pnpm analyze --limit 3` で 3 件が `data/analysis.json` に入る。
- `pnpm dev` で上記ページと `/settings`・`/skills` が表示される。
- `pnpm digest --period daily` が Markdown を標準出力に出す。
