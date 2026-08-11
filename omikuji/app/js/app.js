/**
 * 画面の配線。状態はこのファイルの state 1つに集め、更新は必ず新しいオブジェクトを作る。
 */

import {
  FORTUNE_ORDER, TYPE_OMIKUJI, TYPE_VISIT,
  loadBuiltIn, loadUser, addUser, updateUser, removeUser,
  loadOverrides, setOverride, clearOverride, applyOverrides, hiddenIds, unhideAll,
  buildBundle, parseBundle, replaceAll,
  isQuotaError, makeId, parseItems, formatItems, shrineSuggestions,
  introSeen, markIntroSeen,
  normalizeText, numberKey, sameNumberEntries, todayISO,
} from './store.js';
import {
  cardEl, detailEl, yearHeaderEl, formatDate,
  calendarEl, calendarLegendEl, visitsEl, visitStats, visitRowEl, statsEl,
} from './view.js';
import { OMIKUJI_PRESETS, findPreset, guessPreset, numberOptions } from './presets.js';
import {
  watch as watchInstall, onAvailable, canPrompt, promptInstall,
  needsManualHint, isStandalone, dismissed, markDismissed, IOS_STEPS,
} from './install.js';

const $ = (id) => document.getElementById(id);

const FILTER_VISIT = '参拝';
const FILTER_OTHER = 'その他';
const FILTER_NO_FORTUNE = '吉凶なし';

/** 書き起こし記録に重ねられる項目。日付を直したら「推定」の印も外す。 */
const OVERRIDABLE = [
  'date', 'time', 'shrine', 'purpose', 'offering', 'purchases',
  'number', 'fortune', 'poem', 'teaching', 'overview', 'items', 'memo',
];

const RECENT_COUNT = 3;
const OTHER_NUMBER = '__other__';

const VIEW_TITLE = { top: 'おみくじ帳', visits: '訪問記録', list: 'おみくじ', settings: '設定' };

const dom = {
  appbarTitle: $('appbar-title'),
  viewTop: $('view-top'), viewVisits: $('view-visits'), viewList: $('view-list'), viewSettings: $('view-settings'),

  calendar: $('calendar'), calLegend: $('cal-legend'), calSub: $('cal-sub'),
  calMonth: $('cal-month'), calPrev: $('cal-prev'), calNext: $('cal-next'),
  calJump: $('cal-jump'), calYear: $('cal-year'), calMonthSel: $('cal-monthsel'),
  calJumpClose: $('cal-jump-close'),
  recent: $('recent'), visits: $('visits'), visitSub: $('visit-sub'),

  visitList: $('visit-list'), visitSearch: $('visit-search'),
  visitSearchClear: $('visit-search-clear'), visitSummary: $('visit-summary'), visitEmpty: $('visit-empty'),

  list: $('list'), empty: $('empty'), emptyTitle: $('empty-title'),
  emptyBody: $('empty-body'), emptyReset: $('empty-reset'),
  summary: $('summary'), search: $('search'), searchClear: $('search-clear'), chips: $('chips'),

  detail: $('detail'), detailBody: $('detail-body'), detailClose: $('detail-close'),
  detailDelete: $('detail-delete'), detailEdit: $('detail-edit'), detailBarLabel: $('d-barlabel'),
  detailPrev: $('detail-prev'), detailNext: $('detail-next'),
  prevLabel: $('prev-label'), nextLabel: $('next-label'),

  formSheet: $('form-sheet'), formClose: $('form-close'), fab: $('fab'),
  confirm: $('confirm'), confirmActions: $('confirm-actions'),
  confirmTitle: $('c-title'), confirmBody: $('c-body'),
  toast: $('toast'), form: $('form'), formHeading: $('form-heading'), formSubmit: $('form-submit'),

  fDate: $('f-date'), fTime: $('f-time'), fShrine: $('f-shrine'), fPurpose: $('f-purpose'),
  fOffering: $('f-offering'), fPurchases: $('f-purchases'),
  fPreset: $('f-preset'), presetNote: $('preset-note'),
  fNumber: $('f-number'), fNumberOther: $('f-number-other'), numberOtherField: $('number-other-field'),
  fFortune: $('f-fortune'), fPoem: $('f-poem'), fTeaching: $('f-teaching'),
  fOverview: $('f-overview'), fItems: $('f-items'), fMemo: $('f-memo'),
  omikujiFields: $('omikuji-fields'), shrineList: $('shrine-list'), shrineReq: $('shrine-req'),
  eDate: $('e-date'), eShrine: $('e-shrine'),

  exportBtn: $('export-btn'), importBtn: $('import-btn'), importFile: $('import-file'),
  backupStat: $('backup-stat'), stats: $('stats'),
  hiddenBlock: $('hidden-block'), hiddenText: $('hidden-text'), unhideBtn: $('unhide-btn'),
  installBlock: $('install-block'), installText: $('install-text'), installSteps: $('install-steps'),
  installActions: $('install-actions'), installBtn: $('install-btn'),
  promo: $('install-promo'), promoLater: $('promo-later'), promoAdd: $('promo-add'),
  promoBody: $('promo-body'),

  appbar: document.querySelector('.appbar'), tabbar: document.querySelector('.tabbar'),
};

let state = {
  builtin: [],
  overrides: {},
  user: [],
  view: 'top',
  calMonth: null,
  query: '',
  visitQuery: '',
  filter: null,
  shrine: null,
  openId: null,
  editingId: null,
  pending: null,
};

let toastTimer = null;
let lastFocused = null;
/** タブごとのスクロール位置。戻ったときに読んでいた場所を失わせない。 */
const scrollByView = new Map();
let scrollBeforeDetail = 0;

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

function haystack(entry) {
  return normalizeText([
    entry.shrine, entry.number, entry.fortune, entry.poem, entry.teaching,
    entry.overview, entry.title, entry.memo, entry.purpose, entry.purchases, entry.offering,
    entry.date, formatDate(entry.date), entry.time, numberKey(entry.number),
    ...(entry.items || []).flatMap((i) => [i.label, i.value]),
  ].filter((v) => v != null && v !== '').join(' '));
}

function matchesQuery(entry, query) {
  if (!query) return true;
  const hay = haystack(entry);
  return normalizeText(query).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

function visibleEntries() {
  return allEntries().filter((e) => (
    matchesFilter(e, state.filter)
    && matchesQuery(e, state.query)
    && (!state.shrine || (e.shrine || '場所の記載なし') === state.shrine)
  ));
}

function findEntry(id) {
  return allEntries().find((e) => e.id === id) || null;
}

// ---------- TOP ----------

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
  dom.calSub.textContent = inMonth.length
    ? `この月 ${inMonth.length}件`
    : 'この月の記録はありません';

  dom.recent.textContent = '';
  entries.slice(0, RECENT_COUNT).forEach((e) => dom.recent.appendChild(cardEl(e, openDetail)));

  const stats = visitStats(entries);
  dom.visits.textContent = '';
  dom.visits.appendChild(visitsEl(stats, (shrine) => {
    setState({ shrine, filter: null, query: '' });
    dom.search.value = '';
    switchView('list');
  }));
  dom.visitSub.textContent = `${stats.namedShrines}社・${stats.totalDays}日`;
}

// ---------- 訪問記録 ----------

function renderVisits() {
  const rows = allEntries()
    .filter((e) => e.type === TYPE_OMIKUJI || e.type === TYPE_VISIT)
    .filter((e) => matchesQuery(e, state.visitQuery));

  dom.visitList.textContent = '';
  let lastYear = null;
  rows.forEach((e) => {
    const year = e.date.slice(0, 4);
    if (year !== lastYear) {
      dom.visitList.appendChild(yearHeaderEl(year, rows.filter((x) => x.date.startsWith(year)).length));
      lastYear = year;
    }
    dom.visitList.appendChild(visitRowEl(e, openDetail));
  });

  dom.visitEmpty.hidden = rows.length > 0;
  const days = new Set(rows.map((e) => e.date)).size;
  dom.visitSummary.textContent = state.visitQuery
    ? `${rows.length}件を表示中`
    : `${rows.length}件・${days}日ぶんのお参り`;
  dom.visitSearchClear.hidden = !state.visitQuery;
}

// ---------- おみくじ一覧 ----------

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
  const hidden = hiddenIds(state.overrides);
  const edited = Object.keys(state.overrides).length - hidden.length;

  const hasOwn = mine || edited || hidden.length;
  dom.backupStat.textContent = hasOwn
    ? `自分の記録 ${mine}件・手直し ${edited}件・一覧から外した記録 ${hidden.length}件が、この端末にあります。`
    : 'この端末だけの記録はまだありません。書き出すものがないので、いまは控えを取る必要はありません。';
  dom.exportBtn.disabled = !hasOwn;

  dom.hiddenBlock.hidden = hidden.length === 0;
  if (hidden.length) {
    const names = hidden.map((id) => {
      const e = state.builtin.find((b) => b.id === id);
      return e ? `${formatDate(e.date)}　${e.number || e.title || 'おみくじ'}` : id;
    });
    dom.hiddenText.textContent = `${names.join(' ／ ')} を一覧とカレンダーから外しています。`;
  }

  const omikuji = entries.filter((e) => e.type === TYPE_OMIKUJI);
  const counts = countsOf(entries);
  const stats = visitStats(entries);
  const offerings = entries.map((e) => Number(e.offering)).filter((n) => Number.isFinite(n) && n > 0);

  const rows = [
    ['ぜんぶで', `${entries.length}件`],
    ['お参りした日', `${stats.totalDays}日`],
    ['お参りした寺社', `${stats.namedShrines}社`],
    ['引いたおみくじ', `${omikuji.length}回`],
    ['大吉', `${counts.get('大吉') || 0}回`],
    ['いちばん古い記録', entries.length ? formatDate(entries[entries.length - 1].date) : '—'],
  ];
  if (offerings.length) {
    rows.push(['賽銭の合計', `${offerings.reduce((a, b) => a + b, 0).toLocaleString('ja-JP')}円`]);
  }
  dom.stats.textContent = '';
  dom.stats.appendChild(statsEl(rows));
}

/**
 * ホーム画面への案内。3通りに分かれる。
 *   すでに入っている → 何も勧めない
 *   ブラウザが対応  → ボタンひとつで追加
 *   iOS Safari      → 自動で出せないので手順を書く
 */
function renderInstall() {
  if (isStandalone()) {
    dom.installBlock.hidden = false;
    dom.installText.textContent = 'ホーム画面から開いています。電波がなくても記録を読み返せます。';
    dom.installSteps.hidden = true;
    dom.installActions.hidden = true;
    return;
  }
  if (canPrompt()) {
    dom.installBlock.hidden = false;
    dom.installText.textContent = 'アプリのように開けるようになり、電波がなくても読み返せます。';
    dom.installSteps.hidden = true;
    dom.installActions.hidden = false;
    return;
  }
  if (needsManualHint()) {
    dom.installBlock.hidden = false;
    dom.installText.textContent = 'この端末では、Safari の共有メニューから置けます。';
    dom.installSteps.textContent = '';
    IOS_STEPS.forEach((step) => {
      const li = document.createElement('li');
      li.textContent = step;
      dom.installSteps.appendChild(li);
    });
    dom.installSteps.hidden = false;
    dom.installActions.hidden = true;
    return;
  }
  dom.installBlock.hidden = true;
}

/** 記録し終えた直後にだけ勧める。初回ロードでは出さない。 */
function maybeShowPromo() {
  if (isStandalone() || dismissed()) return;
  const auto = canPrompt();
  if (!auto && !needsManualHint()) return;
  dom.promoBody.textContent = auto
    ? 'アプリのように開けて、電波がなくても読み返せます。'
    : 'Safari の共有メニューから「ホーム画面に追加」で置けます。設定に手順があります。';
  dom.promoAdd.hidden = !auto;
  dom.promo.hidden = false;
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
  renderTop();
  renderVisits();
  renderChips();
  renderList();
  renderSettings();
  renderInstall();
  renderShrineSuggestions();
  if (!dom.detail.hidden && state.openId) refreshDetail();
}

// ---------- 前面に出したときの背景の扱い ----------

function setBackgroundInert(on) {
  [dom.appbar, dom.tabbar, dom.viewTop, dom.viewVisits, dom.viewList, dom.viewSettings, dom.fab]
    .forEach((node) => { if (node) node.inert = on; });
  dom.fab.hidden = on;
}

// ---------- 詳細 ----------

/** 記録ごとに URL を持たせる。共有でき、端末の「戻る」で閉じられる。 */
function hashId() {
  const m = location.hash.match(/^#\/r\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function openDetail(entry, { push = true } = {}) {
  if (dom.detail.hidden) {
    lastFocused = document.activeElement;
    scrollBeforeDetail = window.scrollY;
  }
  state = { ...state, openId: entry.id };
  refreshDetail();
  dom.detailBody.scrollTop = 0;
  dom.detail.hidden = false;
  setBackgroundInert(true);
  document.body.style.overflow = 'hidden';
  dom.detailClose.focus();

  // standalone にはブラウザの戻るボタンがない。履歴に積んでおけば
  // 端末の戻る操作（Android の戻る、iOS の横スワイプ）で閉じられる。
  const url = `#/r/${encodeURIComponent(entry.id)}`;
  if (push && location.hash !== url) history.pushState({ id: entry.id }, '', url);
  else if (!push) history.replaceState({ id: entry.id }, '', url);
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

  dom.detailEdit.hidden = false;
  dom.detailDelete.hidden = false;

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

function closeDetail({ pop = true } = {}) {
  if (dom.detail.hidden) return;
  dom.detail.hidden = true;
  setBackgroundInert(false);
  document.body.style.overflow = '';
  const id = state.openId;
  state = { ...state, openId: null };

  // 読んでいた場所へ戻す。開く前の位置を覚えているのでそこへ。
  window.scrollTo(0, scrollBeforeDetail);

  const card = id && document.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (card) card.focus();
  else if (lastFocused && lastFocused.isConnected) lastFocused.focus();
  lastFocused = null;

  if (pop && hashId()) history.back();
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
}

function setKind(kind) {
  const radio = dom.form.querySelector(`input[name="kind"][value="${kind}"]`);
  if (radio) radio.checked = true;
  syncKindFields();
}

/** おみくじの型と番号の選択肢を組み立てる。起動時に1度だけ。 */
function buildFormOptions() {
  dom.fPreset.textContent = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '型を選ぶ…';
  dom.fPreset.appendChild(blank);
  OMIKUJI_PRESETS.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    dom.fPreset.appendChild(opt);
  });

  dom.fNumber.textContent = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '記載なし';
  dom.fNumber.appendChild(none);
  numberOptions().forEach((label) => {
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    dom.fNumber.appendChild(opt);
  });
  const other = document.createElement('option');
  other.value = OTHER_NUMBER;
  other.textContent = 'この中にない（自分で書く）';
  dom.fNumber.appendChild(other);

  // 年月を直接選べるようにする（2年前まで月送りで戻るのは骨が折れる）
  const thisYear = new Date().getFullYear();
  dom.calYear.textContent = '';
  for (let y = thisYear + 1; y >= thisYear - 20; y -= 1) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = `${y}年`;
    dom.calYear.appendChild(opt);
  }
  dom.calMonthSel.textContent = '';
  for (let m = 1; m <= 12; m += 1) {
    const opt = document.createElement('option');
    opt.value = String(m);
    opt.textContent = `${m}月`;
    dom.calMonthSel.appendChild(opt);
  }
}

function syncNumberOther() {
  dom.numberOtherField.hidden = dom.fNumber.value !== OTHER_NUMBER;
}

function setNumberValue(value) {
  const has = value && [...dom.fNumber.options].some((o) => o.value === value);
  if (has) {
    dom.fNumber.value = value;
    dom.fNumberOther.value = '';
  } else if (value) {
    dom.fNumber.value = OTHER_NUMBER;
    dom.fNumberOther.value = value;
  } else {
    dom.fNumber.value = '';
    dom.fNumberOther.value = '';
  }
  syncNumberOther();
}

function readNumber() {
  if (dom.fNumber.value === OTHER_NUMBER) return dom.fNumberOther.value.trim() || null;
  return dom.fNumber.value || null;
}

/** 型を選んだら、項目名だけを流し込む。すでに書いてあるものは消さない。 */
function applyPreset(id, { force = false } = {}) {
  const preset = findPreset(id);
  dom.presetNote.textContent = preset ? preset.note : '';
  if (!preset) return;

  if (preset.shrine && (force || !dom.fShrine.value.trim())) {
    dom.fShrine.value = preset.shrine;
  }
  const current = dom.fItems.value.trim();
  if (preset.items.length && (force || !current)) {
    dom.fItems.value = preset.items.map((label) => `${label}: `).join('\n');
  }
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
  dom.fDate.value = todayISO();
  setKind(TYPE_OMIKUJI);
  setNumberValue('');
  dom.fPreset.value = '';
  dom.presetNote.textContent = '';
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
  dom.fTime.value = entry.time || '';
  dom.fShrine.value = entry.shrine || '';
  dom.fPurpose.value = entry.purpose || '';
  dom.fOffering.value = entry.offering ?? '';
  dom.fPurchases.value = entry.purchases || '';
  setNumberValue(entry.number || '');
  dom.fFortune.value = entry.fortune || '';
  dom.fPoem.value = entry.poem || '';
  dom.fTeaching.value = entry.teaching || '';
  dom.fOverview.value = entry.overview || '';
  dom.fItems.value = formatItems(entry.items);
  dom.fMemo.value = entry.memo || '';

  const guessed = guessPreset(entry);
  dom.fPreset.value = guessed || '';
  dom.presetNote.textContent = guessed ? (findPreset(guessed)?.note || '') : '';

  dom.formHeading.textContent = '記録を直す';
  dom.formSubmit.textContent = '書きかえる';
  clearErrors();
  closeDetail();
  openForm();
}

function readForm() {
  const kind = selectedKind();
  const offering = dom.fOffering.value.trim();
  const entry = {
    date: dom.fDate.value,
    time: dom.fTime.value || null,
    type: kind,
    shrine: dom.fShrine.value.trim() || null,
    purpose: dom.fPurpose.value.trim() || null,
    offering: offering === '' ? null : Number(offering),
    purchases: dom.fPurchases.value.trim() || null,
    memo: dom.fMemo.value.trim() || null,
    // 種類は「どの欄を見せるか」の切り替えであって、書いた内容を捨てる理由にはならない。
    number: readNumber(),
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
    showError(dom.eShrine, dom.fShrine, 'お参りした場所を入れてください。');
    return;
  }

  const fields = readForm();
  const editing = state.editingId ? findEntry(state.editingId) : null;

  try {
    if (editing && editing.source === 'builtin') {
      const patch = {};
      OVERRIDABLE.forEach((key) => { if (key in fields) patch[key] = fields[key]; });
      if (editing.dateEstimated && fields.date !== editing.date) {
        patch.dateEstimated = false;
        patch.dateNote = null;
      }
      const nextOverrides = setOverride(state.overrides, editing.id, patch);
      resetForm();
      closeForm();
      setState({ overrides: nextOverrides });
      toast('書きかえました');
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
      // 一度使ってもらった後が勧めどき。初回ロードでは出さない。
      setTimeout(maybeShowPromo, 1200);
    }
  } catch (err) {
    toast(isQuotaError(err)
      ? 'この端末の保存容量が一杯です。古い記録を消すと空きます。'
      : `保存できませんでした（${err.message}）`);
  }
}

// ---------- 取り返しのつかない操作の前に確認する（4-10） ----------

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.body
 * @param {Array}  options.actions [{ label, kind, danger }]。押した kind が runPending へ渡る
 * @param {object} [options.payload] kind と一緒に持ち回す値
 */
function ask({ title, body, actions, payload = {} }) {
  dom.confirmTitle.textContent = title;
  dom.confirmBody.textContent = body;

  dom.confirmActions.textContent = '';
  dom.confirmActions.classList.toggle('confirm__actions--stack', actions.length > 1);

  actions.forEach((action) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${action.danger ? 'btn--danger' : 'btn--ghost'}`;
    b.textContent = action.label;
    b.addEventListener('click', () => {
      state = { ...state, pending: { kind: action.kind, ...payload } };
      runPending();
    });
    dom.confirmActions.appendChild(b);
  });

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn--ghost';
  cancel.textContent = 'やめる';
  cancel.addEventListener('click', closeConfirm);
  dom.confirmActions.appendChild(cancel);

  dom.confirm.hidden = false;
  dom.detail.inert = true;
  cancel.focus();
}

function closeConfirm() {
  dom.confirm.hidden = true;
  dom.detail.inert = false;
  state = { ...state, pending: null };
}

function askDelete() {
  const entry = findEntry(state.openId);
  if (!entry) return;

  const builtin = entry.source === 'builtin';
  const wording = builtin
    ? { verb: '一覧から外す', note: 'あとで設定から戻せます。' }
    : { verb: '削除する', note: '元に戻せません。' };

  // おみくじの記録は、お参りの記録でもある。
  // まとめて消すと「その日その社に行った」ことまで失われるので、分けて選べるようにする。
  if (entry.type === TYPE_OMIKUJI) {
    ask({
      title: 'この記録をどうしますか',
      body: `${formatDate(entry.date)}　${entry.shrine || '場所の記載なし'} のお参りの記録でもあります。`
        + `おみくじだけを消せば、お参りに行ったことは残ります。${wording.note}`,
      // builtin は配布ファイルを消せないため「隠す」だけ。文言でその差を出す
      payload: { id: entry.id },
      actions: [
        { kind: builtin ? 'omikuji-only-builtin' : 'omikuji-only-user', label: 'おみくじだけ消す' },
        { kind: builtin ? 'hide' : 'delete', label: `記録ごと${wording.verb}`, danger: true },
      ],
    });
    return;
  }

  ask({
    title: builtin ? 'この記録を一覧から外しますか' : 'この記録を削除しますか',
    body: builtin
      ? `一覧とカレンダーに出なくなります。${wording.note}`
      : `${wording.note}`,
    payload: { id: entry.id },
    actions: [{ kind: builtin ? 'hide' : 'delete', label: wording.verb, danger: true }],
  });
}

function askRevert(id) {
  ask({
    title: '手直しを取り消しますか',
    body: 'もとの内容に戻ります。直した内容は消えます。',
    payload: { id },
    actions: [{ kind: 'revert', label: '元に戻す', danger: true }],
  });
}

function askImport(bundle) {
  ask({
    title: '読み込むと今の記録は置き換わります',
    body: `いまこの端末にある記録 ${state.user.length}件・手直し ${Object.keys(state.overrides).length}件は、`
      + `ファイルの内容（記録 ${bundle.entries.length}件・手直し ${Object.keys(bundle.overrides).length}件）に置き換わります。`,
    payload: { bundle },
    actions: [{ kind: 'import', label: '読み込む', danger: true }],
  });
}

/** おみくじの中身だけを落として、お参りの記録として残す形。 */
const WITHOUT_OMIKUJI = {
  type: TYPE_VISIT,
  title: '参拝',
  number: null,
  fortune: null,
  poem: null,
  teaching: null,
  overview: null,
  items: [],
};

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

  if (pending.kind === 'hide') {
    const patch = { ...(state.overrides[pending.id] || {}), deleted: true };
    const nextOverrides = setOverride(state.overrides, pending.id, patch);
    closeDetail();
    setState({ overrides: nextOverrides });
    toast('一覧から外しました');
    return;
  }

  // おみくじの中身だけを落とし、お参りの記録としては残す
  if (pending.kind === 'omikuji-only-builtin') {
    const patch = { ...(state.overrides[pending.id] || {}), ...WITHOUT_OMIKUJI };
    setState({ overrides: setOverride(state.overrides, pending.id, patch) });
    toast('おみくじを消して、お参りの記録として残しました');
    return;
  }

  if (pending.kind === 'omikuji-only-user') {
    const entry = findEntry(pending.id);
    if (!entry) return;
    const nextUser = updateUser(state.user, { ...entry, ...WITHOUT_OMIKUJI });
    setState({ user: nextUser });
    toast('おみくじを消して、お参りの記録として残しました');
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
  const count = state.user.length;
  const patches = Object.keys(state.overrides).length;
  if (!count && !patches) {
    toast('書き出すものがありません。');
    return;
  }
  try {
    const bundle = buildBundle(state.user, state.overrides, new Date().toISOString());
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omikuji-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`自分の記録${count}件・手直し${patches}件を書き出しました`);
  } catch (err) {
    toast(`書き出せませんでした（${err.message}）`);
  }
}

function onImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
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
  // 離れるタブの位置を覚えておき、戻ってきたら同じ場所を見せる
  if (state.view !== name) scrollByView.set(state.view, window.scrollY);

  state = { ...state, view: name };
  dom.viewTop.hidden = name !== 'top';
  dom.viewVisits.hidden = name !== 'visits';
  dom.viewList.hidden = name !== 'list';
  dom.viewSettings.hidden = name !== 'settings';
  dom.appbarTitle.textContent = VIEW_TITLE[name] || 'おみくじ帳';
  document.querySelectorAll('.tab').forEach((tab) => {
    const on = tab.dataset.view === name;
    tab.classList.toggle('is-active', on);
    if (on) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  window.scrollTo(0, scrollByView.get(name) || 0);
}

// ---------- 初回の案内（4-13） ----------

function showIntroIfFirstTime() {
  if (introSeen()) return;
  const box = document.createElement('div');
  box.className = 'intro';
  const p = document.createElement('p');
  p.textContent = 'これまでの記録が入っています。カレンダーの日を押すとその回を読めます。新しく引いたら右下の＋から足せます。';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '閉じる';
  close.addEventListener('click', () => { markIntroSeen(); box.remove(); });
  box.append(p, close);
  dom.viewTop.insertBefore(box, dom.viewTop.firstChild);
}

// ---------- 電波の状態を伝える（4-06） ----------

function syncOnlineState() {
  const offline = !navigator.onLine;
  const banner = $('offline');
  if (banner) banner.hidden = !offline;
  document.body.classList.toggle('is-offline', offline);
}

// ---------- Service Worker ----------

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

  dom.visitSearch.addEventListener('input', (e) => setState({ visitQuery: e.target.value.trim() }));
  dom.visitSearchClear.addEventListener('click', () => {
    dom.visitSearch.value = '';
    setState({ visitQuery: '' });
    dom.visitSearch.focus();
  });

  dom.calPrev.addEventListener('click', () => setState({ calMonth: shiftMonth(currentMonth(), -1) }));
  dom.calNext.addEventListener('click', () => setState({ calMonth: shiftMonth(currentMonth(), 1) }));
  dom.calMonth.addEventListener('click', () => {
    const [y, m] = currentMonth().split('-').map(Number);
    dom.calYear.value = String(y);
    dom.calMonthSel.value = String(m);
    dom.calJump.hidden = !dom.calJump.hidden;
    if (!dom.calJump.hidden) dom.calYear.focus();
  });
  const jump = () => {
    const y = Number(dom.calYear.value);
    const m = Number(dom.calMonthSel.value);
    setState({ calMonth: `${y}-${String(m).padStart(2, '0')}` });
  };
  dom.calYear.addEventListener('change', jump);
  dom.calMonthSel.addEventListener('change', jump);
  dom.calJumpClose.addEventListener('click', () => { dom.calJump.hidden = true; dom.calMonth.focus(); });

  dom.detailClose.addEventListener('click', closeDetail);
  dom.detailDelete.addEventListener('click', askDelete);
  dom.detailEdit.addEventListener('click', () => {
    const entry = findEntry(state.openId);
    if (entry) startEdit(entry);
  });
  dom.detailPrev.addEventListener('click', () => step(-1));
  dom.detailNext.addEventListener('click', () => step(1));

  dom.fab.addEventListener('click', () => { resetForm(); openForm(); });
  dom.formClose.addEventListener('click', () => { resetForm(); closeForm(); });
  dom.form.addEventListener('submit', onSubmit);
  dom.form.querySelectorAll('input[name="kind"]').forEach((radio) => {
    radio.addEventListener('change', syncKindFields);
  });
  dom.fPreset.addEventListener('change', () => applyPreset(dom.fPreset.value));
  dom.fNumber.addEventListener('change', syncNumberOther);

  dom.unhideBtn.addEventListener('click', () => {
    setState({ overrides: unhideAll(state.overrides) });
    toast('一覧に戻しました');
  });
  dom.exportBtn.addEventListener('click', onExport);
  dom.importBtn.addEventListener('click', () => dom.importFile.click());
  dom.importFile.addEventListener('change', onImportFile);

  const add = async () => {
    dom.promo.hidden = true;
    const outcome = await promptInstall();
    if (outcome === 'accepted') toast('ホーム画面に追加しました');
    renderInstall();
  };
  dom.installBtn.addEventListener('click', add);
  dom.promoAdd.addEventListener('click', add);
  dom.promoLater.addEventListener('click', () => {
    markDismissed();          // 断られたら二度と出さない
    dom.promo.hidden = true;
    renderInstall();
  });

  // 端末の戻る操作で詳細を閉じる（standalone にはブラウザの戻るがない）
  window.addEventListener('popstate', () => {
    const id = hashId();
    if (id) {
      const entry = findEntry(id);
      if (entry) openDetail(entry, { push: false });
    } else {
      closeDetail({ pop: false });
    }
  });

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
  buildFormOptions();
  resetForm();
  registerServiceWorker();

  syncOnlineState();
  window.addEventListener('online', syncOnlineState);
  window.addEventListener('offline', syncOnlineState);

  watchInstall();
  onAvailable(renderInstall);

  // 上まで戻っているときは罫を消し、地と一続きに見せる
  const syncBarLine = () => dom.appbar.classList.toggle('is-scrolled', window.scrollY > 4);
  syncBarLine();
  window.addEventListener('scroll', syncBarLine, { passive: true });

  const { entries: user, warning } = loadUser();
  if (warning) toast(warning);
  const overrides = loadOverrides();

  try {
    const builtin = await loadBuiltIn();
    setState({ builtin, overrides, user });
    showIntroIfFirstTime();
    // URL で名指しされた記録があれば開く（共有されたリンクから来た場合）
    const id = hashId();
    if (id) {
      const entry = findEntry(id);
      if (entry) openDetail(entry, { push: false });
    }
  } catch (err) {
    setState({ builtin: [], overrides, user });
    dom.empty.hidden = false;
    dom.emptyTitle.textContent = '記録を読み込めませんでした';
    dom.emptyBody.textContent = `${err.message} 通信を確認して画面を開き直してください。`;
    dom.emptyReset.hidden = true;
  }
}

main();
