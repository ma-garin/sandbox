// search.test.mjs — クライアント側検索/フィルタ/ソートのオフライン検証
// 実行: node tests/search.test.mjs

import assert from "node:assert";
import { filterByText, filterByField, sortBy } from "../src/search.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++; console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++; console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

const items = [
  { id: 1, name: "ログイン画面", priority: "A" },
  { id: 2, name: "ログアウト処理", priority: "B" },
  { id: 3, name: "会員登録", priority: "A" },
];

console.log("filterByText");
test("複数フィールドを対象に部分一致（大小文字無視）", () => {
  const r = filterByText(items, "ログ", ["name"]);
  assert.strictEqual(r.length, 2);
});
test("空クエリは全件そのまま返す", () => {
  assert.strictEqual(filterByText(items, "", ["name"]).length, 3);
});
test("元配列を変更しない", () => {
  const before = JSON.stringify(items);
  filterByText(items, "ログ", ["name"]);
  assert.strictEqual(JSON.stringify(items), before);
});

console.log("filterByField");
test("完全一致でフィルタ", () => {
  const r = filterByField(items, "priority", "A");
  assert.strictEqual(r.length, 2);
});
test("空値指定は絞り込まない", () => {
  assert.strictEqual(filterByField(items, "priority", "").length, 3);
});

console.log("sortBy");
test("昇順・降順ソート、元配列は変更しない", () => {
  const before = JSON.stringify(items);
  const asc = sortBy(items, "id", "asc");
  const desc = sortBy(items, "id", "desc");
  assert.deepStrictEqual(asc.map((i) => i.id), [1, 2, 3]);
  assert.deepStrictEqual(desc.map((i) => i.id), [3, 2, 1]);
  assert.strictEqual(JSON.stringify(items), before);
});
test("undefined/nullは末尾に回す", () => {
  const withNulls = [{ v: 2 }, { v: undefined }, { v: 1 }, { v: null }];
  const r = sortBy(withNulls, "v", "asc").map((i) => i.v);
  assert.deepStrictEqual(r, [1, 2, undefined, null]);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
