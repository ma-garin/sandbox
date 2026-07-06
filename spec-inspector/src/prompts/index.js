// prompts/index.js — 解析プロンプトの組み立て（公開API）
//
// buildAnalysisMessages(docs) → { system, chunks:[{user, meta}], version }
// system: ペルソナ＋6観点指示＋文書role別ヒント＋few-shot＋出力契約
// user  : チャンク化された文書本文（1チャンク=1 API呼び出し）

import { PROMPT_VERSION, CONTRACT_TEXT } from "./contract.js";
import { VIEWPOINT_INSTRUCTIONS, ROLE_HINTS } from "./viewpoints.js";
import { fewshotBlock } from "./examples.js";
import { chunkDocuments } from "./chunking.js";

const PERSONA = `あなたはソフトウェア品質保証のシニアレビュアーです。仕様文書を6つの品質観点でレビューし、人間のレビュアーにしかできない意味的な指摘に集中してください。機械的な表記チェックは別エンジンが実施済みです。`;

function viewpointBlock() {
  const rows = Object.entries(VIEWPOINT_INSTRUCTIONS).map(([key, v]) =>
    `- ${key}（${v.label}）\n  着眼: ${v.focus}\n  対象外（検出済み）: ${v.avoid}`
  ).join("\n");
  return `## レビュー観点\n\n${rows}`;
}

function roleBlock(docs) {
  const roles = [...new Set((docs || []).map((d) => d.role).filter(Boolean))];
  const hints = roles.map((r) => ROLE_HINTS[r]).filter(Boolean);
  return hints.length ? `## 文書種別ごとの重点\n\n${hints.join("\n")}` : "";
}

export function buildAnalysisMessages(docs, { fewshot = true, maxChars = 16000 } = {}) {
  const system = [
    PERSONA,
    viewpointBlock(),
    roleBlock(docs),
    fewshot ? fewshotBlock({ max: 4 }) : "",
    CONTRACT_TEXT,
  ].filter(Boolean).join("\n\n");

  const chunks = chunkDocuments(docs, { maxChars }).map((chunk) => {
    const user = chunk.docs.map((p) => {
      const partLabel = p.totalParts > 1 ? `（分割 ${p.part}/${p.totalParts}）` : "";
      return `=== 文書: ${p.name}${partLabel} ===\n${p.text}`;
    }).join("\n\n");
    return {
      user,
      meta: {
        docNames: [...new Set(chunk.docs.map((p) => p.name))],
        parts: chunk.docs.map((p) => ({ name: p.name, part: p.part, totalParts: p.totalParts })),
      },
    };
  });

  return { system, chunks, version: PROMPT_VERSION };
}

export { PROMPT_VERSION, CONTRACT_TEXT } from "./contract.js";
export { parseAIFindings } from "./contract.js";
