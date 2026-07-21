// Chart.js ラッパー（推移グラフ FR-009/011/102, SCR-03）
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  type ChartConfiguration,
} from 'chart.js';
import type { BodyRecord, Metric } from '../types';
import { METRIC_DEFS } from '../types';
import { series, movingAverage } from '../lib/calc';
import { fmtDateShort } from './dom';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#2f6f4f';
}

export interface ChartOptions {
  metric: Metric;
  target?: number | null;
  showMovingAvg?: boolean;
  onTap?: (date: string) => void;
}

/** canvas に指標系列を描画し、Chart インスタンスを返す（呼び出し側が destroy 管理） */
export function renderMetricChart(canvas: HTMLCanvasElement, records: BodyRecord[], opt: ChartOptions): Chart {
  const points = series(records, opt.metric);
  const labels = points.map((p) => fmtDateShort(p.date));
  const green = cssVar('--green');
  const accent = cssVar('--accent');
  const info = cssVar('--down');
  const grid = cssVar('--divider');
  const text2 = cssVar('--text-2');
  const meta = METRIC_DEFS.find((m) => m.key === opt.metric)!;

  const datasets: ChartConfiguration<'line'>['data']['datasets'] = [
    {
      label: meta.label,
      data: points.map((p) => p.value),
      borderColor: green,
      backgroundColor: hexA(green, 0.12),
      fill: true,
      tension: 0.25,
      pointRadius: points.length > 45 ? 0 : 3,
      pointHoverRadius: 6,
      borderWidth: 2.5,
    },
  ];

  if (opt.showMovingAvg && points.length >= 3) {
    const avg = movingAverage(points, 7);
    datasets.push({
      label: '7日移動平均',
      data: avg as number[],
      borderColor: hexA(info, 0.7),
      backgroundColor: 'transparent',
      fill: false,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2,
      spanGaps: true,
    });
  }

  if (opt.metric === 'weightKg' && opt.target != null && points.length) {
    datasets.push({
      label: '目標',
      data: points.map(() => opt.target as number),
      borderColor: accent,
      backgroundColor: 'transparent',
      fill: false,
      borderDash: [6, 4],
      pointRadius: 0,
      borderWidth: 1.5,
    });
  }

  const config: ChartConfiguration<'line'> = {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onClick: (_e, elements) => {
        if (opt.onTap && elements.length) {
          const idx = elements[0].index;
          if (points[idx]) opt.onTap(points[idx].date);
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: text2, maxTicksLimit: 6, font: { size: 10 } } },
        y: { grid: { color: grid }, ticks: { color: text2, font: { size: 10 } } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => points[items[0].dataIndex]?.date ?? '',
            label: (item) => `${item.dataset.label}: ${item.formattedValue}${meta.unit}`,
          },
        },
      },
    },
  };
  return new Chart(canvas, config);
}

function hexA(hex: string, alpha: number): string {
  const m = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
