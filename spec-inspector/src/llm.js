// llm.js — LLM解析アダプタ（Claude API 実接続）
//
// 既定は "rule"（ルールベースのみ、APIキー不要）。
// "claude" 選択＋APIキー設定時は、Claude APIをブラウザから直接呼び出して
// ルールベースでは拾えない意味的な指摘（論理飛躍・暗黙の前提・仕様間の意味矛盾）を補足する。
// - キーは localStorage のみ（ハードコード禁止・外部送信はAnthropic APIへのリクエストのみ）
// - 失敗時はルールベース結果のみで継続（graceful degradation）
// - AI指摘はスコアに影響させない（スコアは再現性のあるルールベースで固定）

import { VIEWPOINTS, SEVERITY } from "./engine.js";

const KEY_STORE = "spec-inspector.apikey.v1";
const PROVIDER_STORE = "spec-inspector.provider.v1";
const MODEL_STORE = "spec-inspector.model.v1";
const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_INPUT_CHARS = 24000;
const TIMEOUT_MS = 90000;

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
export function getModel() {
  return localStorage.getItem(MODEL_STORE) || DEFAULT_MODEL;
}
export function setModel(m) {
  localStorage.setItem(MODEL_STORE, m || DEFAULT_MODEL);
}

// docs: [{name, text}] → プロンプト
export function buildPrompt(docs) {
  const vps = VIEWPOINTS.map((v) => `${v.key}（${v.label}: ${v.desc}）`).join("、");
  const body = docs
    .map((d) => `=== 文書: ${d.name} ===\n${d.text}`)
    .join("\n\n")
    .slice(0, MAX_INPUT_CHARS);
  return `あなたはソフトウェア品質保証のシニアレビュアーです。以下の仕様文書を6観点（${vps}）でレビューしてください。

機械的な表記チェック（曖昧語の単純検出・見出し有無など）は別エンジンが実施済みです。あなたは人間のレビュアーにしかできない意味的な指摘に集中してください：論理の飛躍、暗黙の前提、実現困難な要求、ユースケースの抜け、文書間の意味的な矛盾、セキュリティ/運用上の考慮漏れ。

指摘はJSON配列のみで出力してください（前後に説明文を付けない）：
[{"viewpoint":"accuracy|clarity|visual|depth|reliability|verifiability","severity":"Critical|High|Medium|Low","doc":"文書名","message":"指摘（1文）","evidence":"該当箇所の引用（原文ママ・40字以内）","suggestion":"具体的な改善案","expectedEffect":"期待効果"}]

根拠のない指摘は禁止です。evidenceには必ず原文の引用を入れてください。指摘が無ければ [] を返してください。最大10件。

${body}`;
}

// Claude応答テキストからJSON配列を頑健に抽出・検証
export function parseFindings(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  let arr;
  try {
    arr = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const vpKeys = new Set(VIEWPOINTS.map((v) => v.key));
  return arr
    .filter((f) => f && typeof f === "object")
    .filter((f) => vpKeys.has(f.viewpoint) && SEVERITY.includes(f.severity))
    .filter((f) => f.message && f.evidence)
    .slice(0, 10)
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
}

// AI補足解析を実行。{enabled, findings, error?}
export async function enrichWithAI(docs) {
  if (getProvider() !== "claude") return { enabled: false, findings: [] };
  const key = getApiKey();
  if (!key) return { enabled: false, error: "APIキー未設定のためAI補足をスキップしました（設定タブで登録できます）", findings: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        // Anthropic公式のブラウザ直接アクセス許可ヘッダ（ユーザー自身のキーによるクライアントサイド利用）
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: 3000,
        messages: [{ role: "user", content: buildPrompt(docs) }],
      }),
    });
    if (!res.ok) {
      const detail = res.status === 401 ? "APIキーが無効です" : res.status === 429 ? "レート制限に達しました" : `APIエラー (${res.status})`;
      return { enabled: true, error: `AI補足に失敗: ${detail}。ルールベース結果のみ表示します`, findings: [] };
    }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return { enabled: true, findings: parseFindings(text) };
  } catch (e) {
    const msg = e.name === "AbortError" ? "タイムアウトしました" : "ネットワークエラー";
    return { enabled: true, error: `AI補足に失敗: ${msg}。ルールベース結果のみ表示します`, findings: [] };
  } finally {
    clearTimeout(timer);
  }
}
