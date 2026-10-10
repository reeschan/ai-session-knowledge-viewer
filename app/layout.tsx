import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowledge Viewer",
  description: "AI エージェントの会話ログをナレッジとして閲覧",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" data-theme="dark-pop-purple" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- テーマ CSS がフォント名をそのまま指定するため next/font を使わない */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Mochiy+Pop+One:wght@400&family=Zen+Maru+Gothic:wght@500;700&family=Space+Mono:wght@400&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-heading text-primary text-lg font-semibold">
              Knowledge Viewer
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/"
                className="text-muted-foreground hover:text-primary"
              >
                一覧
              </Link>
              <Link
                href="/learnings"
                className="text-muted-foreground hover:text-primary"
              >
                学び
              </Link>
              <Link
                href="/skills"
                className="text-muted-foreground hover:text-primary"
              >
                スキル
              </Link>
              <Link
                href="/manual"
                className="text-muted-foreground hover:text-primary"
              >
                マニュアル
              </Link>
              <Link
                href="/settings"
                className="text-muted-foreground hover:text-primary"
              >
                設定
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
