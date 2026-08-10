import type { BodyRecord, UserSettings } from '../types';

export type Tab = 'record' | 'graph' | 'history' | 'settings';

/** 各画面へ渡すアプリ状態・操作 */
export interface AppContext {
  records: BodyRecord[];
  settings: UserSettings;
  /** 記録画面が読み込む対象日（編集時に指定） */
  editDate: string;
  /** DB から records を再取得し、現在のタブを再描画 */
  reload: () => Promise<void>;
  /** 現在のタブを再描画 */
  rerender: () => void;
  /** タブ切替 */
  go: (tab: Tab, editDate?: string) => void;
  /** 設定を保存して state 反映 */
  updateSettings: (patch: Partial<UserSettings>) => void;
}
