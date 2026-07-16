// search.js — 一覧のクライアント側検索/フィルタ/ソート（純粋関数、リソース非依存）
// QualityForward APIの一覧系エンドポイントにはページネーション・検索パラメータが一切無いため、
// 取得済みの全件配列に対してここで絞り込みを行う。すべてimmutable（新しい配列を返す）。

export function filterByText(items, query, fields) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => fields.some((f) => String(item[f] ?? "").toLowerCase().includes(q)));
}

export function filterByField(items, key, value) {
  if (value === undefined || value === null || value === "") return items;
  return items.filter((item) => String(item[key]) === String(value));
}

export function sortBy(items, key, dir = "asc") {
  const sign = dir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    return av > bv ? sign : -sign;
  });
}
