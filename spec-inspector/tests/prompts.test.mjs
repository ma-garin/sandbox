// prompts.test.mjs — プロンプトパックのオフライン検証
// 実行: node tests/prompts.test.mjs
import assert from "node:assert";
import { buildAnalysisMessages, parseAIFindings, CONTRACT_TEXT, PROMPT_VERSION } from "../src/prompts/index.js";
import { VIEWPOINT_INSTRUCTIONS, ROLE_HINTS } from "../src/prompts/viewpoints.js";
import { FEWSHOT_EXAMPLES, fewshotBlock } from "../src/prompts/examples.js";
import { chunkDocuments, estimateTokens } from "../src/prompts/chunking.js";
import { buildTestDesignPrompt, buildTestDocReviewPrompt, buildIVVPrompt } from "../src/prompts/features.js";
import { VIEWPOINTS } from "../src/engine.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("prompts: buildAnalysisMessages");
test("systemに6観点すべてと出力契約が含まれる", () => {
  const { system } = buildAnalysisMessages([{ name: "a.md", text: "本文", role: "requirement" }]);
  for (const v of VIEWPOINTS) assert.ok(system.includes(v.key), `観点${v.key}欠落`);
  assert.ok(system.includes("出力形式（厳守）"), "契約欠落");
});
test("JSONモード制約: systemに「JSON」の語が含まれる", () => {
  const { system } = buildAnalysisMessages([{ name: "a.md", text: "x" }]);
  assert.ok(system.includes("JSON"), "「JSON」の語がない（OpenAI JSONモードが拒否する）");
});
test("role=testの文書でテスト向けヒントが入り、無関係roleのヒントは入らない", () => {
  const { system } = buildAnalysisMessages([{ name: "t.md", text: "x", role: "test" }]);
  assert.ok(system.includes(ROLE_HINTS.test));
  assert.ok(!system.includes(ROLE_HINTS.design));
});
test("userに文書名ヘッダと本文が入る", () => {
  const { chunks } = buildAnalysisMessages([{ name: "要件.md", text: "REQ-001 ログイン。" }]);
  assert.strictEqual(chunks.length, 1);
  assert.ok(chunks[0].user.includes("=== 文書: 要件.md ===") && chunks[0].user.includes("REQ-001"));
  assert.deepStrictEqual(chunks[0].meta.docNames, ["要件.md"]);
});
test("versionが付く", () => {
  assert.strictEqual(buildAnalysisMessages([{ name: "a", text: "x" }]).version, PROMPT_VERSION);
});

console.log("prompts: chunking");
test("50,000字の文書は複数チャンクに分割され上限を守る", () => {
  const para = ("これは仕様の本文です。境界条件を確認します。\n").repeat(40) + "\n## 見出し\n";
  const text = para.repeat(Math.ceil(50000 / para.length));
  const chunks = chunkDocuments([{ name: "big.md", text }], { maxChars: 16000, overlapChars: 400 });
  assert.ok(chunks.length >= 3, `チャンク数不足: ${chunks.length}`);
  for (const c of chunks) for (const p of c.docs) {
    assert.ok(p.text.length <= 16000, `上限超過: ${p.text.length}`);
  }
});
test("分割断片は隣接チャンクとoverlapを共有する", () => {
  const text = ("あ".repeat(100) + "\n").repeat(400); // 40,400字
  const chunks = chunkDocuments([{ name: "b.md", text }], { maxChars: 16000, overlapChars: 400 });
  const parts = chunks.flatMap((c) => c.docs);
  assert.ok(parts.length >= 2);
  const tail = parts[0].text.slice(-200);
  assert.ok(parts[1].text.includes(tail.slice(0, 100)), "overlap未共有");
});
test("小さい文書は1チャンクに同居する", () => {
  const docs = [{ name: "a", text: "短い1" }, { name: "b", text: "短い2" }];
  const chunks = chunkDocuments(docs, { maxChars: 16000 });
  assert.strictEqual(chunks.length, 1);
  assert.strictEqual(chunks[0].docs.length, 2);
});
test("estimateTokens: 日本語は1字1token・ASCIIは4字1tokenの近似", () => {
  assert.strictEqual(estimateTokens("あいうえお"), 5);
  assert.strictEqual(estimateTokens("abcdefgh"), 2);
});

console.log("prompts: parseAIFindings");
const valid = { viewpoint: "depth", severity: "High", doc: "a.md", message: "例外系が無い", evidence: "登録する", suggestion: "追記", expectedEffect: "防止" };
test("ラッパー形 {findings:[...]} を受理", () => {
  const r = parseAIFindings(`前置き ${JSON.stringify({ findings: [valid] })} 後置き`);
  assert.ok(r.ok);
  assert.strictEqual(r.findings.length, 1);
  assert.strictEqual(r.findings[0].source, "ai");
});
test("裸配列も後方互換で受理", () => {
  const r = parseAIFindings(JSON.stringify([valid]));
  assert.ok(r.ok && r.findings.length === 1);
});
test("非JSON応答は ok:false・空配列", () => {
  const r = parseAIFindings("申し訳ありませんが指摘できません");
  assert.ok(!r.ok && r.findings.length === 0 && r.error);
});
test("不正なviewpoint/severity/evidence欠落は除外", () => {
  const r = parseAIFindings(JSON.stringify({ findings: [
    { ...valid, viewpoint: "bogus" },
    { ...valid, severity: "URGENT" },
    { ...valid, evidence: "" },
    valid,
  ] }));
  assert.strictEqual(r.findings.length, 1);
});
test("maxFindingsで切り詰める（既定10）", () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ ...valid, message: `m${i}` }));
  assert.strictEqual(parseAIFindings(JSON.stringify({ findings: many })).findings.length, 10);
});

console.log("prompts: few-shot自己整合");
test("FEWSHOT_EXAMPLESの全outputが契約パーサを通過する", () => {
  for (const ex of FEWSHOT_EXAMPLES) {
    const r = parseAIFindings(JSON.stringify({ findings: [ex.output] }));
    assert.strictEqual(r.findings.length, 1, `契約違反: ${ex.id}`);
  }
});
test("fewshotBlockは観点で絞り込める", () => {
  const block = fewshotBlock({ viewpoints: ["depth"], max: 10 });
  assert.ok(block.includes("ex-depth") === false); // idは出力に含めない
  assert.ok(block.includes("異常系") || block.includes("競合"), "depth例が入っていない");
  assert.ok(!block.includes("体感でストレス"), "他観点の例が混入");
});
test("観点指示はavoid（ルール検出済み項目）を必ず持つ", () => {
  for (const [k, v] of Object.entries(VIEWPOINT_INSTRUCTIONS)) {
    assert.ok(v.focus && v.avoid, `${k}のfocus/avoid欠落`);
  }
});

console.log("prompts: features（定義のみ・接続はGOALS）");
test("テスト設計プロンプトに候補と出力契約が入る", () => {
  const p = buildTestDesignPrompt(
    [{ type: "boundary", doc: "a.md", location: 3, evidence: "8文字以上" }],
    [{ name: "a.md", text: "パスワードは8文字以上。" }]
  );
  assert.ok(p.includes("boundary") && p.includes("8文字以上") && p.includes("JSON"));
});
test("テスト設計書診断プロンプトに文書名とJSON契約が入る", () => {
  const p = buildTestDocReviewPrompt({ name: "テスト仕様書.md", text: "TC-001" });
  assert.ok(p.includes("テスト仕様書.md") && p.includes("JSON") && p.includes("TC-001"));
});
test("IV&Vプロンプトにチェックリストが入る", () => {
  const p = buildIVVPrompt(
    [{ name: "a.md", text: "本文" }],
    [{ id: "IVV-01", label: "要求の追跡可能性", ref: "IEEE 1012" }]
  );
  assert.ok(p.includes("IVV-01") && p.includes("IEEE 1012") && p.includes("JSON"));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
