// 純粋計算ロジック（DOM / DB 非依存 → Vitest で単体テスト対象）
import type { BodyRecord, Metric } from '../types';

/** 小数第 n 位に四捨五入 */
export function roundTo(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * BMI 計算（AC-02）
 * 体重kg ÷ 身長m² を小数第2位で四捨五入し小数第1位まで。
 * 身長未設定・不正値では NaN を避けて 0 を返す（呼び出し側で表示制御）。
 */
export function calcBmi(weightKg: number, heightCm: number | null | undefined): number {
  if (!heightCm || heightCm <= 0 || !weightKg || weightKg <= 0) return 0;
  const m = heightCm / 100;
  return roundTo(weightKg / (m * m), 1);
}

export function bmiCategory(bmi: number): string {
  if (bmi <= 0) return '';
  if (bmi < 18.5) return '低体重';
  if (bmi < 25) return '普通体重';
  if (bmi < 30) return '肥満(1度)';
  if (bmi < 35) return '肥満(2度)';
  return '肥満(3度+)';
}

/** measuredAt 昇順に整列（元配列は変更しない） */
export function sortByDate(records: BodyRecord[]): BodyRecord[] {
  return [...records].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
}

/** 2 つの ISO 日付(YYYY-MM-DD)の差（b - a 日数） */
export function dayDiff(aIso: string, bIso: string): number {
  return Math.round((Date.parse(bIso) - Date.parse(aIso)) / 86_400_000);
}

/** 指定日から n 日前以前で最も新しい記録（前日比・7日前比の基準） */
export function recordOnOrBefore(sorted: BodyRecord[], baseIso: string, daysAgo: number): BodyRecord | null {
  const targetMs = Date.parse(baseIso) - daysAgo * 86_400_000;
  let best: BodyRecord | null = null;
  for (const r of sorted) {
    if (r.measuredAt >= baseIso) continue;
    if (Date.parse(r.measuredAt) <= targetMs + 43_200_000) best = r; // 半日許容
  }
  return best;
}

export interface DashboardStats {
  latest: BodyRecord | null;
  deltaPrev: number | null; // 前日比
  delta7: number | null; // 7日前比
  deltaStart: number | null; // 開始からの差
  toGoal: number | null; // 目標体重までの残差（現在 - 目標、正=まだ減らす）
  streak: number; // 連続記録日数
  recordCount: number;
}

/** ダッシュボード指標（FR-008） */
export function dashboardStats(
  records: BodyRecord[],
  targetWeightKg: number | null | undefined,
  startWeightKg?: number | null,
): DashboardStats {
  const sorted = sortByDate(records);
  const latest = sorted.length ? sorted[sorted.length - 1] : null;
  if (!latest) {
    return { latest: null, deltaPrev: null, delta7: null, deltaStart: null, toGoal: null, streak: 0, recordCount: 0 };
  }
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const base7 = recordOnOrBefore(sorted, latest.measuredAt, 7);
  const start = startWeightKg ?? sorted[0].weightKg;
  return {
    latest,
    deltaPrev: prev ? roundTo(latest.weightKg - prev.weightKg, 1) : null,
    delta7: base7 ? roundTo(latest.weightKg - base7.weightKg, 1) : null,
    deltaStart: start != null ? roundTo(latest.weightKg - start, 1) : null,
    toGoal: targetWeightKg != null ? roundTo(latest.weightKg - targetWeightKg, 1) : null,
    streak: currentStreak(sorted),
    recordCount: sorted.length,
  };
}

/** 最新記録から遡り、日付が連続している日数（FR-107 先取り） */
export function currentStreak(sorted: BodyRecord[]): number {
  if (!sorted.length) return 0;
  let s = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    if (dayDiff(sorted[i - 1].measuredAt, sorted[i].measuredAt) === 1) s++;
    else break;
  }
  return s;
}

/** 目標達成率 %（開始→目標に対する進捗、0..100 にクランプ）。増量・減量どちらにも対応 */
export function goalProgressPercent(
  latestWeight: number,
  startWeight: number,
  goalWeight: number,
): number | null {
  const total = startWeight - goalWeight;
  if (total === 0) return 100;
  const done = startWeight - latestWeight;
  return Math.max(0, Math.min(100, roundTo((done / total) * 100, 0)));
}

export interface Point {
  date: string;
  value: number;
}

/** 指標系列を取り出す（値が無い日は除外） */
export function series(records: BodyRecord[], metric: Metric): Point[] {
  return sortByDate(records)
    .map((r) => ({ date: r.measuredAt, value: r[metric] as number | undefined }))
    .filter((p): p is Point => p.value != null && Number.isFinite(p.value));
}

/** n 日移動平均（FR-102）。窓内に値が無ければ null */
export function movingAverage(points: Point[], window = 7): (number | null)[] {
  return points.map((_, i) => {
    let sum = 0;
    let cnt = 0;
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      sum += points[j].value;
      cnt++;
    }
    return cnt ? roundTo(sum / cnt, 2) : null;
  });
}

/** 期間フィルタ（日数。0 or 負で全期間）。最新日を終端に days 日ぶん遡る */
export function filterByRange(records: BodyRecord[], days: number): BodyRecord[] {
  const sorted = sortByDate(records);
  if (!days || days <= 0 || !sorted.length) return sorted;
  const last = sorted[sorted.length - 1].measuredAt;
  const cutoffMs = Date.parse(last) - (days - 1) * 86_400_000;
  return sorted.filter((r) => Date.parse(r.measuredAt) >= cutoffMs);
}
