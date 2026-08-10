/**
 * DOM を組み立てるだけの層。状態は持たない。
 * innerHTML に文字列を差し込まず、必ず textContent を通す（写し取った本文をそのまま扱うため）。
 */

import { TYPE_OMIKUJI, TYPE_VISIT } from './store.js';
import { holidayName } from './holidays.js';

const TOP_FORTUNE = '大吉';
const UNKNOWN_SHRINE = '場所の記載なし';

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

/** 参拝として数える記録か。貼り紙の写真などは参拝ではない。 */
function isVisit(entry) {
  return entry.type === TYPE_OMIKUJI || entry.type === TYPE_VISIT;
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
  btn.dataset.id = entry.id;

  const top = el('div', 'card__top');
  top.appendChild(el('span', 'card__date', formatDate(entry.date) + (entry.time ? ` ${entry.time}` : '')));
  if (entry.dateEstimated) top.appendChild(el('span', 'card__tag', '日付は推定'));
  if (isUnreadable(entry)) top.appendChild(el('span', 'card__tag card__tag--warn', '本文未判読'));
  if (entry.edited) top.appendChild(el('span', 'card__tag', '手直しあり'));
  if (entry.source === 'user') top.appendChild(el('span', 'card__tag card__tag--mine', '自分の記録'));
  btn.appendChild(top);

  const title = el('h3', 'card__title');
  title.appendChild(badgeEl(entry));
  title.appendChild(el('span', 'card__no', headingText(entry)));
  btn.appendChild(title);

  const shrine = entry.shrine || (entry.type === TYPE_OMIKUJI ? UNKNOWN_SHRINE : '');
  if (shrine) btn.appendChild(el('p', 'card__shrine', shrine));

  const ex = excerpt(entry);
  if (ex) {
    const p = el('p', 'card__excerpt', ex);
    // 歌は5句で1つの文なので途中で切らない。長い運勢本文だけ2行に丸める。
    if (entry.poem && ex === entry.poem) p.classList.add('card__excerpt--poem');
    btn.appendChild(p);
  }

  btn.addEventListener('click', () => onOpen(entry));
  li.appendChild(btn);
  return li;
}

/** 年の区切り見出し（5-10 一覧を見やすくする） */
export function yearHeaderEl(year, count) {
  const li = el('li', 'year');
  li.appendChild(el('span', 'year__label', `${year}年`));
  li.appendChild(el('span', 'year__count', `${count}件`));
  return li;
}

/* ============================================================
   参拝カレンダー
   お参りした日を月ごとに見る。おみくじの吉凶は「おみくじ」タブの担当。
   ============================================================ */

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 札は幅が狭い。社名の頭を2文字だけ出し、全文は title と詳細で見せる。 */
function chipLabel(entry) {
  if (entry.shrine) {
    const plain = entry.shrine.replace(/（.*?）/g, '').replace(/\s+/g, '');
    return plain.slice(0, 2);
  }
  if (entry.type === TYPE_OMIKUJI) return 'みくじ';
  if (entry.type === TYPE_VISIT) return '参拝';
  return '他';
}

function chipKind(entry) {
  if (entry.type === TYPE_OMIKUJI) return 'is-omikuji';
  if (entry.type === TYPE_VISIT) return 'is-visit';
  return 'is-other';
}

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

    if (offset < 0) {
      cd = daysPrev + offset + 1;
      cm = m - 1; if (cm === 0) { cm = 12; cy -= 1; }
      outside = true;
    } else if (offset >= daysThis) {
      cd = offset - daysThis + 1;
      cm = m + 1; if (cm === 13) { cm = 1; cy += 1; }
      outside = true;
    }

    const date = ymd(cy, cm, cd);
    const hits = byDate.get(date) || [];
    const dow = i % 7;
    const holiday = holidayName(date);

    // 記録がある日はマスごと押せるようにする（札だけだと指の的が小さすぎる）
    const cell = el(hits.length ? 'button' : 'div', 'cal__day');
    if (hits.length) {
      cell.type = 'button';
      const names = hits.map((h) => h.shrine || UNKNOWN_SHRINE).join('、');
      cell.setAttribute('aria-label', `${date} ${names}`);
      cell.addEventListener('click', () => onPick(hits[0]));
    }
    if (outside) cell.classList.add('is-outside');
    if (date === today) cell.classList.add('is-today');
    if (hits.length) cell.classList.add('has-visit');

    const num = el('span', 'cal__num', cd);
    // 祝日は日曜と同じ扱いで赤くする（暦の慣習）
    if (dow === 0 || holiday) num.classList.add('is-sun');
    else if (dow === 6) num.classList.add('is-sat');
    cell.appendChild(num);

    if (holiday) {
      const h = el('span', 'cal__holiday', holiday);
      h.title = holiday;
      cell.appendChild(h);
    }

    // 札は見た目だけ。押す的はマス全体（上の button）が引き受ける
    hits.forEach((entry) => {
      const chip = el('span', 'cal__chip', chipLabel(entry));
      chip.classList.add(chipKind(entry));
      chip.title = `${date} ${entry.shrine || UNKNOWN_SHRINE}`;
      cell.appendChild(chip);
    });

    grid.appendChild(cell);
  }

  return grid;
}

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
  wrap.appendChild(el('span', 'legend__note', '札は社名の頭2文字。押すとその記録が開きます'));
  return wrap;
}

/* ============================================================
   訪問記録
   ============================================================ */

/**
 * 神社ごとの参拝回数。
 * 数えるのは「行った日の数」。同じ日に複数の記録があっても1回とする
 * （おみくじを2つ引いた日を2回参拝したことにしない）。
 */
export function visitStats(entries) {
  const byShrine = new Map();
  entries.forEach((e) => {
    if (!isVisit(e)) return;
    const name = e.shrine || UNKNOWN_SHRINE;
    if (!byShrine.has(name)) byShrine.set(name, { days: new Set(), last: '' });
    const info = byShrine.get(name);
    info.days.add(e.date);
    if (e.date > info.last) info.last = e.date;
  });

  const rows = [...byShrine.entries()]
    .map(([name, info]) => ({ name, count: info.days.size, last: info.last }))
    .sort((a, b) => {
      if ((a.name === UNKNOWN_SHRINE) !== (b.name === UNKNOWN_SHRINE)) {
        return a.name === UNKNOWN_SHRINE ? 1 : -1;
      }
      return b.count - a.count;
    });

  const namedShrines = rows.filter((r) => r.name !== UNKNOWN_SHRINE).length;
  const totalDays = new Set(entries.filter(isVisit).map((e) => e.date)).size;

  return { rows, namedShrines, totalDays };
}

export function visitsEl(stats, onPick) {
  const max = stats.rows.length ? Math.max(...stats.rows.map((r) => r.count)) : 1;
  const frag = document.createDocumentFragment();

  stats.rows.forEach((row) => {
    const li = el('li');
    const btn = el('button', 'visit');
    btn.type = 'button';

    const head = el('div', 'visit__head');
    head.appendChild(el('span', 'visit__name', row.name));
    head.appendChild(el('span', 'visit__n', `${row.count}回`));
    btn.appendChild(head);

    const bar = el('div', 'visit__bar');
    const fill = el('i');
    fill.style.width = `${Math.round((row.count / max) * 100)}%`;
    bar.appendChild(fill);
    btn.appendChild(bar);

    btn.appendChild(el('p', 'visit__last', `最後にお参りしたのは ${formatDate(row.last)}`));
    btn.addEventListener('click', () => onPick(row.name));
    li.appendChild(btn);
    frag.appendChild(li);
  });
  return frag;
}

/** 訪問記録タブの1行。日付・時間・場所・目的・おみくじ・賽銭・購入品・メモ。 */
export function visitRowEl(entry, onOpen) {
  const li = el('li');
  const btn = el('button', 'vrow');
  btn.type = 'button';
  btn.dataset.id = entry.id;

  const head = el('div', 'vrow__head');
  const when = el('span', 'vrow__when', formatDate(entry.date));
  head.appendChild(when);
  if (entry.time) head.appendChild(el('span', 'vrow__time', entry.time));
  const hol = holidayName(entry.date);
  if (hol) head.appendChild(el('span', 'vrow__holiday', hol));
  btn.appendChild(head);

  btn.appendChild(el('p', 'vrow__place', entry.shrine || UNKNOWN_SHRINE));

  const facts = el('dl', 'vrow__facts');
  const addFact = (label, value) => {
    if (value == null || value === '') return;
    facts.appendChild(el('dt', null, label));
    facts.appendChild(el('dd', null, value));
  };

  addFact('目的', entry.purpose);
  if (entry.type === TYPE_OMIKUJI) {
    const parts = [entry.fortune, entry.number].filter(Boolean).join('　');
    addFact('おみくじ', parts || '引いた（吉凶の記載なし）');
  }
  if (entry.offering != null && entry.offering !== '') {
    addFact('賽銭', `${Number(entry.offering).toLocaleString('ja-JP')}円`);
  }
  addFact('購入品', entry.purchases);
  addFact('メモ', entry.memo);

  if (facts.childElementCount) btn.appendChild(facts);

  btn.addEventListener('click', () => onOpen(entry));
  li.appendChild(btn);
  return li;
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

export function detailEl(entry, options = {}) {
  const { sameNumber = [], onOpen, onRevert } = options;
  const inner = el('div', 'sheet__inner');

  const head = el('div', 'd-head');
  head.appendChild(badgeEl(entry));
  head.appendChild(el('h2', 'd-title', headingText(entry)));
  inner.appendChild(head);

  const meta = [entry.shrine || (entry.type === TYPE_OMIKUJI ? UNKNOWN_SHRINE : ''), entry.time]
    .filter(Boolean).join('　');
  if (meta) inner.appendChild(el('p', 'd-shrine', meta));

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
    inner.appendChild(el('p', 'd-warn', '写真の印字が薄く、本文を読み取れませんでした。「直す」から書き足せます。'));
  }

  // お参りそのものの記録
  const visitFacts = [
    ['目的', entry.purpose],
    ['賽銭', entry.offering != null && entry.offering !== '' ? `${Number(entry.offering).toLocaleString('ja-JP')}円` : null],
    ['購入品', entry.purchases],
  ].filter(([, v]) => v);
  if (visitFacts.length) {
    const dl = el('div', 'd-items');
    visitFacts.forEach(([k, v]) => {
      const row = el('div', 'd-item');
      row.appendChild(el('div', 'd-item__k', k));
      row.appendChild(el('div', 'd-item__v', v));
      dl.appendChild(row);
    });
    inner.appendChild(section('お参り', dl));
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

  const notes = [];
  if (entry.dateEstimated) notes.push(`日付は推定です。${entry.dateNote || ''}`.trim());
  if (entry.timeSource === 'photo') notes.push('時刻は写真を撮った時刻です。参拝そのものの時刻とは限りません。');
  [entry.fortuneNote, entry.shrineNote, entry.note].forEach((n) => { if (n) notes.push(n); });
  // sourcePhotos（元写真のファイル名）は画面に出さない。記録者本人には要らない情報で、
  // データの確かさにも関わらないため。控えは data/omikuji.json に残っている。
  if (notes.length || onRevert) {
    const wrap = el('div', 'd-section');
    wrap.appendChild(el('p', 'd-label', 'この記録について'));
    if (onRevert) wrap.appendChild(el('p', 'd-note', 'あとから手直しされています。'));
    notes.forEach((n) => wrap.appendChild(el('p', 'd-note', n)));
    if (onRevert) {
      const b = el('button', 'linkbtn', 'もとの内容に戻す');
      b.type = 'button';
      b.addEventListener('click', onRevert);
      wrap.appendChild(b);
    }
    inner.appendChild(wrap);
  }

  return inner;
}

export function statsEl(rows) {
  const frag = document.createDocumentFragment();
  rows.forEach(([label, value]) => {
    frag.appendChild(el('dt', null, label));
    frag.appendChild(el('dd', null, value));
  });
  return frag;
}
