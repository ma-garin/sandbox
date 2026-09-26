// ブラウザ内の保存（localStorage）
const SESSION_KEY = 'session';
const RECENT_KEY = 'recentSearches';
const DRAFT_KEY = 'loanDraft';
export const RECENT_MAX = 10;

export function saveSession(session) {
  localStorage.setItem('session', JSON.stringify({ memberId: session.memberId, token: session.token, memberType: session.memberType }));
}

export function loadSession() {
  const raw = localStorage.getItem('session');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('session');
}

export function loadRecentSearches() {
  const raw = localStorage.getItem('recentSearches');
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query) {
  const current = loadRecentSearches().filter((q) => q !== query);
  const next = [query, ...current].slice(0, RECENT_MAX);
  localStorage.setItem('recentSearches', JSON.stringify(next));
  return next;
}

export function clearRecentSearches() {
  localStorage.removeItem(RECENT_KEY);
}

export function saveLoanDraft(draft) {
  localStorage.setItem('loanDraft', JSON.stringify({ memberId: draft.memberId, isbn: draft.isbn, count: draft.count, days: draft.days }));
}

export function loadLoanDraft() {
  const raw = localStorage.getItem('loanDraft');
  return raw ? JSON.parse(raw) : null;
}

export function clearLoanDraft() {
  localStorage.removeItem(DRAFT_KEY);
}
