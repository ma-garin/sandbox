// testdesign.test.mjs — テスト設計レディネスの単体テスト
// 実行: node tests/testdesign.test.mjs
import assert from "node:assert";
import {
  detectDecisionTableCandidates, detectBoundaryCandidates, detectStateCandidates,
  decisionTableDraft, boundaryDraft, stateDraft, analyzeTestDesignReadiness,
} from "../src/testdesign.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("testdesign: デシジョンテーブル候補");
test("条件の組み合わせ（かつ＋場合）を検出（正例）", () => {
  const c = detectDecisionTableCandidates("利用者が会員であり、かつ購入金額が5000円以上の場合は送料無料とする。それ以外の場合は送料を加算する。");
  assert.ok(c.length >= 1, "候補が検出されない");
  assert.strictEqual(c[0].type, "decision-table");
  assert.ok(c[0].conditions.length >= 1, "条件が抽出されない");
});
test("単純文は候補にしない（負例）", () => {
  assert.strictEqual(detectDecisionTableCandidates("利用者はログイン画面を表示する。").length, 0);
});
test("候補はevidenceとlocationを持つ", () => {
  const c = detectDecisionTableCandidates("A\nBが真かつCが偽の場合はエラー、それ以外の場合は成功とする。");
  assert.ok(c[0].evidence && c[0].location > 0);
});

console.log("testdesign: 境界値候補");
test("「8文字以上」を境界値候補として検出", () => {
  const c = detectBoundaryCandidates("パスワードは8文字以上とする。");
  assert.strictEqual(c.length, 1);
  assert.strictEqual(c[0].value, "8");
  assert.strictEqual(c[0].unit, "文字");
  assert.strictEqual(c[0].comparator, "以上");
});
test("比較語が無ければ候補にしない", () => {
  assert.strictEqual(detectBoundaryCandidates("画面には3件のカードを表示する。").length, 0);
});
test("全角数字も半角化して検出", () => {
  const c = detectBoundaryCandidates("応答時間は３秒以内とする。");
  assert.strictEqual(c[0].value, "3");
  assert.strictEqual(c[0].comparator, "以内");
});

console.log("testdesign: 状態遷移候補");
test("「承認待ち・承認済み」の状態を抽出", () => {
  const c = detectStateCandidates("申請の状態は、承認待ち・承認済み・却下のいずれかに遷移する。");
  assert.ok(c.length >= 1, "状態候補未検出");
  assert.ok(c[0].states.includes("承認待ち"), `states=${c[0].states}`);
  assert.ok(c[0].states.some((s) => s.includes("承認済")), `states=${c[0].states}`);
});
test("状態語彙が無ければ候補にしない", () => {
  assert.strictEqual(detectStateCandidates("利用者は名前を入力する。").length, 0);
});

console.log("testdesign: ドラフト生成");
test("デシジョンテーブルドラフトは有効なMarkdown表", () => {
  const md = decisionTableDraft({ type: "decision-table", conditions: ["会員である", "在庫がある"] });
  const bars = md.split("\n").filter((l) => l.trim().startsWith("|"));
  assert.ok(bars.length >= 4, `表の行数不足: ${bars.length}`);
  assert.ok(md.includes("Y") && md.includes("N"), "Y/N組合せがない");
  assert.ok(md.includes("会員である"));
});
test("境界値ドラフトは 8以上 → 7/8/9 を出す", () => {
  const md = boundaryDraft({ type: "boundary", value: "8", unit: "文字", comparator: "以上" });
  assert.ok(md.includes("7文字") && md.includes("8文字") && md.includes("9文字"), md);
  assert.ok(md.split("\n").filter((l) => l.startsWith("|")).length >= 3);
});
test("境界値ドラフトは 未満 の境界をv-1で扱う", () => {
  const md = boundaryDraft({ type: "boundary", value: "10", unit: "件", comparator: "未満" });
  // 境界=9, → 8/9/10
  assert.ok(md.includes("9件") && md.includes("8件") && md.includes("10件"), md);
});
test("状態遷移ドラフトはN×N遷移表を出す", () => {
  const md = stateDraft({ type: "state", states: ["待ち", "済み", "却下"] });
  assert.ok(md.includes("却下") && md.split("\n").filter((l) => l.startsWith("|")).length >= 4);
});

console.log("testdesign: analyzeTestDesignReadiness");
test("複数文書を統合し種別カウントと候補を返す", () => {
  const r = analyzeTestDesignReadiness([
    { name: "要件.md", text: "パスワードは8文字以上とする。会員かつ在庫ありの場合は割引する場合がある。" },
    { name: "設計.md", text: "申請の状態は承認待ち・承認済みに遷移する。" },
  ]);
  assert.ok(r.candidates.length >= 2);
  assert.ok(r.counts.boundary >= 1 && r.counts.state >= 1);
  for (const c of r.candidates) {
    assert.ok(c.doc && c.draft && c.evidence, "候補にdoc/draft/evidenceがない");
    assert.ok(c.draft.includes("|"), "draftが表でない");
  }
});
test("候補ゼロ文書は空結果", () => {
  const r = analyzeTestDesignReadiness([{ name: "a", text: "利用者は登録する。" }]);
  assert.strictEqual(r.candidates.length, 0);
  assert.deepStrictEqual(r.counts, { decisionTable: 0, boundary: 0, state: 0 });
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
