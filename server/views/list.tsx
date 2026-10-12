import { getKnowledge } from "@/lib/knowledge";
import { CATEGORIES } from "@/lib/types";

function buildHref(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== "");
  if (entries.length === 0) return "/";
  const query = new URLSearchParams(entries.map(([key, value]) => [key, value])).toString();
  return `/?${query}`;
}

function matches(entry: { title: string; analysis?: { summary?: string; tags?: string[] } }, q: string): boolean {
  const needle = q.toLowerCase();
  const haystack = [entry.title, entry.analysis?.summary ?? "", ...(entry.analysis?.tags ?? [])].join(" ").toLowerCase();
  return haystack.includes(needle);
}

export async function ListPage({ query }: { query: URLSearchParams }) {
  const q = query.get("q") ?? "";
  const category = query.get("category") ?? "";
  const client = query.get("client") ?? "";
  const project = query.get("project") ?? "";
  const tag = query.get("tag") ?? "";

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

  const sidebarCategories = [...CATEGORIES, "未解析"].filter((c) => categoryCounts.get(c) !== undefined);

  return (
    <div class="mx-auto flex max-w-6xl gap-6 px-4 py-6">
      <aside class="w-48 shrink-0">
        <h2 class="mb-2 text-sm font-semibold text-muted-foreground">カテゴリ</h2>
        <ul class="flex flex-col gap-1 text-sm">
          <li>
            <a
              href={buildHref({ category: "", q, client, project, tag })}
              data-category-link=""
              class={`block rounded-full px-2 py-1 ${
                category === "" ? "bg-primary font-medium text-primary-foreground" : "text-foreground/85 hover:bg-accent"
              }`}
            >
              すべて
              <span class="ml-1 text-xs text-muted-foreground">{all.length}</span>
            </a>
          </li>
          {sidebarCategories.map((c) => (
            <li>
              <a
                href={buildHref({ category: c, q, client, project, tag })}
                data-category-link={c}
                class={`block rounded-full px-2 py-1 ${
                  category === c ? "bg-primary font-medium text-primary-foreground" : "text-foreground/85 hover:bg-accent"
                }`}
              >
                {c}
                <span class="ml-1 text-xs text-muted-foreground">{categoryCounts.get(c)}</span>
              </a>
            </li>
          ))}
        </ul>
      </aside>

      <div class="flex-1">
        <form method="get" class="mb-4 flex flex-wrap gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          {tag && <input type="hidden" name="tag" value={tag} />}
          <input
            name="q"
            value={q}
            placeholder="キーワード検索"
            class="w-48 rounded-sm border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            name="client"
            class="rounded-sm border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" selected={client === ""}>
              全クライアント
            </option>
            <option value="claude-code" selected={client === "claude-code"}>
              claude-code
            </option>
            <option value="codex" selected={client === "codex"}>
              codex
            </option>
          </select>
          <select
            name="project"
            class="rounded-sm border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" selected={project === ""}>
              全プロジェクト
            </option>
            {projects.map((p) => (
              <option value={p} selected={project === p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="submit"
            class="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/85 disabled:opacity-50"
          >
            絞り込み
          </button>
        </form>

        {tag && (
          <div class="mb-4 text-sm text-foreground/85">
            タグ: {tag}{" "}
            <a
              href={buildHref({ q, category, client, project })}
              data-tag-clear=""
              aria-label="タグの絞り込みを解除"
              class="ml-1 text-muted-foreground hover:text-primary hover:underline"
            >
              ×
            </a>
          </div>
        )}

        <ul class="flex flex-col gap-3">
          {filtered.map((entry) => (
            <li data-entry-id={entry.id} class="rounded-md border border-border bg-card p-4 text-card-foreground shadow-md">
              <div class="flex items-start justify-between gap-2">
                <a href={`/log/${entry.id}`} class="text-base font-semibold hover:underline">
                  {entry.title || "(タイトルなし)"}
                </a>
                <span class="shrink-0 text-xs text-muted-foreground">{entry.startedAt}</span>
              </div>
              <div class="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{entry.project}</span>
                <span>{entry.client}</span>
                {entry.analysis ? (
                  <span class="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{entry.analysis.category}</span>
                ) : (
                  <span data-badge="unanalyzed" class="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">
                    未解析
                  </span>
                )}
              </div>
              {entry.analysis?.summary && (
                <p class="mt-2 line-clamp-2 text-sm text-foreground/85">{entry.analysis.summary}</p>
              )}
              {entry.analysis?.tags && entry.analysis.tags.length > 0 && (
                <div class="mt-2 flex flex-wrap gap-1">
                  {entry.analysis.tags.map((t) => (
                    <a
                      href={buildHref({ q, category, client, project, tag: t })}
                      class="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground hover:underline"
                    >
                      {t}
                    </a>
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
