// LLM 層: 説明文の生成（REQ-F-016・029）。既定は無効（Q-02）。キーは環境変数 ANTHROPIC_API_KEY。
// 有効化は selectLlm(true)。キーが無ければ無効扱い。

import type { SourceRef } from '../ir/schema.ts';
import { createAnthropicLlm, type AnthropicLlmOptions } from './anthropic.ts';

export const LLM_DISABLED_TEXT = 'LLM 無効のため未生成';

export interface ExplainRequest {
  /** 説明する対象の IR 要素 id（機能・画面・業務ルール） */
  targetId: string;
  kind: 'function' | 'screen' | 'rule' | 'module';
  /** 静的解析の要約（秘密情報は除去済みであること） */
  summary: string;
  /** 渡すソース断片（秘密情報は除去済みであること） */
  snippets: { source: SourceRef; text: string }[];
}

export interface ExplainResult {
  text: string;
  /** 'inference' 固定。disabled のときは 'unknown' */
  evidence: 'inference' | 'unknown';
  /** 参照したソース位置 */
  source: SourceRef[];
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  requests: number;
  /** 送信したファイルの一覧（REQ-F-030） */
  sentFiles: string[];
}

export interface LlmClient {
  readonly enabled: boolean;
  explain(req: ExplainRequest): Promise<ExplainResult>;
  usage(): LlmUsage;
}

/** 無効時のクライアント。送信は 0 件で、説明文は常に LLM_DISABLED_TEXT */
export const disabledLlm: LlmClient = {
  enabled: false,
  async explain(): Promise<ExplainResult> {
    return { text: LLM_DISABLED_TEXT, evidence: 'unknown', source: [] };
  },
  usage(): LlmUsage {
    return { inputTokens: 0, outputTokens: 0, requests: 0, sentFiles: [] };
  },
};

export { createAnthropicLlm, DEFAULT_MODEL, LLM_FAILED_TEXT, preparePrompt, type AnthropicLlmOptions, type MessagesApi } from './anthropic.ts';
export { redact, isSecretLine, isEnvFile, REDACTED_LINE } from './redact.ts';

/**
 * 設定から LLM クライアントを選ぶ。既定は無効（Q-02・REQ-N-011）。
 * enabled=true でもキーが無ければ無効扱い。
 */
export function selectLlm(enabled: boolean, options: AnthropicLlmOptions = {}): LlmClient {
  if (!enabled) return disabledLlm;
  return createAnthropicLlm(options) ?? disabledLlm;
}
