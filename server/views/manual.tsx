import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function renderManual(): Promise<string | null> {
  const md = await readText(path.join(process.cwd(), "docs", "MANUAL.md"));
  if (md === null) return null;
  let html = marked.parse(md, { gfm: true, async: false }) as string;

  // <source ... srcset="architecture/..."> は取り除く（ダーク固定なので不要）
  html = html.replace(/<source\b[^>]*srcset="(?:\.\/)?architecture\/[^"]*"[^>]*>/g, "");

  // src="architecture/<名前>-light.svg" / -dark.svg をダーク版の data URI に置き換える
  const names = new Set<string>();
  for (const m of html.matchAll(/src="(?:\.\/)?architecture\/([\w.-]+?)-(?:light|dark)\.svg"/g)) {
    names.add(m[1]);
  }
  for (const name of names) {
    const svg = await readFile(
      path.join(process.cwd(), "docs", "architecture", name + "-dark.svg"),
    ).catch(() => null);
    if (!svg) continue;
    const uri = "data:image/svg+xml;base64," + svg.toString("base64");
    for (const variant of ["light", "dark"]) {
      for (const prefix of ["", "./"]) {
        html = html.split("src=\"" + prefix + "architecture/" + name + "-" + variant + ".svg\"").join("src=\"" + uri + "\"");
      }
    }
  }
  return html;
}

export async function ManualPage() {
  const html = await renderManual();

  if (html === null) {
    return (
      <div class="mx-auto max-w-3xl px-4 py-6">
        <p class="text-sm text-muted-foreground">docs/MANUAL.md が見つかりません</p>
      </div>
    );
  }

  // html はリポジトリ内の信頼できるファイル（docs/MANUAL.md）だけから作る。外部入力は入らない。
  return <div class="manual mx-auto max-w-3xl px-4 py-6" dangerouslySetInnerHTML={{ __html: html }} />;
}
