// prompts/config.js — 内部プロンプトの既定値＋ユーザー上書き（管理タブから編集可能）
//
// 既定は viewpoints.js / contract.js の定数。上書きは localStorage に保存する。
// Node（テスト）では localStorage 無しでも既定で動作する。

import { VIEWPOINT_INSTRUCTIONS, ROLE_HINTS } from "./viewpoints.js";
import { CONTRACT_TEXT } from "./contract.js";

export const DEFAULT_PERSONA = "あなたはソフトウェア品質保証のシニアレビュアーです。仕様文書を6つの品質観点でレビューし、人間のレビュアーにしかできない意味的な指摘に集中してください。機械的な表記チェックは別エンジンが実施済みです。";

export const DEFAULT_PROMPTS = Object.freeze({
  persona: DEFAULT_PERSONA,
  viewpointInstructions: VIEWPOINT_INSTRUCTIONS,
  roleHints: ROLE_HINTS,
  contractText: CONTRACT_TEXT,
});

const PROMPT_STORE = "spec-inspector.prompts.v1";
function loadOverrides() {
  try {
    if (typeof localStorage === "undefined") return {};
    return JSON.parse(localStorage.getItem(PROMPT_STORE) || "{}");
  } catch { return {}; }
}
// 有効なプロンプト設定（既定＋上書き）
export function getPrompts() {
  const o = loadOverrides();
  const out = {};
  for (const k of Object.keys(DEFAULT_PROMPTS)) out[k] = k in o ? o[k] : DEFAULT_PROMPTS[k];
  return out;
}
export function setPrompts(section, value) {
  if (!(section in DEFAULT_PROMPTS)) throw new Error(`未知のプロンプトセクション: ${section}`);
  if (typeof localStorage === "undefined") return;
  const o = { ...loadOverrides(), [section]: value };
  localStorage.setItem(PROMPT_STORE, JSON.stringify(o));
}
export function resetPrompts(section) {
  if (typeof localStorage === "undefined") return;
  if (!section) { localStorage.removeItem(PROMPT_STORE); return; }
  const o = { ...loadOverrides() }; delete o[section];
  localStorage.setItem(PROMPT_STORE, JSON.stringify(o));
}
export function isPromptsCustomized() {
  return Object.keys(loadOverrides()).length > 0;
}
