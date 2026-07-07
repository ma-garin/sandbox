// adminstore.js — 管理設定（辞書・プロンプト・IV&Vメタ）の集約 export/import/reset
//
// 各モジュールが自前のlocalStorageストアを持つ。ここはそれらを横断して
// 1つのJSONにまとめ、チーム共有・Git管理・バックアップできるようにする。

import { getDict, setDict, resetDict, DEFAULT_DICT } from "./engine.js";
import { getPrompts, setPrompts, resetPrompts, DEFAULT_PROMPTS } from "./prompts/config.js";
import { getIvvMeta, setIvvMeta, resetIvvMeta } from "./ivv.js";

export const ADMIN_CONFIG_VERSION = 1;

// 現在の有効設定（既定＋上書き）を1つのJSONにまとめる
export function exportAdminConfig() {
  return JSON.stringify({
    version: ADMIN_CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    dict: getDict(),
    prompts: getPrompts(),
    ivvMeta: getIvvMeta(),
  }, null, 2);
}

// JSONを取り込み各ストアへ反映。→ 反映したセクション名の配列
export function importAdminConfig(json) {
  const parsed = typeof json === "string" ? JSON.parse(json) : json;
  const applied = [];
  if (parsed.dict && typeof parsed.dict === "object") {
    for (const k of Object.keys(DEFAULT_DICT)) {
      if (k in parsed.dict) { setDict(k, parsed.dict[k]); }
    }
    applied.push("dict");
  }
  if (parsed.prompts && typeof parsed.prompts === "object") {
    for (const k of Object.keys(DEFAULT_PROMPTS)) {
      if (k in parsed.prompts) { setPrompts(k, parsed.prompts[k]); }
    }
    applied.push("prompts");
  }
  if (Array.isArray(parsed.ivvMeta)) {
    setIvvMeta(parsed.ivvMeta);
    applied.push("ivvMeta");
  }
  return applied;
}

// すべてを既定に戻す
export function resetAllAdminConfig() {
  resetDict();
  resetPrompts();
  resetIvvMeta();
}
