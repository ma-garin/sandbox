// llm.js — LLM解析アダプタ（差し替え可能）
//
// 既定は "rule"（ルールベースのみ、APIキー不要）。
// "claude" を選ぶとユーザー提供APIキー（localStorage）でAIによる補足指摘を追加する想定。
// 現状 claude アダプタは骨組み（プロンプトと呼び出し口）まで。ネットワーク解析は後続で有効化。

const KEY_STORE = "spec-inspector.apikey.v1";
const PROVIDER_STORE = "spec-inspector.provider.v1";

export function getProvider() {
  return localStorage.getItem(PROVIDER_STORE) || "rule";
}
export function setProvider(p) {
  localStorage.setItem(PROVIDER_STORE, p);
}
export function getApiKey() {
  return localStorage.getItem(KEY_STORE) || "";
}
export function setApiKey(k) {
  if (k) localStorage.setItem(KEY_STORE, k);
  else localStorage.removeItem(KEY_STORE);
}

// AI補足用プロンプト（レビュー観点をClaudeに渡す想定のテンプレート）
export function buildPrompt(text) {
  return [
    "あなたはソフトウェア品質のレビュアーです。次の仕様文書を6観点",
    "（正確性/理解性/視覚性/深層性/信頼性/検証可能性）でレビューし、",
    "各指摘に severity(Critical/High/Medium/Low)・該当引用・改善案をJSONで返してください。",
    "---",
    text.slice(0, 12000),
  ].join("\n");
}

// provider="rule" のときは何も追加しない（呼び出し側でルール結果のみ使用）。
// provider="claude" のAI補足は将来ここで fetch を実装する。現状は未接続を明示。
export async function enrichWithAI(text) {
  const provider = getProvider();
  if (provider === "rule") return { enabled: false, findings: [] };
  if (!getApiKey()) {
    return { enabled: false, error: "APIキー未設定のためAI補足はスキップしました", findings: [] };
  }
  // TODO: Claude API 呼び出しを実装（buildPrompt(text) を送信し、返却JSONをfindingsに整形）
  return { enabled: false, error: "AI補足は未接続（ルールベース結果のみ表示）", findings: [] };
}
