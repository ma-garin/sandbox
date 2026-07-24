/**
 * app.js — UI配線（ブラウザ完結）
 * viewpoints.js / analyzer.js / engine.js をグローバル参照して動く。
 */
(function () {
  "use strict";
  const V = window.VIEWPOINTS, ANALYZER = window.ANALYZER, ENGINE = window.ENGINE;

  const SCAFFOLD = window.SCAFFOLD, LLM = window.LLM;
  const $ = (id) => document.getElementById(id);
  const el = {
    spec: $("spec"), analyzeBtn: $("analyzeBtn"), clearBtn: $("clearBtn"),
    detectedCard: $("detectedCard"), fieldChips: $("fieldChips"),
    flagChips: $("flagChips"), industryChips: $("industryChips"), regenBtn: $("regenBtn"),
    resultCard: $("resultCard"), tbody: $("tbody"), coverage: $("coverage"),
    kpiTotal: $("kpiTotal"), kpiRate: $("kpiRate"), kpiCats: $("kpiCats"), kpiDefects: $("kpiDefects"),
    blindspots: $("blindspots"),
    csvBtn: $("csvBtn"), copyBtn: $("copyBtn"), pwBtn: $("pwBtn"), pyBtn: $("pyBtn"),
    defectsCard: $("defectsCard"), defects: $("defects"), dpCount: $("dpCount"),
    aiCard: $("aiCard"), aiExpandBtn: $("aiExpandBtn"), apiKey: $("apiKey"),
    saveKeyBtn: $("saveKeyBtn"), clearKeyBtn: $("clearKeyBtn"),
    aiStatus: $("aiStatus"), aiCases: $("aiCases"),
  };

  // 判定状態（チップの ON/OFF を保持）
  let state = { feature: "対象機能", fields: {}, flags: {}, industry: null, lastCSV: "", lastRows: [] };

  const SAMPLES = {
    ec: "会員登録・ログイン機能\nユーザーはメールアドレスとパスワードで会員登録する。氏名・生年月日・電話番号を入力。\n決済はクレジットカードで金額を請求し、ECサイトのカート・在庫と連携する。クーポンの適用も行う。",
    finance: "口座間送金機能\nログイン認証後、金額と振込先を入力して送金する。残高不足時はエラー。\n送金日時を指定でき、取引の監査ログを記録する。銀行の勘定系APIと連携する。",
    ai: "AIチャットサポート\nユーザーの質問（自然言語テキスト）に対し、LLMが回答を生成する。\nログイン中の顧客情報を参照し、過去履歴から推論する。外部の生成AI APIと連携する。",
  };

  const FIELD_LABEL = { number: "数値", text: "テキスト", date: "日付", select: "選択", email: "メール", file: "ファイル" };
  const FLAG_LABEL = {
    auth: "認証/権限", integration: "外部連携", money: "金額/決済", pii: "個人情報",
    state: "状態遷移", concurrent: "同時実行", perf: "性能/負荷", ai: "AI/生成AI",
  };

  function analyze() {
    const text = el.spec.value;
    if (!text.trim()) { el.spec.focus(); return; }
    const a = ANALYZER.analyze(text);
    state.feature = a.feature;
    state.fields = {}; state.flags = {}; state.industry = a.industry ? a.industry.key : null;
    // 検出されたものを ON、evidence を保持
    V.FIELD_TYPES.forEach((t) => { state.fields[t] = false; });
    a.fields.forEach((f) => { state.fields[f.type] = { on: true, ev: f.evidence }; });
    V.FLAG_TYPES.forEach((k) => { state.flags[k] = false; });
    a.flags.forEach((f) => { state.flags[f.key] = { on: true, ev: f.evidence }; });
    state.industryEvidence = a.industryCandidates || {};
    renderChips();
    el.detectedCard.style.display = "";
    generate();
  }

  function chip(labelText, on, evidence, onToggle) {
    const c = document.createElement("span");
    c.className = "chip" + (on ? " on" : "");
    const label = document.createElement("span");
    label.textContent = labelText;
    c.appendChild(label);
    if (evidence && evidence.length) {
      const ev = document.createElement("span");
      ev.className = "ev";
      ev.textContent = "（" + evidence.slice(0, 3).join("・") + "）";
      c.appendChild(ev);
    }
    c.style.cursor = "pointer";
    c.addEventListener("click", onToggle);
    return c;
  }

  function renderChips() {
    // 入力項目
    el.fieldChips.innerHTML = "";
    V.FIELD_TYPES.forEach((t) => {
      const s = state.fields[t];
      const on = !!(s && s.on);
      el.fieldChips.appendChild(chip(FIELD_LABEL[t] || t, on, on && s.ev, () => {
        state.fields[t] = on ? false : { on: true, ev: (s && s.ev) || [] };
        renderChips();
      }));
    });
    // 機能特性
    el.flagChips.innerHTML = "";
    V.FLAG_TYPES.forEach((k) => {
      const s = state.flags[k];
      const on = !!(s && s.on);
      el.flagChips.appendChild(chip(FLAG_LABEL[k] || k, on, on && s.ev, () => {
        state.flags[k] = on ? false : { on: true, ev: (s && s.ev) || [] };
        renderChips();
      }));
    });
    // 業種（単一選択）
    el.industryChips.innerHTML = "";
    const noneOn = state.industry === null;
    el.industryChips.appendChild(chip("指定なし", noneOn, null, () => { state.industry = null; renderChips(); }));
    V.INDUSTRIES.forEach((k) => {
      const on = state.industry === k;
      const ev = (state.industryEvidence && state.industryEvidence[k]) || null;
      el.industryChips.appendChild(chip(V.INDUSTRY_NAME[k] || k, on, on && ev, () => {
        state.industry = on ? null : k; renderChips();
      }));
    });
  }

  function currentSpec() {
    const fields = V.FIELD_TYPES.filter((t) => state.fields[t] && state.fields[t].on).map((t) => ({ name: t, type: t }));
    const flags = V.FLAG_TYPES.filter((k) => state.flags[k] && state.flags[k].on);
    return { feature: state.feature, fields: fields, flags: flags, industry: state.industry || "" };
  }

  function generate() {
    const g = ENGINE.generate(currentSpec());
    const defects = ENGINE.relatedDefects(g.rows);
    const hasAI = !!(state.flags.ai && state.flags.ai.on);
    const cov = ENGINE.coverageReport(g.rows, hasAI);
    state.lastCSV = ENGINE.toCSV(g.rows);
    state.lastRows = g.rows;

    el.kpiTotal.textContent = g.total;
    el.kpiRate.textContent = cov.rate + "%";
    el.kpiCats.textContent = g.coverage.length;
    el.kpiDefects.textContent = defects.length;

    // 盲点（未カバーの観点カテゴリ）— 第三者検証の中立レビュー価値
    if (cov.missing.length) {
      el.blindspots.style.display = "";
      el.blindspots.innerHTML = "<b>盲点: " + cov.missing.length + "カテゴリ未カバー</b>（全" +
        cov.total + "カテゴリ中）— " +
        cov.missing.map((m) => '<span class="bs-chip">' + escapeHtml(m.cat_name) + "</span>").join("");
    } else {
      el.blindspots.style.display = "none";
    }

    // カバレッジバー
    const max = g.coverage.reduce((m, c) => Math.max(m, c.count), 1);
    el.coverage.innerHTML = "";
    g.coverage.forEach((c) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML =
        '<div>' + escapeHtml(c.cat_name) + '</div>' +
        '<div class="track"><div class="fill" style="width:' + (c.count / max * 100) + '%"></div></div>' +
        '<div class="num">' + c.count + '</div>';
      el.coverage.appendChild(row);
    });

    // 観点表
    el.tbody.innerHTML = "";
    g.rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + r.id + "</td>" +
        "<td>" + escapeHtml(r.target) + "</td>" +
        "<td>" + escapeHtml(r.viewpoint) + "</td>" +
        '<td><span class="tag">' + escapeHtml(r.technique) + "</span></td>" +
        "<td>" + escapeHtml(r.cat_name) + "</td>" +
        "<td>" + escapeHtml(r.expected) + "</td>" +
        '<td class="auth">' + escapeHtml(r.authority || "—") + "</td>";
      el.tbody.appendChild(tr);
    });

    // 欠陥パターン
    el.dpCount.textContent = defects.length;
    el.defects.innerHTML = "";
    defects.forEach((d) => {
      const div = document.createElement("div");
      div.className = "dp";
      div.innerHTML =
        '<span class="dp-id">' + d.id + "</span> " +
        '<span class="dp-title">' + escapeHtml(d.pattern) + "</span>" +
        '<div class="dp-meta">カテゴリ: ' + escapeHtml(d.cat_name) + "</div>" +
        '<div class="dp-meta">典型例: ' + escapeHtml(d.example) + "</div>" +
        '<div class="dp-meta">予防策: ' + escapeHtml(d.prevention) + "</div>";
      el.defects.appendChild(div);
    });

    el.resultCard.style.display = "";
    el.defectsCard.style.display = defects.length ? "" : "none";
    el.aiCard.style.display = "";
    el.aiCases.innerHTML = "";
    el.aiStatus.textContent = "";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function renderCases(cases) {
    el.aiCases.innerHTML = "";
    (cases || []).forEach((c) => {
      const div = document.createElement("div");
      div.className = "aicase";
      const steps = (c.steps || []).map((s) => "<li>" + escapeHtml(s) + "</li>").join("");
      div.innerHTML =
        '<span class="ac-id">' + escapeHtml(c.id || "") + "</span> " +
        '<span class="ac-title">' + escapeHtml(c.title || "") + "</span>" +
        '<div class="ac-row"><span class="ac-k">前提:</span> ' + escapeHtml(c.precondition || "—") + "</div>" +
        '<div class="ac-row"><span class="ac-k">手順:</span></div><ol>' + steps + "</ol>" +
        '<div class="ac-row"><span class="ac-k">データ:</span> ' + escapeHtml(c.data || "—") + "</div>" +
        '<div class="ac-row"><span class="ac-k">期待結果:</span> ' + escapeHtml(c.expected || "—") + "</div>";
      el.aiCases.appendChild(div);
    });
  }

  function download(filename, text, mime) {
    const type = (mime || "text/csv") + ";charset=utf-8;";
    const prefix = mime ? "" : "﻿"; // CSVのみBOM付与（Excel対策）
    const blob = new Blob([prefix + text], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // イベント
  el.analyzeBtn.addEventListener("click", analyze);
  el.regenBtn.addEventListener("click", generate);
  el.clearBtn.addEventListener("click", () => {
    el.spec.value = ""; el.detectedCard.style.display = "none";
    el.resultCard.style.display = "none"; el.defectsCard.style.display = "none";
    el.spec.focus();
  });
  el.csvBtn.addEventListener("click", () => {
    if (state.lastCSV) download("test-viewpoints.csv", state.lastCSV);
  });
  el.pwBtn.addEventListener("click", () => {
    if (state.lastRows.length) download("e2e.spec.ts", SCAFFOLD.toPlaywright(state.feature, state.lastRows), "text/plain");
  });
  el.pyBtn.addEventListener("click", () => {
    if (state.lastRows.length) download("test_viewpoints.py", SCAFFOLD.toPytest(state.feature, state.lastRows), "text/plain");
  });
  // APIキー管理
  el.saveKeyBtn.addEventListener("click", () => {
    LLM.setKey(el.apiKey.value);
    el.apiKey.value = "";
    el.aiStatus.textContent = LLM.hasKey() ? "APIキーを保存しました。" : "APIキーが空です。";
  });
  el.clearKeyBtn.addEventListener("click", () => {
    LLM.clearKey(); el.apiKey.value = "";
    el.aiStatus.textContent = "APIキーを消去しました。";
  });
  // AIでテストケースへ具体化
  el.aiExpandBtn.addEventListener("click", async () => {
    if (!state.lastRows.length) return;
    if (!LLM.hasKey()) { el.aiStatus.textContent = "先にAPIキーを保存してください。"; return; }
    el.aiExpandBtn.disabled = true;
    el.aiStatus.textContent = "AIがテストケースを生成中… (" + LLM.MODEL + ")";
    el.aiCases.innerHTML = "";
    try {
      const cases = await LLM.expandToTestCases(state.feature, state.lastRows);
      renderCases(cases);
      el.aiStatus.textContent = cases.length + "件のテストケースを生成しました。";
    } catch (e) {
      el.aiStatus.textContent = "生成に失敗: " + (e && e.message ? e.message : e) + "（決定的な観点表はそのまま利用できます）";
    } finally {
      el.aiExpandBtn.disabled = false;
    }
  });
  el.copyBtn.addEventListener("click", () => {
    if (!state.lastCSV) return;
    navigator.clipboard && navigator.clipboard.writeText(state.lastCSV).then(
      () => { el.copyBtn.textContent = "コピーしました"; setTimeout(() => (el.copyBtn.textContent = "CSVをコピー"), 1500); },
      () => { el.copyBtn.textContent = "コピー失敗"; }
    );
  });
  document.querySelectorAll("[data-sample]").forEach((b) => {
    b.addEventListener("click", () => { el.spec.value = SAMPLES[b.dataset.sample] || ""; analyze(); window.scrollTo({ top: 0 }); });
  });
})();
