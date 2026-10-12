import assert from "node:assert/strict";
import { test } from "node:test";
import { request, setupTestEnv } from "./helpers";

setupTestEnv();

test("GET /learnings は 200 で、Layout (DOCTYPE・CSS・ヘッダー) を含む", async () => {
  const res = await request("/learnings");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Knowledge Viewer/);
  assert.match(html, /href="\/app\.css"/);
  assert.match(html, /<!DOCTYPE html>/i);
});

test("GET /manual の title はマニュアル用", async () => {
  const res = await request("/manual");
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes("<title>マニュアル | Knowledge Viewer</title>"));
});

test("存在しないページは 404 で、Layout の中にメッセージを出す", async () => {
  const res = await request("/no-such-page");
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /見つかりません/);
  assert.match(html, /Knowledge Viewer/);
});

test("存在しないログ ID は 404 で、Layout の中にメッセージを出す", async () => {
  const res = await request("/log/no-such-id");
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /見つかりません/);
  assert.match(html, /Knowledge Viewer/);
});

test("末尾に / が付いた URL は / なしへ転送する", async () => {
  for (const p of ["/settings/", "/learnings/", "/log/fixture-001/"]) {
    const res = await request(p, { redirect: "manual" });
    assert.equal(res.status, 301, p);
    assert.ok((res.headers.get("location") ?? "").endsWith(p.slice(0, -1)), p);
  }
});

test("Host が evil.example の GET は 403", async () => {
  const res = await request("/", { headers: { host: "evil.example" } });
  assert.equal(res.status, 403);
});

test("GET には Host の確認だけがかかる (Sec-Fetch-Site: cross-site でも 403 にならない)", async () => {
  const res = await request("/", { headers: { host: "127.0.0.1:3000", "sec-fetch-site": "cross-site" } });
  assert.notEqual(res.status, 403);
});

test("POST /api/settings は別サイトの Origin・別の Host なら 403", async () => {
  const crossOrigin = await request("/api/settings", {
    method: "POST",
    headers: { host: "127.0.0.1:3000", origin: "http://evil.example" },
  });
  assert.equal(crossOrigin.status, 403);
  const badHost = await request("/api/settings", { method: "POST", headers: { host: "evil.example" } });
  assert.equal(badHost.status, 403);
});

test("静的ファイル (/app.css・/favicon.ico) を配信する", async () => {
  const css = await request("/app.css");
  assert.equal(css.status, 200);
  assert.ok((css.headers.get("content-type") ?? "").includes("text/css"));
  const icon = await request("/favicon.ico");
  assert.equal(icon.status, 200);
});
