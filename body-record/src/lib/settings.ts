// 設定の永続化。小規模な設定値は localStorage（5.3）。
import type { UserSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const KEY = 'body-record:settings';

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('settings save failed', e);
  }
}

/** テーマを DOM に適用（FR-104）。system は OS 設定に追従 */
export function applyTheme(theme: UserSettings['theme']): void {
  const root = document.documentElement;
  if (theme === 'system') {
    const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'dark' : 'light';
  } else {
    root.dataset.theme = theme;
  }
}
