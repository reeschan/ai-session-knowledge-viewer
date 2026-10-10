import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { listLogs } from "./logs";
import { loadAnalyses } from "./analysis";
import { effectiveSettings } from "./settings";
import { CATEGORIES, type Analysis, type LogEntry } from "./types";

export type KnowledgeEntry = LogEntry & { analysis?: Analysis };

type SkillSummary = Omit<Analysis, "id" | "mtimeMs">;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** <storeDir>/summaries/*.json を sessionId ごとに読む。フォルダが無い・壊れた JSON は無視する。 */
async function loadSkillSummaries(storeDir: string): Promise<Map<string, SkillSummary>> {
  const result = new Map<string, SkillSummary>();
  if (storeDir === "") return result;
  const dir = path.join(storeDir, "summaries");
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return result;
  }
  for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
    try {
      const data: unknown = JSON.parse(await readFile(path.join(dir, name), "utf8"));
      if (typeof data !== "object" || data === null) continue;
      const d = data as Record<string, unknown>;
      if (typeof d.sessionId !== "string" || typeof d.summary !== "string") continue;
      const category =
        typeof d.category === "string" && (CATEGORIES as readonly string[]).includes(d.category)
          ? d.category
          : "その他";
      result.set(d.sessionId, {
        summary: d.summary,
        category,
        tags: strings(d.tags),
        learnings: strings(d.learnings),
      });
    } catch {
      // 壊れた JSON は無視する
    }
  }
  return result;
}

export async function getKnowledge(): Promise<KnowledgeEntry[]> {
  const [logs, analyses, settings] = await Promise.all([listLogs(), loadAnalyses(), effectiveSettings()]);
  const summaries = await loadSkillSummaries(settings.skills.storeDir);
  return logs.map((log) => {
    const stored = analyses[log.id];
    if (stored) return { ...log, analysis: stored };
    const fromSkill = summaries.get(log.sessionId);
    return {
      ...log,
      analysis: fromSkill ? { id: log.id, mtimeMs: log.mtimeMs, ...fromSkill } : undefined,
    };
  });
}
