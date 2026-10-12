import type { Child } from "hono/jsx";
import { raw } from "hono/html";

export function Layout({ title = "Knowledge Viewer", children }: { title?: string; children?: Child }) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="ja" data-theme="dark-pop-purple" class="h-full antialiased">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          <meta name="description" content="AI エージェントの会話ログをナレッジとして閲覧" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Mochiy+Pop+One:wght@400&family=Zen+Maru+Gothic:wght@500;700&family=Space+Mono:wght@400&display=swap"
          />
          <link rel="stylesheet" href="/app.css" />
          <link rel="icon" href="/favicon.ico" />
        </head>
        <body class="min-h-full flex flex-col bg-background text-foreground font-sans">
          <header class="border-b border-border bg-card">
            <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <a href="/" class="font-heading text-primary text-lg font-semibold">
                Knowledge Viewer
              </a>
              <nav class="flex gap-4 text-sm">
                <a href="/" class="text-muted-foreground hover:text-primary">
                  一覧
                </a>
                <a href="/learnings" class="text-muted-foreground hover:text-primary">
                  学び
                </a>
                <a href="/skills" class="text-muted-foreground hover:text-primary">
                  スキル
                </a>
                <a href="/manual" class="text-muted-foreground hover:text-primary">
                  マニュアル
                </a>
                <a href="/settings" class="text-muted-foreground hover:text-primary">
                  設定
                </a>
              </nav>
            </div>
          </header>
          <main class="flex-1">{children}</main>
        </body>
      </html>
    </>
  );
}
