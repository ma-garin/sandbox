// parsers.js — 入力ファイルからプレーンテキストを抽出する
//
// 対応: .txt / .md（そのまま） / .docx（ZIP内 document.xml をパース） / .pdf（pdf.js を遅延ロード）
// - docx: ブラウザ標準の DecompressionStream("deflate-raw") でZIPエントリを展開（追加依存なし）
// - pdf : CDNの pdf.js を dynamic import。オフライン等で失敗したら分かりやすいエラーを投げる
// 依存を持たないことを優先し、docx はネイティブAPIのみで実装している。

// ---- ZIP(最小) : DecompressionStream を使った deflate 展開 ----------------

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("この環境ではDecompressionStreamが使えません（.docxは非対応）");
  }
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

// ZIPのローカルファイルヘッダを走査して target エントリの生データを返す
function findZipEntry(u8, target) {
  const dv = new DataView(u8.buffer);
  let i = 0;
  while (i + 4 <= u8.length) {
    const sig = dv.getUint32(i, true);
    if (sig !== 0x04034b50) break; // ローカルヘッダ以外に到達したら終了
    const method = dv.getUint16(i + 8, true);
    const compSize = dv.getUint32(i + 18, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const nameStart = i + 30;
    const name = new TextDecoder().decode(u8.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const data = u8.subarray(dataStart, dataStart + compSize);
    if (name === target) return { method, data };
    i = dataStart + compSize;
  }
  return null;
}

async function parseDocx(arrayBuffer) {
  const u8 = new Uint8Array(arrayBuffer);
  const entry = findZipEntry(u8, "word/document.xml");
  if (!entry) throw new Error("docxの本文(document.xml)が見つかりません");
  let xmlBytes;
  if (entry.method === 0) xmlBytes = entry.data;      // 無圧縮
  else xmlBytes = await inflateRaw(entry.data);        // deflate
  const xml = new TextDecoder().decode(xmlBytes);
  // 段落 <w:p> ごとに改行、<w:t> のテキストを結合、<w:tab/>はタブ
  const paras = xml.split(/<w:p[ >]/).map((chunk) => {
    const texts = [...chunk.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
    return texts.join("");
  });
  return paras.join("\n").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
}

async function parsePdf(arrayBuffer) {
  let pdfjs;
  try {
    pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";
  } catch (e) {
    throw new Error("PDF解析ライブラリの読込に失敗（オフライン時はテキスト/Markdownをご利用ください）");
  }
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map((it) => it.str).join(" ") + "\n\n";
  }
  return out.trim();
}

// File → {name, text}
export async function parseFile(file) {
  const name = file.name || "input";
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "txt" || ext === "md" || ext === "markdown" || ext === "csv") {
    return { name, text: await file.text() };
  }
  if (ext === "docx") {
    return { name, text: await parseDocx(await file.arrayBuffer()) };
  }
  if (ext === "pdf") {
    return { name, text: await parsePdf(await file.arrayBuffer()) };
  }
  // 未知拡張子はテキストとして試行
  return { name, text: await file.text() };
}
