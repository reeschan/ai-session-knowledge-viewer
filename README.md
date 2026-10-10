# Knowledge Viewer

このPCに保存されている AI エージェント (Claude Code / Codex) の会話ログを読み込み、
ローカル LLM でサマリーとカテゴリを付けて、ナレッジとして閲覧できる Next.js アプリ。

仕様の詳細は `SPEC.md`、作業の進捗は `NEXT-STEPS.md` を参照。

## 前提

- Node.js と npm (このリポジトリは `npm` で扱う)
- OpenAI 互換の API を提供するローカル LLM サーバー (既定: `http://127.0.0.1:8888/v1`、モデル `qwen3.8-27b-exl3-2.0bpw`)
- `.env.local` を作成する。雛形は `.env.local.example` にあるので、コピーして値を合わせる。

  ```bash
  cp .env.local.example .env.local
  ```

  | 変数 | 内容 |
  | --- | --- |
  | `LLM_BASE_URL` | ローカル LLM の API ベース URL |
  | `LLM_API_KEY` | API キー (ローカルなら任意の文字列) |
  | `LLM_MODEL` | 使用するモデル名 |
  | `LOG_ROOT` | ログの置き場所。配下の `claude-code\logs\<YYYY-MM>\*.md` と `codex\logs\<YYYY-MM>\*.md` を読む (読み取り専用) |

## 使い方

```bash
npm install

# 未解析のログをローカル LLM で解析し、data/analysis.json に保存する
npm run analyze
npm run analyze -- --limit N   # 先頭 N 件だけ解析する (動作確認向け)

# 開発サーバー (http://localhost:3000)
npm run dev

# 本番ビルド
npm run build
```

`npm run analyze` は 1 件ごとに結果を保存するので、途中で止めても次回は続きから解析する。
解析の失敗は未解析のまま残り、もう一度実行すると再試行される。

## 画面

- `/` : ログの一覧。サイドバーのカテゴリで絞り込む (「すべて」と、解析前の `未解析` を含む)。
  - クエリ `q` : タイトル・サマリー・タグの検索
  - `category` : カテゴリ。`未解析` を指定すると未解析のログだけを表示する
  - `client` / `project` : クライアントとプロジェクトで絞り込む
  - `tag` : タグで絞り込む。一覧と詳細のタグをクリックすると `/?tag=<タグ>` に移動する
  - 上記の条件は互いに保持される
- `/log/[id]` : 1 件の詳細。サマリー、学び、最終応答を表示する
- `/learnings` : 各ログの学びをカテゴリごとにまとめて表示する

## データ

- 解析結果は `data/analysis.json` に保存する (リポジトリ外に出さないため `.gitignore` 済み)。
- ログのファイルの更新時刻 (mtime) を解析結果と比べ、新規・更新されたログだけを再解析する。
- ログは会話全文ではなくヘッダ部分 (`## 会話` の手前) だけを読む。
- ログフォルダは読み取り専用で、アプリから書き込み・削除はしない。

## 開発メモ

- Next.js 16 (App Router) + TypeScript + Tailwind CSS。DB は使わない。
- 各ページは `force-dynamic` で、Server Component として `data/analysis.json` とログを読む。
- 型チェックは `npx tsc --noEmit`、Lint は `npm run lint`。
