/**
 * 画面の配線。状態はこのファイルの state 1つに集め、更新は必ず新しいオブジェクトを作る。
 */

import {
  FORTUNE_ORDER, TYPE_OMIKUJI, TYPE_VISIT,
  loadBuiltIn, loadUser, addUser, updateUser, removeUser,
  loadOverrides, setOverride, clearOverride, applyOverrides,
  isQuotaError, makeId, parseItems, formatItems, shrineSuggestions,
  introSeen, markIntroSeen,
  normalizeText, numberKey, sameNumberEntries, todayISO,
} from './store.js';
import { cardEl, detailEl, yearHeaderEl, formatDate } from './view.js';

const $ = (id) => document.getElementById(id);

/** チップの特別扱いする値。吉凶そのものではないもの。 */
const FILTER_VISIT = '参拝';
const FILTER_OTHER = 'その他';
const FILTER_NO_FORTUNE = '吉凶なし';

/** 書き起こし記録に重ねられる項目。これ以外は手直しの対象にしない。 */
const OVERRIDABLE = ['date', 'shrine', 'number', 'fortune', 'poem', 'overview', 'items', 'memo'];

const dom = {
  list: $('list'), empty: $('empty'), emptyTitle: $('empty-title'),
  emptyBody: $('empty-body'), emptyReset: $('empty-reset'),
  summary: $('summary'), search: $('search'), searchClear: $('search-clear'),
  chips: $('chips'),
  detail: $('detail'), detailBody: $('detail-body'), detailClose: $('detail-close'),
  detailDelete: $('detail-delete'), detailEdit: $('detail-edit'), detailBarLabel: $('d-barlabel'),
  detailPrev: $('detail-prev'), detailNext: $('detail-next'),
  prevLabel: $('prev-label'), nextLabel: $('next-label'),
  confirm: $('confirm'), confirmOk: $('confirm-ok'), confirmCancel: $('confirm-cancel'),
  confirmTitle: $('c-title'), confirmBody: $('c-body'),
  toast: $('toast'), form: $('form'), formHeading: $('form-heading'),
  formSubmit: $('form-submit'), formCancel: $('form-cancel'),
  fDate: $('f-date'), fShrine: $('f-shrine'), fNumber: $('f-number'),
  fFortune: $('f-fortune'), fPoem: $('f-poem'), fOverview: $('f-overview'),
  fItems: $('f-items'), fMemo: $('f-memo'),
  omikujiFields: $('omikuji-fields'), shrineList: $('shrine-list'),
  shrineReq: $('shrine-req'),
  eDate: $('e-date'), eShrine: $('e-shrine'),
  viewList: $('view-list'), viewAdd: $('view-add'),
  appbar: document.querySelector('.appbar'), tabbar: document.querySelector('.tabbar'),
};

let state = {
  builtin: [],      // data/omikuji.json をそのまま
  overrides: {},    // 書き起こし記録への手直し
  user: [],         // この端末で足した記録
  query: '',
  filter: null,     // null = 絞り込みなし
  openId: null,
  editingId: null,
  pending: null,    // 確認待ちの操作 { kind: 'delete' | 'revert', id }
};

let toastTimer = null;
let lastFocused = null;

// ---------- 状態 ----------

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

function allEntries() {
  return [...applyOverrides(state.builtin, state.overrides), ...state.user]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.id < b.id ? 1 : -1)));
}

function matchesFilter(entry, filter) {
  if (!filter) return true;
  if (filter === FILTER_VISIT) return entry.type === TYPE_VISIT;
  if (filter === FILTER_OTHER) return entry.type !== TYPE_OMIKUJI && entry.type !== TYPE_VISIT;
  if (filter === FILTER_NO_FORTUNE) return entry.type === TYPE_OMIKUJI && !entry.fortune;
  return entry.fortune === filter;
}

function matchesQuery(entry, query) {
  if (!query) return true;
  const hay = normalizeText([
    entry.shrine, entry.number, entry.fortune, entry.poem, entry.teaching,
    entry.overview, entry.title, entry.memo,
    entry.date,                 // 2025-03-09
    formatDate(entry.date),     // 画面に出ているのはこちらの形
    numberKey(entry.number),    // 「32」と打っても「第三十二番」に当たるように
    ...(entry.items || []).flatMap((i) => [i.label, i.value]),
  ].filter((v) => v != null && v !== '').join(' '));

  // 空白で区切ったら、その全部を含むものだけ（「東京 三十二」で絞れるように）
  return normalizeText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

/** いま画面に出ている順番。詳細の前後送りもこれを使う。 */
function visibleEntries() {
  return allEntries().filter((e) => matchesFilter(e, state.filter) && matchesQuery(e, state.query));
}

function findEntry(id) {
  return allEntries().find((e) => e.id === id) || null;
}

// ---------- 描画 ----------

function countsOf(entries) {
  const c = new Map();
  entries.forEach((e) => {
    let key;
    if (e.type === TYPE_VISIT) key = FILTER_VISIT;
    else if (e.type !== TYPE_OMIKUJI) key = FILTER_OTHER;
    else key = e.fortune || FILTER_NO_FORTUNE;
    c.set(key, (c.get(key) || 0) + 1);
  });
  return c;
}

function renderChips() {
  const entries = allEntries();
  const counts = countsOf(entries);

  const keys = FORTUNE_ORDER.filter((f) => counts.has(f));
  [FILTER_NO_FORTUNE, FILTER_VISIT, FILTER_OTHER].forEach((k) => { if (counts.has(k)) keys.push(k); });

  dom.chips.textContent = '';
  const makeChip = (label, value, count) => {
    const b = document.createElement('button');
    b.type = 'button';
    const on = state.filter === value;
    b.className = 'chip' + (on ? ' is-on' : '');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = label;
    if (count != null) {
      const n = document.createElement('span');
      n.className = 'chip__n';
      n.textContent = count;
      b.appendChild(n);
    }
    b.addEventListener('click', () => setState({ filter: on ? null : value }));
    return b;
  };

  dom.chips.appendChild(makeChip('すべて', null, entries.length));
  keys.forEach((k) => dom.chips.appendChild(makeChip(k, k, counts.get(k))));
}

function renderList() {
  const entries = allEntries();
  const shown = visibleEntries();

  dom.list.textContent = '';
  // 5-10 一覧を見やすくする: 年で区切って現在位置が分かるようにする
  let lastYear = null;
  shown.forEach((e) => {
    const year = e.date.slice(0, 4);
    if (year !== lastYear) {
      dom.list.appendChild(yearHeaderEl(year, shown.filter((x) => x.date.startsWith(year)).length));
      lastYear = year;
    }
    dom.list.appendChild(cardEl(e, openDetail));
  });

  const filtering = Boolean(state.query || state.filter);
  dom.empty.hidden = shown.length > 0;
  if (!shown.length) {
    dom.emptyTitle.textContent = filtering ? '見つかりませんでした' : 'まだ記録がありません';
    dom.emptyBody.textContent = filtering
      ? '別の言葉で探すか、絞り込みを外してみてください。'
      : '下の「記録」から、引いたおみくじやお参りを書きとめられます。';
    dom.emptyReset.hidden = !filtering;
  }

  const omikuji = entries.filter((e) => e.type === TYPE_OMIKUJI).length;
  const visits = entries.filter((e) => e.type === TYPE_VISIT).length;
  dom.summary.textContent = filtering
    ? `${shown.length}件を表示中（全${entries.length}件）`
    : `おみくじ${omikuji}件・参拝${visits}件・その他${entries.length - omikuji - visits}件`;

  dom.searchClear.hidden = !state.query;
}

function renderShrineSuggestions() {
  dom.shrineList.textContent = '';
  shrineSuggestions(allEntries()).forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    dom.shrineList.appendChild(opt);
  });
}

function render() {
  renderChips();
  renderList();
  renderShrineSuggestions();
  if (!dom.detail.hidden && state.openId) refreshDetail();
}

// ---------- 前面に出したときの背景の扱い ----------

/**
 * aria-modal を名乗る以上、背景へキーボードで移動できてはいけない。
 * inert を付けると、その中は Tab でもクリックでも触れなくなる。
 */
function setBackgroundInert(on) {
  [dom.appbar, dom.tabbar, dom.viewList, dom.viewAdd].forEach((node) => {
    if (node) node.inert = on;
  });
}

// ---------- 詳細 ----------

function openDetail(entry) {
  if (dom.detail.hidden) lastFocused = document.activeElement;
  state = { ...state, openId: entry.id };
  refreshDetail();
  dom.detailBody.scrollTop = 0;
  dom.detail.hidden = false;
  setBackgroundInert(true);
  document.body.style.overflow = 'hidden';
  dom.detailClose.focus();
}

/** 開いたままデータが変わったときにも作り直せるようにしておく。 */
function refreshDetail() {
  const entry = findEntry(state.openId);
  if (!entry) { closeDetail(); return; }

  dom.detailBody.textContent = '';
  dom.detailBody.appendChild(detailEl(entry, {
    sameNumber: sameNumberEntries(allEntries(), entry),
    onOpen: openDetail,
    onRevert: entry.edited ? () => askRevert(entry.id) : null,
  }));
  dom.detailBarLabel.textContent = formatDate(entry.date);

  // 書き起こした記録も手直しできる。ただし消せるのは自分で足したものだけ。
  dom.detailEdit.hidden = false;
  dom.detailDelete.hidden = entry.source !== 'user';

  const list = visibleEntries();
  const i = list.findIndex((e) => e.id === entry.id);
  dom.detailPrev.disabled = i <= 0;
  dom.detailNext.disabled = i < 0 || i >= list.length - 1;
  dom.prevLabel.textContent = i > 0 ? formatDate(list[i - 1].date) : 'これが最新';
  dom.nextLabel.textContent = i >= 0 && i < list.length - 1 ? formatDate(list[i + 1].date) : 'これが最初';
}

function step(delta) {
  const list = visibleEntries();
  const i = list.findIndex((e) => e.id === state.openId);
  const next = list[i + delta];
  if (next) openDetail(next);
}

function closeDetail() {
  dom.detail.hidden = true;
  setBackgroundInert(false);
  document.body.style.overflow = '';
  const id = state.openId;
  state = { ...state, openId: null };
  // 閉じたら元いた場所へ戻す。戻さないと現在地を見失う。
  const card = id && dom.list.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (card) card.focus();
  else if (lastFocused && lastFocused.isConnected) lastFocused.focus();
  lastFocused = null;
}

// ---------- トースト ----------

function toast(message) {
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 2600);
}

// ---------- 記録フォーム ----------

function selectedKind() {
  const checked = dom.form.querySelector('input[name="kind"]:checked');
  return checked ? checked.value : TYPE_OMIKUJI;
}

/** 種類によって出す欄を変える（4-05 なくてもわかるものは削る） */
function syncKindFields() {
  const kind = selectedKind();
  dom.omikujiFields.hidden = kind !== TYPE_OMIKUJI;
  dom.shrineReq.hidden = kind !== TYPE_VISIT;
  dom.fMemo.placeholder = kind === TYPE_VISIT
    ? 'お参りしたときのこと。天気、誰と行ったか、願ったことなど'
    : 'そのとき思ったこと、天気、誰と行ったかなど';
}

function setKind(kind) {
  const radio = dom.form.querySelector(`input[name="kind"][value="${kind}"]`);
  if (radio) radio.checked = true;
  syncKindFields();
}

function clearErrors() {
  [[dom.eDate, dom.fDate], [dom.eShrine, dom.fShrine]].forEach(([msg, input]) => {
    msg.hidden = true;
    input.closest('.field').classList.remove('is-error');
  });
}

function showError(msgEl, input, text) {
  msgEl.textContent = text;
  msgEl.hidden = false;
  input.closest('.field').classList.add('is-error');
  input.focus();
}

function resetForm() {
  dom.form.reset();
  // その場で記録することが多いので、日付は今日から始める
  dom.fDate.value = todayISO();
  setKind(TYPE_OMIKUJI);
  clearErrors();
  state = { ...state, editingId: null };
  dom.formHeading.textContent = '記録する';
  dom.formSubmit.textContent = '保存する';
  dom.formCancel.hidden = true;
}

function startEdit(entry) {
  state = { ...state, editingId: entry.id };
  setKind(entry.type === TYPE_VISIT ? TYPE_VISIT : TYPE_OMIKUJI);
  dom.fDate.value = entry.date;
  dom.fShrine.value = entry.shrine || '';
  dom.fNumber.value = entry.number || '';
  dom.fFortune.value = entry.fortune || '';
  dom.fPoem.value = entry.poem || '';
  dom.fOverview.value = entry.overview || '';
  dom.fItems.value = formatItems(entry.items);
  dom.fMemo.value = entry.memo || '';
  dom.formHeading.textContent = entry.source === 'builtin' ? '書き起こしを直す' : '記録を直す';
  dom.formSubmit.textContent = '書きかえる';
  dom.formCancel.hidden = false;
  clearErrors();
  closeDetail();
  switchView('add');
}

function readForm() {
  const kind = selectedKind();
  const entry = {
    date: dom.fDate.value,
    type: kind,
    shrine: dom.fShrine.value.trim() || null,
    memo: dom.fMemo.value.trim() || null,
    // 種類は「どの欄を見せるか」の切り替えであって、書いた内容を捨てる理由にはならない。
    // 「参拝のみ」に変えても入力済みの本文は残す（書き写した文を失う損害が大きすぎる）。
    number: dom.fNumber.value.trim() || null,
    fortune: dom.fFortune.value || null,
    poem: dom.fPoem.value.trim() || null,
    overview: dom.fOverview.value.trim() || null,
    items: parseItems(dom.fItems.value),
  };
  if (kind === TYPE_VISIT) entry.title = '参拝';
  return entry;
}

function onSubmit(event) {
  event.preventDefault();
  clearErrors();

  const kind = selectedKind();
  if (!dom.fDate.value) {
    showError(dom.eDate, dom.fDate, '日付を入れてください。');
    return;
  }
  // 参拝の記録は、神社名がないと後から何の記録か分からなくなる
  if (kind === TYPE_VISIT && !dom.fShrine.value.trim()) {
    showError(dom.eShrine, dom.fShrine, 'お参りした神社を入れてください。');
    return;
  }

  const fields = readForm();
  const editing = state.editingId ? findEntry(state.editingId) : null;

  try {
    if (editing && editing.source === 'builtin') {
      // 配布ファイルは書き換えず、直した項目だけを重ねて持つ
      const patch = {};
      OVERRIDABLE.forEach((key) => { if (key in fields) patch[key] = fields[key]; });
      const nextOverrides = setOverride(state.overrides, editing.id, patch);
      resetForm();
      setState({ overrides: nextOverrides });
      switchView('list');
      toast('書き起こしを直しました');
    } else if (editing) {
      const nextUser = updateUser(state.user, { ...fields, id: editing.id });
      resetForm();
      setState({ user: nextUser });
      switchView('list');
      toast('書きかえました');
    } else {
      const id = makeId(fields.date, allEntries());
      const nextUser = addUser(state.user, { ...fields, id });
      resetForm();
      setState({ user: nextUser });
      switchView('list');
      toast(kind === TYPE_VISIT ? '参拝を記録しました' : 'おみくじを記録しました');
    }
  } catch (err) {
    toast(isQuotaError(err)
      ? 'この端末の保存容量が一杯です。古い記録を消すと空きます。'
      : `保存できませんでした（${err.message}）`);
  }
}

// ---------- 取り返しのつかない操作の前に確認する（4-10） ----------

function ask(kind, id, title, body, okLabel) {
  state = { ...state, pending: { kind, id } };
  dom.confirmTitle.textContent = title;
  dom.confirmBody.textContent = body;
  dom.confirmOk.textContent = okLabel;
  dom.confirm.hidden = false;
  dom.detail.inert = true;
  dom.confirmCancel.focus();
}

function closeConfirm() {
  dom.confirm.hidden = true;
  dom.detail.inert = false;
  state = { ...state, pending: null };
}

function askDelete() {
  ask('delete', state.openId, 'この記録を削除しますか',
    '削除すると元に戻せません。', '削除する');
}

function askRevert(id) {
  ask('revert', id, '手直しを取り消しますか',
    '写真から書き起こしたときの内容に戻ります。直した内容は消えます。', '元に戻す');
}

function runPending() {
  const pending = state.pending;
  closeConfirm();
  if (!pending) return;

  if (pending.kind === 'delete') {
    const nextUser = removeUser(state.user, pending.id);
    closeDetail();
    setState({ user: nextUser });
    toast('削除しました');
    return;
  }

  const nextOverrides = clearOverride(state.overrides, pending.id);
  setState({ overrides: nextOverrides });
  toast('元に戻しました');
}

// ---------- タブ ----------

function switchView(name) {
  dom.viewList.hidden = name !== 'list';
  dom.viewAdd.hidden = name !== 'add';
  document.querySelectorAll('.tab').forEach((tab) => {
    const on = tab.dataset.view === name;
    tab.classList.toggle('is-active', on);
    if (on) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

// ---------- 初回の案内（4-13） ----------

function showIntroIfFirstTime() {
  if (introSeen()) return;
  const box = document.createElement('div');
  box.className = 'intro';
  const p = document.createElement('p');
  p.textContent = '写真から起こした過去の記録が入っています。カードを押すと全文を読めます。写し間違いは直せますし、新しく引いたら「記録」から足せます。';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '閉じる';
  close.addEventListener('click', () => { markIntroSeen(); box.remove(); });
  box.append(p, close);
  dom.list.parentNode.insertBefore(box, dom.list);
}

// ---------- Service Worker ----------

/**
 * load を待つが、すでに発火済みならその場で登録する。
 * データ取得を await したあとに addEventListener すると、
 * load が先に終わっていてリスナーが二度と呼ばれない。
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // 登録できなくても閲覧はできる。ここで画面を止めない。
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

// ---------- 起動 ----------

function bind() {
  dom.search.addEventListener('input', (e) => setState({ query: e.target.value.trim() }));
  dom.searchClear.addEventListener('click', () => {
    dom.search.value = '';
    setState({ query: '' });
    dom.search.focus();
  });
  dom.emptyReset.addEventListener('click', () => {
    dom.search.value = '';
    setState({ query: '', filter: null });
  });

  dom.detailClose.addEventListener('click', closeDetail);
  dom.detailDelete.addEventListener('click', askDelete);
  dom.detailEdit.addEventListener('click', () => {
    const entry = findEntry(state.openId);
    if (entry) startEdit(entry);
  });
  dom.detailPrev.addEventListener('click', () => step(-1));
  dom.detailNext.addEventListener('click', () => step(1));

  dom.confirmCancel.addEventListener('click', closeConfirm);
  dom.confirmOk.addEventListener('click', runPending);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!dom.confirm.hidden) closeConfirm();
      else if (!dom.detail.hidden) closeDetail();
      return;
    }
    if (dom.detail.hidden || !dom.confirm.hidden) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  dom.form.addEventListener('submit', onSubmit);
  dom.form.querySelectorAll('input[name="kind"]').forEach((radio) => {
    radio.addEventListener('change', syncKindFields);
  });
  dom.formCancel.addEventListener('click', () => {
    resetForm();
    switchView('list');
  });
}

async function main() {
  bind();
  resetForm();
  registerServiceWorker();

  const { entries: user, warning } = loadUser();
  if (warning) toast(warning);
  const overrides = loadOverrides();

  try {
    const builtin = await loadBuiltIn();
    setState({ builtin, overrides, user });
    showIntroIfFirstTime();
  } catch (err) {
    // 4-07 エラーの表現方法: 何が起きて何をすればよいかを書く
    setState({ builtin: [], overrides, user });
    dom.empty.hidden = false;
    dom.emptyTitle.textContent = '記録を読み込めませんでした';
    dom.emptyBody.textContent = `${err.message} 通信を確認して画面を開き直してください。`;
    dom.emptyReset.hidden = true;
  }
}

main();
