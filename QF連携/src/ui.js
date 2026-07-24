// ui.js — 画面共通のDOMヘルパー（HTMLエスケープ・トースト通知・エラー表示・プロファイル未設定ガード）

import { getActiveProfile } from "./profiles.js";

// アクティブなプロファイル(APIキー)が無ければ案内を描画してnullを返す。あれば取得して返す。
export function requireProfile(container) {
  const profile = getActiveProfile();
  if (profile) return profile;
  container.innerHTML = `<p class="empty">APIキーが未設定です。<button class="btn primary" id="goto-settings-btn">設定タブでプロジェクトを追加</button></p>`;
  container.querySelector("#goto-settings-btn")?.addEventListener("click", () => {
    document.querySelector('.tab[data-tab="settings"]')?.click();
  });
  return null;
}

export function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

let toastTimer;
export function showToast(message) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

export function renderError(error) {
  return `<p class="error-msg">⚠ ${escapeHtml(error)}</p>`;
}

export function renderEmpty(message) {
  return `<p class="empty">${escapeHtml(message)}</p>`;
}
