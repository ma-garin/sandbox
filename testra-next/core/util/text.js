// テキスト解析ユーティリティ（純粋関数・依存なし）

/** 全角/半角を吸収して正規化 */
export function normalize(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/　/g, ' ')
    .trim();
}

/** 空行区切りの段落配列に分割 */
export function toParagraphs(text) {
  return normalize(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** 行配列（空行除去） */
export function toLines(text) {
  return normalize(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** 箇条書き記号や番号を除去して本文を取り出す */
export function stripBullet(line) {
  return line.replace(/^\s*(?:[-*・]|\d+[.)、]|[（(]\d+[）)])\s*/, '').trim();
}

/**
 * キーワード辞書に対する出現有無を判定する。
 * @param {string} text
 * @param {string[]} keywords
 * @returns {boolean}
 */
export function hasAny(text, keywords) {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
}

/**
 * 一文に含まれる主要名詞句を粗く抽出する（ルールベース）。
 * 形態素解析なしで、句読点・助詞境界で分割し短語を捨てる。
 */
export function keyPhrases(sentence) {
  return normalize(sentence)
    .split(/[、。,.:：\s]+/)
    .map((w) => w.replace(/[はがをにへとでもや」「』『]/g, '').trim())
    .filter((w) => w.length >= 2);
}
