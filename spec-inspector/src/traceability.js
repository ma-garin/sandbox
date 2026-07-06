// traceability.js — 要件↔設計↔テストのトレーサビリティ矩阵を構築
//
// 各文書を役割（requirement / design / test）に分類し、識別子(ID)を横串に対応表を作る。
// 役割は文書名の指定 or 内容ヒューリスティクスで判定。
// 出力: { ids, rows, coverage } — ロールごとのIDカバレッジと断絶箇所。

import { ID_PATTERN } from "./engine.js";

export const ROLES = [
  { key: "requirement", label: "要件", hints: ["要件", "requirement", "req", "仕様", "spec"] },
  { key: "design",      label: "設計", hints: ["設計", "design", "基本設計", "詳細設計", "アーキ"] },
  { key: "test",        label: "テスト", hints: ["テスト", "test", "試験", "検証", "ケース", "tc"] },
];

export function inferRole(name = "", text = "") {
  const hay = (name + " " + text.slice(0, 200)).toLowerCase();
  // 判定は具体的な役割（テスト→設計）を先に評価し、汎用的な「仕様/spec」を含む
  // requirement を既定フォールバックにする。同点時は先に評価した役割を優先。
  const priority = ["test", "design", "requirement"];
  let best = "requirement", score = 0;
  for (const key of priority) {
    const r = ROLES.find((x) => x.key === key);
    const s = r.hints.reduce((a, h) => a + (hay.includes(h) ? 1 : 0), 0);
    if (s > score) { score = s; best = key; }
  }
  return best;
}

function idsIn(text) {
  const set = new Set();
  let m;
  const re = new RegExp(ID_PATTERN.source, "g");
  while ((m = re.exec(text)) !== null) set.add(m[1].toUpperCase().replace(/_/g, "-"));
  return set;
}

// docs: [{name, text, role?}] → matrix
export function buildTraceability(docs) {
  const tagged = docs.map((d) => ({
    name: d.name,
    role: d.role || inferRole(d.name, d.text),
    ids: idsIn(d.text),
  }));

  const allIds = new Set();
  tagged.forEach((d) => d.ids.forEach((id) => allIds.add(id)));
  const ids = [...allIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const roleHas = (role, id) => tagged.some((d) => d.role === role && d.ids.has(id));

  const rows = ids.map((id) => {
    const cell = {};
    for (const r of ROLES) {
      const docsWith = tagged.filter((d) => d.role === r.key && d.ids.has(id)).map((d) => d.name);
      cell[r.key] = docsWith;
    }
    // 断絶判定: 要件にあるが設計orテストに無い等
    const inReq = cell.requirement.length > 0;
    const inDesign = cell.design.length > 0;
    const inTest = cell.test.length > 0;
    const gaps = [];
    if (inReq && !inDesign) gaps.push("設計欠落");
    if (inReq && !inTest) gaps.push("テスト欠落");
    if (!inReq && (inDesign || inTest)) gaps.push("要件不明");
    return { id, cell, gaps, complete: gaps.length === 0 };
  });

  const coverage = {};
  for (const r of ROLES) {
    const covered = rows.filter((row) => row.cell[r.key].length > 0).length;
    coverage[r.key] = { covered, total: ids.length, pct: ids.length ? Math.round((covered / ids.length) * 100) : 0 };
  }

  const gapsCount = rows.filter((r) => !r.complete).length;
  return { ids, rows, coverage, roles: tagged.map((d) => ({ name: d.name, role: d.role })), gapsCount };
}
