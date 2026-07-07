// ivv.test.mjs — IV&Vチェックリスト＋自動判定の単体テスト
// 実行: node tests/ivv.test.mjs
import assert from "node:assert";
import { runIVV, IVV_CHECKLIST } from "../src/ivv.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}
const byId = (items, id) => items.find((i) => i.id === id);

console.log("ivv: チェックリスト定義");
test("15項目以上・areaとrefを持つ", () => {
  assert.ok(IVV_CHECKLIST.length >= 15, `項目不足: ${IVV_CHECKLIST.length}`);
  for (const i of IVV_CHECKLIST) assert.ok(i.id && i.area && i.label && i.ref, `不備: ${i.id}`);
});

console.log("ivv: 自動判定");
const richDocs = [
  { name: "要件.md", role: "requirement", text: "REQ-001 前提: 登録済み。制約あり。受入基準: 3秒以内。性能は応答時間3秒。例外時はエラー表示。更新履歴あり。用語集: 会員=登録済み利用者。" },
  { name: "設計.md", role: "design", text: "REQ-001 認証API。" },
  { name: "テスト.md", role: "test", text: "TC-001 REQ-001 を境界値分析で検証。ホーム画面が表示されること。" },
];
const richResults = {
  trace: { ids: ["REQ-001"], rows: [{ id: "REQ-001", gaps: [] }] },
  consistency: [],
  findings: [],
};

test("充実文書ではauto項目の多くがok", () => {
  const { items } = runIVV(richDocs, richResults);
  assert.strictEqual(byId(items, "IVV-01").status, "ok"); // ID
  assert.strictEqual(byId(items, "IVV-03").status, "ok"); // 受入基準
  assert.strictEqual(byId(items, "IVV-08").status, "ok"); // 非機能
  assert.strictEqual(byId(items, "IVV-10").status, "ok"); // 異常系
  assert.strictEqual(byId(items, "IVV-12").status, "ok"); // 技法
  assert.strictEqual(byId(items, "IVV-13").status, "ok"); // 期待結果
});

const poorDocs = [{ name: "薄い.md", role: "requirement", text: "利用者はログインする。" }];
const poorResults = {
  trace: { ids: [], rows: [{ id: "REQ-001", gaps: ["設計欠落", "テスト欠落"] }] },
  consistency: [{ type: "metric-mismatch", message: "応答時間の不一致" }],
  findings: [{ viewpoint: "accuracy", message: "曖昧語「適切に」", evidence: "適切に処理" }],
};
test("不足文書ではng判定にevidenceが必ず付く", () => {
  const { items } = runIVV(poorDocs, poorResults);
  const ngs = items.filter((i) => i.status === "ng");
  assert.ok(ngs.length >= 5, `ng項目が少ない: ${ngs.length}`);
  for (const n of ngs) assert.ok(n.evidence, `ngなのにevidence欠落: ${n.id}`);
});
test("矛盾ありでIVV-02がng・トレース断絶でIVV-07/11がng", () => {
  const { items } = runIVV(poorDocs, poorResults);
  assert.strictEqual(byId(items, "IVV-02").status, "ng");
  assert.strictEqual(byId(items, "IVV-07").status, "ng");
  assert.strictEqual(byId(items, "IVV-11").status, "ng");
});
test("曖昧表現ありでIVV-04がng", () => {
  const { items } = runIVV(poorDocs, poorResults);
  assert.strictEqual(byId(items, "IVV-04").status, "ng");
});

console.log("ivv: 手動項目");
test("auto=nullの項目は必ずstatus=manual・evidenceなし", () => {
  const { items } = runIVV(richDocs, richResults);
  for (const item of IVV_CHECKLIST) {
    if (item.auto === null) {
      const r = byId(items, item.id);
      assert.strictEqual(r.status, "manual", `${item.id}がmanualでない`);
      assert.ok(!("evidence" in r), `manualにevidenceが付いている: ${item.id}`);
    }
  }
});
test("countsが整合する", () => {
  const { items, counts } = runIVV(richDocs, richResults);
  assert.strictEqual(counts.ok + counts.ng + counts.manual, items.length);
});
test("ruleResults未指定でも落ちない", () => {
  const { items } = runIVV(poorDocs);
  assert.ok(items.length === IVV_CHECKLIST.length);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
