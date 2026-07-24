// app.js — タブ切替・初期化・各画面(views/*.js)への差配

import { getActiveProfile, listProfiles } from "./profiles.js";
import { escapeHtml } from "./ui.js";
import { renderProjectView } from "./views/project.js";
import { renderTestSuitesView } from "./views/testsuites.js";
import { renderExecutionView } from "./views/execution.js";
import { renderBugCountsView } from "./views/bugcounts.js";
import { renderSettingsView } from "./views/settings.js";

const VIEWS = {
  project: renderProjectView,
  testsuites: renderTestSuitesView,
  execution: renderExecutionView,
  bugcounts: renderBugCountsView,
  settings: renderSettingsView,
};

function renderActiveProfileBar() {
  const bar = document.getElementById("active-profile-bar");
  const profiles = listProfiles();
  const profile = getActiveProfile();
  if (!profiles.length) {
    bar.innerHTML = `<span class="profile-warn">APIキー未設定 — 「設定」タブでプロジェクトを追加してください</span>`;
    return;
  }
  bar.innerHTML = `<span class="profile-current">接続中プロジェクト: <strong>${escapeHtml(profile ? profile.label : "未選択")}</strong></span>`;
}

async function activateTab(tab) {
  document.querySelectorAll(".tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === `panel-${tab}`));
  renderActiveProfileBar();
  const container = document.getElementById(`panel-${tab}`);
  const render = VIEWS[tab];
  if (render) await render(container);
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });
}

// settings.jsから、プロファイル追加/切替/削除のたびに発火される（循環import回避のためイベント経由）
window.addEventListener("qf:profile-changed", renderActiveProfileBar);

function init() {
  wireTabs();
  renderActiveProfileBar();
  activateTab("project");
}

init();
