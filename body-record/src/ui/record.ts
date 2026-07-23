// SCR-01 今日の入力 + SCR-02 ダッシュボード（起動直後の最重要画面）
import type { AppContext } from './context';
import type { BodyRecord, StampType, Metric } from '../types';
import { STAMP_DEFS } from '../types';
import { calcBmi, bmiCategory, dashboardStats, goalProgressPercent, filterByRange } from '../lib/calc';
import { saveRecord, deleteByDate, getByDate } from '../lib/db';
import { renderMetricChart } from './chart';
import type { Chart } from 'chart.js';
import { $, esc, toast, todayStr, fmtDateFull, signed, deltaClass, numOrNull } from './dom';

let dashChart: Chart | null = null;
let selectedStamps: Set<StampType> = new Set();

export function renderRecord(ctx: AppContext, mount: HTMLElement): void {
  dashChart?.destroy();
  dashChart = null;
  const s = ctx.settings;
  const stats = dashboardStats(ctx.records, s.targetWeightKg);
  const latest = stats.latest;

  // リマインド（未記録 / 24h 超過）— 通知の代替（セクション 9）
  const reminder = reminderText(ctx.records);

  // ダッシュボードは入力の「下」に補助表示（記録がなければ何も出さない）
  const dashboard = latest ? dashboardHtml(ctx, stats) : '';

  const enabled = new Set<Metric>(s.enabledFields);
  const field = (id: string, label: string, metric: Metric, ph: string, opt = true) =>
    enabled.has(metric)
      ? `<div class="field"><label class="l" for="${id}">${label}${opt ? ' <span class="opt">任意</span>' : ''}</label>
           <input type="number" id="${id}" inputmode="decimal" step="0.1" placeholder="${ph}"></div>`
      : '';

  mount.innerHTML = `
    ${reminder ? `<div class="reminder">⏰ ${esc(reminder)}</div>` : ''}
    <h2 class="view-title">今日の入力</h2>
    <div class="card">
      <div class="field">
        <label class="l" for="f-date">日付</label>
        <input type="date" id="f-date" value="${esc(ctx.editDate || todayStr())}">
      </div>
      <div class="field">
        <label class="l" for="f-weight">体重 (kg)</label>
        <div class="stepper">
          <button type="button" id="w-dec" aria-label="0.1減らす">−</button>
          <input type="number" id="f-weight" inputmode="decimal" step="0.1" placeholder="65.0">
          <button type="button" id="w-inc" aria-label="0.1増やす">＋</button>
        </div>
      </div>
      <div class="grid2">
        ${field('f-fat', '体脂肪率 (%)', 'bodyFatPercent', '18.0')}
        <div class="field"><label class="l" for="f-bmi">BMI</label><input type="text" id="f-bmi" readonly placeholder="—"></div>
      </div>
      <div class="grid2">
        ${field('f-muscle', '筋肉量 (kg)', 'muscleMassKg', '50.0')}
        ${field('f-waist', 'ウエスト (cm)', 'waistCm', '80.0')}
      </div>
      <div class="field">
        <label class="l">スタンプ</label>
        <div class="stamps" id="f-stamps">
          ${STAMP_DEFS.map((d) => `<button type="button" class="stamp" data-stamp="${d.type}" aria-pressed="false">${d.emoji} ${d.label}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <label class="l" for="f-memo">メモ <span class="opt">任意</span></label>
        <textarea id="f-memo" placeholder="食事・運動・体調など"></textarea>
      </div>
      <button class="btn btn-primary" id="f-save">保存する</button>
      <button class="btn btn-danger" id="f-delete" style="margin-top:10px;display:none">この日の記録を削除</button>
    </div>
    ${dashboard}`;

  // draw dashboard mini chart (直近30日)
  const canvas = $<HTMLCanvasElement>('#dash-chart');
  if (canvas && latest) {
    dashChart = renderMetricChart(canvas, filterByRange(ctx.records, 30), {
      metric: 'weightKg',
      target: s.targetWeightKg,
      showMovingAvg: false,
    });
  }

  wireForm(ctx);
}

function dashboardHtml(ctx: AppContext, stats: ReturnType<typeof dashboardStats>): string {
  const s = ctx.settings;
  const l = stats.latest!;
  const bmi = calcBmi(l.weightKg, s.heightCm);
  const sorted = ctx.records;
  const startW = sorted.length ? sorted[0].weightKg : l.weightKg;
  const goal = s.targetWeightKg;

  let progress = '';
  if (goal != null && startW !== goal) {
    const pct = goalProgressPercent(l.weightKg, startW, goal) ?? 0;
    const remain = stats.toGoal ?? 0;
    progress = `
      <div class="card">
        <p class="card-title">目標まで</p>
        <div class="progress">
          <div class="big">${remain > 0 ? 'あと ' : remain < 0 ? '超過 ' : '達成 '}${Math.abs(remain).toFixed(1)}<small> kg</small></div>
          <div class="row"><span>開始 ${startW.toFixed(1)}</span><span>目標 ${goal.toFixed(1)}</span></div>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <div class="row" style="margin-top:6px"><span>${pct}% 達成</span><span>${s.heightCm ? 'BMI ' + bmi.toFixed(1) : ''}</span></div>
        </div>
      </div>`;
  }

  return `
    ${progress}
    <div class="card">
      <p class="card-title">サマリー（最新 ${esc(fmtDateFull(l.measuredAt))}）</p>
      <div class="stat-grid">
        <div class="stat"><div class="v">${l.weightKg.toFixed(1)}<small>kg</small></div><div class="l">現在体重</div></div>
        <div class="stat"><div class="v ${deltaClass(stats.deltaPrev)}">${signed(stats.deltaPrev)}</div><div class="l">前日比</div></div>
        <div class="stat"><div class="v ${deltaClass(stats.delta7)}">${signed(stats.delta7)}</div><div class="l">7日前比</div></div>
        <div class="stat"><div class="v">${bmi > 0 ? bmi.toFixed(1) : '—'}</div><div class="l">BMI ${bmiCategory(bmi)}</div></div>
        <div class="stat"><div class="v">${l.bodyFatPercent != null ? l.bodyFatPercent.toFixed(1) + '<small>%</small>' : '—'}</div><div class="l">体脂肪率</div></div>
        <div class="stat"><div class="v">${stats.streak}</div><div class="l">連続記録</div></div>
      </div>
    </div>
    <div class="card">
      <p class="card-title">直近30日</p>
      <div class="chart-wrap short"><canvas id="dash-chart"></canvas></div>
    </div>`;
}

function reminderText(records: BodyRecord[]): string | null {
  if (!records.length) return null;
  const today = todayStr();
  if (records.some((r) => r.measuredAt === today)) return null;
  const last = records[records.length - 1];
  const hours = (Date.parse(today) - Date.parse(last.measuredAt)) / 3_600_000;
  if (hours >= 24) return '前回の記録から時間が経っています。今日の体重を記録しましょう。';
  return null;
}

function wireForm(ctx: AppContext): void {
  const dateEl = $<HTMLInputElement>('#f-date')!;
  const weightEl = $<HTMLInputElement>('#f-weight')!;
  const bmiEl = $<HTMLInputElement>('#f-bmi')!;

  const updateBmi = () => {
    const w = numOrNull(weightEl.value);
    if (w != null && ctx.settings.heightCm) {
      const b = calcBmi(w, ctx.settings.heightCm);
      bmiEl.value = `${b.toFixed(1)}（${bmiCategory(b)}）`;
    } else bmiEl.value = '';
  };

  const loadDate = async (date: string) => {
    dateEl.dataset.loaded = ''; // 読み込み中マーク（非同期ロードが入力を上書きしないよう完了を検知可能に）
    const rec = await getByDate(date);
    selectedStamps = new Set(rec?.stamps ?? []);
    weightEl.value = rec ? String(rec.weightKg) : ctx.records.length ? String(ctx.records[ctx.records.length - 1].weightKg) : '';
    setVal('#f-fat', rec?.bodyFatPercent);
    setVal('#f-muscle', rec?.muscleMassKg);
    setVal('#f-waist', rec?.waistCm);
    const memo = $<HTMLTextAreaElement>('#f-memo');
    if (memo) memo.value = rec?.memo ?? '';
    $$stamps();
    const del = $<HTMLButtonElement>('#f-delete')!;
    del.style.display = rec ? 'block' : 'none';
    updateBmi();
    dateEl.dataset.loaded = date; // 読み込み完了。以降のユーザー入力は上書きされない
  };

  const $$stamps = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-stamp]').forEach((b) => {
      b.setAttribute('aria-pressed', selectedStamps.has(b.dataset.stamp as StampType) ? 'true' : 'false');
    });
  };

  dateEl.addEventListener('change', () => loadDate(dateEl.value));
  weightEl.addEventListener('input', updateBmi);
  $('#w-dec')!.addEventListener('click', () => step(weightEl, -0.1, updateBmi, ctx));
  $('#w-inc')!.addEventListener('click', () => step(weightEl, 0.1, updateBmi, ctx));

  document.querySelectorAll<HTMLButtonElement>('[data-stamp]').forEach((b) =>
    b.addEventListener('click', () => {
      const t = b.dataset.stamp as StampType;
      if (selectedStamps.has(t)) selectedStamps.delete(t);
      else selectedStamps.add(t);
      $$stamps();
    }),
  );

  $('#f-save')!.addEventListener('click', () => save(ctx));
  $('#f-delete')!.addEventListener('click', async () => {
    const date = dateEl.value;
    if (confirm(`${date} の記録を削除しますか？`)) {
      await deleteByDate(date);
      toast('削除しました');
      ctx.editDate = todayStr();
      await ctx.reload();
    }
  });

  loadDate(dateEl.value);
}

function setVal(sel: string, v: number | undefined): void {
  const el = $<HTMLInputElement>(sel);
  if (el) el.value = v != null ? String(v) : '';
}

function step(el: HTMLInputElement, delta: number, cb: () => void, ctx: AppContext): void {
  const cur = numOrNull(el.value) ?? (ctx.records.length ? ctx.records[ctx.records.length - 1].weightKg : 60);
  el.value = (Math.round((cur + delta) * 10) / 10).toFixed(1);
  cb();
}

async function save(ctx: AppContext): Promise<void> {
  const date = $<HTMLInputElement>('#f-date')!.value;
  const weight = numOrNull($<HTMLInputElement>('#f-weight')!.value);
  if (!date) return toast('日付を入力してください');
  if (weight == null || weight <= 0 || weight > 500) return toast('体重を正しく入力してください');

  await saveRecord(
    {
      measuredAt: date,
      weightKg: Math.round(weight * 10) / 10,
      bodyFatPercent: optVal('#f-fat'),
      muscleMassKg: optVal('#f-muscle'),
      waistCm: optVal('#f-waist'),
      memo: ($<HTMLTextAreaElement>('#f-memo')!.value || '').trim() || undefined,
      stamps: Array.from(selectedStamps),
    },
    ctx.settings.heightCm,
  );
  toast('保存しました ✓');
  ctx.editDate = todayStr();
  await ctx.reload();
}

function optVal(sel: string): number | undefined {
  const el = $<HTMLInputElement>(sel);
  if (!el) return undefined;
  const n = numOrNull(el.value);
  return n == null ? undefined : Math.round(n * 10) / 10;
}
