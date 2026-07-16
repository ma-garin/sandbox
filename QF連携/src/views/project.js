// views/project.js — プロジェクト情報(current_project)とユーザー一覧の表示（ホーム画面）

import { getCurrentProject, listUsers } from "../client.js";
import { buildResultLabelMap } from "../labels.js";
import { escapeHtml, renderError, renderEmpty, requireProfile } from "../ui.js";

let cachedProject = null;

// execution.js等、他画面から結果ラベルを引くための共有アクセサ。
// 未取得ならAPIを叩いて埋める（何度も同じ画面を跨いで叩き直さないため）。
export async function ensureProject(apiKey, { force = false } = {}) {
  if (!force && cachedProject) return { ok: true, status: 200, data: cachedProject };
  const res = await getCurrentProject({ apiKey });
  if (res.ok) cachedProject = res.data;
  return res;
}

export function getCachedProject() {
  return cachedProject;
}

export async function renderProjectView(container) {
  const profile = requireProfile(container);
  if (!profile) return;
  container.innerHTML = `<p class="empty">読み込み中...</p>`;

  const [projectRes, usersRes] = await Promise.all([
    ensureProject(profile.apiKey, { force: true }),
    listUsers({ apiKey: profile.apiKey }),
  ]);
  if (!projectRes.ok) {
    container.innerHTML = renderError(projectRes.error);
    return;
  }
  const project = projectRes.data;
  const users = usersRes.ok ? usersRes.data?.users || [] : [];
  const resultLabels = buildResultLabelMap(project);

  const resultRows = Object.entries(resultLabels)
    .map(([code, label]) => `<tr><td>${code}</td><td>${escapeHtml(label)}</td></tr>`)
    .join("");
  const userRows = users
    .map((u) => `<tr><td>${u.id}</td><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td></tr>`)
    .join("");

  container.innerHTML = `
    <div class="input-head">
      <h2>${escapeHtml(project.name || "プロジェクト")}</h2>
      <button class="btn" id="project-refresh-btn">更新</button>
    </div>
    ${project.description ? `<p class="hint">${escapeHtml(project.description)}</p>` : ""}

    <h3>テスト結果ラベル設定</h3>
    <p class="hint">このプロジェクトでの表示名です。「テスト実行」タブの結果選択に反映されます。</p>
    <table class="matrix"><thead><tr><th>コード</th><th>ラベル</th></tr></thead><tbody>${resultRows}</tbody></table>

    <h3 style="margin-top:24px">ユーザー</h3>
    ${
      users.length
        ? `<table class="matrix"><thead><tr><th>ID</th><th>名前</th><th>メール</th></tr></thead><tbody>${userRows}</tbody></table>`
        : renderEmpty(usersRes.ok ? "ユーザーが登録されていません" : `ユーザー情報の取得に失敗: ${usersRes.error}`)
    }
  `;
  container.querySelector("#project-refresh-btn")?.addEventListener("click", () => renderProjectView(container));
}
