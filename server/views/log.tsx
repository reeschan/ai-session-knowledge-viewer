import type { KnowledgeEntry } from "@/lib/knowledge";

export function LogPage({ entry }: { entry: KnowledgeEntry }) {
  return (
    <div class="mx-auto max-w-4xl px-4 py-6">
      <a href="/" class="text-sm text-muted-foreground hover:text-primary hover:underline">
        ← 一覧へ戻る
      </a>

      <h1 class="mt-2 text-2xl font-semibold">{entry.title || "(タイトルなし)"}</h1>

      <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <dt class="text-muted-foreground">開始</dt>
        <dd>{entry.startedAt}</dd>
        <dt class="text-muted-foreground">クライアント</dt>
        <dd>{entry.client}</dd>
        <dt class="text-muted-foreground">プロジェクト</dt>
        <dd>{entry.project}</dd>
        <dt class="text-muted-foreground">ブランチ</dt>
        <dd>{entry.branch || "-"}</dd>
        <dt class="text-muted-foreground">セッション ID</dt>
        <dd class="break-all">{entry.sessionId || "-"}</dd>
      </dl>

      {entry.analysis && (
        <section class="mt-6">
          <h2 class="text-lg font-semibold">サマリー</h2>
          <p class="mt-2 text-sm leading-relaxed text-foreground/85">{entry.analysis.summary}</p>
          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            <span class="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{entry.analysis.category}</span>
            {entry.analysis.tags.map((tag) => (
              <a
                href={`/?tag=${encodeURIComponent(tag)}`}
                class="rounded-full bg-accent px-2 py-0.5 text-accent-foreground hover:underline"
              >
                {tag}
              </a>
            ))}
          </div>
        </section>
      )}

      {entry.analysis && entry.analysis.learnings.length > 0 && (
        <section class="mt-6">
          <h2 class="text-lg font-semibold">学び</h2>
          <ul class="mt-2 flex flex-col gap-1 text-sm text-foreground/85">
            {entry.analysis.learnings.map((learning) => (
              <li class="list-disc pl-4">{learning}</li>
            ))}
          </ul>
        </section>
      )}

      <section class="mt-6">
        <h2 class="text-lg font-semibold">最終応答</h2>
        <pre class="mt-2 whitespace-pre-wrap rounded-md bg-muted p-4 text-sm text-foreground">
          {entry.finalResponse || "(なし)"}
        </pre>
      </section>
    </div>
  );
}
