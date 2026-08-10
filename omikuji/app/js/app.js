/**
 * 画面の配線。状態はこのファイルの state 1つに集め、更新は必ず新しいオブジェクトを作る。
 */

import {
  FORTUNE_ORDER, TYPE_OMIKUJI, TYPE_VISIT,
  loadBuiltIn, loadUser, addUser, updateUser, removeUser,
  loadOverrides, setOverride, clearOverride, applyOverrides,
  buildBundle, parseBundle, replaceAll,
  isQuotaError, makeId, parseItems, formatItems, shrineSuggestions,
  introSeen, markIntroSeen,
  normalizeText, numberKey, sameNumberEntries, todayISO,
} from './store.js';
import {
  cardEl, detailEl, yearHeaderEl, formatDate,
  calendarEl, calendarLegendEl, visitsEl, statsEl,
} from './view.js';

const $ = (id) => document.getElementById(id);

/** チップの特別扱いする値。吉凶そのものではないもの。 */
const FILTER_VISIT = '参拝';
const FILTER_OTHER = 'その他';
const FILTER_NO_FORTUNE = '吉凶なし';

/** 書き起こし記録に重ねられる項目。日付を直したら「推定」の印も外す。 */
const OVERRIDABLE = [
  'date', 'shrine', 'number', 'fortune', 'poem', 'teaching', 'overview', 'items', 'memo',
];

const RECENT_COUNT = 3;

const VIEW_TITLE = { top: 'おみくじ帳', list: '記録一覧', settings: '設定' };

const dom = {
  appbarTitle: $('appbar-title'),
  viewTop: $('view-top'), viewList: $('view-list'), viewSettings: $('view-settings'),

  calendar: $('calendar'), calLegend: $('cal-legend'), calSub: $('cal-sub'),
  calMonth: $('cal-month'), calPrev: $('cal-prev'), calNext: $('cal-next'), calToday: $('cal-today'),
  recent: $('recent'), visits: $('visits'), visitSub: $('visit-sub'),

  list: $('list'), empty: $('empty'), emptyTitle: $('empty-title'),
  emptyBody: $('empty-body'), emptyReset: $('empty-reset'),
  summary: $('summary'), search: $('search'), searchClear: $('search-clear'),
  chips: $('chips'),

  detail: $('detail'), detailBody: $('detail-body'), detailClose: $('detail-close'),
  detailDelete: $('detail-delete'), detailEdit: $('detail-edit'), detailBarLabel: $('d-barlabel'),
  detailPrev: $('detail-prev'), detailNext: $('detail-next'),
  prevLabel: $('prev-label'), nextLabel: $('next-label'),

  formSheet: $('form-sheet'), formClose: $('form-close'), fab: $('fab'),
  confirm: $('confirm'), confirmOk: $('confirm-ok'), confirmCancel: $('confirm-cancel'),
  confirmTitle: $('c-title'), confirmBody: $('c-body'),
  toast: $('toast'), form: $('form'), formHeading: $('form-heading'), formSubmit: $('form-submit'),

  fDate: $('f-date'), fShrine: $('f-shrine'), fNumber: $('f-number'),
  fFortune: $('f-fortune'), fPoem: $('f-poem'), fTeaching: $('f-teaching'),
  fOverview: $('f-overview'), fItems: $('f-items'), fMemo: $('f-memo'),
  omikujiFields: $('omikuji-fields'), shrineList: $('shrine-list'), shrineReq: $('shrine-req'),
  eDate: $('e-date'), eShrine: $('e-shrine'),

  exportBtn: $('export-btn'), importBtn: $('import-btn'), importFile: $('import-file'),
  backupStat: $('backup-stat'), stats: $('stats'),

  appbar: document.querySelector('.appbar'), tabbar: document.querySelector('.tabbar'),
};

let state = {
  builtin: [],
  overrides: {},
  user: [],
  view: 'top',
  calMonth: null,   // 'YYYY-MM'。未設定なら一番新しい記録の月を出す
  query: '',
  filter: null,     // 吉凶・種別
  shrine: null,     // 神社での絞り込み
  openId: null,
  editingId: null,
  pending: null,
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
    entry.date, formatDate(entry.date), numberKey(entry.number),
    ...(entry.items || []).flatMap((i) => [i.label, i.value]),
  ].filter((v) => v != null && v !== '').join(' '));

  return normalizeText(query).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

function visibleEntries() {
  return allEntries().filter((e) => (
    matchesFilter(e, state.filter)
    && matchesQuery(e, state.query)
    && (!state.shrine || (e.shrine || '神社名の記載なし') === state.shrine)
  ));
}

function findEntry(id) {
  return allEntries().find((e) => e.id === id) || null;
}

// ---------- TOP ----------

/** いま出している月。まだ選んでいなければ、一番新しい記録の月。 */
function currentMonth() {
  if (state.calMonth) return state.calMonth;
  const entries = allEntries();
  return entries.length ? entries[0].date.slice(0, 7) : todayISO().slice(0, 7);
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function renderTop() {
  const entries = allEntries();
  const month = currentMonth();
  const [cy, cm] = month.split('-').map(Number);

  dom.calendar.textContent = '';
  dom.calendar.appendChild(calendarEl(entries, month, todayISO(), openDetail));
  dom.calLegend.textContent = '';
  dom.calLegend.appendChild(calendarLegendEl(entries));
  dom.calMonth.textContent = `${cy}年${cm}月`;

  const inMonth = entries.filter((e) => e.date.startsWith(month));
  const omikujiInMonth = inMonth.filter((e) => e.type === TYPE_OMIKUJI).length;
  dom.calSub.textContent = inMonth.length
    ? `この月 ${inMonth.length}件（おみくじ${omikujiInMonth}）`
    : 'この月の記録はありません';
  dom.calToday.hidden = month === todayISO().slice(0, 7);

  dom.recent.textContent = '';
  entries.slice(0, RECENT_COUNT).forEach((e) => dom.recent.appendChild(cardEl(e, openDetail)));

  dom.visits.textContent = '';
  dom.visits.appendChild(visitsEl(entries, (shrine) => {
    setState({ shrine, filter: null, query: '' });
    dom.search.value = '';
    switchView('list');
  }));
  const shrines = new Set(entries.map((e) => e.shrine || '神社名の記載なし'));
  dom.visitSub.textContent = `${shrines.size}社・のべ${entries.length}回`;
}

// ---------- 一覧 ----------

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

  // 神社で絞り込み中なら、それを外す手立てを先に出す
  if (state.shrine) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip chip--shrine is-on';
    b.textContent = state.shrine;
    const x = document.createElement('span');
    x.className = 'chip__x';
    x.textContent = '✕';
    b.appendChild(x);
    b.setAttribute('aria-label', `${state.shrine}での絞り込みを外す`);
    b.addEventListener('click', () => setState({ shrine: null }));
    dom.chips.appendChild(b);
  }

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
  let lastYear = null;
  shown.forEach((e) => {
    const year = e.date.slice(0, 4);
    if (year !== lastYear) {
      dom.list.appendChild(yearHeaderEl(year, shown.filter((x) => x.date.startsWith(year)).length));
      lastYear = year;
    }
    dom.list.appendChild(cardEl(e, openDetail));
  });

  const filtering = Boolean(state.query || state.filter || state.shrine);
  dom.empty.hidden = shown.length > 0;
  if (!shown.length) {
    dom.emptyTitle.textContent = filtering ? '見つかりませんでした' : 'まだ記録がありません';
    dom.emptyBody.textContent = filtering
      ? '別の言葉で探すか、絞り込みを外してみてください。'
      : '右下の＋から、引いたおみくじやお参りを書きとめられます。';
    dom.emptyReset.hidden = !filtering;
  }

  dom.summary.textContent = filtering
    ? `${shown.length}件を表示中（全${entries.length}件）`
    : `${entries.length}件`;
  dom.searchClear.hidden = !state.query;
}

// ---------- 設定 ----------

function renderSettings() {
  const entries = allEntries();
  const mine = state.user.length;
  const edited = Object.keys(state.overrides).length;

  dom.backupStat.textContent = (mine || edited)
    ? `自分の記録 ${mine}件・手直し ${edited}件が、この端末にあります。`
    : 'まだこの端末だけの記録はありません。';

  const omikuji = entries.filter((e) => e.type === TYPE_OMIKUJI);
  const counts = countsOf(entries);
  const shrines = new Set(entries.map((e) => e.shrine || '神社名の記載なし'));
  const rows = [
    ['ぜんぶで', `${entries.length}件`],
    ['おみくじ', `${omikuji.length}回`],
    ['大吉', `${counts.get('大吉') || 0}回`],
    ['お参りした神社', `${shrines.size}社`],
    ['いちばん古い記録', entries.length ? formatDate(entries[entries.length - 1].date) : '—'],
  ];
  dom.stats.textContent = '';
  dom.stats.appendChild(statsEl(rows));
}

function render() {
  renderTop();
  renderChips();
  renderList();
  renderSettings();
  renderShrineSuggestions();
  if (!dom.detail.hidden && state.openId) refreshDetail();
}

function renderShrineSuggestions() {
  dom.shrineList.textContent = '';
  shrineSuggestions(allEntries()).forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    dom.shrineList.appendChild(opt);
  });
}

// ---------- 前面に出したときの背景の扱い ----------

function setBackgroundInert(on) {
  [dom.appbar, dom.tabbar, dom.viewTop, dom.viewList, dom.viewSettings, dom.fab].forEach((node) => {
    if (node) node.inert = on;
  });
  dom.fab.hidden = on;
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

  dom.detailEdit.hidden = false;                      // 書き起こしも直せる
  dom.detailDelete.hidden = entry.source !== 'user';  // 消せるのは自分の記録だけ

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
  const card = id && document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (card) card.focus();
  else if (lastFocused && lastFocused.isConnected) lastFocused.focus();
  lastFocused = null;
}

// ---------- トースト ----------

function toast(message) {
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 2800);
}

// ---------- 記録フォーム ----------

function selectedKind() {
  const checked = dom.form.querySelector('input[name="kind"]:checked');
  return checked ? checked.value : TYPE_OMIKUJI;
}

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
  dom.fDate.value = todayISO();   // その場で記録することが多い
  setKind(TYPE_OMIKUJI);
  clearErrors();
  state = { ...state, editingId: null };
  dom.formHeading.textContent = '記録する';
  dom.formSubmit.textContent = '保存する';
}

function openForm() {
  lastFocused = document.activeElement;
  dom.formSheet.hidden = false;
  setBackgroundInert(true);
  document.body.style.overflow = 'hidden';
  dom.formClose.focus();
}

function closeForm() {
  dom.formSheet.hidden = true;
  setBackgroundInert(false);
  document.body.style.overflow = '';
  if (lastFocused && lastFocused.isConnected) lastFocused.focus();
  lastFocused = null;
}

function startEdit(entry) {
  state = { ...state, editingId: entry.id };
  setKind(entry.type === TYPE_VISIT ? TYPE_VISIT : TYPE_OMIKUJI);
  dom.fDate.value = entry.date;
  dom.fShrine.value = entry.shrine || '';
  dom.fNumber.value = entry.number || '';
  dom.fFortune.value = entry.fortune || '';
  dom.fPoem.value = entry.poem || '';
  dom.fTeaching.value = entry.teaching || '';
  dom.fOverview.value = entry.overview || '';
  dom.fItems.value = formatItems(entry.items);
  dom.fMemo.value = entry.memo || '';
  dom.formHeading.textContent = entry.source === 'builtin' ? '書き起こしを直す' : '記録を直す';
  dom.formSubmit.textContent = '書きかえる';
  clearErrors();
  closeDetail();
  openForm();
}

function readForm() {
  const kind = selectedKind();
  const entry = {
    date: dom.fDate.value,
    type: kind,
    shrine: dom.fShrine.value.trim() || null,
    memo: dom.fMemo.value.trim() || null,
    // 種類は「どの欄を見せるか」の切り替えであって、書いた内容を捨てる理由にはならない。
    number: dom.fNumber.value.trim() || null,
    fortune: dom.fFortune.value || null,
    poem: dom.fPoem.value.trim() || null,
    teaching: dom.fTeaching.value.trim() || null,
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
  if (kind === TYPE_VISIT && !dom.fShrine.value.trim()) {
    showError(dom.eShrine, dom.fShrine, 'お参りした神社を入れてください。');
    return;
  }

  const fields = readForm();
  const editing = state.editingId ? findEntry(state.editingId) : null;

  try {
    if (editing && editing.source === 'builtin') {
      const patch = {};
      OVERRIDABLE.forEach((key) => { if (key in fields) patch[key] = fields[key]; });
      // 日付を直したなら、もう推定ではない
      if (editing.dateEstimated && fields.date !== editing.date) {
        patch.dateEstimated = false;
        patch.dateNote = null;
      }
      const nextOverrides = setOverride(state.overrides, editing.id, patch);
      resetForm();
      closeForm();
      setState({ overrides: nextOverrides });
      toast('書き起こしを直しました');
    } else if (editing) {
      const nextUser = updateUser(state.user, { ...fields, id: editing.id });
      resetForm();
      closeForm();
      setState({ user: nextUser });
      toast('書きかえました');
    } else {
      const id = makeId(fields.date, allEntries());
      const nextUser = addUser(state.user, { ...fields, id });
      resetForm();
      closeForm();
      setState({ user: nextUser });
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
  ask('delete', state.openId, 'この記録を削除しますか', '削除すると元に戻せません。', '削除する');
}

function askRevert(id) {
  ask('revert', id, '手直しを取り消しますか',
    '写真から書き起こしたときの内容に戻ります。直した内容は消えます。', '元に戻す');
}

function askImport(bundle) {
  state = { ...state, pending: { kind: 'import', bundle } };
  dom.confirmTitle.textContent = '読み込むと今の記録は置き換わります';
  dom.confirmBody.textContent =
    `いまこの端末にある記録 ${state.user.length}件・手直し ${Object.keys(state.overrides).length}件は、`
    + `ファイルの内容（記録 ${bundle.entries.length}件・手直し ${Object.keys(bundle.overrides).length}件）に置き換わります。`;
  dom.confirmOk.textContent = '読み込む';
  dom.confirm.hidden = false;
  dom.confirmCancel.focus();
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

  if (pending.kind === 'revert') {
    setState({ overrides: clearOverride(state.overrides, pending.id) });
    toast('元に戻しました');
    return;
  }

  try {
    const { user, overrides } = replaceAll(pending.bundle.entries, pending.bundle.overrides);
    setState({ user, overrides });
    toast(`${user.length}件を読み込みました`);
  } catch (err) {
    toast(`読み込めませんでした（${err.message}）`);
  }
}

// ---------- 持ち出し ----------

function onExport() {
  try {
    const bundle = buildBundle(state.user, state.overrides, new Date().toISOString());
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omikuji-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('書き出しました');
  } catch (err) {
    toast(`書き出せませんでした（${err.message}）`);
  }
}

function onImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';   // 同じファイルを選び直せるように
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      askImport(parseBundle(String(reader.result)));
    } catch (err) {
      toast(err.message);
    }
  };
  reader.onerror = () => toast('ファイルを読めませんでした。');
  reader.readAsText(file);
}

// ---------- タブ ----------

function switchView(name) {
  state = { ...state, view: name };
  dom.viewTop.hidden = name !== 'top';
  dom.viewList.hidden = name !== 'list';
  dom.viewSettings.hidden = name !== 'settings';
  dom.appbarTitle.textContent = VIEW_TITLE[name] || 'おみくじ帳';
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
  p.textContent = '写真から起こした過去の記録が入っています。カレンダーの月を押すとその回を読めます。新しく引いたら右下の＋から足せます。';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '閉じる';
  close.addEventListener('click', () => { markIntroSeen(); box.remove(); });
  box.append(p, close);
  dom.viewTop.insertBefore(box, dom.viewTop.firstChild);
}

// ---------- Service Worker ----------

/**
 * load を待つが、すでに発火済みならその場で登録する。
 * await のあとに addEventListener すると、load が先に終わっていて二度と呼ばれない。
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
    setState({ query: '', filter: null, shrine: null });
  });

  dom.detailClose.addEventListener('click', closeDetail);
  dom.detailDelete.addEventListener('click', askDelete);
  dom.detailEdit.addEventListener('click', () => {
    const entry = findEntry(state.openId);
    if (entry) startEdit(entry);
  });
  dom.detailPrev.addEventListener('click', () => step(-1));
  dom.detailNext.addEventListener('click', () => step(1));

  dom.calPrev.addEventListener('click', () => setState({ calMonth: shiftMonth(currentMonth(), -1) }));
  dom.calNext.addEventListener('click', () => setState({ calMonth: shiftMonth(currentMonth(), 1) }));
  dom.calToday.addEventListener('click', () => setState({ calMonth: todayISO().slice(0, 7) }));

  dom.fab.addEventListener('click', () => { resetForm(); openForm(); });
  dom.formClose.addEventListener('click', () => { resetForm(); closeForm(); });
  dom.form.addEventListener('submit', onSubmit);
  dom.form.querySelectorAll('input[name="kind"]').forEach((radio) => {
    radio.addEventListener('change', syncKindFields);
  });

  dom.confirmCancel.addEventListener('click', closeConfirm);
  dom.confirmOk.addEventListener('click', runPending);

  dom.exportBtn.addEventListener('click', onExport);
  dom.importBtn.addEventListener('click', () => dom.importFile.click());
  dom.importFile.addEventListener('change', onImportFile);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!dom.confirm.hidden) closeConfirm();
      else if (!dom.formSheet.hidden) { resetForm(); closeForm(); }
      else if (!dom.detail.hidden) closeDetail();
      return;
    }
    if (dom.detail.hidden || !dom.confirm.hidden) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  document.querySelectorAll('.tab, .block__more').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
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
    setState({ builtin: [], overrides, user });
    dom.empty.hidden = false;
    dom.emptyTitle.textContent = '記録を読み込めませんでした';
    dom.emptyBody.textContent = `${err.message} 通信を確認して画面を開き直してください。`;
    dom.emptyReset.hidden = true;
  }
}

main();
