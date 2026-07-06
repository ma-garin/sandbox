// app.js — UIオーケストレーション
import { analyzeDocument, VIEWPOINTS, SEVERITY } from "./engine.js";
import { detectInconsistencies } from "./consistency.js";
import { buildTraceability, inferRole, ROLES } from "./traceability.js";
import { parseFile } from "./parsers.js";
import { addEntry, getHistory, clearHistory, latestDelta } from "./history.js";
import { radarSVG, scoreBar } from "./charts.js";
import { getProvider, setProvider, getApiKey, setApiKey } from "./llm.js";

// ---- 状態（immutable運用: 置き換えで更新） --------------------------------
let docs = []; // [{name, text, role}]
let lastResult = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// ---- タブ ---------------------------------------------------------------
$$(".tab").forEach((t) => t.addEventListener("click", () => {
  $$(".tab").forEach((x) => x.classList.remove("active"));
  $$(".panel").forEach((x) => x.classList.remove("active"));
  t.classList.add("active");
  $(`#tab-${t.dataset.tab}`).classList.add("active");
  if (t.dataset.tab === "history") renderHistory();
}));

// ---- ドキュメント管理 ----------------------------------------------------
function syncTextareaToDocs() {
  // テキストエリアの内容を単一の一時docとして扱う（ファイル未追加時）
  const text = $("#doc-text").value.trim();
  if (!docs.length && text) {
    return [{ name: "貼付テキスト", text, role: inferRole("貼付テキスト", text) }];
  }
  // ファイルがある場合、テキストエリアにも入力があれば追加docとして混ぜる
  const extra = text ? [{ name: "貼付テキスト", text, role: inferRole("貼付テキスト", text) }] : [];
  return [...docs, ...extra];
}

function renderDocList() {
  const el = $("#doc-list");
  if (!docs.length) { el.innerHTML = ""; return; }
  el.innerHTML = docs.map((d, i) =>
    `<span class="doc-chip"><span class="role">${ROLES.find((r) => r.key === d.role)?.label || "?"}</span> ${esc(d.name)} <button data-i="${i}" title="削除">×</button></span>`
  ).join("");
  el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    docs = docs.filter((_, i) => i !== Number(b.dataset.i));
    renderDocList();
  }));
}

$("#file-input").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  for (const f of files) {
    try {
      const { name, text } = await parseFile(f);
      docs = [...docs, { name, text, role: inferRole(name, text) }];
    } catch (err) {
      toast(`「${f.name}」読込失敗: ${err.message}`);
    }
  }
  renderDocList();
  e.target.value = "";
});

// ---- 解析実行 -----------------------------------------------------------
$("#analyze-btn").addEventListener("click", runAnalysis);

function runAnalysis() {
  const targets = syncTextareaToDocs();
  if (!targets.length) { toast("解析するテキストまたはファイルを入力してください"); return; }

  // 各文書を解析し、代表（先頭）＋集約を表示
  const perDoc = targets.map((d) => ({ doc: d, result: analyzeDocument(d.text, d.name) }));

  // 集約スコア（平均）
  const agg = {};
  for (const v of VIEWPOINTS) {
    agg[v.key] = Math.round(perDoc.reduce((s, p) => s + p.result.scores[v.key], 0) / perDoc.length);
  }
  const overall = Math.round(VIEWPOINTS.reduce((s, v) => s + agg[v.key], 0) / VIEWPOINTS.length);
  const allFindings = perDoc.flatMap((p) => p.result.findings.map((f) => ({ ...f, doc: p.result.name })));
  const counts = SEVERITY.reduce((o, s) => ((o[s] = allFindings.filter((f) => f.severity === s).length), o), {});

  lastResult = { perDoc, agg, overall, allFindings, counts, targets };

  // 履歴保存（Date.nowはブラウザでは利用可）
  addEntry({
    id: "r" + Date.now(), at: new Date().toISOString(),
    docNames: targets.map((d) => d.name), overall, scores: agg, counts,
  });

  renderResult();
  renderConsistency(targets);
  renderTrace(targets);
  toast("解析が完了しました");
}

function renderResult() {
  const { agg, overall, allFindings, counts } = lastResult;
  const axes = VIEWPOINTS.map((v) => ({ label: v.label, value: agg[v.key] }));
  const delta = latestDelta();
  const prev = delta ? VIEWPOINTS.map((v) => (agg[v.key] - (delta.delta[v.key] || 0))) : null;

  const bars = VIEWPOINTS.map((v) => scoreBar(v.label, agg[v.key])).join("");
  const pills = SEVERITY.map((s) => `<span class="count-pill ${s}">${s} ${counts[s]}</span>`).join("");

  const findingsHtml = allFindings.length
    ? allFindings.map((f) => `
      <div class="finding ${f.severity}">
        <div class="finding-head">
          <span class="sev-tag ${f.severity}">${f.severity}</span>
          <span class="vp-tag">${VIEWPOINTS.find((v) => v.key === f.viewpoint)?.label || f.viewpoint}</span>
          <span class="finding-msg">${esc(f.message)}</span>
          <span class="loc">${esc(f.doc || "")}${f.location ? " · L" + f.location : ""}</span>
        </div>
        <div class="evidence">${esc(f.evidence)}</div>
        <div class="suggestion"><b>改善:</b> ${esc(f.suggestion)}</div>
        <div class="effect">期待効果: ${esc(f.expectedEffect)}</div>
      </div>`).join("")
    : `<div class="empty">指摘は見つかりませんでした 🎉</div>`;

  $("#result").hidden = false;
  $("#result").innerHTML = `
    <div class="overview">
      <div>
        <div class="overall-badge">
          <div class="num" style="color:${overallColor(overall)}">${overall}</div>
          <div class="cap">総合スコア / 100</div>
        </div>
        ${radarSVG(axes, { prev })}
      </div>
      <div>
        ${bars}
        <div class="counts">${pills}</div>
        ${delta ? deltaHtml(delta) : ""}
      </div>
    </div>
    <div class="findings"><h2>指摘一覧（${allFindings.length}件・severity順）</h2>${findingsHtml}</div>`;
}

function deltaHtml(delta) {
  const sign = (n) => (n > 0 ? `<span class="delta up">▲${n}</span>` : n < 0 ? `<span class="delta down">▼${-n}</span>` : "±0");
  return `<p class="hint">前回比: 総合 ${sign(delta.overall)} ／ ` +
    VIEWPOINTS.map((v) => `${v.label} ${sign(delta.delta[v.key] || 0)}`).join(" ／ ") + "</p>";
}

function overallColor(v) { const hue = Math.round((v / 100) * 120); return `hsl(${hue} 65% 45%)`; }

// ---- 矛盾検知 -----------------------------------------------------------
function renderConsistency(targets) {
  const el = $("#consistency-result");
  if (targets.length < 2) {
    el.innerHTML = `<div class="empty">2つ以上のドキュメントを追加すると矛盾検知が有効になります（現在 ${targets.length} 件）</div>`;
    return;
  }
  const findings = detectInconsistencies(targets);
  if (!findings.length) { el.innerHTML = `<div class="empty">文書間の不一致・矛盾は検出されませんでした 🎉</div>`; return; }
  el.innerHTML = findings.map((f) => `
    <div class="finding ${f.severity}">
      <div class="finding-head">
        <span class="sev-tag ${f.severity}">${f.severity}</span>
        <span class="vp-tag">${f.type}</span>
        <span class="finding-msg">${esc(f.message)}</span>
      </div>
      <div class="evidence">${esc(f.evidence)}</div>
      <div class="suggestion"><b>改善:</b> ${esc(f.suggestion)}</div>
      <div class="effect">期待効果: ${esc(f.expectedEffect)} ／ 対象: ${esc((f.docs || []).join(", "))}</div>
    </div>`).join("");
}

// ---- トレーサビリティ ----------------------------------------------------
function renderTrace(targets) {
  const el = $("#trace-result");
  const tr = buildTraceability(targets);
  if (!tr.ids.length) {
    el.innerHTML = `<div class="empty">識別子（REQ-/FR-/NFR-/TC- 等）が見つかりませんでした。要件にIDを付番すると対応表を作成します。</div>`;
    return;
  }
  const cov = ROLES.map((r) => `${r.label} ${tr.coverage[r.key].pct}% (${tr.coverage[r.key].covered}/${tr.coverage[r.key].total})`).join(" ／ ");
  const rows = tr.rows.map((row) => {
    const cells = ROLES.map((r) => {
      const list = row.cell[r.key];
      return list.length
        ? `<td class="ok">${esc(list.join(", "))}</td>`
        : `<td class="gap">—</td>`;
    }).join("");
    return `<tr><td><b>${esc(row.id)}</b></td>${cells}<td>${row.gaps.length ? `<span class="gap">${row.gaps.join("・")}</span>` : `<span class="ok">OK</span>`}</td></tr>`;
  }).join("");
  el.innerHTML = `
    <p class="hint">カバレッジ: ${cov} ／ 断絶: <b>${tr.gapsCount}</b> 件</p>
    <div class="tbl-wrap"><table class="matrix">
      <thead><tr><th>ID</th>${ROLES.map((r) => `<th>${r.label}</th>`).join("")}<th>判定</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// ---- 履歴 ---------------------------------------------------------------
function renderHistory() {
  const el = $("#history-result");
  const list = getHistory();
  if (!list.length) { el.innerHTML = `<div class="empty">解析履歴はまだありません。</div>`; return; }
  el.innerHTML = list.map((h) => `
    <div class="hist-item">
      <div>
        <b>総合 ${h.overall}</b> · ${esc((h.docNames || []).join(", "))}
        <div class="hist-scores">${VIEWPOINTS.map((v) => `${v.label}:${h.scores?.[v.key] ?? "-"}`).join(" ")}</div>
      </div>
      <div class="hint">${new Date(h.at).toLocaleString("ja-JP")}</div>
    </div>`).join("");
}

$("#clear-history-btn").addEventListener("click", () => {
  clearHistory();
  renderHistory();
  toast("履歴をクリアしました");
});

// ---- 設定 ---------------------------------------------------------------
$("#provider-select").value = getProvider();
$("#apikey-input").value = getApiKey();
$("#provider-select").addEventListener("change", (e) => { setProvider(e.target.value); toast("エンジンを変更しました"); });
$("#save-key-btn").addEventListener("click", () => { setApiKey($("#apikey-input").value.trim()); toast("APIキーを保存しました"); });

// ---- サンプル -----------------------------------------------------------
$("#sample-btn").addEventListener("click", () => {
  $("#doc-text").value = SAMPLE;
  toast("サンプルを投入しました。『解析する』を押してください");
});

// ---- toast --------------------------------------------------------------
let toastTimer;
function toast(msg) {
  let el = $(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

const SAMPLE = `# ログイン機能 要件定義書

## 概要
本システムは利用者がログインできること。適切にエラーを表示する。

## 機能要件
REQ-001 利用者はメールアドレスとパスワードでログインする。
REQ-002 パスワードは8文字以上とする。ログイン試行は必要に応じて制限する。
パスワードを忘れた場合の再設定はTBD。

## 非機能
応答時間は3秒以内を目指す。`;

renderDocList();
