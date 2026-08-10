/**
 * DOM を組み立てるだけの層。状態は持たない。
 * innerHTML に文字列を差し込まず、必ず textContent を通す（写し取った本文をそのまま扱うため）。
 */

import { TYPE_OMIKUJI, TYPE_VISIT } from './store.js';

const TOP_FORTUNE = '大吉';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** 2026-08-09 → 2026.08.09 。数字を読みやすく揃える。 */
export function formatDate(iso) {
  return iso.replace(/-/g, '.');
}

/** 一覧・詳細で共通して使う、状態を表すラベル（4-15）。 */
export function badgeEl(entry) {
  if (entry.type === TYPE_VISIT) return el('span', 'fortune fortune--visit', '参拝');
  if (entry.type !== TYPE_OMIKUJI) return el('span', 'fortune fortune--none', 'その他');
  if (!entry.fortune) return el('span', 'fortune fortune--none', '吉凶なし');
  const node = el('span', 'fortune', entry.fortune);
  if (entry.fortune === TOP_FORTUNE) node.classList.add('fortune--top');
  return node;
}

/** カードの見出しにあたる部分。おみくじは番号、それ以外は題。 */
function headingText(entry) {
  if (entry.type === TYPE_OMIKUJI) return entry.number || 'おみくじ';
  return entry.title || (entry.type === TYPE_VISIT ? '参拝' : 'その他');
}

function excerpt(entry) {
  return entry.poem || entry.overview || entry.teaching || entry.memo || '';
}

/** 本文が一つも読み取れていない記録。開く前に分かるようにする。 */
function isUnreadable(entry) {
  if (entry.type !== TYPE_OMIKUJI) return false;
  const hasBody = entry.poem || entry.overview || entry.teaching;
  const hasItem = (entry.items || []).some((i) => i.value);
  return !hasBody && !hasItem;
}

export function cardEl(entry, onOpen) {
  const li = el('li');
  const btn = el('button', 'card');
  btn.type = 'button';
  btn.dataset.id = entry.id;   // 詳細を閉じたときにここへフォーカスを戻す

  const top = el('div', 'card__top');
  top.appendChild(el('span', 'card__date', formatDate(entry.date)));
  if (entry.dateEstimated) top.appendChild(el('span', 'card__tag', '日付は推定'));
  if (isUnreadable(entry)) top.appendChild(el('span', 'card__tag card__tag--warn', '本文未判読'));
  if (entry.edited) top.appendChild(el('span', 'card__tag', '手直しあり'));
  if (entry.source === 'user') top.appendChild(el('span', 'card__tag card__tag--mine', '自分の記録'));
  btn.appendChild(top);

  const title = el('h3', 'card__title');
  title.appendChild(badgeEl(entry));
  title.appendChild(el('span', 'card__no', headingText(entry)));
  btn.appendChild(title);

  const shrine = entry.shrine || (entry.type === TYPE_OMIKUJI ? '神社名の記載なし' : '');
  if (shrine) btn.appendChild(el('p', 'card__shrine', shrine));

  const ex = excerpt(entry);
  if (ex) btn.appendChild(el('p', 'card__excerpt', ex));

  btn.addEventListener('click', () => onOpen(entry));
  li.appendChild(btn);
  return li;
}

/** 年の区切り見出し。スクロール中の現在位置も兼ねる（5-10 一覧を見やすくする） */
export function yearHeaderEl(year, count) {
  const li = el('li', 'year');
  li.appendChild(el('span', 'year__label', `${year}年`));
  li.appendChild(el('span', 'year__count', `${count}件`));
  return li;
}

/* ============================================================
   参拝カレンダー
   お参りした日を月ごとに見る。おみくじの吉凶は記録一覧の担当なので、
   ここでは「いつ・どこへ行ったか」だけを扱う。
   ============================================================ */

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 神社名はマスに収まらないので、見出しになる部分だけ残す。 */
function chipLabel(entry) {
  if (entry.shrine) return entry.shrine.replace(/（.*?）/g, '').replace(/\s+/g, '').slice(0, 6);
  if (entry.type === TYPE_OMIKUJI) return 'おみくじ';
  if (entry.type === TYPE_VISIT) return '参拝';
  return 'その他';
}

/** 札の色分け。おみくじ / 参拝だけ / それ以外。 */
function chipKind(entry) {
  if (entry.type === TYPE_OMIKUJI) return 'is-omikuji';
  if (entry.type === TYPE_VISIT) return 'is-visit';
  return 'is-other';
}

/**
 * @param {Array} entries すべての記録
 * @param {string} month  'YYYY-MM'
 * @param {string} today  'YYYY-MM-DD'
 * @param {Function} onPick 日の記録を開くときに呼ぶ
 */
export function calendarEl(entries, month, today, onPick) {
  const [y, m] = month.split('-').map(Number);

  const byDate = new Map();
  entries.forEach((e) => {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  });

  const grid = document.createDocumentFragment();

  DOW.forEach((label, i) => {
    const cell = el('span', 'cal__dow', label);
    if (i === 0) cell.classList.add('is-sun');
    if (i === 6) cell.classList.add('is-sat');
    grid.appendChild(cell);
  });

  const firstDow = new Date(y, m - 1, 1).getDay();
  const daysThis = new Date(y, m, 0).getDate();
  const daysPrev = new Date(y, m - 1, 0).getDate();
  const totalCells = Math.ceil((firstDow + daysThis) / 7) * 7;

  for (let i = 0; i < totalCells; i += 1) {
    const offset = i - firstDow;
    let cy = y;
    let cm = m;
    let cd = offset + 1;
    let outside = false;

    if (offset < 0) {            // 前の月のはみ出し
      cd = daysPrev + offset + 1;
      cm = m - 1; if (cm === 0) { cm = 12; cy -= 1; }
      outside = true;
    } else if (offset >= daysThis) {   // 次の月のはみ出し
      cd = offset - daysThis + 1;
      cm = m + 1; if (cm === 13) { cm = 1; cy += 1; }
      outside = true;
    }

    const date = ymd(cy, cm, cd);
    const hits = byDate.get(date) || [];
    const dow = i % 7;

    const cell = el('div', 'cal__day');
    if (outside) cell.classList.add('is-outside');
    if (date === today) cell.classList.add('is-today');
    if (hits.length) cell.classList.add('has-visit');

    const num = el('span', 'cal__num', cd);
    if (dow === 0) num.classList.add('is-sun');
    if (dow === 6) num.classList.add('is-sat');
    cell.appendChild(num);

    hits.forEach((entry) => {
      const chip = el('button', 'cal__chip', chipLabel(entry));
      chip.type = 'button';
      chip.classList.add(chipKind(entry));
      const label = `${date} ${entry.shrine || '神社名の記載なし'}`;
      chip.setAttribute('aria-label', label);
      chip.title = label;
      chip.addEventListener('click', () => onPick(entry));
      cell.appendChild(chip);
    });

    grid.appendChild(cell);
  }

  return grid;
}

/** 何が塗られているかの説明。該当する種類だけ出す。 */
export function calendarLegendEl(entries) {
  const kinds = new Set(entries.map(chipKind));
  const wrap = el('div', 'legend');
  [
    ['is-omikuji', 'おみくじを引いた日'],
    ['is-visit', 'お参りだけした日'],
    ['is-other', 'その他の記録'],
  ].forEach(([cls, label]) => {
    if (!kinds.has(cls)) return;
    const item = el('span', 'legend__item');
    item.append(el('i', `legend__chip ${cls}`), el('span', null, label));
    wrap.appendChild(item);
  });
  return wrap;
}

/* ============================================================
   TOP の訪問記録
   ============================================================ */

export function visitsEl(entries, onPick) {
  const counts = new Map();
  entries.forEach((e) => {
    const name = e.shrine || '神社名の記載なし';
    const cur = counts.get(name) || { n: 0, last: '' };
    counts.set(name, { n: cur.n + 1, last: e.date > cur.last ? e.date : cur.last });
  });

  // 回数の多い順。ただし神社名が分からないものは、社名のある行の後ろへ回す
  const UNKNOWN = '神社名の記載なし';
  const rows = [...counts.entries()].sort((a, b) => {
    if ((a[0] === UNKNOWN) !== (b[0] === UNKNOWN)) return a[0] === UNKNOWN ? 1 : -1;
    return b[1].n - a[1].n;
  });
  const max = rows.length ? Math.max(...rows.map(([, i]) => i.n)) : 1;

  const frag = document.createDocumentFragment();
  rows.forEach(([name, info]) => {
    const li = el('li');
    const btn = el('button', 'visit');
    btn.type = 'button';

    const head = el('div', 'visit__head');
    head.appendChild(el('span', 'visit__name', name));
    head.appendChild(el('span', 'visit__n', `${info.n}回`));
    btn.appendChild(head);

    const bar = el('div', 'visit__bar');
    const fill = el('i');
    fill.style.width = `${Math.round((info.n / max) * 100)}%`;
    bar.appendChild(fill);
    btn.appendChild(bar);

    btn.appendChild(el('p', 'visit__last', `最後にお参りしたのは ${formatDate(info.last)}`));
    btn.addEventListener('click', () => onPick(name));
    li.appendChild(btn);
    frag.appendChild(li);
  });
  return frag;
}

/* ============================================================
   詳細
   ============================================================ */

function section(label, node) {
  const wrap = el('div', 'd-section');
  wrap.appendChild(el('p', 'd-label', label));
  wrap.appendChild(node);
  return wrap;
}

/**
 * @param {object} entry
 * @param {object} [options]
 * @param {Array}  [options.sameNumber] 同じ神社で同じ番号を引いた他の回
 * @param {Function} [options.onOpen]   その回へ移動するときに呼ぶ
 * @param {Function} [options.onRevert] 手直しを取り消すときに呼ぶ（手直しがある場合のみ）
 */
export function detailEl(entry, options = {}) {
  const { sameNumber = [], onOpen, onRevert } = options;
  const inner = el('div', 'sheet__inner');

  const head = el('div', 'd-head');
  head.appendChild(badgeEl(entry));
  head.appendChild(el('h2', 'd-title', headingText(entry)));
  inner.appendChild(head);

  // 日付は上のバーに出ているので、ここでは繰り返さない
  const meta = entry.shrine || (entry.type === TYPE_OMIKUJI ? '神社名の記載なし' : '');
  if (meta) inner.appendChild(el('p', 'd-shrine', meta));

  // 毎月引いていると同じ番号に当たることがある。読み返しで一番おもしろいところなので目立たせる。
  if (sameNumber.length) {
    const box = el('div', 'same');
    box.appendChild(el('p', 'same__label', `同じ番号を${sameNumber.length + 1}回引いています`));
    const row = el('div', 'same__links');
    sameNumber.forEach((other) => {
      const b = el('button', 'same__link', formatDate(other.date));
      b.type = 'button';
      if (onOpen) b.addEventListener('click', () => onOpen(other));
      row.appendChild(b);
    });
    box.appendChild(row);
    inner.appendChild(box);
  }

  if (isUnreadable(entry)) {
    inner.appendChild(el('p', 'd-warn', 'この記録は写真の印字が読み取れず、本文が入っていません。撮り直して書き足せます。'));
  }

  if (entry.poem) {
    const wrap = section('歌', el('p', 'd-poem', entry.poem));
    if (entry.poemAuthor) wrap.appendChild(el('p', 'd-note', `作者: ${entry.poemAuthor}`));
    inner.appendChild(wrap);
  }

  if (entry.teaching && entry.teaching !== '恋の歌') {
    inner.appendChild(section('訓', el('p', 'd-text', entry.teaching)));
  }

  if (entry.overview) {
    const label = entry.type === TYPE_OMIKUJI ? '運勢' : '内容';
    const wrap = section(label, el('p', 'd-text', entry.overview));
    if (entry.overviewNote) wrap.appendChild(el('p', 'd-note', entry.overviewNote));
    inner.appendChild(wrap);
  } else if (entry.overviewNote) {
    inner.appendChild(section('運勢', el('p', 'd-note', entry.overviewNote)));
  }

  if (entry.memo) inner.appendChild(section('メモ', el('p', 'd-text', entry.memo)));

  if (entry.items && entry.items.length) {
    const dl = el('div', 'd-items');
    entry.items.forEach((item) => {
      const row = el('div', 'd-item');
      row.appendChild(el('div', 'd-item__k', item.label));
      if (item.value) {
        row.appendChild(el('div', 'd-item__v', item.value));
      } else {
        row.appendChild(el('div', 'd-item__v d-item__v--empty', '読み取れず'));
      }
      dl.appendChild(row);
    });
    inner.appendChild(section('判断', dl));
  }

  // どこまで確かな記録なのかを最後に添える
  const notes = [];
  if (entry.dateEstimated) notes.push(`日付は推定です。${entry.dateNote || ''}`.trim());
  [entry.fortuneNote, entry.shrineNote, entry.note].forEach((n) => { if (n) notes.push(n); });
  if (entry.sourcePhotos && entry.sourcePhotos.length) {
    notes.push(`書き起こしの元にした写真: ${entry.sourcePhotos.join(' / ')}`);
  }
  if (notes.length || onRevert) {
    const wrap = el('div', 'd-section');
    wrap.appendChild(el('p', 'd-label', 'この記録について'));
    if (onRevert) wrap.appendChild(el('p', 'd-note', 'この記録は書き起こしのあとに手直しされています。'));
    notes.forEach((n) => wrap.appendChild(el('p', 'd-note', n)));
    if (onRevert) {
      const b = el('button', 'linkbtn', '書き起こしたときの内容に戻す');
      b.type = 'button';
      b.addEventListener('click', onRevert);
      wrap.appendChild(b);
    }
    inner.appendChild(wrap);
  }

  return inner;
}

/** 設定画面の数え上げ。 */
export function statsEl(rows) {
  const frag = document.createDocumentFragment();
  rows.forEach(([label, value]) => {
    frag.appendChild(el('dt', null, label));
    frag.appendChild(el('dd', null, value));
  });
  return frag;
}
