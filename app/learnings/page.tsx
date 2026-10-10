import Link from "next/link";
import { getKnowledge } from "@/lib/knowledge";
import { CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LearningsPage() {
  const all = await getKnowledge();

  const grouped = new Map<string, { logId: string; title: string; learning: string }[]>();
  for (const entry of all) {
    if (!entry.analysis) continue;
    for (const learning of entry.analysis.learnings) {
      const key = entry.analysis.category;
      const list = grouped.get(key) ?? [];
      list.push({ logId: entry.id, title: entry.title || "(タイトルなし)", learning });
      grouped.set(key, list);
    }
  }

  const fixed: string[] = CATEGORIES.filter((c) => grouped.has(c));
  const extra = [...grouped.keys()].filter((c) => !(CATEGORIES as readonly string[]).includes(c));
  const sections = [...fixed, ...extra];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-semibold">学び</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        全ログの「学び」をカテゴリ別に一覧
      </p>

      {sections.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          まだ解析されたログがありません。
        </p>
      )}

      {sections.map((category) => {
        const items = grouped.get(category)!;
        return (
          <section key={category} className="mt-6">
            <h2 className="text-lg font-semibold">{category}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {items.map((item, i) => (
                <li
                  key={i}
                  data-learning-item=""
                  className="rounded-md border border-border bg-card p-3 text-card-foreground shadow-md"
                >
                  <p className="text-sm text-foreground/85">{item.learning}</p>
                  <Link
                    href={`/log/${item.logId}`}
                    className="mt-1 block text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
