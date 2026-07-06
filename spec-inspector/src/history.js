// history.js — 解析履歴の保存・取得・スコア比較（localStorage）
// immutableパターン: 保存時は新配列を生成し、既存を破壊しない。

const KEY = "spec-inspector.history.v1";
const MAX = 50;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(list) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

// entry: {id, at, docNames, overall, scores, counts}
export function addEntry(entry) {
  const list = load();
  const next = [entry, ...list];
  persist(next);
  return next;
}

export function getHistory() {
  return load();
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}

// 直近2件のスコア差分（観点別）。無ければnull。
export function latestDelta() {
  const list = load();
  if (list.length < 2) return null;
  const [cur, prev] = list;
  const delta = {};
  for (const k of Object.keys(cur.scores || {})) {
    delta[k] = (cur.scores[k] ?? 0) - (prev.scores[k] ?? 0);
  }
  return { curAt: cur.at, prevAt: prev.at, overall: (cur.overall ?? 0) - (prev.overall ?? 0), delta };
}
