import assert from "node:assert/strict";
import { test } from "node:test";
import { request, setupTestEnv } from "./helpers";

setupTestEnv();

async function getHtml(path: string, status = 200): Promise<string> {
  const res = await request(path);
  assert.equal(res.status, status);
  return res.text();
}

test("GET / は 2 件のログと未解析バッジを出す", async () => {
  const html = await getHtml("/");
  assert.ok(html.includes("テスト用セッション 1"));
  assert.ok(html.includes("テスト用セッション 2"));
  assert.ok(html.includes('data-badge="unanalyzed"'));
});

test("GET / のサイドバーに すべて・実装・未解析 のリンクがある", async () => {
  const html = await getHtml("/");
  assert.match(html, /<a [^>]*data-category-link=""[^>]*>すべて/);
  assert.match(html, /<a [^>]*data-category-link="実装"[^>]*>実装/);
  assert.match(html, /<a [^>]*data-category-link="未解析"[^>]*>未解析/);
});

test("GET /?q=セッション 2 は該当するログだけを出し、検索欄に値を残す", async () => {
  const html = await getHtml(`/?q=${encodeURIComponent("セッション 2")}`);
  assert.ok(html.includes("テスト用セッション 2"));
  assert.ok(!html.includes("テスト用セッション 1"));
  assert.ok(html.includes('value="セッション 2"'));
});

test("GET /?client=codex は codex のログだけを出し、option に selected を付ける", async () => {
  const html = await getHtml("/?client=codex");
  assert.ok(html.includes('<option value="codex" selected'));
  assert.ok(!html.includes('<option value="claude-code" selected'));
  assert.ok(html.includes("テスト用セッション 2"));
  assert.ok(!html.includes("テスト用セッション 1"));
});

test("GET /?tag=hono はタグを持つログだけを出し、解除リンクを付ける", async () => {
  const html = await getHtml("/?tag=hono");
  assert.ok(html.includes("テスト用セッション 1"));
  assert.ok(!html.includes("テスト用セッション 2"));
  assert.ok(html.includes("data-tag-clear"));
});

test("GET /?category=未解析 は未解析のログだけを出す", async () => {
  const html = await getHtml(`/?category=${encodeURIComponent("未解析")}`);
  assert.ok(html.includes("テスト用セッション 2"));
  assert.ok(!html.includes("テスト用セッション 1"));
});

test("GET /log/fixture-001 はサマリー・学び・タグのリンク・最終応答を出す", async () => {
  const html = await getHtml("/log/fixture-001");
  assert.ok(html.includes("テスト用のサマリー。"));
  assert.ok(html.includes("テスト用の学び"));
  assert.ok(html.includes('href="/?tag=hono"'));
  assert.ok(html.includes("テスト用の作業を終えました。"));
});

test("GET /log/fixture-002 (未解析) にはサマリーの見出しが無い", async () => {
  const html = await getHtml("/log/fixture-002");
  assert.ok(!html.includes("サマリー"));
  assert.ok(html.includes("確認しました。"));
});
