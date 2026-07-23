// SCR-04 履歴（日付降順・編集・削除・検索）+ カレンダー表示（FR-103）
import type { AppContext } from './context';
import { STAMP_DEFS } from '../types';
import { roundTo } from '../lib/calc';
import { $, esc, fmtDateShort, weekday, signed, deltaClass } from './dom';
import { renderCalendar } from './calendar';

let query = '';
let mode: 'list' | 'calendar' = 'list';

export function renderHistory(ctx: AppContext, mount: HTMLElement): void {
  mount.innerHTML = `
    <h2 class="view-title">履歴 <span class="badge-count">${ctx.records.length}件</span></h2>
    <div class="seg" id="hist-mode" style="margin-bottom:14px">
      <button data-mode="list" aria-pressed="${mode === 'list'}">📋 リスト</button>
      <button data-mode="calendar" aria-pressed="${mode === 'calendar'}">🗓 カレンダー</button>
    </div>
    <div id="hist-body"></div>`;

  $('#hist-mode')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mode]');
    if (!b) return;
    mode = b.dataset.mode as 'list' | 'calendar';
    renderHistory(ctx, mount);
  });

  const body = $('#hist-body')!;
  if (mode === 'calendar') {
    const box = document.createElement('div');
    box.className = 'card';
    body.appendChild(box);
    renderCalendar(ctx, box);
    return;
  }

  body.innerHTML = `
    <div class="search">
      <input type="text" id="hist-search" placeholder="🔍 日付・メモで検索（例: 2026-07, ジム）" value="${esc(query)}">
    </div>
    <div class="card" style="padding:8px 14px"><div id="hist-list"></div></div>`;
  const input = $<HTMLInputElement>('#hist-search')!;
  input.addEventListener('input', () => {
    query = input.value.trim();
    drawList(ctx);
  });
  drawList(ctx);
}

function drawList(ctx: AppContext): void {
  const list = $('#hist-list');
  if (!list) return;
  const sorted = ctx.records; // 昇順
  const q = query.toLowerCase();
  const rows: string[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    if (q && !(r.measuredAt.includes(q) || (r.memo ?? '').toLowerCase().includes(q))) continue;
    const d = prev ? roundTo(r.weightKg - prev.weightKg, 1) : null;
    const stamps = r.stamps.map((s) => STAMP_DEFS.find((x) => x.type === s)?.emoji ?? '').join('');
    const metaBits = [
      r.bodyFatPercent != null ? `📊${r.bodyFatPercent.toFixed(1)}%` : '',
      stamps,
      esc(r.memo ?? ''),
    ].filter(Boolean).join(' ');
    rows.push(`
      <div class="rec">
        <div class="date"><b>${fmtDateShort(r.measuredAt)}</b>${weekday(r.measuredAt)}</div>
        <div class="w">${r.weightKg.toFixed(1)}<small> kg</small></div>
        <div class="delta ${deltaClass(d)}">${d == null ? '' : signed(d)}</div>
        <div class="meta">${metaBits}</div>
        <button class="edit" data-edit="${r.measuredAt}" aria-label="編集">✎</button>
      </div>`);
  }
  list.innerHTML = rows.length
    ? rows.join('')
    : `<div class="empty"><div class="e">📋</div><p>${query ? '該当する記録がありません' : '記録がありません'}</p></div>`;

  list.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => ctx.go('record', b.dataset.edit)),
  );
}
