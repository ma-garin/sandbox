// views/testsuites.js — テストスイート → バージョン → テストケースの一覧・検索・CRUD
//
// category1..25はテストスイートごとの label_categoryN / use_categoryN でラベル解決し、
// 未使用スロットは新規作成フォームにも表示しない（生のcategoryN名を見せないための核心部分）。

import {
  listTestSuites, createTestSuite, deleteTestSuite,
  listTestSuiteVersions, createTestSuiteVersion, deleteTestSuiteVersion,
  listTestCases, createTestCase, deleteTestCase,
} from "../client.js";
import { buildCategoryLabelMap, humanizeTestCase } from "../labels.js";
import { filterByText, sortBy } from "../search.js";
import { escapeHtml, renderError, renderEmpty, showToast, requireProfile } from "../ui.js";
import { getNavState, setNavState } from "../cache.js";

const PRIORITY_CODES = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10 };
const PRIORITY_LABELS = Object.fromEntries(Object.entries(PRIORITY_CODES).map(([k, v]) => [v, k]));

const state = {
  apiKey: "",
  profileId: "",
  suites: [],
  versions: [],
  cases: [],
  selectedSuiteId: null,
  selectedVersionId: null,
  suiteQuery: "",
  caseQuery: "",
};

function suiteLabelMapFor(suiteId) {
  const suite = state.suites.find((s) => s.id === suiteId);
  return buildCategoryLabelMap(suite || {});
}

async function loadSuites() {
  const res = await listTestSuites({ apiKey: state.apiKey });
  if (res.ok) state.suites = res.data?.test_suites || [];
  return res;
}
async function loadVersions(suiteId) {
  const res = await listTestSuiteVersions({ apiKey: state.apiKey, testSuiteId: suiteId });
  if (res.ok) state.versions = res.data?.test_suite_versions || [];
  return res;
}
async function loadCases(suiteId, versionId) {
  const res = await listTestCases({ apiKey: state.apiKey, testSuiteId: suiteId, versionId });
  if (res.ok) state.cases = res.data?.test_cases || [];
  return res;
}

export async function renderTestSuitesView(container) {
  const profile = requireProfile(container);
  if (!profile) return;
  state.apiKey = profile.apiKey;
  state.profileId = profile.id;
  container.innerHTML = `<p class="empty">読み込み中...</p>`;

  const nav = getNavState(state.profileId);
  const res = await loadSuites();
  if (!res.ok) {
    container.innerHTML = renderError(res.error);
    return;
  }
  state.selectedSuiteId = state.suites.some((s) => s.id === nav.testSuiteId) ? nav.testSuiteId : state.suites[0]?.id ?? null;
  state.versions = [];
  state.cases = [];
  if (state.selectedSuiteId) await loadVersions(state.selectedSuiteId);
  state.selectedVersionId = state.versions.some((v) => v.id === nav.testSuiteVersionId) ? nav.testSuiteVersionId : state.versions[0]?.id ?? null;
  if (state.selectedSuiteId && state.selectedVersionId) await loadCases(state.selectedSuiteId, state.selectedVersionId);

  paint(container);
}

function renderCaseForm(categoryMap) {
  const usedFields = Object.values(categoryMap).filter((m) => m.used);
  const priorityOptions = Object.entries(PRIORITY_CODES).map(([label, code]) => `<option value="${code}">${label}</option>`).join("");
  const fieldInputs = usedFields
    .map((m) => `<label class="tc-form-label">${escapeHtml(m.label)}<input type="text" data-category-key="${m.key}" /></label>`)
    .join("");
  return `
    <label>No <input type="number" id="new-case-no" /></label>
    <label>優先度 <select id="new-case-priority">${priorityOptions}</select></label>
    ${fieldInputs}
  `;
}

function paint(container) {
  const filteredSuites = sortBy(filterByText(state.suites, state.suiteQuery, ["name"]), "id", "asc");
  const suiteRows = filteredSuites
    .map(
      (s) => `
    <tr class="${s.id === state.selectedSuiteId ? "row-selected" : ""}">
      <td>${s.id}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>
        <button class="btn ghost select-suite-btn" data-id="${s.id}">選択</button>
        <button class="btn ghost danger delete-suite-btn" data-id="${s.id}">削除</button>
      </td>
    </tr>`
    )
    .join("");

  const versionRows = state.versions
    .map(
      (v) => `
    <tr class="${v.id === state.selectedVersionId ? "row-selected" : ""}">
      <td>${v.id}</td><td>${escapeHtml(v.name)}</td><td>${escapeHtml(v.status || "")}</td>
      <td>
        <button class="btn ghost select-version-btn" data-id="${v.id}">選択</button>
        <button class="btn ghost danger delete-version-btn" data-id="${v.id}">削除</button>
      </td>
    </tr>`
    )
    .join("");

  const categoryMap = suiteLabelMapFor(state.selectedSuiteId);
  const searchableFields = Object.keys(categoryMap).filter((k) => categoryMap[k].used).concat(["no"]);
  const filteredCases = sortBy(filterByText(state.cases, state.caseQuery, searchableFields), "no", "asc");
  const caseRows = filteredCases
    .map((tc) => {
      const humanized = humanizeTestCase(tc, categoryMap);
      const fieldsText =
        humanized.labeledFields.map((f) => `<div class="tc-field"><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</div>`).join("") ||
        renderEmpty("項目なし");
      return `
    <tr>
      <td>${tc.no}</td>
      <td>${escapeHtml(PRIORITY_LABELS[tc.priority] || tc.priority || "")}</td>
      <td>${fieldsText}</td>
      <td><button class="btn ghost danger delete-case-btn" data-id="${tc.id}">削除</button></td>
    </tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="input-head">
      <h2>テストスイート</h2>
      <div class="input-actions">
        <input type="text" id="suite-search" placeholder="スイート名で検索" value="${escapeHtml(state.suiteQuery)}" />
        <button class="btn" id="suite-add-toggle">＋ 新規スイート</button>
      </div>
    </div>
    <div id="suite-add-form" class="add-form" hidden>
      <input type="text" id="new-suite-name" placeholder="テストスイート名" />
      <button class="btn primary" id="suite-add-submit">作成</button>
    </div>
    <table class="matrix"><thead><tr><th>ID</th><th>名前</th><th></th></tr></thead>
      <tbody>${suiteRows || `<tr><td colspan="3">${renderEmpty("テストスイートがありません")}</td></tr>`}</tbody></table>

    <h3 style="margin-top:24px">バージョン${state.selectedSuiteId ? "" : "（スイートを選択してください）"}</h3>
    ${
      state.selectedSuiteId
        ? `
      <div class="input-actions">
        <button class="btn" id="version-add-toggle">＋ 新規バージョン</button>
      </div>
      <div id="version-add-form" class="add-form" hidden>
        <input type="text" id="new-version-name" placeholder="バージョン名" />
        <button class="btn primary" id="version-add-submit">作成</button>
      </div>
      <table class="matrix"><thead><tr><th>ID</th><th>名前</th><th>状態</th><th></th></tr></thead>
        <tbody>${versionRows || `<tr><td colspan="4">${renderEmpty("バージョンがありません")}</td></tr>`}</tbody></table>`
        : ""
    }

    <h3 style="margin-top:24px">テストケース${state.selectedVersionId ? "" : "（バージョンを選択してください）"}</h3>
    ${
      state.selectedVersionId
        ? `
      <div class="input-head">
        <input type="text" id="case-search" placeholder="項目内容やNoで検索" value="${escapeHtml(state.caseQuery)}" />
        <button class="btn" id="case-add-toggle">＋ 新規テストケース</button>
      </div>
      <div id="case-add-form" class="add-form" hidden>
        ${renderCaseForm(categoryMap)}
        <button class="btn primary" id="case-add-submit">作成</button>
      </div>
      <table class="matrix"><thead><tr><th>No</th><th>優先度</th><th>内容</th><th></th></tr></thead>
        <tbody>${caseRows || `<tr><td colspan="4">${renderEmpty("テストケースがありません")}</td></tr>`}</tbody></table>`
        : ""
    }
  `;
  wireEvents(container);
}

function wireEvents(container) {
  container.querySelector("#suite-search")?.addEventListener("input", (e) => {
    state.suiteQuery = e.target.value;
    paint(container);
  });
  container.querySelector("#suite-add-toggle")?.addEventListener("click", () => {
    const form = container.querySelector("#suite-add-form");
    form.hidden = !form.hidden;
  });
  container.querySelector("#suite-add-submit")?.addEventListener("click", async () => {
    const name = container.querySelector("#new-suite-name").value.trim();
    if (!name) {
      showToast("テストスイート名を入力してください");
      return;
    }
    const res = await createTestSuite({ apiKey: state.apiKey, testSuite: { name } });
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    showToast("テストスイートを作成しました");
    await loadSuites();
    state.selectedSuiteId = res.data?.id ?? state.selectedSuiteId;
    paint(container);
  });
  container.querySelectorAll(".select-suite-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      state.selectedSuiteId = Number(btn.dataset.id);
      state.selectedVersionId = null;
      state.cases = [];
      setNavState(state.profileId, { testSuiteId: state.selectedSuiteId });
      await loadVersions(state.selectedSuiteId);
      paint(container);
    })
  );
  container.querySelectorAll(".delete-suite-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("このテストスイートを削除しますか？（バージョン・テストケースも削除されます）")) return;
      const res = await deleteTestSuite({ apiKey: state.apiKey, testSuiteId: Number(btn.dataset.id) });
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      showToast("削除しました");
      if (state.selectedSuiteId === Number(btn.dataset.id)) {
        state.selectedSuiteId = null;
        state.versions = [];
        state.cases = [];
      }
      await loadSuites();
      paint(container);
    })
  );

  container.querySelector("#version-add-toggle")?.addEventListener("click", () => {
    const form = container.querySelector("#version-add-form");
    form.hidden = !form.hidden;
  });
  container.querySelector("#version-add-submit")?.addEventListener("click", async () => {
    const name = container.querySelector("#new-version-name").value.trim();
    if (!name) {
      showToast("バージョン名を入力してください");
      return;
    }
    const res = await createTestSuiteVersion({ apiKey: state.apiKey, testSuiteId: state.selectedSuiteId, testSuiteVersion: { name } });
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    showToast("バージョンを作成しました");
    await loadVersions(state.selectedSuiteId);
    paint(container);
  });
  container.querySelectorAll(".select-version-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      state.selectedVersionId = Number(btn.dataset.id);
      setNavState(state.profileId, { testSuiteVersionId: state.selectedVersionId });
      await loadCases(state.selectedSuiteId, state.selectedVersionId);
      paint(container);
    })
  );
  container.querySelectorAll(".delete-version-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("このバージョンを削除しますか？（テストケースも削除されます）")) return;
      const res = await deleteTestSuiteVersion({ apiKey: state.apiKey, testSuiteId: state.selectedSuiteId, versionId: Number(btn.dataset.id) });
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      showToast("削除しました");
      if (state.selectedVersionId === Number(btn.dataset.id)) {
        state.selectedVersionId = null;
        state.cases = [];
      }
      await loadVersions(state.selectedSuiteId);
      paint(container);
    })
  );

  container.querySelector("#case-search")?.addEventListener("input", (e) => {
    state.caseQuery = e.target.value;
    paint(container);
  });
  container.querySelector("#case-add-toggle")?.addEventListener("click", () => {
    const form = container.querySelector("#case-add-form");
    form.hidden = !form.hidden;
  });
  container.querySelector("#case-add-submit")?.addEventListener("click", async () => {
    const no = Number(container.querySelector("#new-case-no").value);
    const priority = Number(container.querySelector("#new-case-priority").value);
    if (!no) {
      showToast("Noを入力してください");
      return;
    }
    const testCase = { no, priority };
    container.querySelectorAll("[data-category-key]").forEach((input) => {
      if (input.value) testCase[input.dataset.categoryKey] = input.value;
    });
    const res = await createTestCase({ apiKey: state.apiKey, testSuiteId: state.selectedSuiteId, versionId: state.selectedVersionId, testCase });
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    showToast("テストケースを作成しました");
    await loadCases(state.selectedSuiteId, state.selectedVersionId);
    paint(container);
  });
  container.querySelectorAll(".delete-case-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("このテストケースを削除しますか？")) return;
      const res = await deleteTestCase({
        apiKey: state.apiKey,
        testSuiteId: state.selectedSuiteId,
        versionId: state.selectedVersionId,
        testCaseId: btn.dataset.id,
      });
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      showToast("削除しました");
      await loadCases(state.selectedSuiteId, state.selectedVersionId);
      paint(container);
    })
  );
}
