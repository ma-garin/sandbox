// report.test.mjs — 出力（CSV/コメント付きMD/HTMLレポート）とLLM応答パースの単体テスト
// 実行: node tests/report.test.mjs
import assert from "node:assert";
import { buildCsv, buildAnnotatedMarkdown, buildHtmlReport } from "../src/report.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const finding = (over = {}) => ({
  viewpoint: "accuracy", severity: "High", doc: "要件.md", location: 2,
  message: "曖昧語がある", evidence: "適切に処理する", suggestion: "条件を明記",
  expectedEffect: "手戻り防止", source: "rule", ...over,
});

console.log("report: buildCsv");
test("CSVにヘッダと行が出る（BOM付き）", () => {
  const csv = buildCsv([finding()]);
  assert.ok(csv.startsWith("﻿"), "BOMなし");
  assert.ok(csv.includes("severity"), "ヘッダなし");
  assert.ok(csv.includes("曖昧語がある"));
});
test("カンマ・引用符・改行をエスケープ", () => {
  const csv = buildCsv([finding({ message: 'a,"b"\nc' })]);
  assert.ok(csv.includes('"a,""b""\nc"'), `escape失敗: ${csv}`);
});

console.log("report: buildAnnotatedMarkdown");
test("該当行の直後にコメントが挿入される", () => {
  const docs = [{ name: "要件.md", text: "L1タイトル\n適切に処理する\nL3本文" }];
  const md = buildAnnotatedMarkdown(docs, [finding()]);
  const lines = md.split("\n");
  const idx = lines.findIndex((l) => l === "適切に処理する");
  assert.ok(idx >= 0, "元の行が見つからない");
  assert.ok(lines[idx + 1].includes("[High/正確性]"), `直後にコメントなし: ${lines[idx + 1]}`);
  assert.ok(lines[idx + 2].includes("改善:"));
});
test("location=0の指摘は文書全体セクションに載る", () => {
  const docs = [{ name: "要件.md", text: "本文のみ" }];
  const md = buildAnnotatedMarkdown(docs, [finding({ location: 0, message: "前提条件が無い" })]);
  assert.ok(md.includes("文書全体への指摘"));
  assert.ok(md.includes("前提条件が無い"));
});
test("複数文書はセクション分割される", () => {
  const docs = [{ name: "A.md", text: "a" }, { name: "B.md", text: "b" }];
  const md = buildAnnotatedMarkdown(docs, []);
  assert.ok(md.includes("# 📄 A.md") && md.includes("# 📄 B.md"));
});

console.log("report: buildHtmlReport");
test("スコア・指摘・矛盾・トレースが埋め込まれる", () => {
  const html = buildHtmlReport({
    overall: 82,
    agg: { accuracy: 48, clarity: 100, visual: 100, depth: 72, reliability: 88, verifiability: 86 },
    counts: { Critical: 1, High: 5, Medium: 1, Low: 1 },
    findings: [finding()],
    docNames: ["要件.md"],
    radarSvg: "<svg></svg>",
    generatedAt: "2026/7/6 12:00:00",
    consistency: [{ severity: "Critical", message: "値が不一致", evidence: "3秒 vs 5秒" }],
    trace: { ids: ["REQ-001"], gapsCount: 1, rows: [{ id: "REQ-001", cell: { requirement: ["要件.md"], design: [], test: [] }, gaps: ["設計欠落"], complete: false }] },
  });
  assert.ok(html.includes("82"));
  assert.ok(html.includes("曖昧語がある"));
  assert.ok(html.includes("値が不一致"));
  assert.ok(html.includes("REQ-001") && html.includes("設計欠落"));
  assert.ok(html.includes("<!DOCTYPE html>"));
});
test("HTMLエスケープされる", () => {
  const html = buildHtmlReport({
    overall: 50, agg: { accuracy: 50, clarity: 50, visual: 50, depth: 50, reliability: 50, verifiability: 50 },
    counts: { Critical: 0, High: 1, Medium: 0, Low: 0 },
    findings: [finding({ message: "<script>alert(1)</script>" })],
    docNames: ["x"], radarSvg: "", generatedAt: "now",
  });
  assert.ok(!html.includes("<script>alert"), "XSS未対策");
});

// 注: 旧llmセクション（parseFindings/buildPrompt）は tests/prompts.test.mjs と
// tests/llm.test.mjs に移管した。

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
