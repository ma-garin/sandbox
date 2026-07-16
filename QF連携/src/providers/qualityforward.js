// providers/qualityforward.js — QualityForward API プロバイダ（リクエスト構築・応答抽出・エラー変換）
//
// すべて純粋関数＋fetch注入で、APIキーなしの環境でも完全にモック検証できる。
// 認証: Authorization: Bearer <project_api_key>（APIキーはプロジェクト単位）
// 利用規約上のレート制限: 1秒あたり1リクエスト・日次約3000・月間約10万（呼び出し側で間隔を空けること）

export const QF_BASE_URL = "https://cloud.veriserve.co.jp/api/v2";

// リクエスト仕様を組み立てる（副作用なし）
export function buildQFRequest({ apiKey, method = "GET", path, query, body }) {
  const url = new URL(QF_BASE_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  const headers = { Authorization: `Bearer ${apiKey}` };
  let payload;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return { url: url.toString(), method, headers, body: payload };
}

// HTTPステータス→利用者向け日本語メッセージ
export function describeError(status, bodyText = "") {
  if (status === 401) return "APIキーが無効です（設定タブでご確認ください）";
  if (status === 403) return "この操作の権限がありません";
  if (status === 404) return "リソースが見つかりません（IDをご確認ください）";
  if (status === 422) {
    let detail = "";
    try {
      const j = JSON.parse(bodyText);
      detail = j?.message || (Array.isArray(j?.errors) ? j.errors.join(", ") : "");
    } catch {
      detail = "";
    }
    return `入力内容が不正です${detail ? `: ${detail.slice(0, 120)}` : ""}`;
  }
  if (status === 429) return "レート制限に達しました（1秒1回・日次上限を超えていないかご確認ください）";
  if (status >= 500) return `QualityForwardサーバエラー (${status})`;
  return `APIエラー (${status})`;
}

// API呼び出し。絶対にthrowしない。→ {ok:true, status, data} | {ok:false, error}
export async function callQF(reqSpec, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(reqSpec.url, {
      method: reqSpec.method,
      headers: reqSpec.headers,
      body: reqSpec.body,
      signal: controller.signal,
    });
    const bodyText = await res.text().catch(() => "");
    if (!res.ok) {
      return { ok: false, error: describeError(res.status, bodyText) };
    }
    let data = null;
    if (bodyText) {
      try {
        data = JSON.parse(bodyText);
      } catch {
        data = bodyText;
      }
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    const msg = e?.name === "AbortError" ? "タイムアウトしました" : "ネットワークエラー（CORSブロックの可能性があります）";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
