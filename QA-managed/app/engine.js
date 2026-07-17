/**
 * engine.js — 観点ベースのテスト観点表 生成エンジン（QA-managed 移植版）
 *
 * QA-PMO/portal/knowledge/engine.py の generate() をブラウザ向けに移植。
 * 観点ライブラリ（viewpoints.js）を、解析結果（機能・入力項目・特性・業種）へ
 * 適用し、観点カバレッジ付きでテスト観点表を生成する。
 * 各行は 観点→技法→カテゴリ→根拠標準 に追跡可能（監査証跡・evidence-only）。
 */
(function (root, factory) {
  const V = (typeof require === "function") ? require("./viewpoints.js") : root.VIEWPOINTS;
  const mod = factory(V);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.ENGINE = mod;
})(typeof self !== "undefined" ? self : this, function (V) {
  "use strict";

  /**
   * generate(spec) → { rows, coverage, total }
   * spec: {
   *   feature: string,
   *   fields: [{name, type}],
   *   flags: [string]  (viewpoints.FLAG のキー),
   *   industry: string|"" (viewpoints.INDUSTRY のキー)
   * }
   */
  function generate(spec) {
    spec = spec || {};
    const feature = spec.feature || "対象機能";
    const fields = spec.fields || [];
    const flags = spec.flags || [];
    const industry = spec.industry || "";

    const rows = [];
    let n = 0;

    function add(target, vp, source) {
      n += 1;
      const [viewpoint, technique, cat, authority] = vp;
      rows.push({
        id: "TC-" + String(n).padStart(3, "0"),
        target: target,
        viewpoint: viewpoint,
        technique: technique,
        cat: cat,
        cat_name: V.CATEGORIES[cat] || cat,
        expected: V.expectedFor(cat, technique),
        authority: authority || "",
        source: source, // always / field:xxx / flag:xxx / industry:xxx
      });
    }

    // 1) 常時観点
    for (const vp of V.ALWAYS) add(feature, vp, "always");

    // 2) 入力項目の型別観点
    for (const f of fields) {
      const list = V.FIELD[f.type];
      if (!list) continue;
      const label = f.name && f.name !== f.type ? f.name : (f.type + " 項目");
      for (const vp of list) add(feature + " / " + label, vp, "field:" + f.type);
    }

    // 3) 機能特性別観点
    for (const flag of flags) {
      const list = V.FLAG[flag];
      if (!list) continue;
      for (const vp of list) add(feature, vp, "flag:" + flag);
    }

    // 4) 業種別観点
    if (industry && V.INDUSTRY[industry]) {
      const indName = V.INDUSTRY_NAME[industry] || industry;
      for (const vp of V.INDUSTRY[industry]) add(feature + "（" + indName + "）", vp, "industry:" + industry);
    }

    return {
      rows: rows,
      total: rows.length,
      coverage: coverage(rows),
    };
  }

  // カテゴリ別のカバレッジ集計（観点数）
  function coverage(rows) {
    const map = {};
    for (const r of rows) {
      if (!map[r.cat]) map[r.cat] = { cat: r.cat, cat_name: r.cat_name, count: 0 };
      map[r.cat].count += 1;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }

  // 関連する欠陥パターンを、生成された観点のカテゴリ集合から抽出
  function relatedDefects(rows) {
    const cats = new Set(rows.map((r) => r.cat));
    return V.DEFECT_PATTERNS
      .filter((dp) => cats.has(dp[1]))
      .map((dp) => ({
        id: dp[0], cat: dp[1], cat_name: V.CATEGORIES[dp[1]] || dp[1],
        pattern: dp[2], example: dp[3], prevention: dp[4],
      }));
  }

  // CSV文字列化（テスト観点表）。RFC4180準拠のクォート。
  function toCSV(rows) {
    const header = ["ID", "対象", "テスト観点", "技法", "カテゴリ", "期待結果", "根拠標準", "適用契機"];
    const q = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    const lines = [header.map(q).join(",")];
    for (const r of rows) {
      lines.push([r.id, r.target, r.viewpoint, r.technique, r.cat_name, r.expected, r.authority, r.source].map(q).join(","));
    }
    return lines.join("\r\n");
  }

  return { generate, coverage, relatedDefects, toCSV };
});
