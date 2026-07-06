// report.js — 成果物出力（HTMLレポート / CSV / コメント付きMarkdown）
//
// QuintSpectの「問題箇所コメント付きファイル出力」に相当する機能＋CSV/HTMLレポート。
// すべて純粋関数（ブラウザ/Node両対応）。ダウンロード処理は呼び出し側で行う。

import { VIEWPOINTS } from "./engine.js";

const vpLabel = (key) => VIEWPOINTS.find((v) => v.key === key)?.label || key;

function csvEscape(s) {
  const t = String(s ?? "");
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

// 指摘一覧をCSV化（BOM付き: Excelでの文字化け防止）
export function buildCsv(findings) {
  const header = ["severity", "観点", "文書", "行", "指摘", "根拠", "改善案", "期待効果"];
  const rows = findings.map((f) => [
    f.severity, vpLabel(f.viewpoint), f.doc || "", f.location || "",
    f.message, f.evidence, f.suggestion, f.expectedEffect,
  ].map(csvEscape).join(","));
  return "﻿" + [header.join(","), ...rows].join("\n");
}

// 元文書に指摘コメントをインライン追記したMarkdownを生成
// docs: [{name, text}], findings: [{doc, location, severity, viewpoint, message, suggestion}]
export function buildAnnotatedMarkdown(docs, findings) {
  const sections = docs.map((d) => {
    const mine = findings.filter((f) => f.doc === d.name);
    const byLine = {};
    const globals = [];
    for (const f of mine) {
      if (f.location && f.location > 0) (byLine[f.location] ||= []).push(f);
      else globals.push(f);
    }
    const lines = d.text.replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    lines.forEach((line, i) => {
      out.push(line);
      for (const f of byLine[i + 1] || []) {
        out.push(`> ⚠️ **[${f.severity}/${vpLabel(f.viewpoint)}]** ${f.message}`);
        out.push(`> 改善: ${f.suggestion}`);
      }
    });
    const globalBlock = globals.length
      ? ["", "## 📌 文書全体への指摘", ...globals.map((f) => `- ⚠️ **[${f.severity}/${vpLabel(f.viewpoint)}]** ${f.message}（改善: ${f.suggestion}）`)]
      : [];
    return [`# 📄 ${d.name}（指摘コメント付き）`, "", ...out, ...globalBlock].join("\n");
  });
  return sections.join("\n\n---\n\n");
}

// 自己完結HTMLレポート（配布用・印刷可）
export function buildHtmlReport({ overall, agg, counts, findings, docNames, radarSvg, generatedAt, consistency = [], trace = null }) {
  const sevColor = { Critical: "#d64550", High: "#e8833a", Medium: "#c9a227", Low: "#7a8895" };
  const bars = VIEWPOINTS.map((v) => {
    const val = agg[v.key];
    const hue = Math.round((val / 100) * 120);
    return `<tr><td>${v.label}</td><td style="width:60%"><div style="background:#eef1f5;border-radius:6px"><div style="width:${val}%;background:hsl(${hue} 70% 45%);height:10px;border-radius:6px"></div></div></td><td style="text-align:right;font-weight:600">${val}</td></tr>`;
  }).join("");
  const rows = findings.map((f) => `
    <tr>
      <td><span style="background:${sevColor[f.severity]};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700">${f.severity}</span></td>
      <td>${vpLabel(f.viewpoint)}${f.source === "ai" ? " <em>(AI)</em>" : ""}</td>
      <td>${esc(f.doc || "")}${f.location ? ` L${f.location}` : ""}</td>
      <td>${esc(f.message)}<div style="color:#667;font-size:12px;margin-top:4px;font-family:monospace">${esc(f.evidence)}</div><div style="color:#2f6fed;font-size:13px;margin-top:4px">改善: ${esc(f.suggestion)}</div></td>
    </tr>`).join("");
  const consRows = consistency.map((f) => `
    <tr><td><span style="background:${sevColor[f.severity]};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700">${f.severity}</span></td>
    <td>${esc(f.message)}<div style="color:#667;font-size:12px;margin-top:4px;font-family:monospace">${esc(f.evidence)}</div></td></tr>`).join("");
  const traceBlock = trace && trace.ids.length ? `
    <h2>要件↔設計↔テスト トレーサビリティ</h2>
    <p>断絶: <b>${trace.gapsCount}</b> 件</p>
    <table><thead><tr><th>ID</th><th>要件</th><th>設計</th><th>テスト</th><th>判定</th></tr></thead><tbody>
    ${trace.rows.map((r) => `<tr><td><b>${esc(r.id)}</b></td>${["requirement", "design", "test"].map((k) => `<td>${r.cell[k].length ? esc(r.cell[k].join(", ")) : '<span style="color:#d64550">—</span>'}</td>`).join("")}<td>${r.complete ? '<span style="color:#2c9c46">OK</span>' : `<span style="color:#d64550">${r.gaps.join("・")}</span>`}</td></tr>`).join("")}
    </tbody></table>` : "";
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>仕様書インスペクションレポート</title>
<style>
body{font-family:-apple-system,"Hiragino Kaku Gothic ProN","Noto Sans JP",Meiryo,sans-serif;max-width:960px;margin:0 auto;padding:32px;color:#1c2530;line-height:1.7}
h1{font-size:22px;border-bottom:3px solid #2f6fed;padding-bottom:8px}h2{font-size:17px;margin-top:32px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #dde3ea;padding:8px 10px;text-align:left;vertical-align:top}th{background:#f2f5f9}
.meta{color:#667;font-size:13px}.score{font-size:48px;font-weight:700;color:#2f6fed}
.grid{display:flex;gap:32px;align-items:center;flex-wrap:wrap}
@media print{body{padding:0}}
</style></head><body>
<h1>仕様書インスペクションレポート</h1>
<p class="meta">生成: ${esc(generatedAt)} ／ 対象: ${esc(docNames.join(", "))} ／ spec-inspector（6観点診断・ISTQB severity分類）</p>
<div class="grid"><div><div class="score">${overall}<span style="font-size:16px;color:#667"> / 100</span></div><div class="meta">総合スコア</div></div>${radarSvg}</div>
<h2>観点別スコア</h2><table>${bars}</table>
<h2>指摘一覧（${findings.length}件）</h2>
<p class="meta">Critical: ${counts.Critical} ／ High: ${counts.High} ／ Medium: ${counts.Medium} ／ Low: ${counts.Low}</p>
<table><thead><tr><th>severity</th><th>観点</th><th>箇所</th><th>指摘・根拠・改善</th></tr></thead><tbody>${rows}</tbody></table>
${consistency.length ? `<h2>文書間の矛盾・不一致（${consistency.length}件）</h2><table><tbody>${consRows}</tbody></table>` : ""}
${traceBlock}
<p class="meta" style="margin-top:40px">本レポートの指摘はすべて根拠引用付き（evidence-only）。ISO/IEC 25010品質特性に基づく診断。</p>
</body></html>`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
