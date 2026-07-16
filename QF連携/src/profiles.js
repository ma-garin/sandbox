// profiles.js — QualityForward APIキーの複数プロファイル管理（localStorageのみに保存、ハードコード禁止）
//
// APIキーは仕様上プロジェクト単位のため、複数プロジェクトを行き来する利用者向けに
// 「プロファイル」(表示名+APIキー)を複数保持し、アクティブなプロファイルを切り替えられるようにする。

const PROFILES_STORE = "qf-renkei.profiles.v1";
const ACTIVE_ID_STORE = "qf-renkei.activeProfileId.v1";

function readProfiles() {
  const raw = localStorage.getItem(PROFILES_STORE);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeProfiles(profiles) {
  localStorage.setItem(PROFILES_STORE, JSON.stringify(profiles));
}

function genId() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export function listProfiles() {
  return readProfiles();
}

export function addProfile({ label, apiKey }) {
  const profiles = readProfiles();
  const profile = { id: genId(), label: label || "無題プロジェクト", apiKey: apiKey || "" };
  writeProfiles([...profiles, profile]);
  if (!getActiveProfileId()) setActiveProfileId(profile.id);
  return profile;
}

export function updateProfile(id, patch) {
  const next = readProfiles().map((p) => (p.id === id ? { ...p, ...patch, id } : p));
  writeProfiles(next);
}

export function removeProfile(id) {
  const next = readProfiles().filter((p) => p.id !== id);
  writeProfiles(next);
  if (getActiveProfileId() === id) {
    setActiveProfileId(next[0]?.id || "");
  }
}

export function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_ID_STORE) || "";
}

export function setActiveProfileId(id) {
  if (id) localStorage.setItem(ACTIVE_ID_STORE, id);
  else localStorage.removeItem(ACTIVE_ID_STORE);
}

export function getActiveProfile() {
  const id = getActiveProfileId();
  if (!id) return null;
  return readProfiles().find((p) => p.id === id) || null;
}
