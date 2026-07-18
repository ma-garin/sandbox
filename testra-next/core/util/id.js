// 決定論的ID生成ユーティリティ（純粋関数）
// Math.random / Date.now を使わず、入力から安定したIDを導出する。
// これによりパイプラインは同一入力に対して常に同一の成果物を生成する（再現性）。

/**
 * FNV-1a 32bit ハッシュ。短く安定したハッシュ文字列を返す。
 * @param {string} str
 * @returns {string} 8桁の16進
 */
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * プレフィックス付きの安定IDを生成する。
 * @param {string} prefix 例: "FT", "TC"
 * @param {...(string|number)} parts ID素材
 * @returns {string} 例: "FT-3f2a1b9c"
 */
export function stableId(prefix, ...parts) {
  return `${prefix}-${hash(parts.join('|'))}`;
}

/**
 * 連番ID（ゼロ埋め）。決定論的な順序付けに使う。
 * @param {string} prefix
 * @param {number} n 1始まり
 * @param {number} [width=3]
 * @returns {string} 例: "TC-001"
 */
export function seqId(prefix, n, width = 3) {
  return `${prefix}-${String(n).padStart(width, '0')}`;
}
