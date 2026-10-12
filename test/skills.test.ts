import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { request, setupTestEnv } from "./helpers";

const dir = setupTestEnv();
const homeDir = process.env.KV_HOME_DIR ?? "";
// 本物のホームの .claude に書かないよう、KV_HOME_DIR が一時フォルダを指していることを確かめる。
assert.ok(homeDir !== "" && homeDir.startsWith(dir), "KV_HOME_DIR は一時フォルダを指していること");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function listFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name));
}

function postForm(fields: [string, string][]): Promise<Response> {
  const body = new URLSearchParams();
  for (const [k, v] of fields) body.append(k, v);
  return request("/api/skills/install", { method: "POST", body });
}

test("GET /skills は 200 で、daily だけ checked で、定期実行の説明を含む", async () => {
  const res = await request("/skills");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<input[^>]*name="periods" value="daily"[^>]*\bchecked\b/);
  assert.doesNotMatch(html, /<input[^>]*name="periods" value="weekly"[^>]*\bchecked\b/);
  assert.ok(html.includes("定期実行について"));
});

test("storeDir・appDir・periods 付きの GET はプレビューとインストールのフォームを出す", async () => {
  const storeDir = path.join(dir, "store&<x>");
  const query = new URLSearchParams({ storeDir, appDir: dir });
  query.append("periods", "daily");
  query.append("periods", "weekly");
  const res = await request(`/skills?${query.toString()}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes("プレビュー"));
  assert.ok(html.includes("フックの断片"));
  assert.ok(html.includes('action="/api/skills/install"'));
  assert.ok(html.includes('<input type="hidden" name="periods" value="daily"/>'));
  assert.ok(html.includes('<input type="hidden" name="periods" value="weekly"/>'));
  assert.equal(html.match(/type="hidden" name="periods"/g)?.length, 2);
  assert.ok(html.includes(`value="${escapeHtml(storeDir)}"`));
});

test("storeDir と appDir が空の GET はプレビューもインストールのフォームも出さない", async () => {
  const res = await request("/skills?storeDir=&appDir=");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(!html.includes("フックの断片"));
  assert.ok(!html.includes('action="/api/skills/install"'));
});

test("confirm なしの POST は 400 で、ファイルを作らない", async () => {
  const res = await postForm([
    ["storeDir", path.join(dir, "store")],
    ["appDir", dir],
    ["periods", "daily"],
  ]);
  assert.equal(res.status, 400);
  assert.ok((await res.text()).includes("確認のチェックが必要です。"));
  assert.deepEqual(listFiles(homeDir), []);
});

test("confirm 付きの POST は 303 で /skills?installed=N へ移り、ファイルと設定を書く", async () => {
  const storeDir = path.join(dir, "store");
  const res = await postForm([
    ["storeDir", storeDir],
    ["appDir", dir],
    ["periods", "daily"],
    ["confirm", "on"],
  ]);
  assert.equal(res.status, 303);
  const match = /\/skills\?installed=(\d+)$/.exec(res.headers.get("location") ?? "");
  assert.ok(match, `location: ${res.headers.get("location")}`);
  assert.ok(Number(match[1]) >= 1);
  assert.ok(listFiles(path.join(homeDir, ".claude")).length >= 1);
  const settings = JSON.parse(fs.readFileSync(path.join(dir, "settings.json"), "utf8")) as { skills: { storeDir: string } };
  assert.equal(settings.skills.storeDir, storeDir);
});

test("GET /skills?installed=3 は完了メッセージを出す", async () => {
  const res = await request("/skills?installed=3");
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes("3 件のファイルをインストールしました"));
});
