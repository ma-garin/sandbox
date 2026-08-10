// ドメイン型定義（UI 非依存）

/** スタンプ種別（FR-007） */
export type StampType = 'exercise' | 'overeat' | 'alcohol' | 'sick' | 'bowel';

export const STAMP_DEFS: { type: StampType; label: string; emoji: string }[] = [
  { type: 'exercise', label: '運動', emoji: '🏃' },
  { type: 'overeat', label: '食べ過ぎ', emoji: '🍰' },
  { type: 'alcohol', label: '飲酒', emoji: '🍺' },
  { type: 'sick', label: '体調不良', emoji: '🤒' },
  { type: 'bowel', label: '排便', emoji: '💩' },
];

/** 日次記録（5.1） */
export interface BodyRecord {
  id: string;
  /** 測定日 YYYY-MM-DD（同一日は 1 件・一意キー） */
  measuredAt: string;
  weightKg: number;
  bodyFatPercent?: number;
  muscleMassKg?: number;
  waistCm?: number;
  bmi: number;
  stamps: StampType[];
  memo?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** 追跡できる数値指標（グラフ切替 FR-009） */
export type Metric = 'weightKg' | 'bodyFatPercent' | 'muscleMassKg' | 'waistCm';

export const METRIC_DEFS: { key: Metric; label: string; unit: string }[] = [
  { key: 'weightKg', label: '体重', unit: 'kg' },
  { key: 'bodyFatPercent', label: '体脂肪率', unit: '%' },
  { key: 'muscleMassKg', label: '筋肉量', unit: 'kg' },
  { key: 'waistCm', label: 'ウエスト', unit: 'cm' },
];

/** ユーザー設定（5.2） */
export interface UserSettings {
  heightCm: number | null;
  targetWeightKg: number | null;
  targetBodyFatPercent?: number | null;
  targetMuscleMassKg?: number | null;
  targetWaistCm?: number | null;
  /** 入力・表示する項目（weightKg は常に有効） */
  enabledFields: Metric[];
  theme: 'light' | 'dark' | 'system';
}

export const DEFAULT_SETTINGS: UserSettings = {
  heightCm: null,
  targetWeightKg: null,
  targetBodyFatPercent: null,
  targetMuscleMassKg: null,
  targetWaistCm: null,
  enabledFields: ['weightKg', 'bodyFatPercent', 'muscleMassKg', 'waistCm'],
  theme: 'system',
};
