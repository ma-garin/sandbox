// バックエンド API の呼び出し（サーバはこのサンプルには含まない）
export const API_BASE = 'https://api.library.example.jp/v1';
export const TIMEOUT_MS = 8000;
export const MAX_RETRY = 2;
export const RETRY_INTERVAL_MS = 500;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** query があれば付ける */
function withQuery(path, query = null) {
  return query ? `${path}?${new URLSearchParams(query)}` : path;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 共通の送信処理。タイムアウト 8000ms、失敗時は 2 回まで再試行する。
 * @param {string} url
 * @param {RequestInit} options
 */
export async function requestWithRetry(url, options = {}) {
  url = withQuery(url, options.query);
  let attempt = 0;
  while (attempt <= MAX_RETRY) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) {
        if (res.status >= 500 && attempt < MAX_RETRY) {
          attempt += 1;
          await wait(RETRY_INTERVAL_MS);
          continue;
        }
        if (res.status === 401) {
          throw new ApiError(401, 'ログインの有効期限が切れました。もう一度ログインしてください');
        }
        if (res.status === 404) {
          throw new ApiError(404, '該当するデータが見つかりません');
        }
        if (res.status === 409) {
          throw new ApiError(409, 'この本はすでに貸出中です');
        }
        throw new ApiError(res.status, 'サーバでエラーが発生しました。時間をおいて再度お試しください');
      }
      if (res.status === 204) return null;
      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        if (attempt < MAX_RETRY) {
          attempt += 1;
          continue;
        }
        throw new ApiError(0, '通信がタイムアウトしました。通信環境を確認してください');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ApiError(0, '再試行の上限に達しました');
}

function jsonHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export function searchBooks(query, category, token) {
  return requestWithRetry(`${API_BASE}/books`, { method: 'GET', headers: jsonHeaders(token), query: { q: query, category } });
}

export function getMember(id, token) {
  return requestWithRetry(`${API_BASE}/members/${encodeURIComponent(id)}`, { method: 'GET', headers: jsonHeaders(token) });
}

export function createLoan(payload, token) {
  return requestWithRetry(`${API_BASE}/loans`, { method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(payload) });
}

export function deleteLoan(id, token) {
  return requestWithRetry(`${API_BASE}/loans/${encodeURIComponent(id)}`, { method: 'DELETE', headers: jsonHeaders(token) });
}

export function login(memberId, password) {
  return requestWithRetry(`${API_BASE}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, password }) });
}
