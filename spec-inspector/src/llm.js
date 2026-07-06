// llm.js — LLM設定とAI補足オーケストレーション（プロバイダ: OpenAI）
//
// 実APIの実行は別環境（org/project/keyはそこで設定）。本モジュールは
// fetch注入によりオフラインで全経路を検証できる。
// - 設定はすべてlocalStorage（ハードコード禁止）
// - enrichWithAI の契約は不変: {enabled, findings, error?}
//   AI指摘は source:"ai" タグ付き・スコア計算には影響しない（ルールベース固定）
//   失敗時もルールベース結果は必ず得られる（graceful degradation）

import { buildAnalysisMessages, parseAIFindings } from "./prompts/index.js";
import { buildTestDesignPrompt } from "./prompts/features.js";
import { buildOpenAIRequest, callOpenAI } from "./providers/openai.js";

const PROVIDER_STORE = "spec-inspector.provider.v1";      // "rule" | "openai"
const KEY_STORE = "spec-inspector.openai.key.v1";
const ORG_STORE = "spec-inspector.openai.org.v1";
const PROJECT_STORE = "spec-inspector.openai.project.v1";
const MODEL_STORE = "spec-inspector.openai.model.v1";
const DEFAULT_MODEL = "gpt-5-mini";
const MAX_TOTAL_FINDINGS = 20;

const KNOWN_PROVIDERS = new Set(["rule", "openai"]);

export function getProvider() {
  const v = localStorage.getItem(PROVIDER_STORE) || "rule";
  // 旧値（"claude"等）はruleに正規化。キー体系が異なるため自動昇格しない
  return KNOWN_PROVIDERS.has(v) ? v : "rule";
}
export function setProvider(p) {
  localStorage.setItem(PROVIDER_STORE, KNOWN_PROVIDERS.has(p) ? p : "rule");
}

const mkAccessor = (store) => [
  () => localStorage.getItem(store) || "",
  (v) => { if (v) localStorage.setItem(store, v); else localStorage.removeItem(store); },
];
export const [getOpenAIKey, setOpenAIKey] = mkAccessor(KEY_STORE);
export const [getOpenAIOrg, setOpenAIOrg] = mkAccessor(ORG_STORE);
export const [getOpenAIProject, setOpenAIProject] = mkAccessor(PROJECT_STORE);

export function getModel() {
  return localStorage.getItem(MODEL_STORE) || DEFAULT_MODEL;
}
export function setModel(m) {
  localStorage.setItem(MODEL_STORE, (m || DEFAULT_MODEL).trim() || DEFAULT_MODEL);
}

// message+evidence をキーに重複排除（immutable: 新配列を返す）
function dedupe(findings) {
  const seen = new Set();
  const out = [];
  for (const f of findings) {
    const k = `${f.message}|${f.evidence}`;
    if (!seen.has(k)) { seen.add(k); out.push(f); }
  }
  return out;
}

// AI補足解析。docs: [{name, text, role?}]
// → { enabled, findings, error? }
export async function enrichWithAI(docs, { fetchImpl = fetch, timeoutMs = 90000 } = {}) {
  if (getProvider() !== "openai") return { enabled: false, findings: [] };
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    return { enabled: false, error: "APIキー未設定のためAI補足をスキップしました（設定タブで登録できます）", findings: [] };
  }

  const { system, chunks } = buildAnalysisMessages(docs);
  const org = getOpenAIOrg();
  const project = getOpenAIProject();
  const model = getModel();

  let findings = [];
  const errors = [];
  // チャンクは逐次実行（レート制限に優しく、失敗の切り分けが容易）
  for (const chunk of chunks) {
    const req = buildOpenAIRequest({ apiKey, org, project, model, system, user: chunk.user });
    const res = await callOpenAI(req, { fetchImpl, timeoutMs });
    if (!res.ok) { errors.push(res.error); continue; }
    const parsed = parseAIFindings(res.text);
    if (!parsed.ok && parsed.error) errors.push(parsed.error);
    findings = dedupe([...findings, ...parsed.findings]).slice(0, MAX_TOTAL_FINDINGS);
  }

  const result = { enabled: true, findings };
  if (errors.length) {
    const uniq = [...new Set(errors)].join(" / ");
    result.error = findings.length
      ? `AI補足は一部失敗（${uniq}）。取得できた${findings.length}件を表示します`
      : `AI補足に失敗: ${uniq}。ルールベース結果のみ表示します`;
  }
  return result;
}

// テスト設計候補のAI強化応答 {"candidates":[...]} をパースする
const TD_TYPES = new Set(["decision-table", "boundary", "state"]);
export function parseTestDesignCandidates(text) {
  const src = String(text ?? "");
  const s = src.indexOf("{");
  const e = src.lastIndexOf("}");
  if (s === -1 || e <= s) return { ok: false, candidates: [], error: "応答からJSONを抽出できませんでした" };
  let arr;
  try {
    const obj = JSON.parse(src.slice(s, e + 1));
    arr = Array.isArray(obj.candidates) ? obj.candidates : null;
  } catch {
    return { ok: false, candidates: [], error: "JSON解析に失敗しました" };
  }
  if (!arr) return { ok: false, candidates: [], error: "candidates配列がありません" };
  const candidates = arr
    .filter((c) => c && typeof c === "object" && c.valid !== false)
    .filter((c) => TD_TYPES.has(c.type) && c.evidence)
    .slice(0, 12)
    .map((c) => Object.freeze({
      type: c.type,
      doc: String(c.doc || ""),
      evidence: String(c.evidence),
      conditions: Array.isArray(c.conditions) ? c.conditions.map(String) : [],
      reason: String(c.reason || ""),
      location: 0,
      source: "ai",
    }));
  return { ok: true, candidates };
}

// テスト設計レディネスのAI強化。ルール候補を精緻化し、見落としを補う。
// → { enabled, candidates, error? }（enrichWithAIと同じ縮退契約）
export async function enrichTestDesign(candidates, docs, { fetchImpl = fetch, timeoutMs = 90000 } = {}) {
  if (getProvider() !== "openai") return { enabled: false, candidates: [] };
  const apiKey = getOpenAIKey();
  if (!apiKey) return { enabled: false, error: "APIキー未設定のためテスト設計のAI補足をスキップしました", candidates: [] };

  const system = "あなたはテスト設計技法（デシジョンテーブル・境界値分析・状態遷移テスト）の専門家です。指定されたJSON形式のみで回答してください。";
  const user = buildTestDesignPrompt(candidates, docs);
  const req = buildOpenAIRequest({ apiKey, org: getOpenAIOrg(), project: getOpenAIProject(), model: getModel(), system, user });
  const res = await callOpenAI(req, { fetchImpl, timeoutMs });
  if (!res.ok) return { enabled: true, candidates: [], error: `テスト設計のAI補足に失敗: ${res.error}` };
  const parsed = parseTestDesignCandidates(res.text);
  if (!parsed.ok) return { enabled: true, candidates: [], error: `テスト設計のAI補足: ${parsed.error}` };
  return { enabled: true, candidates: parsed.candidates };
}
