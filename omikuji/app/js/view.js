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

/** カードに出す一言。 */
function excerpt(entry) {
  return entry.poem || entry.overview || entry.teaching || entry.memo || '';
}

export function cardEl(entry, onOpen) {
  const li = el('li');
  const btn = el('button', 'card');
  btn.type = 'button';
  btn.dataset.id = entry.id;   // 詳細を閉じたときにここへフォーカスを戻す

  const top = el('div', 'card__top');
  top.appendChild(el('span', 'card__date', formatDate(entry.date)));
  if (entry.edited) top.appendChild(el('span', 'card__tag', '手直しあり'));
  // 神社名の推定はほぼ全件に付くため一覧には出さない（同じ札が並ぶと識別の助けにならない）。
  // 根拠は詳細の「この記録について」に残してある。
  if (entry.dateEstimated) top.appendChild(el('span', 'card__tag', '日付は推定'));
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
  const inner = el('div', 'detail__inner');

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

  if (entry.memo) {
    inner.appendChild(section('メモ', el('p', 'd-text', entry.memo)));
  }

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

  // どこまで確かな記録なのかを最後に添える（7 実証と推測を混ぜない）
  const notes = [];
  if (entry.dateEstimated) notes.push(`日付は推定です。${entry.dateNote || ''}`.trim());
  [entry.fortuneNote, entry.shrineNote, entry.note].forEach((n) => { if (n) notes.push(n); });
  if (entry.sourcePhotos && entry.sourcePhotos.length) {
    notes.push(`書き起こしの元にした写真: ${entry.sourcePhotos.join(' / ')}`);
  }
  if (notes.length || onRevert) {
    const wrap = el('div', 'd-section');
    wrap.appendChild(el('p', 'd-label', 'この記録について'));
    if (onRevert) {
      wrap.appendChild(el('p', 'd-note', 'この記録は書き起こしのあとに手直しされています。'));
    }
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
