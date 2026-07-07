// engine.test.mjs — ルールエンジン・矛盾検知・トレーサビリティの単体テスト
// 実行: node tests/engine.test.mjs
import assert from "node:assert";
import { analyzeDocument, VIEWPOINTS, weightedOverall } from "../src/engine.js";
import { detectInconsistencies } from "../src/consistency.js";
import { buildTraceability, inferRole } from "../src/traceability.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("engine: analyzeDocument");
test("6観点すべてにスコアが付く", () => {
  const r = analyzeDocument("これはテスト文書です。適切に処理する。");
  for (const v of VIEWPOINTS) assert.ok(typeof r.scores[v.key] === "number", `${v.key} missing`);
  assert.ok(r.overall >= 0 && r.overall <= 100);
});

test("曖昧語を正確性の指摘として検出", () => {
  const r = analyzeDocument("処理は適切に行い、必要に応じてリトライする。");
  const acc = r.findings.filter((f) => f.viewpoint === "accuracy");
  assert.ok(acc.some((f) => f.message.includes("適切に")), "『適切に』未検出");
  assert.ok(acc.some((f) => f.message.includes("必要に応じて")), "『必要に応じて』未検出");
});

test("TBDはCriticalで検出", () => {
  const r = analyzeDocument("再設定はTBD。");
  assert.ok(r.findings.some((f) => f.severity === "Critical" && f.evidence.includes("TBD")));
});

test("検証不能な意図表現を検証可能性で検出", () => {
  const r = analyzeDocument("応答時間の短縮を目指す。");
  assert.ok(r.findings.some((f) => f.viewpoint === "verifiability" && f.message.includes("目指す")));
});

test("すべての指摘がevidenceとsuggestionを持つ（evidence-only）", () => {
  const r = analyzeDocument("処理は適切に行う。ログインできること。REQ-001。");
  for (const f of r.findings) {
    assert.ok(f.evidence !== undefined && f.evidence !== "", `evidence欠落: ${f.message}`);
    assert.ok(f.suggestion, `suggestion欠落: ${f.message}`);
  }
});

test("深層性: 非機能・例外系が無ければ指摘", () => {
  const r = analyzeDocument("利用者は登録する。");
  const depth = r.findings.filter((f) => f.viewpoint === "depth");
  assert.ok(depth.length >= 3, `深層性の指摘が少ない: ${depth.length}`);
});

test("良質な文書は曖昧語文書よりスコアが高い", () => {
  const bad = analyzeDocument("適宜、必要に応じて、なるべく適切に処理する。TBD。");
  const good = analyzeDocument(`# 仕様
REQ-001 利用者は3秒以内にログインできること。
前提条件: アカウント登録済み。
例外: 認証失敗時はエラーを表示する。
性能: 応答時間は3秒以内。ISO/IEC 25010に準拠する。`);
  assert.ok(good.overall > bad.overall, `good=${good.overall} bad=${bad.overall}`);
});

console.log("consistency: detectInconsistencies");
test("数値メトリクスの不一致を検出", () => {
  const docs = [
    { name: "要件.md", text: "応答時間は3秒以内とする。" },
    { name: "設計.md", text: "応答時間は5秒を上限とする。" },
  ];
  const f = detectInconsistencies(docs);
  assert.ok(f.some((x) => x.type === "metric-mismatch"), "不一致未検出");
});

test("ID非対称（トレース断絶）を検出", () => {
  const docs = [
    { name: "要件.md", text: "REQ-001 ログイン。REQ-002 ログアウト。" },
    { name: "テスト.md", text: "TC-001 は REQ-001 を検証。" },
  ];
  const f = detectInconsistencies(docs);
  assert.ok(f.some((x) => x.type === "trace-gap"), "trace-gap未検出");
});

test("相反する断定（必須/対象外）を検出", () => {
  const docs = [
    { name: "A.md", text: "「多要素認証」は必須とする。" },
    { name: "B.md", text: "「多要素認証」は対象外とする。" },
  ];
  const f = detectInconsistencies(docs);
  assert.ok(f.some((x) => x.type === "polarity-conflict"), "polarity-conflict未検出");
});

test("単一文書では矛盾検知しない", () => {
  assert.strictEqual(detectInconsistencies([{ name: "a", text: "x" }]).length, 0);
});

console.log("traceability: buildTraceability");
test("役割推定: 名前から要件/設計/テストを判定", () => {
  assert.strictEqual(inferRole("要件定義書.md", ""), "requirement");
  assert.strictEqual(inferRole("基本設計書.md", ""), "design");
  assert.strictEqual(inferRole("テスト仕様書.md", ""), "test");
});

test("トレーサビリティ矩阵で断絶を検出", () => {
  const docs = [
    { name: "要件.md", text: "REQ-001 REQ-002", role: "requirement" },
    { name: "設計.md", text: "REQ-001", role: "design" },
    { name: "テスト.md", text: "REQ-001", role: "test" },
  ];
  const tr = buildTraceability(docs);
  assert.strictEqual(tr.ids.length, 2);
  const req2 = tr.rows.find((r) => r.id === "REQ-002");
  assert.ok(!req2.complete, "REQ-002は断絶のはず");
  assert.ok(req2.gaps.includes("設計欠落"));
});

console.log("engine: weightedOverall（G-10）");
const evenScores = { accuracy: 60, clarity: 90, visual: 90, depth: 60, reliability: 90, verifiability: 90 };
test("weights未指定・等重みは単純平均と一致", () => {
  const simple = Math.round(VIEWPOINTS.reduce((s, v) => s + evenScores[v.key], 0) / VIEWPOINTS.length);
  assert.strictEqual(weightedOverall(evenScores), simple);
  const eq = {}; VIEWPOINTS.forEach((v) => (eq[v.key] = 1));
  assert.strictEqual(weightedOverall(evenScores, eq), simple);
});
test("重み変更で総合が変わる（低スコア観点を重視すると下がる）", () => {
  const base = weightedOverall(evenScores);
  const w = { accuracy: 2, clarity: 1, visual: 1, depth: 2, reliability: 1, verifiability: 1 };
  const weighted = weightedOverall(evenScores, w);
  assert.ok(weighted < base, `重視で下がるはず: base=${base} weighted=${weighted}`);
});
test("重み全0や不正値でも単純平均にフォールバック", () => {
  const zero = {}; VIEWPOINTS.forEach((v) => (zero[v.key] = 0));
  assert.strictEqual(weightedOverall(evenScores, zero), weightedOverall(evenScores));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
