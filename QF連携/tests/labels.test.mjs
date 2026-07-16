// labels.test.mjs — ラベル解決ロジックのオフライン検証
// 実行: node tests/labels.test.mjs

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  buildResultLabelMap,
  buildResultStringLabelMap,
  buildCategoryLabelMap,
  buildContentLabelMap,
  humanizeTestCase,
  humanizeTestResult,
} from "../src/labels.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++; console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++; console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const project = JSON.parse(readFileSync(path.join(__dirname, "fixtures/current_project.json"), "utf8"));

console.log("buildResultLabelMap");
test("設定済みラベルを反映し、空欄は既定値にフォールバック", () => {
  const map = buildResultLabelMap(project);
  assert.strictEqual(map[1], "合格");
  assert.strictEqual(map[2], "不合格");
  assert.strictEqual(map[3], "SKIP"); // label_skipが空文字のため既定値
  assert.strictEqual(map[7], "質疑応答");
});
test("プロジェクト未取得時(空オブジェクト)は全て既定値", () => {
  const map = buildResultLabelMap({});
  assert.strictEqual(map[1], "PASS");
  assert.strictEqual(map[4], "CUT");
});

console.log("buildResultStringLabelMap（GETレスポンスの文字列enum用）");
test("小文字文字列enumをキーにラベルを解決する", () => {
  const map = buildResultStringLabelMap(project);
  assert.strictEqual(map.pass, "合格");
  assert.strictEqual(map.fail, "不合格");
  assert.strictEqual(map.skip, "SKIP");
  assert.strictEqual(map.qa, "質疑応答");
});

console.log("buildCategoryLabelMap / buildContentLabelMap");
const testSuite = {
  id: 10,
  name: "サンプルスイート",
  label_category1: "画面",
  use_category1: true,
  label_category2: "機能",
  use_category2: true,
  use_category3: false, // 未使用
  label_content1: "備考",
  use_content1: true,
  use_content2: false,
};
test("use_categoryN===falseのみ未使用扱い、それ以外は使用扱い", () => {
  const map = buildCategoryLabelMap(testSuite);
  assert.strictEqual(map.category1.label, "画面");
  assert.strictEqual(map.category1.used, true);
  assert.strictEqual(map.category3.used, false);
  assert.strictEqual(map.category25.used, true); // 未定義でも既定でtrue扱い
  assert.strictEqual(map.category25.label, "category25"); // ラベル未設定は生キーにフォールバック
});
test("contentも同様に解決される", () => {
  const map = buildContentLabelMap(testSuite);
  assert.strictEqual(map.content1.label, "備考");
  assert.strictEqual(map.content2.used, false);
});

console.log("humanizeTestCase / humanizeTestResult（イミュータブル）");
test("値が入っているラベル済みフィールドのみ抽出し、元オブジェクトは変更しない", () => {
  const categoryMap = buildCategoryLabelMap(testSuite);
  const testCase = { id: 1, no: 1, category1: "ログイン画面", category2: "", category4: "未使用カテゴリの値" };
  const frozenInput = JSON.stringify(testCase);
  const result = humanizeTestCase(testCase, categoryMap);
  assert.strictEqual(JSON.stringify(testCase), frozenInput, "入力オブジェクトが変更された");
  assert.deepStrictEqual(result.labeledFields, [
    { key: "category1", label: "画面", value: "ログイン画面" },
    { key: "category4", label: "category4", value: "未使用カテゴリの値" },
  ]);
});
test("テスト結果はGETの文字列enumからresultLabelを解決し、contentのラベル済みフィールドを持つ", () => {
  const resultMap = buildResultStringLabelMap(project);
  const contentMap = buildContentLabelMap(testSuite);
  const testResult = { result: "fail", content1: "エラーが発生", content2: "" };
  const result = humanizeTestResult(testResult, resultMap, contentMap);
  assert.strictEqual(result.resultLabel, "不合格");
  assert.deepStrictEqual(result.labeledFields, [{ key: "content1", label: "備考", value: "エラーが発生" }]);
});
test("未知のresult文字列は元の値にフォールバック", () => {
  const result = humanizeTestResult({ result: "unknown_code" }, {}, {});
  assert.strictEqual(result.resultLabel, "unknown_code");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
