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

  const sections = [...CATEGORIES, "その他"].filter((c) => grouped.has(c));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-semibold">学び</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        全ログの「学び」をカテゴリ別に一覧
      </p>

      {sections.length === 0 && (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
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
                  className="rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.learning}</p>
                  <Link
                    href={`/log/${item.logId}`}
                    className="mt-1 block text-xs text-zinc-500 hover:underline dark:text-zinc-400"
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
