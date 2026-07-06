// testdoc.test.mjs — テスト設計書診断の単体テスト
// 実行: node tests/testdoc.test.mjs
import assert from "node:assert";
import { analyzeTestDocQuality } from "../src/testdoc.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}
const has = (findings, sub) => findings.some((f) => f.message.includes(sub));

console.log("testdoc: 5ルール（負例＝欠落を検出）");
const poor = "テスト項目\n・ログイン画面を開く\n・IDを入力する\n・ボタンを押す";
test("欠落だらけのテスト設計書は5件すべて指摘", () => {
  const f = analyzeTestDocQuality(poor, "テスト仕様書.md");
  assert.ok(has(f, "期待結果"), "期待結果ルール未検出");
  assert.ok(has(f, "テスト技法"), "技法ルール未検出");
  assert.ok(has(f, "カバレッジ"), "カバレッジルール未検出");
  assert.ok(has(f, "事前条件"), "事前条件ルール未検出");
  assert.ok(has(f, "要件識別子"), "トレースルール未検出");
});
test("全指摘がevidence・suggestion・category=testdoc・docを持つ", () => {
  const f = analyzeTestDocQuality(poor, "テスト仕様書.md");
  for (const x of f) {
    assert.ok(x.evidence && x.suggestion, `evidence/suggestion欠落: ${x.message}`);
    assert.strictEqual(x.category, "testdoc");
    assert.strictEqual(x.doc, "テスト仕様書.md");
  }
});
test("viewpointは既存6観点にマップされる", () => {
  const f = analyzeTestDocQuality(poor);
  const vps = new Set(["accuracy", "clarity", "visual", "depth", "reliability", "verifiability"]);
  for (const x of f) assert.ok(vps.has(x.viewpoint), `不正なviewpoint: ${x.viewpoint}`);
});

console.log("testdoc: 正例（記述ありは指摘しない）");
test("期待結果ありの文書では期待結果ルールが出ない", () => {
  const good = "TC-001 正しいIDでログインボタンを押すと、ホーム画面が表示されること。";
  assert.ok(!has(analyzeTestDocQuality(good), "期待結果が記述されていない"));
});
test("技法明示ありでは技法ルールが出ない", () => {
  const t = "本テストは境界値分析と同値分割で設計する。パスワード桁数の境界を確認する。";
  assert.ok(!has(analyzeTestDocQuality(t), "テスト技法が明示されていない"));
});
test("カバレッジ記述ありではカバレッジルールが出ない", () => {
  const t = "テスト観点の網羅を確認し、カバレッジC1を満たす。";
  assert.ok(!has(analyzeTestDocQuality(t), "網羅性（カバレッジ）"));
});
test("事前条件記述ありでは事前条件ルールが出ない", () => {
  const t = "事前条件: アカウント登録済み。テストデータ: user01。";
  assert.ok(!has(analyzeTestDocQuality(t), "再現性が乏しい"));
});
test("要件IDありではトレースルールが出ない", () => {
  const t = "TC-001 は REQ-001 を検証する。結果が返却されること。";
  assert.ok(!has(analyzeTestDocQuality(t), "要件識別子"));
});
test("良質なテスト設計書は指摘ゼロ", () => {
  const good = `# テスト仕様書
事前条件: アカウント登録済み。テストデータ: user01。
本テストは境界値分析で設計し、テスト観点のカバレッジを網羅する。
TC-001 REQ-001: 8文字のパスワードでログインできること（期待結果: ホーム画面が表示される）。`;
  assert.strictEqual(analyzeTestDocQuality(good).length, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
