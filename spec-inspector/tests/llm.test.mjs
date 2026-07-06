// llm.test.mjs — OpenAIプロバイダとAI補足オーケストレーションのオフライン検証
// 実行: node tests/llm.test.mjs（実APIは一切呼ばない。fetch注入＋localStorageスタブ）

// llm.js はブラウザ前提で localStorage を関数内参照するため、import前にスタブを定義する
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

import assert from "node:assert";
import { buildOpenAIRequest, extractText, describeError, callOpenAI, OPENAI_URL } from "../src/providers/openai.js";
import {
  getProvider, setProvider, getModel, setModel,
  getOpenAIKey, setOpenAIKey, setOpenAIOrg, setOpenAIProject, enrichWithAI,
} from "../src/llm.js";

let pass = 0, fail = 0;
function test(name, fn) {
  const p = (async () => fn())();
  return p.then(
    () => { pass++; console.log(`  ✓ ${name}`); },
    (e) => { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
  );
}
const okResponse = (content) => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
  text: async () => "",
});
const errResponse = (status, body = "") => ({ ok: false, status, text: async () => body, json: async () => ({}) });

console.log("openai: buildOpenAIRequest");
await test("URL・Bearer・JSONモード・max_completion_tokensの最小構成", () => {
  const req = buildOpenAIRequest({ apiKey: "sk-x", model: "gpt-5-mini", system: "S", user: "U" });
  assert.strictEqual(req.url, OPENAI_URL);
  assert.strictEqual(req.headers.Authorization, "Bearer sk-x");
  const body = JSON.parse(req.body);
  assert.strictEqual(body.model, "gpt-5-mini");
  assert.deepStrictEqual(body.response_format, { type: "json_object" });
  assert.strictEqual(body.max_completion_tokens, 3000);
  assert.deepStrictEqual(body.messages.map((m) => m.role), ["system", "user"]);
});
await test("gpt-5系非互換パラメータ（max_tokens/temperature）を含まない", () => {
  const body = JSON.parse(buildOpenAIRequest({ apiKey: "k", model: "m", system: "s", user: "u" }).body);
  assert.ok(!("max_tokens" in body), "max_tokensが混入");
  assert.ok(!("temperature" in body), "temperatureが混入");
});
await test("org/projectは非空時のみヘッダ付与", () => {
  const with_ = buildOpenAIRequest({ apiKey: "k", org: "org-1", project: "proj_1", model: "m", system: "s", user: "u" });
  assert.strictEqual(with_.headers["OpenAI-Organization"], "org-1");
  assert.strictEqual(with_.headers["OpenAI-Project"], "proj_1");
  const without = buildOpenAIRequest({ apiKey: "k", model: "m", system: "s", user: "u" });
  assert.ok(!("OpenAI-Organization" in without.headers));
  assert.ok(!("OpenAI-Project" in without.headers));
});

console.log("openai: extractText / describeError");
await test("choices[0].message.content を抽出、欠損は空文字", () => {
  assert.strictEqual(extractText({ choices: [{ message: { content: "abc" } }] }), "abc");
  assert.strictEqual(extractText({}), "");
  assert.strictEqual(extractText(null), "");
});
await test("ステータス別の日本語エラー", () => {
  assert.ok(describeError(401).includes("APIキーが無効"));
  assert.ok(describeError(403).includes("Organization/Project"));
  assert.ok(describeError(429).includes("レート制限"));
  assert.ok(describeError(500).includes("サーバエラー"));
  const e400 = describeError(400, JSON.stringify({ error: { message: "Unsupported parameter: max_tokens" } }));
  assert.ok(e400.includes("max_tokens"), `400詳細欠落: ${e400}`);
});

console.log("openai: callOpenAI（fetchモック）");
await test("200正常系でtextを返す", async () => {
  const res = await callOpenAI({ url: "u", headers: {}, body: "{}" }, { fetchImpl: async () => okResponse("hello") });
  assert.deepStrictEqual(res, { ok: true, text: "hello" });
});
await test("401はthrowせずエラーメッセージを返す", async () => {
  const res = await callOpenAI({ url: "u", headers: {}, body: "{}" }, { fetchImpl: async () => errResponse(401) });
  assert.ok(!res.ok && res.error.includes("APIキーが無効"));
});
await test("タイムアウトでAbortを日本語化", async () => {
  const never = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const res = await callOpenAI({ url: "u", headers: {}, body: "{}" }, { fetchImpl: never, timeoutMs: 50 });
  assert.ok(!res.ok && res.error.includes("タイムアウト"));
});
await test("fetch例外はネットワークエラーに変換", async () => {
  const res = await callOpenAI({ url: "u", headers: {}, body: "{}" }, { fetchImpl: async () => { throw new Error("boom"); } });
  assert.ok(!res.ok && res.error.includes("ネットワーク"));
});

console.log("llm: 設定");
await test("providerの旧値・不正値はruleに正規化", () => {
  localStorage.setItem("spec-inspector.provider.v1", "claude");
  assert.strictEqual(getProvider(), "rule");
  setProvider("openai");
  assert.strictEqual(getProvider(), "openai");
});
await test("モデル既定はgpt-5-mini・空設定は既定に戻る", () => {
  localStorage.removeItem("spec-inspector.openai.model.v1");
  assert.strictEqual(getModel(), "gpt-5-mini");
  setModel("  gpt-5  ");
  assert.strictEqual(getModel(), "gpt-5");
  setModel("");
  assert.strictEqual(getModel(), "gpt-5-mini");
});

console.log("llm: enrichWithAI（graceful degradation）");
const aiFinding = { viewpoint: "depth", severity: "High", doc: "a.md", message: "競合制御が無い", evidence: "上書きされる", suggestion: "楽観ロック", expectedEffect: "更新消失防止" };
const docs = [{ name: "a.md", text: "保存時に最新の内容で上書きされる。", role: "requirement" }];

await test("provider=ruleは短絡（fetch未呼び出し）", async () => {
  setProvider("rule");
  let called = 0;
  const r = await enrichWithAI(docs, { fetchImpl: async () => { called++; return okResponse(""); } });
  assert.deepStrictEqual(r, { enabled: false, findings: [] });
  assert.strictEqual(called, 0);
});
await test("キー未設定はスキップ理由を返す", async () => {
  setProvider("openai");
  setOpenAIKey("");
  const r = await enrichWithAI(docs, { fetchImpl: async () => okResponse("") });
  assert.ok(!r.enabled && r.error.includes("APIキー未設定"));
});
await test("正常系: source:aiタグ付きfindingsが返り、リクエストにorg/projectが載る", async () => {
  setProvider("openai");
  setOpenAIKey("sk-test");
  setOpenAIOrg("org-t");
  setOpenAIProject("proj_t");
  let captured;
  const r = await enrichWithAI(docs, {
    fetchImpl: async (url, opts) => { captured = { url, opts }; return okResponse(JSON.stringify({ findings: [aiFinding] })); },
  });
  assert.ok(r.enabled && r.findings.length === 1);
  assert.strictEqual(r.findings[0].source, "ai");
  assert.strictEqual(captured.url, OPENAI_URL);
  assert.strictEqual(captured.opts.headers["OpenAI-Organization"], "org-t");
  assert.strictEqual(captured.opts.headers["OpenAI-Project"], "proj_t");
  const body = JSON.parse(captured.opts.body);
  assert.strictEqual(body.model, "gpt-5-mini");
  assert.ok(body.messages[1].content.includes("a.md"), "userに文書名なし");
});
await test("API失敗時は enabled:true・findings空・error付き（ルール結果は呼び出し側で維持）", async () => {
  setOpenAIKey("sk-test");
  const r = await enrichWithAI(docs, { fetchImpl: async () => errResponse(429) });
  assert.ok(r.enabled && r.findings.length === 0 && r.error.includes("レート制限"));
});
await test("重複findingsはmessage+evidenceで排除", async () => {
  setOpenAIKey("sk-test");
  const dup = JSON.stringify({ findings: [aiFinding, { ...aiFinding }] });
  const r = await enrichWithAI(docs, { fetchImpl: async () => okResponse(dup) });
  assert.strictEqual(r.findings.length, 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
