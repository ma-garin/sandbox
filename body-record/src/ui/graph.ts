// SCR-03 グラフ（指標切替・期間切替・目標線・移動平均・タップ詳細）
import type { AppContext } from './context';
import type { Metric } from '../types';
import { METRIC_DEFS, STAMP_DEFS } from '../types';
import { filterByRange } from '../lib/calc';
import { renderMetricChart } from './chart';
import type { Chart } from 'chart.js';
import { $, esc, fmtDateFull } from './dom';
import { getByDate } from '../lib/db';

const RANGES = [
  { days: 7, label: '7日' },
  { days: 30, label: '30日' },
  { days: 90, label: '90日' },
  { days: 365, label: '1年' },
  { days: 0, label: '全期間' },
];

let chart: Chart | null = null;
let metric: Metric = 'weightKg';
let rangeDays = 30;
let showAvg = true;

export function renderGraph(ctx: AppContext, mount: HTMLElement): void {
  chart?.destroy();
  chart = null;

  const enabled = ctx.settings.enabledFields;
  const metrics = METRIC_DEFS.filter((m) => enabled.includes(m.key));
  if (!metrics.some((m) => m.key === metric)) metric = 'weightKg';

  mount.innerHTML = `
    <h2 class="view-title">グラフ</h2>
    <div class="tabs-scroll" id="metric-tabs" role="tablist">
      ${metrics.map((m) => `<button class="chip" role="tab" data-metric="${m.key}" aria-selected="${m.key === metric}">${m.label}</button>`).join('')}
    </div>
    <div class="tabs-scroll" id="range-tabs" role="tablist">
      ${RANGES.map((r) => `<button class="chip" role="tab" data-range="${r.days}" aria-selected="${r.days === rangeDays}">${r.label}</button>`).join('')}
    </div>
    <div class="card">
      <div class="chart-wrap"><canvas id="main-chart"></canvas></div>
      <div class="legend">
        <span><i style="background:var(--green)"></i>実測</span>
        ${metric === 'weightKg' ? '<span><i style="background:var(--down);opacity:.7"></i>7日移動平均</span><span><i style="background:var(--accent)"></i>目標</span>' : '<span><i style="background:var(--down);opacity:.7"></i>7日移動平均</span>'}
      </div>
      <label class="hint" style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer">
        <input type="checkbox" id="avg-toggle" ${showAvg ? 'checked' : ''} style="width:auto"> 7日移動平均を表示
      </label>
      <div class="tap-info" id="tap-info">グラフ上の点をタップすると、その日の詳細を表示します。</div>
    </div>`;

  draw(ctx);

  $('#metric-tabs')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-metric]');
    if (!b) return;
    metric = b.dataset.metric as Metric;
    ctx.rerender();
  });
  $('#range-tabs')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-range]');
    if (!b) return;
    rangeDays = Number(b.dataset.range);
    ctx.rerender();
  });
  $<HTMLInputElement>('#avg-toggle')!.addEventListener('change', (e) => {
    showAvg = (e.target as HTMLInputElement).checked;
    draw(ctx);
  });
}

function draw(ctx: AppContext): void {
  chart?.destroy();
  const canvas = $<HTMLCanvasElement>('#main-chart')!;
  const data = filterByRange(ctx.records, rangeDays);
  if (!data.some((r) => r[metric] != null)) {
    canvas.parentElement!.innerHTML = `<div class="empty"><div class="e">📈</div><p>この期間・指標のデータがありません</p></div>`;
    return;
  }
  chart = renderMetricChart(canvas, data, {
    metric,
    target: ctx.settings.targetWeightKg,
    showMovingAvg: showAvg,
    onTap: (date) => showTap(date),
  });
}

async function showTap(date: string): Promise<void> {
  const info = $('#tap-info');
  if (!info) return;
  const r = await getByDate(date);
  if (!r) return;
  const stampLabels = r.stamps.map((s) => STAMP_DEFS.find((d) => d.type === s)?.emoji ?? '').join(' ');
  const parts = [
    `<b>${esc(fmtDateFull(r.measuredAt))}</b>`,
    `体重 ${r.weightKg.toFixed(1)}kg`,
    r.bodyFatPercent != null ? `体脂肪 ${r.bodyFatPercent.toFixed(1)}%` : '',
    r.muscleMassKg != null ? `筋肉 ${r.muscleMassKg.toFixed(1)}kg` : '',
    r.waistCm != null ? `ウエスト ${r.waistCm.toFixed(1)}cm` : '',
  ].filter(Boolean);
  info.innerHTML = `${parts.join(' ／ ')}${stampLabels ? ' ' + stampLabels : ''}${r.memo ? `<br>📝 ${esc(r.memo)}` : ''}`;
}
