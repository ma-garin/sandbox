// LLMアダプタ。既定は "rule"（キー不要・決定論）。
// provider を "openai" 等にすると各ステージの AI 補強が有効になる。
// ここではオーケストレーションの契約のみ定義し、実APIは providers/ 配下へ委譲する。
//
// 設計方針:
//  - コアのパイプラインはLLM無しでも完全に動く（ルールベースが常にフォールバック）。
//  - LLMは各ステージの「enrich(候補) => 補強候補」フックとして差し込む。
//  - APIキーはここに置かない。web は localStorage、CLI は環境変数から注入する。

import { createOpenAIProvider } from './providers/openai.js';

/**
 * @typedef {object} LlmConfig
 * @property {'rule'|'openai'} provider
 * @property {string} [apiKey]
 * @property {string} [model]
 * @property {Function} [fetchImpl] テスト用に fetch を注入
 */

/** ルールベース（no-op）プロバイダ: enrich はそのまま返す */
const ruleProvider = Object.freeze({
  id: 'rule',
  async enrich(_stage, candidates) {
    return candidates;
  },
});

/**
 * 設定から LLM プロバイダを解決する。
 * @param {LlmConfig} [config]
 * @returns {{id:string, enrich:Function}}
 */
export function resolveLlm(config = {}) {
  const provider = config.provider || 'rule';
  if (provider === 'openai' && config.apiKey) {
    return createOpenAIProvider(config);
  }
  return ruleProvider;
}
