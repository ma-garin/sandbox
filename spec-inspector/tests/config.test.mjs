// config.test.mjs — 管理設定（辞書・プロンプト・IV&Vメタ）の上書き/リセット/入出力
// 実行: node tests/config.test.mjs（localStorageスタブでオフライン検証）

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

import assert from "node:assert";
import { analyzeDocument, getDict, setDict, resetDict, DEFAULT_DICT, isDictCustomized } from "../src/engine.js";
import { getPrompts, setPrompts, resetPrompts, DEFAULT_PROMPTS } from "../src/prompts/config.js";
import { buildAnalysisMessages } from "../src/prompts/index.js";
import { runIVV, getIvvMeta, setIvvMeta, resetIvvMeta, DEFAULT_IVV_META } from "../src/ivv.js";
import { exportAdminConfig, importAdminConfig, resetAllAdminConfig } from "../src/adminstore.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}
const reset = () => { store.clear(); };

console.log("config: 辞書の上書き（engine）");
test("既定は従来値・未上書きなら isDictCustomized=false", () => {
  reset();
  assert.deepStrictEqual(getDict().tbdWords, DEFAULT_DICT.tbdWords);
  assert.strictEqual(isDictCustomized(), false);
});
test("曖昧語に新語を追加すると解析で検出される", () => {
  reset();
  const doc = "本機能はいい感じに処理する。";
  assert.ok(!analyzeDocument(doc).findings.some((f) => f.evidence.includes("いい感じ")));
  setDict("vagueWords", [...DEFAULT_DICT.vagueWords, "いい感じ"]);
  assert.ok(isDictCustomized());
  const f = analyzeDocument(doc).findings;
  assert.ok(f.some((x) => x.viewpoint === "accuracy" && x.message.includes("いい感じ")), "追加語が検出されない");
});
test("resetDictで既定に戻る", () => {
  reset();
  setDict("tbdWords", ["ZZZ"]);
  assert.deepStrictEqual(getDict().tbdWords, ["ZZZ"]);
  resetDict("tbdWords");
  assert.deepStrictEqual(getDict().tbdWords, DEFAULT_DICT.tbdWords);
});
test("未知セクションのsetDictは例外", () => {
  reset();
  assert.throws(() => setDict("bogus", []));
});

console.log("config: プロンプトの上書き");
test("personaを上書きするとsystemプロンプトに反映", () => {
  reset();
  setPrompts("persona", "テスト用ペルソナXYZ");
  const { system } = buildAnalysisMessages([{ name: "a", text: "x", role: "requirement" }]);
  assert.ok(system.includes("テスト用ペルソナXYZ"));
});
test("resetPromptsで既定に戻る", () => {
  reset();
  setPrompts("persona", "XYZ");
  resetPrompts("persona");
  assert.strictEqual(getPrompts().persona, DEFAULT_PROMPTS.persona);
});

console.log("config: IV&Vメタの上書き");
test("項目をenabled=falseにすると結果から外れる", () => {
  reset();
  const base = runIVV([{ name: "a", text: "REQ-001", role: "requirement" }], { trace: { ids: ["REQ-001"] } });
  assert.ok(base.items.some((i) => i.id === "IVV-01"));
  const meta = getIvvMeta().map((m) => (m.id === "IVV-01" ? { ...m, enabled: false } : m));
  setIvvMeta(meta);
  const after = runIVV([{ name: "a", text: "REQ-001", role: "requirement" }], { trace: { ids: ["REQ-001"] } });
  assert.ok(!after.items.some((i) => i.id === "IVV-01"), "無効化した項目が残っている");
});
test("ユーザー追加のmanual項目が結果に出る", () => {
  reset();
  setIvvMeta([...DEFAULT_IVV_META, { id: "IVV-U1", area: "独自", label: "自社基準の確認", ref: "社内規程", enabled: true }]);
  const r = runIVV([{ name: "a", text: "x" }], {});
  const added = r.items.find((i) => i.id === "IVV-U1");
  assert.ok(added && added.status === "manual", "追加項目がmanualで出ない");
});
test("ラベル上書きが反映される", () => {
  reset();
  setIvvMeta(getIvvMeta().map((m) => (m.id === "IVV-01" ? { ...m, label: "改名した項目" } : m)));
  const r = runIVV([{ name: "a", text: "REQ-001" }], { trace: { ids: ["REQ-001"] } });
  assert.strictEqual(r.items.find((i) => i.id === "IVV-01").label, "改名した項目");
});

console.log("config: 集約 export/import/reset");
test("exportは3セクションを含む", () => {
  reset();
  const json = JSON.parse(exportAdminConfig());
  assert.ok(json.dict && json.prompts && Array.isArray(json.ivvMeta));
});
test("importで各ストアへ反映される", () => {
  reset();
  const json = JSON.stringify({
    dict: { tbdWords: ["IMPORTED"] },
    prompts: { persona: "IMPORTED_PERSONA" },
    ivvMeta: [{ id: "X", area: "a", label: "L", ref: "r", enabled: true }],
  });
  const applied = importAdminConfig(json);
  assert.deepStrictEqual(applied.sort(), ["dict", "ivvMeta", "prompts"]);
  assert.deepStrictEqual(getDict().tbdWords, ["IMPORTED"]);
  assert.strictEqual(getPrompts().persona, "IMPORTED_PERSONA");
  assert.strictEqual(getIvvMeta()[0].id, "X");
});
test("resetAllで全セクション既定化", () => {
  reset();
  setDict("tbdWords", ["Z"]); setPrompts("persona", "Z"); setIvvMeta([{ id: "Z", area: "", label: "", ref: "", enabled: true }]);
  resetAllAdminConfig();
  assert.deepStrictEqual(getDict().tbdWords, DEFAULT_DICT.tbdWords);
  assert.strictEqual(getPrompts().persona, DEFAULT_PROMPTS.persona);
  assert.strictEqual(getIvvMeta().length, DEFAULT_IVV_META.length);
});
test("import後の解析でも既存契約は不変（findingsが得られる）", () => {
  reset();
  const r = analyzeDocument("処理は適切に行う。REQ-001。");
  assert.ok(Array.isArray(r.findings) && r.findings.length > 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
