// app.js — UIオーケストレーション
import { analyzeDocument, VIEWPOINTS, SEVERITY } from "./engine.js";
import { detectInconsistencies } from "./consistency.js";
import { buildTraceability, inferRole, ROLES } from "./traceability.js";
import { parseFile } from "./parsers.js";
import { addEntry, getHistory, clearHistory, latestDelta } from "./history.js";
import { radarSVG, scoreBar } from "./charts.js";
import {
  getProvider, setProvider, getModel, setModel,
  getOpenAIKey, setOpenAIKey, getOpenAIOrg, setOpenAIOrg,
  getOpenAIProject, setOpenAIProject, enrichWithAI,
} from "./llm.js";
import { buildCsv, buildAnnotatedMarkdown, buildHtmlReport } from "./report.js";
import { analyzeTestDesignReadiness } from "./testdesign.js";
import { analyzeTestDocQuality } from "./testdoc.js";

// ---- 状態（immutable運用: 置き換えで更新） --------------------------------
let docs = []; // [{name, text, role}]
let lastResult = null;
// 指摘フィルタ状態
let filterSev = new Set(SEVERITY);
let filterVp = "all";
let filterDoc = "all";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// ---- タブ ---------------------------------------------------------------
function switchTab(name) {
  $$(".tab").forEach((x) => {
    const active = x.dataset.tab === name;
    x.classList.toggle("active", active);
    x.setAttribute("aria-selected", String(active));
  });
  $$(".panel").forEach((x) => x.classList.remove("active"));
  $(`#tab-${name}`).classList.add("active");
  if (name === "history") renderHistory();
}
$$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

function setTabBadge(name, count) {
  const tab = $(`.tab[data-tab="${name}"]`);
  let b = tab.querySelector(".badge");
  if (!count) { b?.remove(); return; }
  if (!b) { b = document.createElement("span"); b.className = "badge"; tab.appendChild(b); }
  b.textContent = count;
}

// ---- ドキュメント管理 ----------------------------------------------------
function syncTextareaToDocs() {
  const text = $("#doc-text").value.trim();
  const extra = text ? [{ name: "貼付テキスト", text, role: inferRole("貼付テキスト", text) }] : [];
  return [...docs, ...extra];
}

function renderDocList() {
  const el = $("#doc-list");
  if (!docs.length) { el.innerHTML = ""; return; }
  el.innerHTML = docs.map((d, i) =>
    `<span class="doc-chip"><span class="role">${ROLES.find((r) => r.key === d.role)?.label || "?"}</span> ${esc(d.name)} <button data-i="${i}" title="削除" aria-label="${esc(d.name)}を削除">×</button></span>`
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

async function runAnalysis() {
  const targets = syncTextareaToDocs();
  if (!targets.length) { toast("解析するテキストまたはファイルを入力してください"); return; }

  const btn = $("#analyze-btn");
  btn.disabled = true;
  btn.textContent = getProvider() === "openai" ? "解析中…（AI補足あり）" : "解析中…";

  try {
    // ルールベース解析（スコアの根拠。再現性を担保）
    const perDoc = targets.map((d) => ({ doc: d, result: analyzeDocument(d.text, d.name) }));
    const agg = {};
    for (const v of VIEWPOINTS) {
      agg[v.key] = Math.round(perDoc.reduce((s, p) => s + p.result.scores[v.key], 0) / perDoc.length);
    }
    const overall = Math.round(VIEWPOINTS.reduce((s, v) => s + agg[v.key], 0) / VIEWPOINTS.length);
    let allFindings = perDoc.flatMap((p) => p.result.findings.map((f) => ({ ...f, doc: p.result.name, source: "rule" })));

    // テスト設計書診断: role=test の文書にのみ専用ルールを適用して合流
    const testDocFindings = targets
      .filter((d) => d.role === "test")
      .flatMap((d) => analyzeTestDocQuality(d.text, d.name).map((f) => ({ ...f, source: "rule" })));
    allFindings = [...allFindings, ...testDocFindings];

    // AI補足（有効時のみ・スコアには影響させない）
    const aiInfo = await enrichWithAI(targets);
    if (aiInfo.findings.length) {
      const names = new Set(targets.map((t) => t.name));
      allFindings = [...allFindings, ...aiInfo.findings.map((f) => ({ ...f, doc: names.has(f.doc) ? f.doc : targets[0].name }))];
    }

    const counts = SEVERITY.reduce((o, s) => ((o[s] = allFindings.filter((f) => f.severity === s).length), o), {});
    const consistency = targets.length >= 2 ? detectInconsistencies(targets) : [];
    const trace = buildTraceability(targets);
    const testdesign = analyzeTestDesignReadiness(targets);

    lastResult = { perDoc, agg, overall, allFindings, counts, targets, consistency, trace, testdesign, aiCount: aiInfo.findings.length };

    addEntry({
      id: "r" + Date.now(), at: new Date().toISOString(),
      docNames: targets.map((d) => d.name), overall, scores: agg, counts,
    });

    // フィルタをリセットして描画
    filterSev = new Set(SEVERITY); filterVp = "all"; filterDoc = "all";
    renderResult();
    renderConsistency();
    renderTrace();
    renderTestDesign();
    setTabBadge("consistency", consistency.length);
    setTabBadge("trace", trace.gapsCount);
    setTabBadge("testdesign", testdesign.candidates.length);
    // AIの警告は完了メッセージに統合（別トーストだと上書きされて読めないため）
    const done = aiInfo.findings.length ? `解析完了（AI補足 ${aiInfo.findings.length}件を含む）` : "解析が完了しました";
    toast(aiInfo.error ? `${done}／${aiInfo.error}` : done);
  } finally {
    btn.disabled = false;
    btn.textContent = "解析する";
  }
}

// ---- 解析結果描画 ---------------------------------------------------------
function renderResult() {
  const { agg, overall, perDoc, aiCount } = lastResult;
  const axes = VIEWPOINTS.map((v) => ({ label: v.label, value: agg[v.key] }));
  const delta = latestDelta();
  const prev = delta ? VIEWPOINTS.map((v) => (agg[v.key] - (delta.delta[v.key] || 0))) : null;

  const bars = VIEWPOINTS.map((v) => scoreBar(v.label, agg[v.key])).join("");

  // 文書別スコア（2文書以上のとき）
  const perDocTable = perDoc.length >= 2 ? `
    <div class="tbl-wrap"><table class="matrix perdoc">
      <thead><tr><th>文書</th><th>総合</th>${VIEWPOINTS.map((v) => `<th>${v.label}</th>`).join("")}</tr></thead>
      <tbody>${perDoc.map((p) => `<tr><td>${esc(p.result.name)}</td><td><b>${p.result.overall}</b></td>${VIEWPOINTS.map((v) => `<td>${p.result.scores[v.key]}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>` : "";

  $("#result").hidden = false;
  $("#result").innerHTML = `
    <div class="overview">
      <div>
        <div class="overall-badge">
          <div class="num" style="color:${overallColor(overall)}">${overall}</div>
          <div class="cap">総合スコア / 100${aiCount ? `　<span class="ai-note">AI補足 ${aiCount}件</span>` : ""}</div>
        </div>
        ${radarSVG(axes, { prev })}
      </div>
      <div>
        ${bars}
        ${delta ? deltaHtml(delta) : ""}
        ${perDocTable}
        <div class="exports">
          <button class="btn" id="export-html">📊 レポート出力 (HTML)</button>
          <button class="btn" id="export-csv">📋 指摘一覧 (CSV)</button>
          <button class="btn" id="export-md">📝 コメント付き文書 (MD)</button>
        </div>
      </div>
    </div>
    <div class="findings">
      <div class="findings-head">
        <h2>指摘一覧</h2>
        <div class="filters" role="group" aria-label="指摘の絞り込み">
          <span class="sev-filters">${SEVERITY.map((s) => `<button class="sev-toggle ${s} on" data-sev="${s}">${s} ${lastResult.counts[s]}</button>`).join("")}</span>
          <select id="vp-filter" aria-label="観点で絞り込み"><option value="all">全観点</option>${VIEWPOINTS.map((v) => `<option value="${v.key}">${v.label}</option>`).join("")}</select>
          ${lastResult.targets.length >= 2 ? `<select id="doc-filter" aria-label="文書で絞り込み"><option value="all">全文書</option>${lastResult.targets.map((t) => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join("")}</select>` : ""}
        </div>
      </div>
      <div id="finding-list"></div>
    </div>`;

  // フィルタイベント
  $$(".sev-toggle").forEach((b) => b.addEventListener("click", () => {
    const s = b.dataset.sev;
    if (filterSev.has(s)) filterSev.delete(s); else filterSev.add(s);
    b.classList.toggle("on", filterSev.has(s));
    renderFindingList();
  }));
  $("#vp-filter").addEventListener("change", (e) => { filterVp = e.target.value; renderFindingList(); });
  $("#doc-filter")?.addEventListener("change", (e) => { filterDoc = e.target.value; renderFindingList(); });

  // エクスポート
  $("#export-html").addEventListener("click", exportHtml);
  $("#export-csv").addEventListener("click", () => download("指摘一覧.csv", buildCsv(lastResult.allFindings), "text/csv"));
  $("#export-md").addEventListener("click", () =>
    download("コメント付き文書.md", buildAnnotatedMarkdown(lastResult.targets, lastResult.allFindings), "text/markdown"));

  renderFindingList();
}

function renderFindingList() {
  const { allFindings } = lastResult;
  const filtered = allFindings.filter((f) =>
    filterSev.has(f.severity) &&
    (filterVp === "all" || f.viewpoint === filterVp) &&
    (filterDoc === "all" || f.doc === filterDoc)
  );
  const el = $("#finding-list");
  if (!filtered.length) {
    el.innerHTML = `<div class="empty">${allFindings.length ? "フィルタ条件に一致する指摘はありません" : "指摘は見つかりませんでした 🎉"}</div>`;
    return;
  }
  el.innerHTML = `<p class="hint">${filtered.length} / ${allFindings.length} 件を表示</p>` + filtered.map((f) => `
    <div class="finding ${f.severity}">
      <div class="finding-head">
        <span class="sev-tag ${f.severity}">${f.severity}</span>
        <span class="vp-tag">${VIEWPOINTS.find((v) => v.key === f.viewpoint)?.label || f.viewpoint}</span>
        ${f.source === "ai" ? `<span class="ai-tag">AI補足</span>` : ""}
        <span class="finding-msg">${esc(f.message)}</span>
        <span class="loc">${esc(f.doc || "")}${f.location ? " · L" + f.location : ""}</span>
      </div>
      <div class="evidence">${esc(f.evidence)}</div>
      <div class="suggestion"><b>改善:</b> ${esc(f.suggestion)}</div>
      <div class="effect">期待効果: ${esc(f.expectedEffect)}</div>
    </div>`).join("");
}

function exportHtml() {
  const { overall, agg, counts, allFindings, targets, consistency, trace } = lastResult;
  const axes = VIEWPOINTS.map((v) => ({ label: v.label, value: agg[v.key] }));
  // レポートはCSS変数が使えないため、変数を実値に置換した独立SVGを埋め込む
  const radar = radarSVG(axes, {})
    .replace(/var\(--grid\)/g, "#d7dee7")
    .replace(/var\(--accent-fill\)/g, "rgba(47,111,237,0.16)")
    .replace(/var\(--accent\)/g, "#2f6fed")
    .replace(/var\(--muted\)/g, "#6b7683")
    .replace(/class="radar-label"/g, 'style="font-size:12px;font-weight:600;fill:#1c2530"')
    .replace(/class="radar-val"/g, 'style="font-size:11px;fill:#6b7683"');
  const html = buildHtmlReport({
    overall, agg, counts,
    findings: allFindings,
    docNames: targets.map((t) => t.name),
    radarSvg: radar,
    generatedAt: new Date().toLocaleString("ja-JP"),
    consistency, trace,
  });
  download("インスペクションレポート.html", html, "text/html");
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast(`${filename} をダウンロードしました`);
}

function deltaHtml(delta) {
  const sign = (n) => (n > 0 ? `<span class="delta up">▲${n}</span>` : n < 0 ? `<span class="delta down">▼${-n}</span>` : "±0");
  return `<p class="hint">前回比: 総合 ${sign(delta.overall)} ／ ` +
    VIEWPOINTS.map((v) => `${v.label} ${sign(delta.delta[v.key] || 0)}`).join(" ／ ") + "</p>";
}

function overallColor(v) { const hue = Math.round((v / 100) * 120); return `hsl(${hue} 65% 45%)`; }

// ---- 矛盾検知 -----------------------------------------------------------
function emptyWithCta(message) {
  return `<div class="empty">${message}<br><button class="btn primary cta-analyze" style="margin-top:12px">解析タブでドキュメントを追加</button></div>`;
}
function bindCta(el) {
  el.querySelector(".cta-analyze")?.addEventListener("click", () => switchTab("analyze"));
}

function renderConsistency() {
  const el = $("#consistency-result");
  const { targets, consistency } = lastResult;
  if (targets.length < 2) {
    el.innerHTML = emptyWithCta(`2つ以上のドキュメントを追加すると矛盾検知が有効になります（現在 ${targets.length} 件）`);
    bindCta(el);
    return;
  }
  if (!consistency.length) { el.innerHTML = `<div class="empty">文書間の不一致・矛盾は検出されませんでした 🎉</div>`; return; }
  el.innerHTML = consistency.map((f) => `
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
function renderTrace() {
  const el = $("#trace-result");
  const { trace } = lastResult;
  if (!trace.ids.length) {
    el.innerHTML = emptyWithCta("識別子（REQ-/FR-/NFR-/TC- 等）が見つかりませんでした。要件にIDを付番すると対応表を作成します。");
    bindCta(el);
    return;
  }
  const cov = ROLES.map((r) => `${r.label} ${trace.coverage[r.key].pct}% (${trace.coverage[r.key].covered}/${trace.coverage[r.key].total})`).join(" ／ ");
  const rows = trace.rows.map((row) => {
    const cells = ROLES.map((r) => {
      const list = row.cell[r.key];
      return list.length ? `<td class="ok">${esc(list.join(", "))}</td>` : `<td class="gap">—</td>`;
    }).join("");
    return `<tr><td><b>${esc(row.id)}</b></td>${cells}<td>${row.gaps.length ? `<span class="gap">${row.gaps.join("・")}</span>` : `<span class="ok">OK</span>`}</td></tr>`;
  }).join("");
  el.innerHTML = `
    <p class="hint">カバレッジ: ${cov} ／ 断絶: <b>${trace.gapsCount}</b> 件</p>
    <div class="tbl-wrap"><table class="matrix">
      <thead><tr><th>ID</th>${ROLES.map((r) => `<th>${r.label}</th>`).join("")}<th>判定</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// ---- テスト設計レディネス ------------------------------------------------
const TD_LABEL = { "decision-table": "デシジョンテーブル", boundary: "境界値分析", state: "状態遷移" };

function renderTestDesign() {
  const el = $("#testdesign-result");
  const { testdesign, targets } = lastResult;
  if (!testdesign || !testdesign.candidates.length) {
    if (!targets.length) { el.innerHTML = emptyWithCta("解析するとテスト技法の適用候補を表示します。"); bindCta(el); return; }
    el.innerHTML = `<div class="empty">テスト技法の適用候補は検出されませんでした（条件分岐・数値境界・状態遷移の記述が見当たりません）。</div>`;
    return;
  }
  const c = testdesign.counts;
  const summary = `<p class="hint">候補 ${testdesign.candidates.length} 件（デシジョンテーブル ${c.decisionTable} ／ 境界値 ${c.boundary} ／ 状態遷移 ${c.state}）</p>`;
  el.innerHTML = summary + testdesign.candidates.map((cand, i) => `
    <div class="finding">
      <div class="finding-head">
        <span class="vp-tag">${TD_LABEL[cand.type] || cand.type}</span>
        <span class="finding-msg">適用候補</span>
        <span class="loc">${esc(cand.doc || "")}${cand.location ? " · L" + cand.location : ""}</span>
      </div>
      <div class="evidence">${esc(cand.evidence)}</div>
      <details class="td-draft">
        <summary>テスト下書きを表示 <button class="btn ghost td-copy" data-i="${i}" type="button">コピー</button></summary>
        <pre class="td-pre" id="td-pre-${i}">${esc(cand.draft)}</pre>
      </details>
    </div>`).join("");
  el.querySelectorAll(".td-copy").forEach((b) => b.addEventListener("click", (ev) => {
    ev.preventDefault();
    const draft = testdesign.candidates[Number(b.dataset.i)].draft;
    navigator.clipboard?.writeText(draft).then(() => toast("下書きをコピーしました"), () => toast("コピーに失敗しました"));
  }));
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
$("#model-input").value = getModel();
$("#openai-org").value = getOpenAIOrg();
$("#openai-project").value = getOpenAIProject();
$("#openai-key").value = getOpenAIKey();
$("#provider-select").addEventListener("change", (e) => { setProvider(e.target.value); toast("エンジンを変更しました"); });
$("#model-input").addEventListener("change", (e) => { setModel(e.target.value); toast(`モデルを ${getModel()} に設定しました`); });
$("#save-openai-btn").addEventListener("click", () => {
  setOpenAIOrg($("#openai-org").value.trim());
  setOpenAIProject($("#openai-project").value.trim());
  setOpenAIKey($("#openai-key").value.trim());
  toast("OpenAI設定を保存しました");
});

// ---- サンプル -----------------------------------------------------------
// 3文書（要件・設計・テスト）を投入し、矛盾検知・トレーサビリティまで一気に体験できるデモ
const SAMPLES = [
  {
    name: "要件定義書.md", role: "requirement",
    text: `# ログイン機能 要件定義書

## 機能要件
REQ-001 利用者はメールアドレスとパスワードでログインできること。
REQ-002 パスワードは8文字以上とする。ログイン試行は必要に応じて制限する。
REQ-003 「多要素認証」は必須とする。
パスワード再設定フローはTBD。

## 非機能要件
応答時間は3秒以内を目指す。`,
  },
  {
    name: "基本設計書.md", role: "design",
    text: `# ログイン機能 基本設計書

REQ-001 認証APIは POST /login。応答時間は5秒を上限とする。
「多要素認証」は対象外とする。
エラー時は適切にメッセージを表示する。`,
  },
  {
    name: "テスト仕様書.md", role: "test",
    text: `# ログイン機能 テスト仕様書

TC-001 REQ-001 を検証。正しい資格情報でログインできること。
TC-002 誤ったパスワードでエラーが表示されること。`,
  },
];

$("#sample-btn").addEventListener("click", () => {
  docs = SAMPLES.map((s) => ({ ...s }));
  $("#doc-text").value = "";
  renderDocList();
  toast("サンプル3文書（要件・設計・テスト）を投入しました。『解析する』を押してください");
});

// ---- toast --------------------------------------------------------------
let toastTimer;
function toast(msg) {
  let el = $(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

renderDocList();
