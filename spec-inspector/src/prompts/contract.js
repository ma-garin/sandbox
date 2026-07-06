// prompts/contract.js — AI出力のJSON契約とパーサ
//
// OpenAI JSONモード（response_format: json_object）の制約:
//   1. プロンプト内に「JSON」という語が必須 → CONTRACT_TEXT に明示
//   2. 返答はオブジェクト（配列不可）→ {"findings":[...]} ラッパーを正とする
// パーサはラッパー形と裸配列の両方を受理（後方互換）。

import { VIEWPOINTS, SEVERITY } from "../engine.js";

export const PROMPT_VERSION = "1.0.0";

export const CONTRACT_TEXT = `## 出力形式（厳守）

必ず次の形のJSONオブジェクトのみを出力してください（前後に説明文・コードフェンスを付けない）:

{"findings":[{"viewpoint":"accuracy|clarity|visual|depth|reliability|verifiability","severity":"Critical|High|Medium|Low","doc":"文書名","message":"指摘（1文・断定形）","evidence":"該当箇所の原文引用（原文ママ・60字以内）","suggestion":"具体的な改善案（書き換え例を含める）","expectedEffect":"期待効果（1句）"}]}

制約:
- 根拠のない指摘は禁止。evidence には必ず対象文書の原文引用を入れる（要約・言い換え不可）
- 指摘が無ければ {"findings":[]} を返す
- 最大10件。確信度の高い順に並べる
- severity の基準: Critical=実装/テストが誤る欠陥級、High=解釈が割れ手戻りを生む、Medium=品質を下げるが回避可能、Low=軽微`;

// AI応答テキストからfindings配列を頑健に抽出・検証する。
// 戻り値: { ok, findings, error? } — findingsは常に配列（失敗時は空）
export function parseAIFindings(text, { maxFindings = 10 } = {}) {
  const src = String(text ?? "");
  // オブジェクト形 {"findings":[...]} を優先、なければ裸配列 [...] を探す
  let raw = null;
  const objStart = src.indexOf("{");
  const objEnd = src.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      const obj = JSON.parse(src.slice(objStart, objEnd + 1));
      if (obj && Array.isArray(obj.findings)) raw = obj.findings;
    } catch { /* fallthrough */ }
  }
  if (!raw) {
    const arrStart = src.indexOf("[");
    const arrEnd = src.lastIndexOf("]");
    if (arrStart !== -1 && arrEnd > arrStart) {
      try {
        const arr = JSON.parse(src.slice(arrStart, arrEnd + 1));
        if (Array.isArray(arr)) raw = arr;
      } catch { /* fallthrough */ }
    }
  }
  if (!raw) return { ok: false, findings: [], error: "応答からJSONを抽出できませんでした" };

  const vpKeys = new Set(VIEWPOINTS.map((v) => v.key));
  const findings = raw
    .filter((f) => f && typeof f === "object")
    .filter((f) => vpKeys.has(f.viewpoint) && SEVERITY.includes(f.severity))
    .filter((f) => f.message && f.evidence)
    .slice(0, maxFindings)
    .map((f) => Object.freeze({
      viewpoint: f.viewpoint,
      severity: f.severity,
      doc: String(f.doc || ""),
      message: String(f.message),
      evidence: String(f.evidence),
      location: 0,
      suggestion: String(f.suggestion || "（改善案なし）"),
      expectedEffect: String(f.expectedEffect || "品質向上"),
      source: "ai",
    }));
  return { ok: true, findings };
}
