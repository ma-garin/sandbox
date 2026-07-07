// providers/openai.js — OpenAI API プロバイダ（リクエスト構築・応答抽出・エラー変換）
//
// すべて純粋関数＋fetch注入で、APIキーなしの環境でも完全にモック検証できる。
// gpt-5系の制約: max_tokens 不可（max_completion_tokens を使う）、temperature は既定値のみ
// → body は model / messages / response_format / max_completion_tokens の最小構成とする。

export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// リクエスト仕様を組み立てる（副作用なし）
export function buildOpenAIRequest({ apiKey, org = "", project = "", model, system, user, maxCompletionTokens = 3000 }) {
  const headers = {
    "content-type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };
  if (org) headers["OpenAI-Organization"] = org;
  if (project) headers["OpenAI-Project"] = project;
  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: maxCompletionTokens,
  });
  return { url: OPENAI_URL, headers, body };
}

// 応答JSONから本文テキストを取り出す（欠損・refusalは空文字）
export function extractText(responseJson) {
  const msg = responseJson?.choices?.[0]?.message;
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  return "";
}

// HTTPステータス→利用者向け日本語メッセージ
export function describeError(status, bodyText = "") {
  if (status === 401) return "APIキーが無効です";
  if (status === 403) return "Organization/Project IDの権限がありません";
  if (status === 429) return "レート制限に達しました（時間をおいて再実行してください）";
  if (status === 400) {
    let detail = "";
    try { detail = JSON.parse(bodyText)?.error?.message || ""; } catch { detail = ""; }
    return `リクエストが不正です${detail ? `: ${detail.slice(0, 80)}` : ""}`;
  }
  if (status >= 500) return `OpenAIサーバエラー (${status})`;
  return `APIエラー (${status})`;
}

// API呼び出し。絶対にthrowしない。→ {ok:true, text} | {ok:false, error}
export async function callOpenAI(reqSpec, { fetchImpl = fetch, timeoutMs = 90000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(reqSpec.url, {
      method: "POST",
      headers: reqSpec.headers,
      body: reqSpec.body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return { ok: false, error: describeError(res.status, bodyText) };
    }
    const json = await res.json();
    return { ok: true, text: extractText(json) };
  } catch (e) {
    const msg = e?.name === "AbortError" ? "タイムアウトしました" : "ネットワークエラー";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
