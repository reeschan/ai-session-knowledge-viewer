# 汎用化の設計 (2026-10-10)

Knowledge Viewer を、特定の PC・特定のログ形式に依存しない汎用アプリにする。既存コードを段階的に改修する。

## 決定事項 (ユーザー確認済み)

| 項目 | 決定 |
| --- | --- |
| 進め方 | 既存コードを段階的に改修する |
| 読むログ | Claude Code の生ログ (`~/.claude/projects/**/*.jsonl`)、Codex の生ログ (`~/.codex/sessions/**/rollout-*.jsonl`)、既存の session-log 形式の Markdown の 3 種類。場所は設定画面で指定する |
| 要約の LLM | Anthropic API (Claude) と OpenAI 互換 API (ローカル LLM・OpenAI など) を設定で切り替える。API キーは設定画面で指定する |
| Slack 通知 | Claude Desktop の定期実行タスク (ローカル実行) と Slack コネクタを使う。アプリは「定期実行タスクの SKILL.md」を生成する |

## 調査で分かった前提

- Claude Desktop の定期実行タスクは `~/.claude/scheduled-tasks/<name>/SKILL.md` (frontmatter は `name` と `description`、本文がプロンプト)。ローカルで動き、ローカルファイルと Slack コネクタを使える。アプリ起動中かつ PC が起きている間だけ動く。頻度は Desktop の UI で Hourly / Daily / Weekdays / Weekly から選ぶ。
- Claude Code の `/schedule` (Routines) はクラウドで動き、ローカルファイルを読めないので使わない。
- claude.ai にアップロードするスキルはローカルディスクを読めないので、ログ保管には使わない。
- Claude Code のスキルは `~/.claude/skills/<name>/SKILL.md`。スクリプトは `${CLAUDE_SKILL_DIR}/scripts/...` で参照する。frontmatter は互換性のため `name` / `description` / `allowed-tools` に絞る (`name` は小文字・数字・ハイフン 64 文字以内、`claude` を含めない。`description` は 1,024 文字以内)。
- Claude Code の Stop フックの入力 (stdin の JSON) には `session_id`, `transcript_path`, `cwd`, `hook_event_name` がある。フックは常に exit 0 で、stdout に何も出さない。

## 構成

```
lib/
  settings.ts        設定の読み書き (data/settings.json)。zod で検証。環境変数で上書き可
  types.ts           LogEntry に source を追加
  sources/
    index.ts         有効なソースを全部読み、sessionId で重複を除いて新しい順に返す (listLogs)
    markdown.ts      既存の lib/logs.ts を移したもの
    claude-code.ts   Claude Code の JSONL
    codex.ts         Codex の JSONL
    cache.ts         path + mtime + size をキーにした解析結果のキャッシュ (data/log-index.json)
  llm/
    index.ts         設定に応じてプロバイダを選ぶ summarize()
    schema.ts        要約結果の zod スキーマとプロンプト
    anthropic.ts     @anthropic-ai/sdk
    openai.ts        openai (OpenAI 互換)
  digest.ts          期間内のログと解析結果から日次・週次のダイジェスト (Markdown) を作る
  skill-templates/   生成するスキルのテンプレート
app/
  settings/          設定画面 (ソース、LLM、API キー)
  skills/            スキル生成画面 (プレビュー、ダウンロード、インストール)
scripts/
  analyze.ts         lib/llm を使う
  digest.ts          npm run digest -- --period daily|weekly
```

## データ

- `data/settings.json` (gitignore 済みの `data/` 配下)。API キーは平文で保存されるので、画面では末尾 4 文字以外を伏せる。環境変数 `ANTHROPIC_API_KEY` / `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` / `LOG_ROOT` があれば設定より優先する (既存の `.env.local` を壊さないため)。
- `LogEntry.id` は既存の Markdown ログではファイル名のまま (既存の `data/analysis.json` を活かすため)。生ログは `cc-<sessionId>` / `codex-<sessionId>`。
- 同じセッションが Markdown と生ログの両方にあるときは sessionId で 1 件にまとめ、Markdown を優先する (既存の解析結果が Markdown の id に付いているため)。

## 生成するスキル

1. **セッション保管スキル (Claude Code 向け)**: `~/.claude/skills/<name>/`
   - `scripts/archive.mjs`: Stop フックから呼ばれ、`transcript_path` の JSONL を保管先 `<storeDir>/claude-code/<YYYY-MM>/<sessionId>.jsonl` にコピーする。常に exit 0。
   - `SKILL.md`: 「セッションを保管して」で起動し、今のセッションの要約をアプリと同じスキーマの JSON で `<storeDir>/summaries/<sessionId>.json` に書く手順。API キー不要。
   - settings.json に追記する Stop フックの断片 (アプリは settings.json を書き換えず、断片を表示する)。
   - アプリは `<storeDir>` を生ログのソースとして、`summaries/` を解析結果として読める。
2. **日次・週次ダイジェストの定期実行タスク (Claude Desktop 向け)**: `~/.claude/scheduled-tasks/<name>/SKILL.md`
   - 本文: アプリのディレクトリで `npm run digest -- --period <daily|weekly>` を実行し、出力を Slack コネクタで指定チャンネルに投稿する手順。
   - 頻度は Desktop の UI で選ぶ旨をアプリの画面に表示する。

## 段階

| 段階 | PBI |
| --- | --- |
| 0 依存の更新 | PBI-006 |
| 1 設定 | PBI-007, PBI-008 |
| 2 ログソース | PBI-009, PBI-010 |
| 3 LLM プロバイダ | PBI-011 |
| 4 ダイジェスト | PBI-012 |
| 5 スキル生成 | PBI-013, PBI-014 |
| 6 文書 | PBI-015 |
