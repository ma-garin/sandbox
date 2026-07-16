// views/execution.js — フェーズ→アサインメント→サイクル→ケース選択→結果登録ウィザード
//
// QualityForwardは1つの結果登録に4段のネストしたID（phase→assignment→cycle→case_no）が必要。
// このウィザードはその連鎖を1画面でたどれるようにし、選択済みIDは次回訪問時のためにキャッシュする。
// また、割当(assignment)にはtest_suite_version_idしか含まれずtest_suite_idが無いため、
// テストスイート一覧を探索してcontent項目のラベルを解決する（利用者に手動横断させないための補完）。

import {
  listTestPhases, createTestPhase,
  createTestSuiteAssignment,
  listTestCycles, createTestCycle,
  listTestResults, submitTestResult,
  listTestSuites, listTestSuiteVersions, listUsers,
} from "../client.js";
import { ensureProject } from "./project.js";
import { buildResultLabelMap, buildResultStringLabelMap, buildContentLabelMap, humanizeTestResult } from "../labels.js";
import { escapeHtml, renderError, renderEmpty, showToast, requireProfile } from "../ui.js";
import { getNavState, setNavState } from "../cache.js";

const PRIORITY_CODES = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10 };

const state = {
  apiKey: "",
  profileId: "",
  phases: [],
  selectedPhaseId: null,
  selectedAssignmentId: null,
  cycles: [],
  selectedCycleId: null,
  results: [],
  users: [],
  resultFormOptions: {}, // 登録フォーム用（数値コード1-7）
  resultDisplayMap: {}, // 表示用（文字列enum）
  contentLabelMap: {},
};

const suiteIdByVersionIdCache = new Map();

// 割当(assignment)はtest_suite_version_idしか持たないため、対応するtest_suite_idを探索する。
// 一度見つかったら結果をキャッシュし、以後は再探索しない。
async function resolveSuiteForVersion(apiKey, versionId) {
  if (suiteIdByVersionIdCache.has(versionId)) return suiteIdByVersionIdCache.get(versionId);
  const suitesRes = await listTestSuites({ apiKey });
  if (!suitesRes.ok) return null;
  for (const suite of suitesRes.data?.test_suites || []) {
    const versionsRes = await listTestSuiteVersions({ apiKey, testSuiteId: suite.id });
    if (versionsRes.ok && (versionsRes.data?.test_suite_versions || []).some((v) => v.id === versionId)) {
      suiteIdByVersionIdCache.set(versionId, suite);
      return suite;
    }
  }
  suiteIdByVersionIdCache.set(versionId, null);
  return null;
}

function selectedPhase() {
  return state.phases.find((p) => p.id === state.selectedPhaseId) || null;
}
function selectedAssignment() {
  const phase = selectedPhase();
  return (phase?.test_suite_assignments || []).find((a) => a.id === state.selectedAssignmentId) || null;
}

async function loadPhases() {
  const res = await listTestPhases({ apiKey: state.apiKey });
  if (res.ok) state.phases = res.data?.test_phases || [];
  return res;
}
async function loadCycles() {
  const res = await listTestCycles({ apiKey: state.apiKey, testPhaseId: state.selectedPhaseId, assignmentId: state.selectedAssignmentId });
  if (res.ok) state.cycles = res.data?.test_cycles || [];
  return res;
}
async function loadResults() {
  const res = await listTestResults({
    apiKey: state.apiKey,
    testPhaseId: state.selectedPhaseId,
    assignmentId: state.selectedAssignmentId,
    cycleId: state.selectedCycleId,
  });
  if (res.ok) state.results = res.data?.test_results || [];
  return res;
}

export async function renderExecutionView(container) {
  const profile = requireProfile(container);
  if (!profile) return;
  state.apiKey = profile.apiKey;
  state.profileId = profile.id;
  container.innerHTML = `<p class="empty">読み込み中...</p>`;

  const [projectRes, usersRes, phasesRes] = await Promise.all([ensureProject(state.apiKey), listUsers({ apiKey: state.apiKey }), loadPhases()]);
  if (!phasesRes.ok) {
    container.innerHTML = renderError(phasesRes.error);
    return;
  }
  const project = projectRes.ok ? projectRes.data : {};
  state.resultFormOptions = buildResultLabelMap(project);
  state.resultDisplayMap = buildResultStringLabelMap(project);
  state.users = usersRes.ok ? usersRes.data?.users || [] : [];

  const nav = getNavState(state.profileId);
  state.selectedPhaseId = state.phases.some((p) => p.id === nav.testPhaseId) ? nav.testPhaseId : state.phases[0]?.id ?? null;
  await onPhaseSelected(nav.testSuiteAssignmentId, nav.testCycleId);

  paint(container);
}

async function onPhaseSelected(navAssignmentId, navCycleId) {
  state.cycles = [];
  state.results = [];
  state.contentLabelMap = {};
  const phase = selectedPhase();
  const assignments = phase?.test_suite_assignments || [];
  state.selectedAssignmentId = assignments.some((a) => a.id === navAssignmentId) ? navAssignmentId : assignments[0]?.id ?? null;
  if (!state.selectedAssignmentId) {
    state.selectedCycleId = null;
    return;
  }
  await loadCycles();
  state.selectedCycleId = state.cycles.some((c) => c.id === navCycleId) ? navCycleId : state.cycles[0]?.id ?? null;
  if (state.selectedCycleId) await loadResults();

  const assignment = selectedAssignment();
  if (assignment) {
    const suite = await resolveSuiteForVersion(state.apiKey, assignment.test_suite_version_id);
    if (suite) state.contentLabelMap = buildContentLabelMap(suite);
  }
}

function paint(container) {
  const phase = selectedPhase();
  const assignments = phase?.test_suite_assignments || [];
  const phaseOptions = state.phases
    .map((p) => `<option value="${p.id}" ${p.id === state.selectedPhaseId ? "selected" : ""}>${escapeHtml(p.name)} (#${p.id})</option>`)
    .join("");
  const assignmentOptions = assignments
    .map(
      (a) =>
        `<option value="${a.id}" ${a.id === state.selectedAssignmentId ? "selected" : ""}>${escapeHtml(a.test_suite_version_name || a.test_suite_name || "")} (#${a.id})</option>`
    )
    .join("");
  const cycleOptions = state.cycles
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === state.selectedCycleId ? "selected" : ""}>${escapeHtml(c.name)} [${escapeHtml(c.status || "")}] (#${c.id})</option>`
    )
    .join("");
  const userOptions = state.users.map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join("");
  const resultOptions = Object.entries(state.resultFormOptions)
    .map(([code, label]) => `<option value="${code}">${escapeHtml(label)}</option>`)
    .join("");

  const resultRows = state.results
    .map((r) => {
      const h = humanizeTestResult(r, state.resultDisplayMap, state.contentLabelMap);
      const fields = h.labeledFields.map((f) => `<div class="tc-field"><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</div>`).join("");
      return `<tr>
        <td>${r.test_case_no}</td>
        <td>${escapeHtml(h.resultLabel)}</td>
        <td>${escapeHtml((r.executed_at || "").slice(0, 16).replace("T", " "))}</td>
        <td>${fields || renderEmpty("")}</td>
      </tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="input-head"><h2>テスト実行</h2></div>

    <div class="wizard-step">
      <label>① テストフェーズ
        <select id="phase-select">${phaseOptions || '<option value="">(フェーズがありません)</option>'}</select>
      </label>
      <button class="btn" id="phase-add-toggle">＋ 新規フェーズ</button>
    </div>
    <div id="phase-add-form" class="add-form" hidden>
      <p class="hint">対象のテストスイートバージョンID（「テストスイート」タブのバージョン一覧のID列）をカンマ区切りで指定してください。</p>
      <input type="text" id="new-phase-name" placeholder="フェーズ名" />
      <input type="date" id="new-phase-start" />
      <input type="date" id="new-phase-end" />
      <input type="text" id="new-phase-version-ids" placeholder="対象バージョンID（例: 3,5）" />
      <button class="btn primary" id="phase-add-submit">作成</button>
    </div>

    ${
      phase
        ? `
    <div class="wizard-step">
      <label>② テストスイート割当
        <select id="assignment-select">${assignmentOptions || '<option value="">(割当がありません)</option>'}</select>
      </label>
      <input type="text" id="new-assignment-version-id" placeholder="紐づけるバージョンID" style="width:160px" />
      <button class="btn" id="assignment-add-submit">紐づけ</button>
    </div>`
        : ""
    }

    ${
      state.selectedAssignmentId
        ? `
    <div class="wizard-step">
      <label>③ テストサイクル
        <select id="cycle-select">${cycleOptions || '<option value="">(サイクルがありません)</option>'}</select>
      </label>
      <button class="btn" id="cycle-add-toggle">＋ 新規サイクル</button>
    </div>
    <div id="cycle-add-form" class="add-form" hidden>
      <input type="text" id="new-cycle-name" placeholder="サイクル名" />
      <input type="date" id="new-cycle-start" />
      <input type="date" id="new-cycle-end" />
      <button class="btn primary" id="cycle-add-submit">作成（対象優先度は全て(A-J)で作成）</button>
    </div>`
        : ""
    }

    ${
      state.selectedCycleId
        ? `
    <h3 style="margin-top:24px">④ テスト結果登録</h3>
    <div class="add-form">
      <input type="number" id="result-case-no" placeholder="テストケースNo" />
      <select id="result-value">${resultOptions}</select>
      <select id="result-user">${userOptions || '<option value="">(ユーザー未取得)</option>'}</select>
      <input type="datetime-local" id="result-executed-at" />
      <button class="btn primary" id="result-submit-btn">登録（既存Noなら上書き）</button>
    </div>

    <h3 style="margin-top:24px">登録済みの結果</h3>
    <table class="matrix"><thead><tr><th>No</th><th>結果</th><th>実施日時</th><th>備考</th></tr></thead>
      <tbody>${resultRows || `<tr><td colspan="4">${renderEmpty("結果がまだありません")}</td></tr>`}</tbody></table>`
        : `<p class="hint" style="margin-top:16px">${phase ? "テストサイクルを選択・作成すると結果を登録できます" : "まずテストフェーズを選択・作成してください"}</p>`
    }
  `;
  wireEvents(container);
}

function wireEvents(container) {
  container.querySelector("#phase-select")?.addEventListener("change", async (e) => {
    state.selectedPhaseId = Number(e.target.value);
    setNavState(state.profileId, { testPhaseId: state.selectedPhaseId });
    await onPhaseSelected();
    paint(container);
  });
  container.querySelector("#phase-add-toggle")?.addEventListener("click", () => {
    const form = container.querySelector("#phase-add-form");
    form.hidden = !form.hidden;
  });
  container.querySelector("#phase-add-submit")?.addEventListener("click", async () => {
    const name = container.querySelector("#new-phase-name").value.trim();
    const start_on = container.querySelector("#new-phase-start").value;
    const end_on = container.querySelector("#new-phase-end").value;
    const idsRaw = container.querySelector("#new-phase-version-ids").value.trim();
    const test_suite_version_ids = idsRaw
      ? idsRaw.split(",").map((s) => Number(s.trim())).filter(Boolean)
      : [];
    if (!name || !start_on || !end_on || !test_suite_version_ids.length) {
      showToast("フェーズ名・開始日・終了日・対象バージョンIDは必須です");
      return;
    }
    const res = await createTestPhase({ apiKey: state.apiKey, testPhase: { name, start_on, end_on, test_suite_version_ids } });
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    showToast("フェーズを作成しました");
    await loadPhases();
    state.selectedPhaseId = res.data?.id ?? state.selectedPhaseId;
    setNavState(state.profileId, { testPhaseId: state.selectedPhaseId });
    await onPhaseSelected();
    paint(container);
  });

  container.querySelector("#assignment-select")?.addEventListener("change", async (e) => {
    state.selectedAssignmentId = Number(e.target.value);
    setNavState(state.profileId, { testSuiteAssignmentId: state.selectedAssignmentId });
    await onPhaseSelected(state.selectedAssignmentId);
    paint(container);
  });
  container.querySelector("#assignment-add-submit")?.addEventListener("click", async () => {
    const versionId = Number(container.querySelector("#new-assignment-version-id").value);
    if (!versionId) {
      showToast("バージョンIDを入力してください");
      return;
    }
    const res = await createTestSuiteAssignment({ apiKey: state.apiKey, testPhaseId: state.selectedPhaseId, testSuiteVersionId: versionId });
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    showToast("紐づけました");
    await loadPhases();
    await onPhaseSelected(res.data?.id);
    paint(container);
  });

  container.querySelector("#cycle-select")?.addEventListener("change", async (e) => {
    state.selectedCycleId = Number(e.target.value);
    setNavState(state.profileId, { testCycleId: state.selectedCycleId });
    await loadResults();
    paint(container);
  });
  container.querySelector("#cycle-add-toggle")?.addEventListener("click", () => {
    const form = container.querySelector("#cycle-add-form");
    form.hidden = !form.hidden;
  });
  container.querySelector("#cycle-add-submit")?.addEventListener("click", async () => {
    const name = container.querySelector("#new-cycle-name").value.trim();
    const start_on = container.querySelector("#new-cycle-start").value;
    const end_on = container.querySelector("#new-cycle-end").value;
    if (!name || !start_on || !end_on) {
      showToast("サイクル名・開始日・終了日は必須です");
      return;
    }
    const res = await createTestCycle({
      apiKey: state.apiKey,
      testPhaseId: state.selectedPhaseId,
      assignmentId: state.selectedAssignmentId,
      testCycle: { name, start_on, end_on, target_priorities: Object.keys(PRIORITY_CODES) },
    });
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    showToast("サイクルを作成しました");
    await loadCycles();
    state.selectedCycleId = res.data?.id ?? state.selectedCycleId;
    setNavState(state.profileId, { testCycleId: state.selectedCycleId });
    await loadResults();
    paint(container);
  });

  container.querySelector("#result-submit-btn")?.addEventListener("click", async () => {
    const test_case_no = Number(container.querySelector("#result-case-no").value);
    const result = Number(container.querySelector("#result-value").value);
    const user_id = Number(container.querySelector("#result-user").value);
    const executedAtRaw = container.querySelector("#result-executed-at").value;
    if (!test_case_no || !result || !user_id || !executedAtRaw) {
      showToast("ケースNo・結果・実施者・実施日時は必須です");
      return;
    }
    const executed_at = new Date(executedAtRaw).toISOString();
    const res = await submitTestResult({
      apiKey: state.apiKey,
      testPhaseId: state.selectedPhaseId,
      assignmentId: state.selectedAssignmentId,
      cycleId: state.selectedCycleId,
      testResult: { test_case_no, result, user_id, executed_at },
    });
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    showToast("テスト結果を登録しました");
    await loadResults();
    paint(container);
  });
}
