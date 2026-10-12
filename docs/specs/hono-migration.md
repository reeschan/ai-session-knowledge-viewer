# Next.js から Hono + hono/jsx への移行

決定の経緯は `docs/adr/0001-replace-nextjs-with-hono.md` を参照。

## Problem Statement

Knowledge Viewer は、自分の PC の会話ログを 127.0.0.1 だけで閲覧するローカルツールなのに、Next.js 16 の上に作られている。そのため、clone して使う人は `pnpm install` で大きな依存を入れ、`next build` を待つことになる。開発する側も、学習データと違う Next.js の API や規約 (AGENTS.md に自動で入るブロック、Turbopack の設定) に付き合わされる。実際には、クライアントコンポーネントも Server Actions も画像最適化もデプロイも使っていない。

さらに、書き込み API の Host ヘッダーの確認が GET の画面には効いていない。そのため、DNS リバインディングによって、悪意あるサイトがログの要約や最終応答を読み出せる余地が残っている。

## Solution

画面とサーバーを Hono + `hono/jsx` に置き換え、TypeScript はビルドせず `tsx` で直接動かす。利用者から見た画面・URL・フォームの動き・ポート (127.0.0.1:3000) と、`pnpm dev` / `pnpm build` / `pnpm start` / `pnpm lint` / `pnpm analyze` / `pnpm digest` / `pnpm configure` というコマンド名は変えない。あわせて、Host の確認を全ルートにかける。

## User Stories

1. 利用者として、`pnpm install` で入る依存を減らしたい。clone してすぐ使い始めたいから。
2. 利用者として、`pnpm dev` を打てば今までどおり `http://127.0.0.1:3000` で開きたい。手順や案内を覚え直したくないから。
3. 利用者として、`pnpm start` だけで CSS の生成から起動まで済ませたい。別にビルドの手順を覚えたくないから。
4. 利用者として、一覧画面でキーワード・カテゴリ・クライアント・プロジェクト・タグで絞り込みたい (今までどおり)。目的のログを見つけたいから。
5. 利用者として、絞り込んだあとも検索欄と選択欄に今の条件が入ったままでいてほしい。条件を少しずつ変えて探したいから。
6. 利用者として、一覧のカテゴリ別件数とタグのリンクを今までどおり使いたい。全体の傾向をつかみたいから。
7. 利用者として、ログの詳細画面でメタ情報・サマリー・タグ・学び・最終応答を見たい。過去の作業を思い出したいから。
8. 利用者として、存在しないログの URL を開いたら、ヘッダー付きの「見つかりません」画面を見たい。一覧へ戻れるようにしたいから。
9. 利用者として、学び画面でカテゴリ別の学びを一覧したい。再利用できる知見を探したいから。
10. 利用者として、マニュアル画面で `docs/MANUAL.md` を、アーキテクチャ図 (ダーク版) 付きで読みたい。設定方法を確かめたいから。
11. 利用者として、設定画面に今の設定が入った状態で表示され、ソースの種類の選択・有効のチェック・LLM のプロバイダも今の値が選ばれていてほしい。誤って設定を上書きしたくないから。
12. 利用者として、設定画面の API キーは末尾 4 文字以外を伏せて表示し、空欄で保存したら既存のキーを残してほしい。キーを画面にさらしたくないから。
13. 利用者として、設定を保存したら設定画面に戻り「保存しました」と出てほしい。保存できたと分かるようにしたいから。
14. 利用者として、不正な設定値を送ったら、何が不正かを 400 で知りたい。直す箇所を知りたいから。
15. 利用者として、環境変数で上書きされている設定項目を設定画面で知りたい。画面の値が効かない理由を知りたいから。
16. 利用者として、スキル生成画面でプレビューし、確認のチェックを付けてインストールしたい (今までどおり)。セッション保管とダイジェストを設定したいから。
17. 利用者として、インストールの確認チェックを付け忘れたら 400 で止まってほしい。うっかりホームのフォルダに書き込みたくないから。
18. 利用者として、`.env.local` に書いた API キーやログの場所が、今までどおりサーバーに効いてほしい。設定を移し替えたくないから。
19. 利用者として、別のサイトや LAN から設定保存とスキルのインストールを実行されないでほしい (今までどおり 403)。PC を守りたいから。
20. 利用者として、Host ヘッダーが 127.0.0.1 / localhost 以外のリクエストは、画面の GET も含めて 403 で拒否してほしい。DNS リバインディングでログを読み出されたくないから。
21. 利用者として、サーバーは 127.0.0.1 だけで待ち受け、ポートは環境変数 `PORT` で変えたい。3000 番がほかのアプリとぶつかることがあるから。
22. 利用者として、予期しないエラーのときはヘッダー付きの「エラーが発生しました」画面を見て、詳しい内容はサーバーのログで確かめたい。画面に内部情報を出したくないから。
23. 利用者として、見た目 (テーマ、フォント、ダークの配色) が今と変わらないでほしい。慣れた画面を使い続けたいから。
24. 利用者として、ブラウザのタブに今と同じタイトル (マニュアルは「マニュアル | Knowledge Viewer」、ほかは「Knowledge Viewer」) が出てほしい。タブを見分けたいから。
25. 開発者として、`pnpm dev` で TS と CSS の両方の変更が自動で反映されてほしい。確認を速く回したいから。
26. 開発者として、`pnpm build` で CSS の生成と型チェックができてほしい。壊れていないことをすぐ確かめたいから。
27. 開発者として、`pnpm lint` で TypeScript 向けのルールが効いてほしい (Next.js 向けのルールはいらない)。素の TS として正しく書けているか確かめたいから。
28. 開発者として、`pnpm test` で、サーバーを立てずに全画面と API の振る舞いを確かめたい。画面を直すときの安全網にしたいから。
29. 開発者として、テストが自分の `~/.claude` や `.env.local` を読まないでほしい。結果を環境に左右されたくないから。
30. 開発者として、`lib/` と `scripts/` が変わらないことを保証したい。解析やダイジェストの挙動に影響を出したくないから。
31. 開発者として、README・SPEC・MANUAL・アーキテクチャ図の元 (d2) から Next.js の記述がなくなっていてほしい。文書と実装を食い違わせたくないから。
32. 開発者として、なぜ Next.js をやめたか、なぜ `hono/csrf` を使わないかを ADR で読みたい。後から「直して」しまわないようにしたいから。

## Implementation Decisions

- **モジュールの分け方**: サーバーは 4 つに分ける。
  - 起動処理: `.env.local` を読み、127.0.0.1 と `PORT` (既定 3000) で待ち受ける。
  - Hono のアプリ本体: ミドルウェア・ルート・404 / 500 を登録する。テストはここを `app.request()` で叩く。
  - 画面: Layout と 6 画面を JSX で書く。
  - POST の 2 つの API。
- **アプリ本体の公開インターフェース**: Hono のアプリ 1 つを export する。起動処理とテストはどちらもこれを使う。
- **`lib/` と `scripts/` は変更しない。** 画面は今と同じ `lib/` の関数 (`getKnowledge`・`loadSettings`・`effectiveSettings`・`envOverrides`・`maskKey`・`generateSkills`・`installSkills` など) を呼ぶ。
- **ルートと振る舞いの契約は今と同じ**:
  - `GET /` (クエリ `q` / `category` / `client` / `project` / `tag`)
  - `GET /log/:id` (無ければ 404)
  - `GET /learnings`、`GET /manual`
  - `GET /settings` (`saved=1` で通知)
  - `GET /skills` (クエリ `storeDir` / `slackChannel` / `appDir` / `periods` / `installed`)
  - `POST /api/settings` (成功で `/settings?saved=1` へ 303、不正値で 400 のテキスト)
  - `POST /api/skills/install` (成功で `/skills?installed=<件数>` へ 303、入力不足で 400)
- **JSX**: `hono/jsx` を使う (`jsxImportSource: hono/jsx`)。`className` などは hono/jsx が変換するので残す。`defaultValue` / `defaultChecked` は変換されないので、`value` / `checked` / 該当する `<option selected>` に書き換える。マニュアルの HTML は今と同じく `dangerouslySetInnerHTML` で入れる (入力はリポジトリ内の `docs/MANUAL.md` だけ)。
- **Layout**: `title` を受け取る。既定は「Knowledge Viewer」。Google Fonts の読み込み、`data-theme="dark-pop-purple"`、ヘッダーのナビゲーションは今と同じにし、`/app.css` を読み込む。
- **ページ間の移動**: `next/link` は `<a>` に、`notFound()` は Hono の 404 に置き換える。404 と 500 は Layout の中に短いメッセージを出し、500 の内容は `console.error` に出す。
- **別サイトからのリクエスト対策**: `lib/request-guard.ts` の `rejectUnlessLocal` をミドルウェアで包む。
  - Host がループバックかどうかの確認は全ルートにかける。
  - Origin / Sec-Fetch-Site の確認は POST にだけかける。
  - どちらも既存の関数の判定をそのまま使う (GET では Host の確認だけが効くよう、ミドルウェア側で振り分ける)。
  - `hono/csrf` は使わない (ADR を参照)。
- **静的ファイル**: Tailwind の入力 CSS (今の globals.css の中身をそのまま) から、`@tailwindcss/cli` で `public/app.css` を作る (gitignore)。`favicon.ico` は `public/` に置く。`serveStatic` は `/app.css` と `/favicon.ico` にだけかける。起動時の作業フォルダはリポジトリのルートが前提 (`lib/settings.ts` と同じ)。
- **スクリプト**:
  - `dev`: `tsx watch` と `tailwindcss --watch` を `concurrently` で同時に動かす
  - `build`: CSS の生成と `tsc --noEmit`
  - `start`: `build` のあと `tsx` で起動
  - `lint`: ESLint (`typescript-eslint` の recommended)
  - `test`: `node --import tsx --test --test-reporter=tap`
  - `analyze` / `digest` / `configure` は変えない
- **依存**:
  - 足す: `hono`、`@hono/node-server`、`@tailwindcss/cli`、`typescript-eslint`、`concurrently`
  - 外す: `next`、`react`、`react-dom`、`@types/react`、`@types/react-dom`、`eslint-config-next`、`@tailwindcss/turbopack`
  - 版は公開から 1 日以上たったものにする (pnpm の `minimumReleaseAge` 対策)
- **消すファイル**: `next.config.ts`、`next-env.d.ts`、`.next/`、AGENTS.md (Next.js のブロックしかなく、参照元もない)、`app/` 配下一式 (移したあと)。tsconfig から Next のプラグインと `.next` の include を外す。

## Testing Decisions

- **良いテストの基準**: 外から見える振る舞い (ステータスコード、リダイレクト先、HTML に出る文字列や属性) だけを確かめる。JSX の組み立て方や内部の関数は確かめない。
- **合意済みの seam**: Hono のアプリ本体に対する `app.request()` だけを使う。サーバーは立てない。ほかに seam は作らない。
- **テストの対象**:
  - 6 画面が 200 を返し、画面ごとの目印 (見出しなど) を含む
  - 一覧の絞り込みの値が `value="..."` や `selected` として HTML に出る
  - 設定画面の今の値が `value` / `checked` / `selected` で出て、API キーの値そのものは出ない
  - 存在しない `/log/<id>` が 404 で、ヘッダーを含む
  - `POST /api/settings` と `POST /api/skills/install` が 303 で正しい場所へ戻り、入力不足のときは 400
  - Host が `evil.example` のときは GET も POST も 403
  - Origin が別サイトの POST は 403
  - `/app.css` が配信される (CSS を作ったあと)
- **テストのデータ**:
  - 一時フォルダに `settings.json` (ソースはテスト用の Markdown ログだけ) と `analysis.json` を書き、`KV_DATA_DIR` をそこに向ける。
  - `LOG_ROOT`・`ANTHROPIC_API_KEY`・`LLM_*` はテスト中は消す。
  - スキルのインストールは、`HOME` / `USERPROFILE` を一時フォルダに向けるなどして、本物のホームに書かない。
  - テスト用のログは SPEC.md の形式に沿った架空の内容で `test/fixtures/` に置き、実際の会話ログは入れない。
- **先行例**: リポジトリにテストはまだない。Node 26 の既定のレポーターは pass / fail の行を出さないので、`--test-reporter=tap` を付ける。

## Out of Scope

- 画面の見た目・文言・機能の変更 (Host の確認を全ルートに広げることだけは例外)
- `lib/` と `scripts/` の変更
- アーキテクチャ図の SVG の作り直し (この PC に `d2` がないため、別作業)
- GitHub のリポジトリの説明文、management-self-pieces の fixture など、リポジトリの外の記述 (移行のあとに確認を取ってから別作業)
- NEXT-STEPS.md と `docs/design/generalize.md` (当時の記録なので直さない)
- ページング・再解析ボタンなど、NEXT-STEPS の改善の候補

## Further Notes

- 作業ブランチは `feat/hono` で、終わったら develop への PR にする。
- 調べて分かった Hono の挙動 (hono 4.13.13 / @hono/node-server 2.1.4 で確認):
  - `className` は `class`、`htmlFor` は `for`、`crossOrigin` は `crossorigin` に変換される。`key` は出力されない。async のコンポーネントも使える。
  - `serve({ fetch, port, hostname })` で待ち受ける。`serveStatic` の `root` は作業フォルダからの相対パス。
  - `app.request()` に `Host` ヘッダーを付けても `c.req.url` は `http://localhost/...` のままになる。Host の確認はヘッダーを読んで行い、テストではヘッダーを付けるか、絶対 URL を渡す。
