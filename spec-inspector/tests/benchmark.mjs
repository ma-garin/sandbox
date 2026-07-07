// benchmark.mjs — 検出力エビデンス測定
// 既知欠陥入りfixtureに対する engine.js の検出率（recall）を観点別に測定する。
// 実行: node tests/benchmark.mjs
// 合否: 全体recall ≥ 60% で成功（下回ったら失敗させ、ルール改善の契機とする）。

import { analyzeDocument, VIEWPOINTS } from "../src/engine.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const THRESHOLD = 0.6;

const spec = JSON.parse(readFileSync(join(HERE, "fixtures/labels.json"), "utf-8"));

// ラベルが検出findingsに一致するか（viewpoint一致 かつ token が message/evidence に含まれる）
function matched(label, findings) {
  return findings.some((f) => f.viewpoint === label.viewpoint &&
    (String(f.message).includes(label.token) || String(f.evidence).includes(label.token)));
}

const perVp = {};
for (const v of VIEWPOINTS) perVp[v.key] = { hit: 0, total: 0 };
const missed = [];
let total = 0, hit = 0;

for (const fx of spec.fixtures) {
  const text = readFileSync(join(HERE, "fixtures", fx.file), "utf-8");
  const findings = analyzeDocument(text, fx.file).findings;
  for (const label of fx.labels) {
    total++;
    perVp[label.viewpoint].total++;
    if (matched(label, findings)) {
      hit++; perVp[label.viewpoint].hit++;
    } else {
      missed.push(`${fx.file} ${label.id} [${label.viewpoint}] ${label.desc}（token: ${label.token}）`);
    }
  }
}

const pct = (h, t) => (t ? Math.round((h / t) * 100) : 0);

console.log("検出力ベンチマーク（既知欠陥に対するrecall）");
console.log("─".repeat(48));
console.log("観点            検出/総数   recall");
for (const v of VIEWPOINTS) {
  const s = perVp[v.key];
  if (!s.total) continue;
  console.log(`${v.label.padEnd(12, "　")}  ${String(s.hit).padStart(2)}/${String(s.total).padStart(2)}      ${pct(s.hit, s.total)}%`);
}
console.log("─".repeat(48));
console.log(`全体            ${hit}/${total}      ${pct(hit, total)}%`);

if (missed.length) {
  console.log("\n取りこぼし:");
  for (const m of missed) console.log(`  - ${m}`);
} else {
  console.log("\n取りこぼしなし 🎉");
}

const recall = hit / total;
console.log(`\n判定基準: 全体recall ≥ ${THRESHOLD * 100}%`);
if (recall >= THRESHOLD) {
  console.log(`✅ 合格（${pct(hit, total)}%）`);
  process.exit(0);
} else {
  console.error(`❌ 不合格（${pct(hit, total)}% < ${THRESHOLD * 100}%）— ルールの検出力が低下しています`);
  process.exit(1);
}
