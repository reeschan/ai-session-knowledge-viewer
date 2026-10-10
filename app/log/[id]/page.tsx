import Link from "next/link";
import { notFound } from "next/navigation";
import { getKnowledge } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export default async function LogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const all = await getKnowledge();
  const entry = all.find((e) => e.id === id);
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/" className="text-sm text-muted-foreground hover:text-primary hover:underline">
        ← 一覧へ戻る
      </Link>

      <h1 className="mt-2 text-2xl font-semibold">{entry.title || "(タイトルなし)"}</h1>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <dt className="text-muted-foreground">開始</dt>
        <dd>{entry.startedAt}</dd>
        <dt className="text-muted-foreground">クライアント</dt>
        <dd>{entry.client}</dd>
        <dt className="text-muted-foreground">プロジェクト</dt>
        <dd>{entry.project}</dd>
        <dt className="text-muted-foreground">ブランチ</dt>
        <dd>{entry.branch || "-"}</dd>
        <dt className="text-muted-foreground">セッション ID</dt>
        <dd className="break-all">{entry.sessionId || "-"}</dd>
      </dl>

      {entry.analysis && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">サマリー</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">
            {entry.analysis.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">
              {entry.analysis.category}
            </span>
            {entry.analysis.tags.map((tag) => (
              <Link
                key={tag}
                href={`/?tag=${encodeURIComponent(tag)}`}
                className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground hover:underline"
              >
                {tag}
              </Link>
            ))}
          </div>
        </section>
      )}

      {entry.analysis && entry.analysis.learnings.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">学び</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground/85">
            {entry.analysis.learnings.map((learning, i) => (
              <li key={i} className="list-disc pl-4">
                {learning}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">最終応答</h2>
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-4 text-sm text-foreground">
          {entry.finalResponse || "(なし)"}
        </pre>
      </section>
    </div>
  );
}
