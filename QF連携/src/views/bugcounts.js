// views/bugcounts.js — 不具合(バグ)件数スナップショットの登録とグラフ表示
//
// 「課題(Issue)管理」に相当する機能はQualityForward APIに存在しない
// （bug_count_snapshotsは書込み専用でGET/一覧エンドポイントが無い）。
// そのためOPEN/CLOSE件数の日次スナップショット登録とグラフ化のみを提供し、
// 履歴はこのブラウザのlocalStorageにのみ保持する（他ブラウザ・他端末とは共有されない）。

import { listTestPhases, createBugCountSnapshots } from "../client.js";
import { lineChartSVG } from "../charts.js";
import { escapeHtml, renderEmpty, renderError, showToast, requireProfile } from "../ui.js";

const HISTORY_STORE = "qf-renkei.bugCountHistory.v1";

function readHistory() {
  const raw = localStorage.getItem(HISTORY_STORE);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
function writeHistory(all) {
  localStorage.setItem(HISTORY_STORE, JSON.stringify(all));
}
function appendHistory(testPhaseId, snapshot) {
  const all = readHistory();
  const list = all[testPhaseId] || [];
  writeHistory({ ...all, [testPhaseId]: [...list, snapshot] });
}

const state = { apiKey: "", phases: [], selectedPhaseId: null };

export async function renderBugCountsView(container) {
  const profile = requireProfile(container);
  if (!profile) return;
  state.apiKey = profile.apiKey;
  container.innerHTML = `<p class="empty">読み込み中...</p>`;

  const res = await listTestPhases({ apiKey: state.apiKey });
  if (!res.ok) {
    container.innerHTML = renderError(res.error);
    return;
  }
  state.phases = res.data?.test_phases || [];
  state.selectedPhaseId = state.phases.some((p) => p.id === state.selectedPhaseId) ? state.selectedPhaseId : state.phases[0]?.id ?? null;

  paint(container);
}

function paint(container) {
  const phaseOptions = state.phases
    .map((p) => `<option value="${p.id}" ${p.id === state.selectedPhaseId ? "selected" : ""}>${escapeHtml(p.name)} (#${p.id})</option>`)
    .join("");

  const history = state.selectedPhaseId ? (readHistory()[state.selectedPhaseId] || []) : [];
  const sorted = [...history].sort((a, b) => (a.target_date > b.target_date ? 1 : -1));
  const series = [
    {
      label: "OPEN",
      color: "var(--crit)",
      points: sorted.map((h, i) => ({ x: i, y: h.open_count, dateLabel: h.target_date })),
    },
    {
      label: "CLOSE",
      color: "var(--accent)",
      points: sorted.map((h, i) => ({ x: i, y: h.close_count, dateLabel: h.target_date })),
    },
  ];

  const historyRows = [...sorted]
    .reverse()
    .map((h) => `<tr><td>${escapeHtml(h.target_date)}</td><td>${h.open_count}</td><td>${h.close_count}</td></tr>`)
    .join("");

  container.innerHTML = `
    <div class="input-head"><h2>不具合件数</h2></div>
    <p class="hint">
      QualityForward APIには個々の不具合チケットを扱うエンドポイントが無いため、日次のOPEN/CLOSE件数スナップショットの登録・グラフ化のみを提供します。
      履歴は<strong>このブラウザにのみ</strong>保存されます（APIに履歴の取得手段が無いため）。
    </p>

    <label>対象テストフェーズ
      <select id="phase-select">${phaseOptions || '<option value="">(フェーズがありません)</option>'}</select>
    </label>

    <div class="add-form">
      <input type="date" id="snapshot-date" />
      <input type="number" id="snapshot-open" placeholder="OPEN件数" min="0" />
      <input type="number" id="snapshot-close" placeholder="CLOSE件数" min="0" />
      <button class="btn primary" id="snapshot-submit-btn">登録</button>
    </div>

    <h3 style="margin-top:24px">推移</h3>
    ${series[0].points.length ? lineChartSVG(series) : renderEmpty("まだ登録がありません")}

    <h3 style="margin-top:24px">登録履歴（このブラウザのみ）</h3>
    <table class="matrix"><thead><tr><th>対象日</th><th>OPEN</th><th>CLOSE</th></tr></thead>
      <tbody>${historyRows || `<tr><td colspan="3">${renderEmpty("登録履歴がありません")}</td></tr>`}</tbody></table>
  `;
  wireEvents(container);
}

function wireEvents(container) {
  container.querySelector("#phase-select")?.addEventListener("change", (e) => {
    state.selectedPhaseId = Number(e.target.value);
    paint(container);
  });
  container.querySelector("#snapshot-submit-btn")?.addEventListener("click", async () => {
    const target_date = container.querySelector("#snapshot-date").value;
    const open_count = Number(container.querySelector("#snapshot-open").value);
    const close_count = Number(container.querySelector("#snapshot-close").value);
    if (!state.selectedPhaseId || !target_date) {
      showToast("対象フェーズと対象日を指定してください");
      return;
    }
    const res = await createBugCountSnapshots({
      apiKey: state.apiKey,
      testPhaseId: state.selectedPhaseId,
      snapshots: [{ target_date, open_count, close_count }],
    });
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    appendHistory(state.selectedPhaseId, { target_date, open_count, close_count, recorded_at: target_date });
    showToast("バグ件数を登録しました");
    paint(container);
  });
}
