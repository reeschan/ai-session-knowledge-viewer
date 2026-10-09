import Link from "next/link";
import { getKnowledge } from "@/lib/knowledge";
import { CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

function buildHref(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== "");
  if (entries.length === 0) return "/";
  const query = new URLSearchParams(
    entries.map(([key, value]) => [key, value])
  ).toString();
  return `/?${query}`;
}

function matches(entry: { title: string; analysis?: { summary?: string; tags?: string[] } }, q: string): boolean {
  const needle = q.toLowerCase();
  const haystack = [
    entry.title,
    entry.analysis?.summary ?? "",
    ...(entry.analysis?.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q : "";
  const category = typeof raw.category === "string" ? raw.category : "";
  const client = typeof raw.client === "string" ? raw.client : "";
  const project = typeof raw.project === "string" ? raw.project : "";

  const all = await getKnowledge();

  const projects = [...new Set(all.map((entry) => entry.project).filter(Boolean))].sort();

  const filtered = all.filter((entry) => {
    if (category && entry.analysis?.category !== category) return false;
    if (client && entry.client !== client) return false;
    if (project && entry.project !== project) return false;
    if (q && !matches(entry, q)) return false;
    return true;
  });

  const categoryCounts = new Map<string, number>();
  for (const entry of all) {
    const key = entry.analysis?.category ?? "未解析";
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  }

  const sidebarCategories = [...CATEGORIES, "未解析"].filter(
    (c) => categoryCounts.get(c) !== undefined
  );

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
      <aside className="w-48 shrink-0">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          カテゴリ
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {sidebarCategories.map((c) => (
            <li key={c}>
              <Link
                href={buildHref({ category: c === "未解析" ? "" : c })}
                className={`block rounded px-2 py-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
                  category === c
                    ? "bg-zinc-200 font-medium dark:bg-zinc-800"
                    : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {c}
                <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {categoryCounts.get(c)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex-1">
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="キーワード検索"
            className="w-48 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            name="client"
            defaultValue={client}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">全クライアント</option>
            <option value="claude-code">claude-code</option>
            <option value="codex">codex</option>
          </select>
          <select
            name="project"
            defaultValue={project}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">全プロジェクト</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-zinc-800 px-3 py-1 text-sm text-white dark:bg-zinc-700">
            絞り込み
          </button>
        </form>

        <ul className="flex flex-col gap-3">
          {filtered.map((entry) => (
            <li
              key={entry.id}
              className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/log/${entry.id}`}
                  className="text-base font-semibold hover:underline"
                >
                  {entry.title || "(タイトルなし)"}
                </Link>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {entry.startedAt}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{entry.project}</span>
                <span>{entry.client}</span>
                {entry.analysis ? (
                  <span className="rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-700">
                    {entry.analysis.category}
                  </span>
                ) : (
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    未解析
                  </span>
                )}
              </div>
              {entry.analysis?.summary && (
                <p className="mt-2 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {entry.analysis.summary}
                </p>
              )}
              {entry.analysis?.tags && entry.analysis.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {entry.analysis.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
