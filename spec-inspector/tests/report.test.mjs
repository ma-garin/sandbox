// report.test.mjs — 出力（CSV/コメント付きMD/HTMLレポート）とLLM応答パースの単体テスト
// 実行: node tests/report.test.mjs
import assert from "node:assert";
import { buildCsv, buildAnnotatedMarkdown, buildHtmlReport, buildVerificationPlanMarkdown } from "../src/report.js";

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
test("対応状態列を出力する（triage未指定は未対応）", () => {
  const csv = buildCsv([finding(), finding({ triage: "対応済み" })]);
  assert.ok(csv.split("\n")[0].includes("対応状態"), "ヘッダに対応状態なし");
  assert.ok(csv.includes("未対応") && csv.includes("対応済み"), "状態値が出ていない");
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

console.log("report: buildHtmlReport 新セクション（G-12）");
const baseReport = {
  overall: 70, agg: { accuracy: 70, clarity: 70, visual: 70, depth: 70, reliability: 70, verifiability: 70 },
  counts: { Critical: 0, High: 1, Medium: 0, Low: 0 }, findings: [finding()],
  docNames: ["要件.md"], radarSvg: "", generatedAt: "now",
};
test("testdesign未指定なら従来出力（新セクションなし・後方互換）", () => {
  const html = buildHtmlReport(baseReport);
  assert.ok(!html.includes("テスト設計レディネス"));
  assert.ok(!html.includes("IV&amp;V 第三者検証チェックリスト"));
});
test("testdesign指定でテスト設計セクションが入る", () => {
  const html = buildHtmlReport({ ...baseReport, testdesign: {
    candidates: [{ type: "boundary", doc: "要件.md", location: 2, evidence: "8文字以上" }],
    counts: { decisionTable: 0, boundary: 1, state: 0 },
  } });
  assert.ok(html.includes("テスト設計レディネス") && html.includes("8文字以上") && html.includes("境界値分析"));
});
test("ivv指定でIV&Vセクションが入る", () => {
  const html = buildHtmlReport({ ...baseReport, ivv: {
    items: [{ id: "IVV-01", area: "要求", label: "識別子付与", ref: "IEEE 1012", status: "ng", evidence: "IDなし" }],
    counts: { ok: 0, ng: 1, manual: 0 },
  } });
  assert.ok(html.includes("IV&amp;V 第三者検証") && html.includes("IVV-01") && html.includes("IDなし"));
});

console.log("report: buildVerificationPlanMarkdown");
const ivvSample = {
  items: [
    { id: "IVV-01", area: "要求", label: "識別子付与", ref: "IEEE 1012", status: "ok", evidence: "REQ-001" },
    { id: "IVV-07", area: "設計", label: "設計トレース", ref: "IEEE 1012", status: "ng", evidence: "設計欠落 REQ-002" },
    { id: "IVV-06", area: "要求", label: "ステークホルダ網羅", ref: "IEEE 1012", status: "manual" },
  ],
  counts: { ok: 1, ng: 1, manual: 1 },
};
test("全章見出しを含む", () => {
  const md = buildVerificationPlanMarkdown({
    docs: [{ name: "要件.md", role: "requirement" }], ivv: ivvSample,
    trace: { ids: ["REQ-001", "REQ-002"], gapsCount: 1 }, consistency: [], findings: [finding()],
    generatedAt: "2026/7/6",
  });
  for (const h of ["## 1. 目的と対象文書", "## 2. 検証観点", "## 3. 指摘サマリ", "## 4. 文書間整合", "## 5. 手動確認", "## 6. 是正が必要", "## 7. トレーサビリティ"]) {
    assert.ok(md.includes(h), `見出し欠落: ${h}`);
  }
});
test("NG項目と手動項目が列挙される", () => {
  const md = buildVerificationPlanMarkdown({ docs: [], ivv: ivvSample, findings: [] });
  assert.ok(md.includes("IVV-07") && md.includes("設計欠落 REQ-002"), "NG項目未記載");
  assert.ok(md.includes("IVV-06") && md.includes("ステークホルダ網羅"), "手動項目未記載");
});
test("セル内のパイプは無害化される", () => {
  const md = buildVerificationPlanMarkdown({
    docs: [], findings: [],
    ivv: { items: [{ id: "X", area: "a", label: "A|B", ref: "r", status: "ng", evidence: "e|f" }], counts: { ok: 0, ng: 1, manual: 0 } },
  });
  assert.ok(md.includes("A\\|B") && md.includes("e\\|f"), "パイプ未エスケープ");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
