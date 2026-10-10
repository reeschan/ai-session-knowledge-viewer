---
name: knowledge-setup
description: Knowledge Viewer の初回セットアップ・設定の見直しを対話で行う。「セットアップして」「設定を手伝って」「LLM やログの場所を設定したい」などで使う。
---

# Knowledge Viewer セットアップ

依存の導入・ログの場所の検出・LLM と保存先の設定・起動までを、利用者と対話しながら進める。設定の読み書きは必ず `pnpm configure`（`scripts/setup.ts`）を通す。コマンドはすべてリポジトリのルートで実行する。

## 手順

### 1. 前提の確認
- `node --version` を実行し、22 以上であることを確かめる。足りなければ Node.js の更新を案内して止める。
- `pnpm --version` を実行する。pnpm が無ければ `corepack enable` を実行するよう案内する。
- `pnpm install` を実行する。

### 2. 現状の把握
- `pnpm configure detect` を実行する。
- 結果を利用者に表で要約する。
  - ログの場所: `sources` と `defaults` の各パスと、その有無（`exists`）
  - LLM: `llm.provider` と、使うプロバイダのモデル名・ベース URL
  - キーの有無: `llm.anthropic.hasKey` / `llm.openai.hasKey`
  - 上書き中の環境変数: `envOverrides`（ここにある項目は `.env.local` などの環境変数が設定画面より優先される）

### 3. 方針を聞く（AskUserQuestion）
- 使う LLM: Anthropic か OpenAI 互換か。OpenAI 互換ならベース URL とモデル名も聞く。
- ログの場所: 検出された既定の場所（`~/.claude/projects`、`~/.codex/sessions`）を使うか。Markdown ログのフォルダを足すか（足すならそのパス）。
- スキル生成を使うか。使うなら保存先フォルダ（`skills.storeDir`）と Slack チャンネル（`skills.slackChannel`）。

### 4. パッチを作って反映
- 答えから、変更する項目だけを含む部分的な設定の JSON を一時ファイル（リポジトリの外。スクラッチ用ディレクトリなど）に書く。
- `pnpm configure apply <ファイル>` を実行する。成功すると `detect` と同じ JSON が出るので、反映結果を利用者に伝える。
- `sources` は配列ごと置き換わる。既存のソースで残すものも含めて、全部を書く（各要素は `id`、`type`（`markdown` / `claude-code` / `codex`）、`path`、`enabled`）。
- パッチに `apiKey` を入れない（入れると apply は失敗する）。

パッチの例:

```json
{
  "llm": { "provider": "openai-compatible", "openai": { "baseUrl": "http://127.0.0.1:8888/v1", "model": "my-model" } },
  "sources": [
    { "id": "claude-code", "type": "claude-code", "path": "C:\\Users\\me\\.claude\\projects", "enabled": true },
    { "id": "codex", "type": "codex", "path": "C:\\Users\\me\\.codex\\sessions", "enabled": true },
    { "id": "notes", "type": "markdown", "path": "C:\\path\\to\\AI", "enabled": true }
  ],
  "skills": { "storeDir": "C:\\path\\to\\store", "slackChannel": "#knowledge" }
}
```

### 5. API キー
- **キーの値をチャットで聞かない・受け取らない。`.env.local` を読まない。**
- 利用者に、次のどちらかで自分で入れるよう案内する。
  - `.env.local`（雛形は `.env.local.example`）に書く。Anthropic なら `ANTHROPIC_API_KEY`、OpenAI 互換なら `LLM_API_KEY`。
  - `pnpm dev` で起動した後、設定画面（`http://127.0.0.1:3000/settings`）で入れる。
- 入れ終わったと言われたら `pnpm configure detect` を実行し、使うプロバイダの `hasKey` が true になったことだけを確かめる。

### 6. 動作確認
- API の料金がかかるので、**利用者の同意を得てから** `pnpm analyze --limit 1` を実行する。同意が無ければ飛ばす。

### 7. 起動
- `pnpm dev` をバックグラウンドで起動し、`http://127.0.0.1:3000` を開くよう伝える。

### 8. スキル生成を使う場合
- 画面の `/skills`（`http://127.0.0.1:3000/skills`）でスキルをインストールするよう案内する。
- 表示される Stop フックの断片を、利用者が自分で `~/.claude/settings.json` に追記するよう案内する（このスキルは `~/.claude/settings.json` を書き換えない）。

### 9. 詳しい説明
- 各設定項目の詳しい説明は、マニュアル（`docs/MANUAL.md`、アプリの `/manual`）を参照するよう伝える。

## やらないこと
- API キーの値を要求する・表示する・ファイルに書き込むこと。
- `.env.local` と `data/settings.json` を直接読むこと（現状は `pnpm configure detect` で確かめる）。
- `~/.claude/settings.json` を書き換えること。
