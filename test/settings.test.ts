import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { maskKey } from "@/lib/settings";
import { FIXTURES, request, setupTestEnv } from "./helpers";

const API_KEY = "sk-test-0000-abcd";

const dir = setupTestEnv({
  llm: {
    provider: "anthropic",
    anthropic: { apiKey: API_KEY, model: "claude-test-model", baseUrl: "" },
    openai: { baseUrl: "http://127.0.0.1:8888/v1", apiKey: "", model: "" },
  },
});
const settingsFile = path.join(dir, "settings.json");

/** hono/jsx が属性値に施すのと同じ HTML エスケープ。 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function readSettingsFile(): {
  llm: { provider: string; anthropic: { apiKey: string } };
} {
  return JSON.parse(fs.readFileSync(settingsFile, "utf8"));
}

test("テスト用の KV_DATA_DIR は一時フォルダを指す (実際の data/ やホームに書かない)", () => {
  assert.equal(process.env.KV_DATA_DIR, dir);
  assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())));
  assert.ok(fs.existsSync(settingsFile));
});

test("GET /settings は 200 で、今の値が value / selected / checked で出る", async () => {
  const res = await request("/settings");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes(`value="${escapeHtml(path.join(FIXTURES, "logs"))}"`), "ソースのパス");
  assert.ok(html.includes('<option value="markdown" selected'), "ソースの種類");
  assert.match(html, /<input type="checkbox" name="source\.0\.enabled" value="on" checked/, "有効のチェックボックス");
  assert.ok(html.includes('<option value="anthropic" selected'), "プロバイダ");
  assert.ok(!html.includes('<option value="openai-compatible" selected'));
});

test("GET /settings は API キーそのものを出さず、伏せ字だけを出す", async () => {
  const html = await (await request("/settings")).text();
  assert.ok(!html.includes(API_KEY));
  assert.ok(html.includes(maskKey(API_KEY)));
});

test("GET /settings?saved=1 は「保存しました」を出し、saved なしは出さない", async () => {
  const saved = await (await request("/settings?saved=1")).text();
  assert.ok(saved.includes("保存しました"));
  const plain = await (await request("/settings")).text();
  assert.ok(!plain.includes("保存しました"));
});

test("環境変数で上書きされている項目を知らせる", async () => {
  process.env.LLM_MODEL = "env-model";
  try {
    const html = await (await request("/settings")).text();
    assert.ok(html.includes("環境変数で上書きされている項目"));
    assert.ok(html.includes("LLM_MODEL"));
  } finally {
    process.env.LLM_MODEL = "";
  }
});

test("POST /api/settings は保存して /settings?saved=1 へ 303。空欄の API キーは既存の値を残す", async () => {
  const before = fs.readFileSync(settingsFile, "utf8");
  try {
    const body = new URLSearchParams({
      "source.0.type": "markdown",
      "source.0.path": path.join(FIXTURES, "logs"),
      "source.0.enabled": "on",
      "source.1.type": "markdown",
      "source.1.path": "",
      "llm.provider": "openai-compatible",
      "llm.anthropic.apiKey": "",
      "llm.anthropic.model": "claude-test-model",
      "llm.anthropic.baseUrl": "",
      "llm.openai.baseUrl": "http://127.0.0.1:8888/v1",
      "llm.openai.apiKey": "",
      "llm.openai.model": "local-model",
      "skills.storeDir": "",
      "skills.slackChannel": "",
      "skills.appDir": dir,
    });
    const res = await request("/api/settings", { method: "POST", body });
    assert.equal(res.status, 303);
    assert.ok((res.headers.get("location") ?? "").endsWith("/settings?saved=1"));
    const saved = readSettingsFile();
    assert.equal(saved.llm.provider, "openai-compatible");
    assert.equal(saved.llm.anthropic.apiKey, API_KEY);
  } finally {
    fs.writeFileSync(settingsFile, before, "utf8");
  }
});

test("POST /api/settings は不正値なら 400 のテキストを返し、settings.json を変えない", async () => {
  const before = fs.readFileSync(settingsFile, "utf8");
  const res = await request("/api/settings", {
    method: "POST",
    body: new URLSearchParams({ "llm.provider": "bogus" }),
  });
  assert.equal(res.status, 400);
  assert.ok((res.headers.get("content-type") ?? "").startsWith("text/plain"));
  assert.ok((await res.text()).startsWith("設定の値が不正です。"));
  assert.equal(fs.readFileSync(settingsFile, "utf8"), before);
});
