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
  const tag = typeof raw.tag === "string" ? raw.tag : "";

  const all = await getKnowledge();

  const projects = [...new Set(all.map((entry) => entry.project).filter(Boolean))].sort();

  const filtered = all.filter((entry) => {
    if (category === "未解析") {
      if (entry.analysis) return false;
    } else if (category && entry.analysis?.category !== category) {
      return false;
    }
    if (client && entry.client !== client) return false;
    if (project && entry.project !== project) return false;
    if (tag && !(entry.analysis?.tags ?? []).includes(tag)) return false;
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
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          カテゴリ
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <Link
              href={buildHref({ category: "", q, client, project, tag })}
              data-category-link=""
              className={`block rounded-full px-2 py-1 ${
                category === ""
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-foreground/85 hover:bg-accent"
              }`}
            >
              すべて
              <span className="ml-1 text-xs text-muted-foreground">
                {all.length}
              </span>
            </Link>
          </li>
          {sidebarCategories.map((c) => (
            <li key={c}>
              <Link
                href={buildHref({ category: c, q, client, project, tag })}
                data-category-link={c}
                className={`block rounded-full px-2 py-1 ${
                  category === c
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-foreground/85 hover:bg-accent"
                }`}
              >
                {c}
                <span className="ml-1 text-xs text-muted-foreground">
                  {categoryCounts.get(c)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex-1">
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          {tag && <input type="hidden" name="tag" value={tag} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="キーワード検索"
            className="w-48 rounded-sm border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            name="client"
            defaultValue={client}
            className="rounded-sm border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">全クライアント</option>
            <option value="claude-code">claude-code</option>
            <option value="codex">codex</option>
          </select>
          <select
            name="project"
            defaultValue={project}
            className="rounded-sm border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">全プロジェクト</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/85 disabled:opacity-50">
            絞り込み
          </button>
        </form>

        {tag && (
          <div className="mb-4 text-sm text-foreground/85">
            タグ: {tag}{" "}
            <Link
              href={buildHref({ q, category, client, project })}
              data-tag-clear=""
              aria-label="タグの絞り込みを解除"
              className="ml-1 text-muted-foreground hover:text-primary hover:underline"
            >
              ×
            </Link>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {filtered.map((entry) => (
            <li
              key={entry.id}
              data-entry-id={entry.id}
              className="rounded-md border border-border bg-card p-4 text-card-foreground shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/log/${entry.id}`}
                  className="text-base font-semibold hover:underline"
                >
                  {entry.title || "(タイトルなし)"}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.startedAt}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{entry.project}</span>
                <span>{entry.client}</span>
                {entry.analysis ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">
                    {entry.analysis.category}
                  </span>
                ) : (
                  <span
                    data-badge="unanalyzed"
                    className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground"
                  >
                    未解析
                  </span>
                )}
              </div>
              {entry.analysis?.summary && (
                <p className="mt-2 line-clamp-2 text-sm text-foreground/85">
                  {entry.analysis.summary}
                </p>
              )}
              {entry.analysis?.tags && entry.analysis.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {entry.analysis.tags.map((t) => (
                    <Link
                      key={t}
                      href={buildHref({ q, category, client, project, tag: t })}
                      className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground hover:underline"
                    >
                      {t}
                    </Link>
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
