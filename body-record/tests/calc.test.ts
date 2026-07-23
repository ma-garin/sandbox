import { describe, it, expect } from 'vitest';
import {
  calcBmi,
  bmiCategory,
  dashboardStats,
  currentStreak,
  goalProgressPercent,
  movingAverage,
  filterByRange,
  series,
  recordOnOrBefore,
  sortByDate,
  monthlyStats,
  monthRecordRate,
  daysInMonth,
} from '../src/lib/calc';
import type { BodyRecord } from '../src/types';

function rec(date: string, weight: number, extra: Partial<BodyRecord> = {}): BodyRecord {
  return {
    id: date,
    measuredAt: date,
    weightKg: weight,
    bmi: 0,
    stamps: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

describe('calcBmi (AC-02)', () => {
  it('体重kg ÷ 身長m² を小数第1位まで四捨五入', () => {
    // 65 / 1.70^2 = 22.4913... -> 22.5
    expect(calcBmi(65, 170)).toBe(22.5);
    // 60 / 1.75^2 = 19.591... -> 19.6
    expect(calcBmi(60, 175)).toBe(19.6);
  });
  it('身長・体重が不正なら 0', () => {
    expect(calcBmi(65, null)).toBe(0);
    expect(calcBmi(65, 0)).toBe(0);
    expect(calcBmi(0, 170)).toBe(0);
  });
});

describe('bmiCategory', () => {
  it('区分を返す', () => {
    expect(bmiCategory(18)).toBe('低体重');
    expect(bmiCategory(22)).toBe('普通体重');
    expect(bmiCategory(27)).toBe('肥満(1度)');
    expect(bmiCategory(0)).toBe('');
  });
});

describe('sortByDate / recordOnOrBefore', () => {
  const recs = [rec('2026-07-01', 66), rec('2026-07-08', 65), rec('2026-07-15', 64)];
  it('昇順ソートは元配列を変更しない', () => {
    const input = [...recs].reverse();
    const sorted = sortByDate(input);
    expect(sorted.map((r) => r.measuredAt)).toEqual(['2026-07-01', '2026-07-08', '2026-07-15']);
    expect(input[0].measuredAt).toBe('2026-07-15'); // unchanged
  });
  it('7日前基準の記録を返す', () => {
    const sorted = sortByDate(recs);
    const base = recordOnOrBefore(sorted, '2026-07-15', 7);
    expect(base?.measuredAt).toBe('2026-07-08');
  });
});

describe('dashboardStats (FR-008)', () => {
  const recs = [rec('2026-07-01', 66), rec('2026-07-14', 65.2), rec('2026-07-15', 65)];
  it('前日比・7日前比・開始差・目標差・記録数', () => {
    const s = dashboardStats(recs, 60);
    expect(s.latest?.weightKg).toBe(65);
    expect(s.deltaPrev).toBe(-0.2); // 65 - 65.2
    expect(s.delta7).toBe(-1); // 65 - 66 (7/01 は 14日前だが7日前以前で最新)
    expect(s.deltaStart).toBe(-1); // 65 - 66
    expect(s.toGoal).toBe(5); // 65 - 60
    expect(s.recordCount).toBe(3);
  });
  it('記録なしは null 群', () => {
    const s = dashboardStats([], 60);
    expect(s.latest).toBeNull();
    expect(s.recordCount).toBe(0);
  });
});

describe('currentStreak (FR-107)', () => {
  it('連続日をカウント、途切れで停止', () => {
    const recs = [rec('2026-07-10', 66), rec('2026-07-13', 65), rec('2026-07-14', 65), rec('2026-07-15', 64)];
    expect(currentStreak(sortByDate(recs))).toBe(3); // 13,14,15
  });
  it('1件なら1、0件なら0', () => {
    expect(currentStreak([rec('2026-07-15', 64)])).toBe(1);
    expect(currentStreak([])).toBe(0);
  });
});

describe('goalProgressPercent', () => {
  it('減量進捗をクランプして返す', () => {
    // 開始70 目標60 現在65 -> (70-65)/(70-60)=50%
    expect(goalProgressPercent(65, 70, 60)).toBe(50);
    // 目標超過はクランプ 100
    expect(goalProgressPercent(58, 70, 60)).toBe(100);
    // 逆行は 0
    expect(goalProgressPercent(72, 70, 60)).toBe(0);
  });
  it('開始=目標は100', () => {
    expect(goalProgressPercent(60, 60, 60)).toBe(100);
  });
});

describe('series / movingAverage (FR-102)', () => {
  const recs = [
    rec('2026-07-01', 66, { bodyFatPercent: 20 }),
    rec('2026-07-02', 65),
    rec('2026-07-03', 64, { bodyFatPercent: 19 }),
  ];
  it('series は値のある日のみ抽出', () => {
    expect(series(recs, 'weightKg').length).toBe(3);
    expect(series(recs, 'bodyFatPercent').length).toBe(2);
  });
  it('movingAverage は先頭で部分平均', () => {
    const pts = series(recs, 'weightKg');
    const avg = movingAverage(pts, 7);
    expect(avg[0]).toBe(66);
    expect(avg[1]).toBe(65.5);
    expect(avg[2]).toBe(65);
  });
});

describe('filterByRange', () => {
  const recs = [rec('2026-06-01', 68), rec('2026-07-10', 66), rec('2026-07-15', 65)];
  it('全期間 (0) は全件', () => {
    expect(filterByRange(recs, 0).length).toBe(3);
  });
  it('7日は最新から遡り2件', () => {
    expect(filterByRange(recs, 7).map((r) => r.measuredAt)).toEqual(['2026-07-10', '2026-07-15']);
  });
});

describe('daysInMonth', () => {
  it('うるう年含めて正しい', () => {
    expect(daysInMonth('2026-07')).toBe(31);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2024-02')).toBe(29);
  });
});

describe('monthlyStats (FR-101)', () => {
  const recs = [
    rec('2026-06-28', 66.0),
    rec('2026-07-01', 65.6),
    rec('2026-07-10', 65.2),
    rec('2026-07-20', 64.8),
  ];
  it('月ごとに平均・最小最大・月内増減・記録率を集計（降順）', () => {
    const ms = monthlyStats(recs);
    expect(ms.map((m) => m.month)).toEqual(['2026-07', '2026-06']);
    const jul = ms[0];
    expect(jul.count).toBe(3);
    expect(jul.avg).toBe(65.2); // (65.6+65.2+64.8)/3
    expect(jul.min).toBe(64.8);
    expect(jul.max).toBe(65.6);
    expect(jul.firstDiff).toBe(-0.8); // 64.8 - 65.6
    expect(jul.recordRate).toBe(Math.round((3 / 31) * 100));
    expect(ms[1].firstDiff).toBeNull(); // 6月は1件
  });
});

describe('monthRecordRate (FR-107)', () => {
  const recs = [rec('2026-07-01', 65), rec('2026-07-02', 65), rec('2026-07-03', 65)];
  it('当月は経過日数で割る（today 指定）', () => {
    // 3件 / 5日経過 = 60%
    expect(monthRecordRate(recs, '2026-07', '2026-07-05')).toBe(60);
  });
  it('過去月は月日数で割る', () => {
    expect(monthRecordRate(recs, '2026-07')).toBe(Math.round((3 / 31) * 100));
  });
});
