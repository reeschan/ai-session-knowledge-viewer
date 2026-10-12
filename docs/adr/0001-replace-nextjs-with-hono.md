---
status: accepted
---

# 画面とサーバーを Next.js から Hono + hono/jsx に移す

このアプリは 127.0.0.1 だけで待ち受け、ローカルのファイルを読むツールで、クライアントコンポーネントも Server Actions も使っていない (6 画面はすべてサーバー描画、2 つの API はフォームの POST から 303 で戻すだけ)。それなのに Next.js のビルド・Turbopack の設定・版ごとの API の変化・大きな依存を抱えていたので、Hono + `hono/jsx` に置き換え、TS はビルドせず `tsx` で直接動かす。`lib/` と `scripts/` はもともと Next.js に依存していないので変えない。

## Considered Options

- **React を残して `renderToString`**: `defaultValue` などの書き方をそのまま使えるが、`react` / `react-dom` が残り、依存を減らす目的に合わない。
- **`hono/html` のテンプレート文字列**: JSX をやめるため、画面のコードを書き直す量が増える。
- **静的 HTML を出力し、設定は CLI (`pnpm configure`) だけにする**: 設定画面とスキルのインストール画面がなくなる。
- **`dist/` にビルドして `node` で動かす**: ローカルで動かすツールなので得るものが少なく、`scripts/` が `tsx` で動いているのとも揃わない。

## Consequences

- **別サイトからのリクエスト対策は `hono/csrf` に置き換えない。** `hono/csrf` は Origin / Sec-Fetch-Site しか見ないうえ、`@hono/node-server` は `c.req.url` を Host ヘッダーから組み立てる。そのため DNS リバインディング (悪意あるサイトが自分のドメイン名を 127.0.0.1 に向け直す攻撃) では Origin と URL が一致し、素通りする。既存の `lib/request-guard.ts` をミドルウェアで包み、Host がループバックかどうかの確認は全ルートに、Origin / Sec-Fetch-Site の確認は POST だけにかける。以前は Host の確認が POST にしか効いておらず、GET の画面 (ログの要約・最終応答) は DNS リバインディングで読み出せた。
- **`hono/jsx` は `defaultValue` / `defaultChecked` を変換しない** (`className` などは変換する)。フォームの初期値は `value` / `checked` / `<option selected>` で書く。
- **CSS は `@tailwindcss/cli` で `public/app.css` に出す** (gitignore)。`pnpm start` は CSS を作ってから起動する。
- **`.env.local` は自動では読まれなくなる**ので、サーバーの起動処理で `process.loadEnvFile` を呼ぶ (`scripts/setup.ts` と同じやり方)。
