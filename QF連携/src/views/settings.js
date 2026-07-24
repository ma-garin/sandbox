// views/settings.js — APIキープロファイルの管理（追加・編集・削除・切替）
// APIキーは常にlocalStorageにのみ保存し、ハードコードしない。

import { listProfiles, addProfile, updateProfile, removeProfile, getActiveProfileId, setActiveProfileId } from "../profiles.js";
import { escapeHtml, showToast } from "../ui.js";

// app.jsとの循環importを避けるため、直接呼び出さずカスタムイベントで通知する。
function notifyProfileChanged() {
  window.dispatchEvent(new Event("qf:profile-changed"));
}

export async function renderSettingsView(container) {
  paint(container);
}

function paint(container) {
  const profiles = listProfiles();
  const activeId = getActiveProfileId();

  const rows = profiles
    .map(
      (p) => `
    <tr class="${p.id === activeId ? "row-selected" : ""}">
      <td>${p.id === activeId ? "●" : ""}</td>
      <td><input type="text" class="profile-label-input" data-id="${p.id}" value="${escapeHtml(p.label)}" /></td>
      <td><input type="password" class="profile-key-input" data-id="${p.id}" value="${escapeHtml(p.apiKey)}" /></td>
      <td>
        <button class="btn ghost activate-btn" data-id="${p.id}">切替</button>
        <button class="btn ghost save-btn" data-id="${p.id}">保存</button>
        <button class="btn ghost danger delete-btn" data-id="${p.id}">削除</button>
      </td>
    </tr>`
    )
    .join("");

  container.innerHTML = `
    <div class="input-head"><h2>設定 — プロジェクト(APIキー)管理</h2></div>
    <p class="hint">
      QualityForwardのAPIキーはプロジェクト単位です。複数プロジェクトを行き来する場合はここで「プロファイル」として複数登録し、切り替えて使えます。
      すべてこのブラウザのlocalStorageにのみ保存され、QualityForward APIへのリクエスト以外に送信されることはありません。
    </p>

    <table class="matrix">
      <thead><tr><th>選択中</th><th>表示名</th><th>APIキー</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">プロファイルがまだありません</td></tr>`}</tbody>
    </table>

    <h3 style="margin-top:24px">新規プロファイル追加</h3>
    <div class="add-form">
      <input type="text" id="new-profile-label" placeholder="表示名（例: 本番プロジェクト）" />
      <input type="password" id="new-profile-key" placeholder="APIキー" />
      <button class="btn primary" id="add-profile-btn">追加</button>
    </div>
  `;
  wireEvents(container);
}

function wireEvents(container) {
  container.querySelector("#add-profile-btn")?.addEventListener("click", () => {
    const label = container.querySelector("#new-profile-label").value.trim();
    const apiKey = container.querySelector("#new-profile-key").value.trim();
    if (!apiKey) {
      showToast("APIキーを入力してください");
      return;
    }
    addProfile({ label, apiKey });
    showToast("プロファイルを追加しました");
    notifyProfileChanged();
    paint(container);
  });

  container.querySelectorAll(".activate-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      setActiveProfileId(btn.dataset.id);
      showToast("アクティブなプロファイルを切り替えました");
      notifyProfileChanged();
      paint(container);
    })
  );
  container.querySelectorAll(".save-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const label = container.querySelector(`.profile-label-input[data-id="${id}"]`).value.trim();
      const apiKey = container.querySelector(`.profile-key-input[data-id="${id}"]`).value.trim();
      updateProfile(id, { label, apiKey });
      showToast("保存しました");
      notifyProfileChanged();
      paint(container);
    })
  );
  container.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!confirm("このプロファイルを削除しますか？")) return;
      removeProfile(btn.dataset.id);
      showToast("削除しました");
      notifyProfileChanged();
      paint(container);
    })
  );
}
