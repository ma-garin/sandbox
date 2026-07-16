// qualityforward.test.mjs — QualityForwardプロバイダのオフライン検証
// 実行: node tests/qualityforward.test.mjs（実APIは一切呼ばない。fetch注入のみ）

import assert from "node:assert";
import { buildQFRequest, describeError, callQF, QF_BASE_URL } from "../src/providers/qualityforward.js";

let pass = 0, fail = 0;
function test(name, fn) {
  const p = (async () => fn())();
  return p.then(
    () => { pass++; console.log(`  ✓ ${name}`); },
    (e) => { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
  );
}
const okResponse = (bodyObj, status = 200) => ({
  ok: true,
  status,
  text: async () => (bodyObj === undefined ? "" : JSON.stringify(bodyObj)),
});
const errResponse = (status, body = "") => ({ ok: false, status, text: async () => body });

console.log("buildQFRequest");
await test("URL・Bearerヘッダの最小構成", () => {
  const req = buildQFRequest({ apiKey: "key-x", method: "GET", path: "/current_project" });
  assert.strictEqual(req.url, `${QF_BASE_URL}/current_project`);
  assert.strictEqual(req.method, "GET");
  assert.strictEqual(req.headers.Authorization, "Bearer key-x");
  assert.strictEqual(req.body, undefined);
});
await test("bodyがある場合はJSON化してcontent-typeを付与", () => {
  const req = buildQFRequest({ apiKey: "k", method: "POST", path: "/test_suites", body: { test_suite: { name: "n" } } });
  assert.strictEqual(req.headers["content-type"], "application/json");
  assert.deepStrictEqual(JSON.parse(req.body), { test_suite: { name: "n" } });
});
await test("queryは空値を除いてURLに反映", () => {
  const req = buildQFRequest({ apiKey: "k", path: "/test_suites", query: { a: "1", b: undefined, c: "" } });
  assert.ok(req.url.includes("a=1"));
  assert.ok(!req.url.includes("b="));
  assert.ok(!req.url.includes("c="));
});

console.log("describeError");
await test("ステータス別の日本語エラー", () => {
  assert.ok(describeError(401).includes("APIキーが無効"));
  assert.ok(describeError(403).includes("権限"));
  assert.ok(describeError(404).includes("見つかりません"));
  assert.ok(describeError(429).includes("レート制限"));
  assert.ok(describeError(500).includes("サーバエラー"));
});
await test("422は詳細メッセージを抽出", () => {
  const msg = describeError(422, JSON.stringify({ message: "nameは必須です" }));
  assert.ok(msg.includes("nameは必須です"), msg);
});

console.log("callQF（fetchモック）");
await test("200正常系でdataを返す", async () => {
  const res = await callQF({ url: "u", method: "GET", headers: {} }, { fetchImpl: async () => okResponse({ id: 1 }) });
  assert.deepStrictEqual(res, { ok: true, status: 200, data: { id: 1 } });
});
await test("空ボディ(204等)はdata:nullを返す", async () => {
  const res = await callQF({ url: "u", method: "DELETE", headers: {} }, { fetchImpl: async () => okResponse(undefined, 204) });
  assert.deepStrictEqual(res, { ok: true, status: 204, data: null });
});
await test("401はthrowせずエラーメッセージを返す", async () => {
  const res = await callQF({ url: "u", method: "GET", headers: {} }, { fetchImpl: async () => errResponse(401) });
  assert.ok(!res.ok && res.error.includes("APIキーが無効"));
});
await test("タイムアウトでAbortを日本語化", async () => {
  const never = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const res = await callQF({ url: "u", method: "GET", headers: {} }, { fetchImpl: never, timeoutMs: 50 });
  assert.ok(!res.ok && res.error.includes("タイムアウト"));
});
await test("fetch例外はネットワーク/CORSエラーに変換", async () => {
  const res = await callQF({ url: "u", method: "GET", headers: {} }, { fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  assert.ok(!res.ok && res.error.includes("ネットワークエラー"));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
