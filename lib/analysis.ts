import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./settings";
import type { Analysis } from "./types";

function analysisFile(): string {
  return path.join(dataDir(), "analysis.json");
}

export async function loadAnalyses(): Promise<Record<string, Analysis>> {
  try {
    const content = await readFile(analysisFile(), "utf8");
    return JSON.parse(content) as Record<string, Analysis>;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveAnalyses(all: Record<string, Analysis>): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(analysisFile(), JSON.stringify(all, null, 2), "utf8");
}
