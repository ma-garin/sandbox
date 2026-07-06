// prompts/chunking.js — 長文ドキュメントの分割（純粋関数）
//
// 1チャンク = 1 API呼び出し。maxChars厳守が不変条件。
// 分割は見出し（Markdown # / 章節番号）・空行の境界を優先し、文脈切断を最小化する。
// チャンク間は overlapChars だけ前チャンク末尾を重複させ、境界の指摘取りこぼしを防ぐ。

// トークン数の近似: 日本語≈1文字/1token、ASCII≈4文字/1token
export function estimateTokens(text) {
  const s = String(text ?? "");
  let ascii = 0, other = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 128) ascii++; else other++;
  }
  return Math.ceil(ascii / 4) + other;
}

function isBoundary(line) {
  return /^#{1,6}\s/.test(line) || /^第?\s*\d+[.．章節]/.test(line) || line.trim() === "";
}

// 単一テキストを maxChars 以下の断片に分割
function splitText(text, maxChars, overlapChars) {
  if (text.length <= maxChars) return [text];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const parts = [];
  let buf = [];
  let bufLen = 0;
  const flush = () => {
    if (bufLen === 0) return;
    parts.push(buf.join("\n"));
    // overlap: 直前チャンク末尾を次チャンクの先頭に引き継ぐ
    const tail = buf.join("\n").slice(-overlapChars);
    buf = tail ? [tail] : [];
    bufLen = tail.length;
  };
  for (const line of lines) {
    const lineLen = line.length + 1;
    // 行自体が上限を超える場合は強制分割
    if (lineLen > maxChars) {
      flush();
      for (let i = 0; i < line.length; i += maxChars - overlapChars) {
        parts.push(line.slice(i, i + maxChars));
      }
      buf = []; bufLen = 0;
      continue;
    }
    if (bufLen + lineLen > maxChars && bufLen > 0) {
      // 境界行で切りたいが、上限超過ならここで切る
      flush();
    } else if (bufLen + lineLen > maxChars * 0.85 && isBoundary(line) && bufLen > 0) {
      // 85%を超えた時点の境界行で先んじて切る（文脈切断の最小化）
      flush();
    }
    buf.push(line);
    bufLen += lineLen;
  }
  flush();
  // 末尾のoverlap断片のみが残るケースを除去
  return parts.filter((p, i) => i === 0 || p.length > overlapChars);
}

// docs: [{name, text, role?}] → [{docs:[{name,text,role,part,totalParts}], chars}]
// 小さい文書は同一チャンクに同居させ、API呼び出し回数を最小化する。
export function chunkDocuments(docs, { maxChars = 16000, overlapChars = 400 } = {}) {
  const pieces = [];
  for (const d of docs || []) {
    const split = splitText(String(d.text ?? ""), maxChars, overlapChars);
    split.forEach((text, i) => {
      pieces.push({ name: d.name, role: d.role, text, part: i + 1, totalParts: split.length });
    });
  }
  // 同居パッキング（先頭から詰める。断片は単独チャンク）
  const chunks = [];
  let cur = { docs: [], chars: 0 };
  const flush = () => { if (cur.docs.length) { chunks.push(Object.freeze(cur)); cur = { docs: [], chars: 0 }; } };
  for (const p of pieces) {
    if (cur.chars + p.text.length > maxChars && cur.docs.length) flush();
    cur.docs.push(p);
    cur.chars += p.text.length;
    if (p.totalParts > 1) flush(); // 分割断片は単独チャンクで文脈を確保
  }
  flush();
  return chunks;
}
