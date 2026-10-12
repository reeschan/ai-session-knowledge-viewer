import type { Context } from "hono";
import { generateSkills, installSkills, type Period } from "@/lib/skills";
import { loadSettings, saveSettings } from "@/lib/settings";

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function bad(message: string) {
  return new Response(`${message}\n`, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function postSkillsInstall(c: Context): Promise<Response> {
  const form = await c.req.raw.formData();
  const storeDir = field(form, "storeDir");
  const slackChannel = field(form, "slackChannel");
  const appDir = field(form, "appDir");
  const periods = form
    .getAll("periods")
    .filter((p): p is Period => p === "daily" || p === "weekly")
    .filter((p, i, all) => all.indexOf(p) === i);

  if (field(form, "confirm") !== "on") return bad("確認のチェックが必要です。");
  if (storeDir === "" || appDir === "") return bad("storeDir と appDir は必須です。");
  if (periods.length === 0) return bad("periods を 1 つ以上選んでください。");

  const { files } = generateSkills({ storeDir, slackChannel, appDir, periods });
  const written = await installSkills(files);

  const current = await loadSettings();
  await saveSettings({ ...current, skills: { storeDir, slackChannel, appDir } });

  return c.redirect(`/skills?installed=${written.length}`, 303);
}
