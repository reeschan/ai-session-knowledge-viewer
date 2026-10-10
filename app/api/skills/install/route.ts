import { NextResponse } from "next/server";
import { generateSkills, installSkills, type Period } from "@/lib/skills";
import { loadSettings, saveSettings } from "@/lib/settings";
import { rejectUnlessLocal } from "@/lib/request-guard";

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function bad(message: string) {
  return new Response(`${message}\n`, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(request: Request) {
  const rejected = rejectUnlessLocal(request);
  if (rejected) return rejected;

  const form = await request.formData();
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

  return NextResponse.redirect(new URL(`/skills?installed=${written.length}`, request.url), 303);
}
