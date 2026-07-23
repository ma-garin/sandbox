// カレンダー表示（記録済み/未記録の月表示 / FR-103）。履歴タブ内で切替。
import type { AppContext } from './context';
import { recordedDateSet, monthRecordRate } from '../lib/calc';
import { todayStr } from './dom';

let viewMonth = ''; // 'YYYY-MM'

const pad = (n: number) => String(n).padStart(2, '0');
const WD = ['日', '月', '火', '水', '木', '金', '土'];

export function renderCalendar(ctx: AppContext, container: HTMLElement): void {
  if (!viewMonth) viewMonth = (ctx.records.length ? ctx.records[ctx.records.length - 1].measuredAt : todayStr()).slice(0, 7);
  const recorded = recordedDateSet(ctx.records);
  const [y, m] = viewMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startWd = first.getDay();
  const days = new Date(y, m, 0).getDate();
  const today = todayStr();
  const rate = monthRecordRate(ctx.records, viewMonth, today);
  const countThisMonth = ctx.records.filter((r) => r.measuredAt.slice(0, 7) === viewMonth).length;

  const cells: string[] = [];
  for (let i = 0; i < startWd; i++) cells.push('<div class="cal-cell empty"></div>');
  for (let d = 1; d <= days; d++) {
    const iso = `${viewMonth}-${pad(d)}`;
    const has = recorded.has(iso);
    const isToday = iso === today;
    cells.push(
      `<button class="cal-cell${has ? ' has' : ''}${isToday ? ' today' : ''}" data-date="${iso}">
         <span class="cal-d">${d}</span>${has ? '<span class="cal-dot"></span>' : ''}
       </button>`,
    );
  }

  container.innerHTML = `
    <div class="cal-head">
      <button class="cal-nav" data-nav="-1" aria-label="前の月">‹</button>
      <div class="cal-title">${y}年${m}月<span class="cal-rate">記録 ${countThisMonth}日 / ${rate}%</span></div>
      <button class="cal-nav" data-nav="1" aria-label="次の月">›</button>
    </div>
    <div class="cal-grid cal-wd">${WD.map((w, i) => `<div class="cal-wdc${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}">${w}</div>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>
    <p class="hint">記録がある日は緑。日付をタップするとその日を編集できます。</p>`;

  container.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => {
      viewMonth = shiftMonth(viewMonth, Number(b.dataset.nav));
      renderCalendar(ctx, container);
    }),
  );
  container.querySelectorAll<HTMLButtonElement>('[data-date]').forEach((b) =>
    b.addEventListener('click', () => ctx.go('record', b.dataset.date)),
  );
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** 履歴タブが再表示されたときにカレンダーの表示月を初期化する */
export function resetCalendarMonth(): void {
  viewMonth = '';
}
