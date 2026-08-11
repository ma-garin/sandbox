/**
 * DOM を組み立てるだけの層。状態は持たない。
 * innerHTML に文字列を差し込まず、必ず textContent を通す（写し取った本文をそのまま扱うため）。
 */

import { TYPE_OMIKUJI, TYPE_VISIT } from './store.js';
import { holidayName } from './holidays.js';
import { dayInfo, moonEvent, eto } from './koyomi.js';
import { rokusei, honmeisei, kenki, compat, SHRINE_ATTR } from './fortune.js';

const TOP_FORTUNE = '大吉';
const UNKNOWN_SHRINE = '場所の記載なし';

/* ---------- 暦注（六曜・吉日・月の満ち欠け） ---------- */

// 旧暦は反復計算なので、同じ日を何度も引かないよう覚えておく。
const koyomiCache = new Map();

// 中間の呼び名（三日月・十三夜など）まで並べると1マスに毎日文字が入り、
// 記録の札が読めなくなるので、節目の4つだけにする。
const MOON_MARKS = { 新月: '●', 上弦: '◐', 満月: '○', 下弦: '◑' };

function koyomiOf(date) {
  let hit = koyomiCache.get(date);
  if (!hit) {
    const [y, m, d] = date.split('-').map(Number);
    const phase = moonEvent(y, m, d);
    hit = { ...dayInfo(date), phase, mark: phase ? MOON_MARKS[phase] : null };
    koyomiCache.set(date, hit);
  }
  return hit;
}

const ROKUYOU_CLASS = { 大安: 'is-taian', 仏滅: 'is-butsumetsu' };

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
  const btn = el('button', 'row card');
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

    // 暦注。六曜は毎日、吉日は印、月相は変わり目の日だけ
    const koyomi = koyomiOf(date);
    const roku = el('span', `cal__roku ${ROKUYOU_CLASS[koyomi.rokuyou] || ''}`.trim(), koyomi.rokuyou);
    if (koyomi.mark) {
      const moonEl = el('i', 'cal__moon', koyomi.mark);
      moonEl.title = koyomi.phase;
      roku.appendChild(moonEl);
    }
    roku.title = `${koyomi.rokuyou}／旧暦${koyomi.kyureki.leap ? '閏' : ''}${koyomi.kyureki.month}月${koyomi.kyureki.day}日${koyomi.phase ? `／${koyomi.phase}` : ''}`;
    cell.appendChild(roku);

    if (koyomi.ichiryu || koyomi.tensha) {
      const marks = el('span', 'cal__marks');
      if (koyomi.tensha) {
        const t = el('i', 'cal__mark is-tensha');
        t.title = '天赦日';
        marks.appendChild(t);
      }
      if (koyomi.ichiryu) {
        const g = el('i', 'cal__mark is-ichiryu');
        g.title = '一粒万倍日';
        marks.appendChild(g);
      }
      cell.appendChild(marks);
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

  // 暦注の印。色だけでは何を指すか分からないので必ず添える
  [
    ['is-ichiryu', '一粒万倍日'],
    ['is-tensha', '天赦日'],
  ].forEach(([cls, label]) => {
    const item = el('span', 'legend__item');
    item.append(el('i', `legend__mark cal__mark ${cls}`), el('span', null, label));
    wrap.appendChild(item);
  });

  const note = el('span', 'legend__item legend__note', '● 新月 ◐ 上弦 ○ 満月 ◑ 下弦');
  wrap.appendChild(note);
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
    const btn = el('button', 'row visit');
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

/**
 * ひとつの寺社について、いつ行ったかを並べる。
 * 座標は持たない（こちらで書くと誤った場所を指しかねない）。
 * 地図は寺社名で開き、検索は地図アプリに任せる。
 */
export function shrineSheetEl(name, entries, onOpen) {
  const inner = el('div', 'sheet__inner');

  const visits = entries
    .filter((e) => isVisit(e) && (e.shrine || UNKNOWN_SHRINE) === name)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const days = [...new Set(visits.map((e) => e.date))];

  inner.appendChild(el('h2', 'shrine__name', name));
  inner.appendChild(el('p', 'shrine__count', `${days.length}日 ・ ${visits.length}件`));

  if (name !== UNKNOWN_SHRINE) {
    const a = el('a', 'shrine__map', '地図で開く');
    a.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    inner.appendChild(a);
  }

  const list = el('ul', 'shrine__days');
  visits.forEach((entry) => {
    const li = el('li');
    const btn = el('button', 'row row--flat shrine__day');
    btn.type = 'button';

    // 日付・吉凶・番号を別々の列に置く。まとめて右へ寄せると幅の差で行がガタつく。
    btn.appendChild(el('span', 'shrine__date', formatDate(entry.date) + (entry.time ? ` ${entry.time}` : '')));

    if (entry.type === TYPE_OMIKUJI) {
      btn.appendChild(badgeEl(entry));
      btn.appendChild(el('span', 'shrine__no', entry.number || ''));
    } else {
      btn.appendChild(el('span', null, ''));   // 吉凶の列は空けておく
      btn.appendChild(el('span', 'shrine__no', entry.purpose || 'お参り'));
    }

    btn.addEventListener('click', () => onOpen(entry));
    li.appendChild(btn);
    list.appendChild(li);
  });
  inner.appendChild(list);

  return inner;
}

/** 訪問記録タブの1行。日付・時間・場所・目的・おみくじ・賽銭・購入品・メモ。 */
export function visitRowEl(entry, onOpen) {
  const li = el('li');
  const btn = el('button', 'row vrow');
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

/* ---------- 暦と相性 ---------- */

/** ラベルと値を1行に。一覧の行は .row に寄せる決まりなので、それに従う */
function factRow(label, value, weak) {
  const row = el('div', 'row row--flat row--fact');
  row.append(el('span', 'row__label', label), el('span', `row__value${weak ? ' is-weak' : ''}`, value));
  return row;
}

/** 生年月日から出る4つ。血液型がなくても3つは出す */
export function fortuneCardsEl(birth, blood) {
  const [y, m, d] = birth.split('-').map(Number);
  const r = rokusei(y, m, d);
  const k = honmeisei(y, m, d);
  const ken = kenki(birth, blood);

  const wrap = el('div', 'surface');
  wrap.appendChild(factRow('六星占術', r.reigo ? `${r.name}（霊合星人）` : r.name));
  wrap.appendChild(factRow('九星（本命星）', k.name));
  wrap.appendChild(factRow('生まれた日の干支', `${eto(y, m, d)}（星数 ${r.starNumber}）`));
  wrap.appendChild(factRow('繭気属性', ken ? `${ken.attr}（${ken.number}）` : '血液型を選ぶと出る', !ken));

  if (k.beforeRisshun) {
    wrap.appendChild(el('p', 'surface__note', `九星は立春で年が変わる。この日は立春より前なので ${k.year} 年として数えている。`));
  }
  return wrap;
}

/** 参拝した社と、その属性・相性。属性が分からない社も隠さず出す */
export function fortuneCompatEl(entries, mine) {
  const counts = new Map();
  entries.forEach((e) => {
    const name = e.shrine;
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });

  const wrap = el('div', 'surface');
  if (!counts.size) {
    wrap.appendChild(el('p', 'surface__note', '場所を記録すると、ここに相性が出る。'));
    return wrap;
  }

  // 社名は省略したくないので、社名と回数で1行、属性と相性で次の行に分ける。
  // 1行に押し込むと「神田明神（江戸総鎮守）」のような長い名が折り返して値とぶつかる。
  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([name, n]) => {
    const info = SHRINE_ATTR[name];
    const row = el('div', 'row row--flat row--shrine');
    row.appendChild(el('span', 'row__label', name));
    row.appendChild(el('span', 'row__sub', `${n}回`));

    if (!info) {
      row.appendChild(el('span', 'row__value is-weak', '資料で確認できず'));
    } else {
      const c = compat(mine, info.attr);
      const val = el('span', 'row__value');
      val.append(el('b', `attr attr--${info.attr}`, info.attr));
      if (mine) val.append(el('span', `compat is-${c.level}`, c.label));
      row.appendChild(val);
    }
    if (info && (info.note || info.unverified)) {
      row.appendChild(el('p', 'row__note', info.unverified ? `${info.note}（未確認）` : info.note));
    }
    wrap.appendChild(row);
  });

  if (!mine) {
    wrap.appendChild(el('p', 'surface__note', '生年月日と血液型を入れると、相性も出る。'));
  }
  return wrap;
}

/**
 * 出どころ。3つで典拠の強さがまるで違うので、それを隠さずに書く。
 * ここを削ると、確かめた話と占い師が決めた話が同じ顔で並ぶことになる。
 */
export function fortuneSourceEl() {
  const wrap = document.createDocumentFragment();
  [
    ['六星占術',
      '細木数子が考案した占術。運命数表（1950〜2030年）の972値すべてが「生まれた日の干支」と一致することを確かめたので、表は持たず干支から出している。',
      'https://fortune.netoff.co.jp/rokusei/keisan/'],
    ['九星（本命星）',
      '算法が公開されている。西暦の各桁を足して1桁にし、11から引く。立春で年が変わる。月命星は算法を確かめていないので入れていない。',
      null],
    ['繭気属性',
      '「最近になって占い師が考え出したもので、ほとんどの神職や僧侶は自分の社寺の属性を知らない」と資料自身が書いている。提唱者も初出も確かめられなかった。神社の属性は書き手の解釈で、神社が定めたものではない。',
      'https://jinjabukkaku-arekore.com/tokyo-daijingu-attributes/'],
  ].forEach(([title, body, url]) => {
    const box = el('div', 'source');
    box.appendChild(el('h3', 'source__title', title));
    box.appendChild(el('p', 'source__body', body));
    if (url) {
      const a = el('a', 'source__link', url.replace(/^https?:\/\//, '').split('/')[0]);
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      box.appendChild(a);
    }
    wrap.appendChild(box);
  });
  return wrap;
}
