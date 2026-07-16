// cache.js — 画面間ナビゲーションで最後に選択したIDをプロファイルごとに覚えておく。
// 一覧データそのものは保持しない（鮮度をレート制限保護より優先しないため。search.js側でメモリキャッシュする）。

const NAV_CACHE_STORE = "qf-renkei.navCache.v1";

function readAll() {
  const raw = localStorage.getItem(NAV_CACHE_STORE);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  localStorage.setItem(NAV_CACHE_STORE, JSON.stringify(all));
}

export function getNavState(profileId) {
  if (!profileId) return {};
  return readAll()[profileId] || {};
}

export function setNavState(profileId, patch) {
  if (!profileId) return;
  const all = readAll();
  all[profileId] = { ...(all[profileId] || {}), ...patch };
  writeAll(all);
}
