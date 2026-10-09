# 後続の作業指示 (Knowledge Viewer)

2026-10-09 時点の中断メモ。仕様は `SPEC.md`、実装はローカルの Qwen3.8-27B (DeepSeek Harness のヘッドレスモード) に委任し、各フェーズのあとに人間 / Claude が検証する進め方。

## 現在の状態

| フェーズ | 内容 | 状態 |
| --- | --- | --- |
| 1 | Next.js 16 の雛形、`openai` / `tsx`、`.env.local` | ✅ コミット済み (Claude が実施。Qwen はループしたため) |
| 2 | `lib/types.ts`, `lib/logs.ts` (ログ 125 件の読み込み) | ✅ コミット済み・検証済み |
| 3 | `lib/analysis.ts`, `scripts/analyze.ts` | ✅ コミット済み。JSON 抽出の off-by-one を修正、`max_tokens: 3000` と `reasoning_effort: "low"` を追加。解析済みは 1 件のみ |
| 4 | 画面 (一覧 / 詳細 / 学び) | ⏸ **途中で停止。未コミット・未検証** |
| 5 | 全件解析 | 未着手 |
| 6 | 最終確認 | 未着手 |

フェーズ 4 で未コミットのまま残っている変更:
`app/layout.tsx`, `app/page.tsx`, `app/log/`, `app/learnings/`, `lib/knowledge.ts`, `public/*.svg` の削除。

## Qwen への指示の出し方

```bash
# 指示文をファイルに書いて渡す。結果は D:\llm\dsh-runs\<名前>.out.md に出る
/d/llm/run-dsh.sh <名前> <指示ファイル>
```

- `run-dsh.sh` は Node 22 で `D:\llm\dsh-cli` の dsh を動かす (Node 26 だと `fs-ext` のビルドに失敗する)。
- `DSH_HOME` は `D:\llm\dsh-home-cli` (Web ハーネス `.dsh` とは別)。`QWEN_LOCAL_API_KEY=local`。
- 前提: `D:\llm\qwen38-27b\windows\start.bat` でモデルサーバー (`127.0.0.1:8888`) が起動していること。
- 途中経過は `D:\llm\dsh-home-cli\sessions\--D-llm-knowledge-app--\*\session.v2.jsonl.zstd` に出る (zstd のフレームが連結されている)。

### 指示文に必ず入れるルール

これまでの失敗から入れているルール。毎回貼る。

```
RULES:
- Only create/modify files inside D:\llm\knowledge-app. The log folder under LOG_ROOT is READ-ONLY.
- Do NOT run npm install / pnpm / create-next-app. Do not create pnpm-workspace.yaml or pnpm-lock.yaml.
- Do NOT run `npm run analyze` or `npm run dev`.
- If the same command fails twice, STOP and report the error instead of retrying.
```

- ルールなしだと、同じコマンドを 300 回繰り返すループに入った (フェーズ 1)。
- 頼んでいないのに pnpm で入れ直すことがある (フェーズ 2)。
- dsh のサンドボックス内では `tsx` (esbuild) が `spawn EPERM` で動かない。**`npm run analyze` と `tsx` を使う確認は人間 / Claude 側で行う。**

## フェーズ 4: 画面の仕上げ

1. まず人間 / Claude 側で途中の状態を確認する。

   ```bash
   cd /d/llm/knowledge-app
   npx tsc --noEmit
   npm run build
   ```

2. エラーが出たら、そのエラーを貼って Qwen に修正だけを頼む。指示文の例:

   ```
   You are working in D:\llm\knowledge-app (Next.js 16 App Router + TypeScript + Tailwind v4). Read SPEC.md first.
   Phase 4 (UI) is partially done: app/page.tsx, app/layout.tsx, app/log/[id]/page.tsx, app/learnings/page.tsx, lib/knowledge.ts.
   <RULES をここに貼る>
   - Next.js 16: `params` / `searchParams` are Promises — `const { id } = await params;`.
   - Every page: `export const dynamic = "force-dynamic";`. Server Components only; filters use <form method="get">.

   Task: finish and fix the UI so that `npx tsc --noEmit` and `npm run build` both pass.
   Current errors:
   <エラーを貼る>
   Check against SPEC.md that these exist: category sidebar with counts (+未解析), search q over title/summary/tags,
   client & project filters, cards with 未解析 badge, /log/[id] detail with learnings and final response, /learnings grouped by category.
   Reply with what you changed and the build result.
   ```

3. ビルドが通ったら `npm run dev` で http://localhost:3000 を開き、次を確認する。
   - `/`: カテゴリのサイドバー、検索、クライアントとプロジェクトの絞り込み、「未解析」バッジ
   - `/log/<id>`: 解析済みの `2025-09-22_xt_urban_webbim-frontend_01996dbc` と、未解析のログの両方
   - `/learnings`
4. 問題なければコミットする: `git add -A && git commit -m "Add UI (by local Qwen)"`

## フェーズ 5: 全件解析

人間 / Claude 側で実行する (Qwen のサンドボックスでは動かないため)。GPU を取り合うので、**Qwen エージェントが動いていないときに実行する。**

```bash
cd /d/llm/knowledge-app
npm run analyze -- --limit 5   # まず少数で確認
npm run analyze                # 残り全件 (約 120 件 × 30〜60 秒 ≒ 1〜2 時間)
```

- 1 件ごとに `data/analysis.json` に保存されるので、途中で止めても続きから再開できる。
- `JSON not found` で失敗したログは、もう一度 `npm run analyze` を実行すれば再試行される (未解析のまま残るため)。
- 失敗が多い場合は Qwen に次を頼む: 「OpenAI の呼び出しに `response_format: { type: "json_object" }` を追加して、失敗時は応答の先頭 300 文字を console.error に出す」
- 解析後に結果をざっと確認する: カテゴリの偏り、`その他` が多すぎないか、サマリーが日本語になっているか。

## フェーズ 6: 最終確認と後片付け

- `npm run build` が通る。
- `/` の件数がログの件数 (現在 125。増えていく) と一致する。
- 新しいログが増えたら、`npm run analyze` を再実行すれば差分だけ解析される (mtime で判定)。
- 不要になったファイル: `scripts/check-logs.ts` (確認用。残してもよい)、`D:\llm\probe.ts`、`D:\llm\test-stderr.log`。

## 改善の候補 (任意)

- 一覧のページング (件数が増えたとき)
- 「再解析」ボタン、またはタグをクリックして絞り込み
- `/learnings` の重複をまとめる (似た学びが複数ログに出るため)
