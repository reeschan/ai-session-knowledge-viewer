import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Analysis } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const ANALYSIS_FILE = path.join(DATA_DIR, "analysis.json");

export async function loadAnalyses(): Promise<Record<string, Analysis>> {
  try {
    const content = await readFile(ANALYSIS_FILE, "utf8");
    return JSON.parse(content) as Record<string, Analysis>;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveAnalyses(all: Record<string, Analysis>): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ANALYSIS_FILE, JSON.stringify(all, null, 2), "utf8");
}
