// OpenAI互換プロバイダ（骨組み）。
// 実APIは別環境で検証する。ここではリクエスト構築と応答抽出の契約のみ実装し、
// fetch を注入可能にしてテストからモックできるようにする（spec-inspector と同方針）。

const DEFAULT_MODEL = 'gpt-5-mini';
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * ステージ名から、AI補強の指示（system プロンプト）を返す。
 * プロンプトはコア内に閉じており、外部に依存しない。
 */
function systemPromptFor(stage) {
  const base =
    'あなたはISTQB/ISO29119準拠のテストアーキテクトです。' +
    '与えられた候補JSONを、抜け漏れ・観点の質の面で補強し、同一スキーマのJSONのみを返してください。';
  const hints = {
    featureAnalysis: 'テストフィーチャー（機能/非機能）の抜けを補ってください。',
    modelAnalysis: '各フィーチャーに最適なテストモデル（技法）の選定理由を精緻化してください。',
    designDetail: 'テスト条件の網羅性（境界・異常・状態遷移）を高めてください。',
    caseLow: 'テストデータの具体値と事前条件を現実的にしてください。',
  };
  return `${base}\n${hints[stage] || ''}`;
}

/**
 * @param {import('../llm.js').LlmConfig} config
 * @returns {{id:string, enrich:Function}}
 */
export function createOpenAIProvider(config) {
  const fetchImpl = config.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const model = config.model || DEFAULT_MODEL;

  return {
    id: 'openai',
    /**
     * 候補を LLM で補強する。失敗時は必ず元の候補にフォールバックする。
     * @param {string} stage
     * @param {Array} candidates
     * @returns {Promise<Array>}
     */
    async enrich(stage, candidates) {
      if (!fetchImpl || !config.apiKey) return candidates;
      const body = {
        model,
        messages: [
          { role: 'system', content: systemPromptFor(stage) },
          { role: 'user', content: JSON.stringify({ stage, candidates }) },
        ],
        response_format: { type: 'json_object' },
      };
      try {
        const res = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) return candidates;
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) return candidates;
        const parsed = JSON.parse(content);
        const items = Array.isArray(parsed) ? parsed : parsed.candidates;
        return Array.isArray(items) && items.length ? items : candidates;
      } catch {
        return candidates; // ネットワーク/パース失敗はルールベース結果を維持
      }
    },
  };
}
