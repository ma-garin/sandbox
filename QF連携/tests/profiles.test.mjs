// profiles.test.mjs — APIキープロファイル管理のオフライン検証
// 実行: node tests/profiles.test.mjs（profiles.js はブラウザ前提でlocalStorageを参照するため、import前にスタブする）

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

import assert from "node:assert";
import {
  listProfiles, addProfile, updateProfile, removeProfile,
  getActiveProfileId, setActiveProfileId, getActiveProfile,
} from "../src/profiles.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++; console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++; console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

console.log("profiles: CRUD");
test("初期状態は空", () => {
  assert.deepStrictEqual(listProfiles(), []);
  assert.strictEqual(getActiveProfileId(), "");
});

let p1, p2;
test("追加した最初のプロファイルが自動的にアクティブになる", () => {
  p1 = addProfile({ label: "プロジェクトA", apiKey: "key-a" });
  assert.strictEqual(listProfiles().length, 1);
  assert.strictEqual(getActiveProfileId(), p1.id);
  assert.deepStrictEqual(getActiveProfile(), p1);
});
test("2件目を追加してもアクティブは変わらない", () => {
  p2 = addProfile({ label: "プロジェクトB", apiKey: "key-b" });
  assert.strictEqual(listProfiles().length, 2);
  assert.strictEqual(getActiveProfileId(), p1.id);
});
test("アクティブプロファイルを切り替えられる", () => {
  setActiveProfileId(p2.id);
  assert.strictEqual(getActiveProfile().label, "プロジェクトB");
});
test("更新は該当プロファイルのみに反映され、他は変わらない", () => {
  updateProfile(p1.id, { label: "プロジェクトA改" });
  const profiles = listProfiles();
  assert.strictEqual(profiles.find((p) => p.id === p1.id).label, "プロジェクトA改");
  assert.strictEqual(profiles.find((p) => p.id === p2.id).label, "プロジェクトB");
});
test("アクティブなプロファイルを削除すると次の候補に自動切替、無ければ空になる", () => {
  setActiveProfileId(p2.id);
  removeProfile(p2.id);
  assert.strictEqual(getActiveProfileId(), p1.id);
  removeProfile(p1.id);
  assert.strictEqual(getActiveProfileId(), "");
  assert.deepStrictEqual(listProfiles(), []);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
