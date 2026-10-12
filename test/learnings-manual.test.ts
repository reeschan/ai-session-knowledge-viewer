import assert from "node:assert/strict";
import { test } from "node:test";
import { request, setupTestEnv } from "./helpers";

setupTestEnv();

test("GET /learnings は見出し・カテゴリ・学び・ログへのリンクを出す", async () => {
  const res = await request("/learnings");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /学び/);
  assert.match(html, /実装/);
  assert.match(html, /テスト用の学び/);
  assert.ok(html.includes('href="/log/fixture-001"'));
  assert.ok(html.includes("data-learning-item"));
});

test("GET /manual は class=\"manual の要素の中に MANUAL.md の見出しを <h1 として出す", async () => {
  const res = await request("/manual");
  assert.equal(res.status, 200);
  const html = await res.text();
  const start = html.indexOf('class="manual');
  assert.ok(start >= 0, 'class="manual を持つ要素がある');
  assert.match(html.slice(start), /<h1[^>]*>Knowledge Viewer マニュアル/);
});

test("GET /manual は SVG を data URI にし、architecture/ の srcset を残さない", async () => {
  const html = await (await request("/manual")).text();
  assert.ok(html.includes("data:image/svg+xml;base64,"));
  assert.ok(!html.includes('srcset="architecture/'));
});

test("GET /manual の <table は HTML のまま出る", async () => {
  const html = await (await request("/manual")).text();
  assert.ok(html.includes("<table"));
  assert.ok(!html.includes("&lt;table"));
});
