// traceability.html の画面の共通部と関係図タブ（トースト・保存・書き出し・タブ・関係図・初期化）。管理と抜けは manage.ts。
// 表示は textContent だけ。innerHTML に入れるのは自前のアイコン（ICON）だけ。
// 書き方の制約は lib.ts と同じ（String.raw の中。バッククォート・「$」+「{」・「</script」を書かない）。

export const TRACE_APP_JS = String.raw`
var PAGE = 100;
var FOLD_LIMIT = 800;
var EXPAND_LIMIT = 300;
var KIND_LABEL = { folder: 'フォルダ', file: 'ファイル', code: 'コード要素', doc: '文書', section: '節' };
var FILE_STATUS_LABEL = { analyzed: '解析済み', failed: '解析失敗', excluded: '対象外', unsupported: '未対応' };

function $(id) { return document.getElementById(id); }
function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = String(text);
  return e;
}
function nowIso() { return new Date().toISOString(); }
function clock() { return new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function pct(n, total) { return total ? Math.round((n / total) * 1000) / 10 + '%' : '0%'; }

var DATA = JSON.parse($('trace-data').textContent);
var GRAPH = DATA.graph;
var LABELS = DATA.labels;
var API = typeof window.SPEC2DOC_TRACE_API === 'string' && window.SPEC2DOC_TRACE_API ? window.SPEC2DOC_TRACE_API : DATA.apiUrl || '';
var STORE_KEY = 'spec2doc-trace-' + GRAPH.runId;
var NODE_BY_ID = new Map(GRAPH.nodes.map(function (n) { return [n.id, n]; }));
var LINK_BY_ID = new Map(GRAPH.links.map(function (l) { return [l.id, l]; }));
var GAPS = findGaps(GRAPH);
var BIG = GRAPH.nodes.length > FOLD_LIMIT;
var OVERVIEW = overviewGraph(GRAPH);
var state = {
  review: DATA.review || emptyReview(GRAPH.runId),
  tab: 'graph', page: 0, gapPage: { u: 0, s: 0 },
  filter: { doc: '', status: 'unreviewed', evidence: '', text: '', node: null },
  hidden: new Set(), expand: false, detail: false, expanded: null, visible: [], search: { ids: [], i: 0 },
  saveTimer: 0, saveToast: null, selected: null,
  checked: new Set(), collapsed: new Set(), current: null, rows: [], pageIds: [],
};

function docLabel(docId) { return LABELS.docs[docId] ? docId + ' ' + LABELS.docs[docId] : docId; }

/* ── トースト（kit の feedback.js と同じクラス・同じ振る舞い。失敗は消えない） ── */
var toastHost = null;
function toast(kind, message, detail, action) {
  if (!toastHost) {
    toastHost = el('div', 'toast-host');
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  var t = el('div', 'toast toast-' + kind);
  if (kind === 'error') t.setAttribute('role', 'alert');
  var ic = el('span', 'toast-icon');
  ic.innerHTML = kind === 'error' ? ICON.error : kind === 'ok' ? ICON.ok : ICON.info;
  t.appendChild(ic);
  var body = el('div', 'toast-body');
  body.appendChild(el('p', 'toast-message', message));
  if (detail) body.appendChild(el('p', 'toast-detail', detail));
  function remove() {
    if (!t.isConnected) return;
    t.classList.add('is-leaving');
    setTimeout(function () { t.remove(); }, 200);
  }
  if (action) {
    var b = el('button', 'toast-action', action.label);
    b.type = 'button';
    b.addEventListener('click', function () { remove(); action.run(); });
    body.appendChild(b);
  }
  t.appendChild(body);
  var close = el('button', 'toast-close');
  close.type = 'button';
  close.setAttribute('aria-label', '閉じる');
  close.innerHTML = ICON.close;
  close.addEventListener('click', remove);
  t.appendChild(close);
  toastHost.appendChild(t);
  requestAnimationFrame(function () { t.classList.add('is-shown'); });
  if (kind !== 'error') setTimeout(remove, 3000);
  return remove;
}

/* ── 保存（サーバがあれば PUT、無ければ localStorage。変更から 1 秒後にまとめて） ── */
function setSaveStatus(text) { $('t-save').textContent = text; }
function saveFailed(message, detail, action) {
  setSaveStatus('保存できていません');
  if (state.saveToast) state.saveToast();
  state.saveToast = toast('error', message, detail, action);
}
function scheduleSave() {
  clearTimeout(state.saveTimer);
  setSaveStatus('変更を保存します…');
  state.saveTimer = setTimeout(save, 1000);
}
function save(keepalive) {
  clearTimeout(state.saveTimer);
  state.saveTimer = 0;
  // サーバの確認状態を読み込む前に保存すると、画面の古い状態でサーバを上書きして消してしまう
  if (API && !state.remoteReady) {
    if (!state.remoteFailed) { setSaveStatus('保存済みの確認状態を読み込むまで保存を待っています'); state.saveTimer = setTimeout(save, 1000); }
    return;
  }
  var body = JSON.stringify(state.review);
  if (!API) {
    try {
      localStorage.setItem(STORE_KEY, body);
      setSaveStatus('この端末に保存しました（' + clock() + '）');
    } catch (e) {
      saveFailed('確認状態をこの端末に保存できませんでした', 'ブラウザの保存領域が使えません（' + ((e && e.name) || '不明') + '）。JSON で書き出して控えてください', { label: 'JSON で書き出す', run: exportJson });
    }
    return;
  }
  setSaveStatus('保存しています…');
  fetch(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: keepalive === true })
    .then(function (res) {
      if (!res.ok) throw new Error('サーバの応答が ' + res.status + ' でした。');
      if (state.saveToast) { state.saveToast(); state.saveToast = null; }
      setSaveStatus('保存しました（' + clock() + '）');
    })
    .catch(function (e) {
      saveFailed('確認状態をサーバに保存できませんでした', ((e && e.message) || '通信に失敗しました。') + ' サーバが動いているか確かめてから保存し直してください', { label: 'もう一度保存する', run: save });
    });
}
/* サーバから開いたときは、保存済みの確認状態を読み込んでから保存を許す（サーバの状態を優先して重ねる） */
function loadRemote() {
  if (!API) { state.remoteReady = true; return; }
  state.remoteReady = false;
  setSaveStatus('保存済みの確認状態を読み込んでいます…');
  fetch(API, { headers: { Accept: 'application/json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('サーバの応答が ' + res.status + ' でした。');
      return res.json();
    })
    .then(function (json) {
      state.review = mergeReviews(state.review, normalizeReview(json, GRAPH, nowIso()).review);
      state.remoteReady = true;
      setSaveStatus('変更はサーバに保存します');
      renderCurrent();
    })
    .catch(function (e) {
      state.remoteFailed = true;
      saveFailed('保存済みの確認状態を読み込めませんでした', ((e && e.message) || '通信に失敗しました。') + ' 上書きを防ぐため保存を止めています。サーバが動いているか確かめてから読み込み直してください', { label: '読み込み直す', run: function () { location.reload(); } });
    });
}
function loadLocal() {
  if (API) return;
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    state.review = mergeReviews(state.review, normalizeReview(JSON.parse(raw), GRAPH, nowIso()).review);
  } catch (e) {
    toast('error', 'この端末に保存した確認状態を読み込めませんでした', ((e && e.message) || '') + ' 書き出した JSON があれば読み込んでください', { label: 'JSON を読み込む', run: openImport });
  }
}

/* ── 書き出し・読み込み ── */
function download(name, text, type) {
  var a = el('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}
function fileStem() { return GRAPH.runId.replace(/[^A-Za-z0-9._-]/g, '_'); }
function exportJson() {
  download('trace-review-' + fileStem() + '.json', JSON.stringify(state.review, null, 2), 'application/json');
  toast('ok', '確認状態を JSON で書き出しました');
}
function exportCsv() {
  download('trace-' + fileStem() + '.csv', buildCsv(GRAPH, state.review, LABELS), 'text/csv;charset=utf-8');
  toast('ok', CSV_COLUMNS.length + ' 列・' + GRAPH.links.length + ' 行の CSV を書き出しました');
}
function openImport() { $('io-file').click(); }
function importFile(file) {
  file.text().then(function (text) {
    var r = normalizeReview(JSON.parse(text), GRAPH, nowIso());
    state.review = mergeReviews(state.review, r.review);
    scheduleSave();
    renderCurrent();
    toast('ok', r.accepted + ' 行の確認状態を読み込みました', r.skipped ? 'この実行に無い行など ' + r.skipped + ' 件は読み込んでいません' : '');
  }).catch(function (e) {
    var why = e instanceof SyntaxError ? 'JSON として読めません。' : (e && e.message) || '';
    toast('error', 'JSON を読み込めませんでした', why + ' この画面で書き出したファイルを選んでください', { label: '別のファイルを選ぶ', run: openImport });
  });
}

/* ── タブ ── */
var TABS = ['graph', 'manage', 'gaps'];
function showTab(name) {
  state.tab = name;
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    var on = b.getAttribute('data-tab') === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  TABS.forEach(function (t) { $('tab-' + t).hidden = t !== name; });
  document.querySelectorAll('[data-for]').forEach(function (s) { s.hidden = s.getAttribute('data-for').split(' ').indexOf(name) < 0; });
  renderCurrent();
}
function renderCurrent() {
  if (state.tab === 'graph') { view.resize(); if (state.selected) showDetail(state.selected); }
  if (state.tab === 'manage') renderManage();
  if (state.tab === 'gaps') renderGaps();
}

/* ── 関係図（既定は概観。点を選ぶとその点の code・section を足す） ── */
var view = createGraphView($('g-canvas'), onGraphSelect);
function onGraphSelect(node) {
  if (!state.detail) {
    var want = !node ? null : OVERVIEW_KINDS[node.kind] ? node.id : state.expanded;
    if (want !== state.expanded) { state.expanded = want; refreshGraph(); }
  }
  showDetail(node);
}
function graphData() {
  if (state.detail) return foldGraph(GRAPH.nodes, GRAPH.edges, BIG && !state.expand);
  if (!state.expanded) return OVERVIEW;
  var extra = localExpand(GRAPH, state.expanded, EXPAND_LIMIT);
  var extraSet = new Set(extra);
  var ids = new Set(OVERVIEW.nodes.map(function (n) { return n.id; }));
  extra.forEach(function (id) { ids.add(id); });
  return {
    nodes: OVERVIEW.nodes.concat(extra.map(function (id) { return NODE_BY_ID.get(id); }).filter(Boolean)),
    edges: OVERVIEW.edges.concat(GRAPH.edges.filter(function (e) {
      return (extraSet.has(e.from) || extraSet.has(e.to)) && ids.has(e.from) && ids.has(e.to);
    })),
  };
}
function refreshGraph() {
  var f = graphData();
  var ns = f.nodes.filter(function (n) { return !state.hidden.has(n.kind); });
  var ids = new Set(ns.map(function (n) { return n.id; }));
  var es = f.edges.filter(function (e) { return ids.has(e.from) && ids.has(e.to); });
  state.visible = ns;
  view.setData(ns, es);
  $('g-count').textContent = ns.length + ' 点・' + es.length + ' 本' + (state.detail ? '' : '（概観）');
  applySearch(false);
}
function applySearch(move) {
  var q = $('g-search').value.trim().toLowerCase();
  var ids = !q ? [] : GRAPH.nodes.filter(function (n) {
    return n.label.toLowerCase().indexOf(q) >= 0 || (n.path || '').toLowerCase().indexOf(q) >= 0;
  }).map(function (n) { return n.id; });
  state.search.ids = ids;
  view.setMatches(ids);
  $('g-search-count').textContent = !q ? '' : ids.length ? ids.length + ' 件一致（Enter で次へ）' : '一致する点はありません。名前かパスの一部で探してください';
  if (move && ids.length) revealNode(NODE_BY_ID.get(ids[state.search.i % ids.length]));
}
function ownerId(node) {
  if (node.kind === 'code') return node.parent || null;
  if (node.kind === 'section') return node.parent || 'doc:' + node.docId;
  return null;
}
function revealNode(node) {
  if (!node) return;
  if (state.tab !== 'graph') showTab('graph');
  if (!view.has(node.id)) {
    state.hidden.delete(node.kind);
    var cb = document.querySelector('[data-kind="' + node.kind + '"]');
    if (cb) cb.checked = true;
    if (state.detail && node.kind === 'code' && BIG) { state.expand = true; $('g-expand').checked = true; }
    if (!state.detail) state.expanded = ownerId(node);
    refreshGraph();
  }
  view.select(node.id);
  view.centerOn(node.id);
}
function addMeta(dl, key, value, cls) {
  if (value === undefined || value === null || value === '') return;
  dl.appendChild(el('dt', '', key));
  dl.appendChild(el('dd', cls || '', value));
}
function showDetail(node) {
  state.selected = node;
  var box = $('g-detail');
  box.textContent = '';
  if (!node) { box.appendChild(el('p', 'muted', '点を選ぶと、つながる文書の節と確認状態が出ます')); return; }
  box.appendChild(el('p', 'detail-kind', KIND_LABEL[node.kind] || node.kind));
  box.appendChild(el('h2', 'detail-title', node.label));
  var dl = el('dl', 'detail-meta');
  addMeta(dl, 'パス', node.path);
  if (node.kind === 'code') {
    var parent = node.parent ? NODE_BY_ID.get(node.parent) : null;
    var file = parent && parent.path ? parent.path : '';
    addMeta(dl, '定義位置', file ? (node.line ? file + ':' + node.line : file) : node.line ? node.line + ' 行' : '');
    addMeta(dl, '要素の種類', node.codeKind);
  }
  if (node.fileStatus) addMeta(dl, '解析', FILE_STATUS_LABEL[node.fileStatus] || node.fileStatus);
  if (node.docId) addMeta(dl, '文書', docLabel(node.docId));
  box.appendChild(dl);
  detailNeighbors(box, node);
  detailLinks(box, node);
}
function detailNeighbors(box, node) {
  var nb = view.neighbors(node.id).map(function (id) { return NODE_BY_ID.get(id); }).filter(Boolean);
  var sec = el('section', 'detail-sec');
  sec.appendChild(el('h3', '', 'つながる点（' + nb.length + '）'));
  var ul = el('ul', 'detail-list');
  nb.slice(0, 30).forEach(function (n) {
    var li = el('li');
    var b = el('button', 'nb-btn', n.label);
    b.type = 'button';
    b.addEventListener('click', function () { view.select(n.id); view.centerOn(n.id); });
    li.appendChild(el('span', 'sec', KIND_LABEL[n.kind] + ' '));
    li.appendChild(b);
    var labels = view.edgeLabels(node.id, n.id);
    if (labels.length) li.appendChild(el('span', 'edge-label', labels.join(' / ')));
    ul.appendChild(li);
  });
  if (nb.length > 30) ul.appendChild(el('li', 'muted', 'ほか ' + (nb.length - 30) + ' 点'));
  sec.appendChild(ul);
  box.appendChild(sec);
}
function detailLinks(box, node) {
  var ls = linksForNode(GRAPH, node);
  var sec = el('section', 'detail-sec');
  sec.appendChild(el('h3', '', '文書の行と確認状態（' + ls.length + '）'));
  if (!ls.length) { sec.appendChild(el('p', 'muted', 'この点を根拠にした文書の行はありません')); box.appendChild(sec); return; }
  var ul = el('ul', 'detail-list');
  ls.slice(0, 30).forEach(function (l) {
    var li = el('li');
    li.appendChild(el('div', 'sec', docLabel(l.docId) + ' / ' + l.section));
    li.appendChild(el('div', '', l.summary));
    li.appendChild(el('span', 'st st--' + statusOf(state.review, l.id), LABELS.status[statusOf(state.review, l.id)]));
    ul.appendChild(li);
  });
  if (ls.length > 30) ul.appendChild(el('li', 'muted', 'ほか ' + (ls.length - 30) + ' 行'));
  sec.appendChild(ul);
  var go = el('button', 'btn', '管理で ' + ls.length + ' 行を開く');
  go.type = 'button';
  go.addEventListener('click', function () {
    state.filter.node = node;
    state.filter.status = '';
    $('f-status').value = '';
    state.page = 0;
    showTab('manage');
  });
  sec.appendChild(go);
  box.appendChild(sec);
}

/* ── 初期化 ── */
function initSide() {
  var counts = {};
  GRAPH.nodes.forEach(function (n) { counts[n.kind] = (counts[n.kind] || 0) + 1; });
  document.querySelectorAll('[data-kind]').forEach(function (cb) {
    var k = cb.getAttribute('data-kind');
    var c = cb.parentElement.querySelector('.count');
    if (c) c.textContent = String(counts[k] || 0);
    cb.addEventListener('change', function () {
      if (cb.checked) state.hidden.delete(k); else state.hidden.add(k);
      refreshGraph();
    });
  });
  $('g-fold').hidden = true;
  $('g-fold-note').textContent = BIG ? '点が ' + FOLD_LIMIT + ' を超えるため、コード要素をファイルに畳んでいます' : '';
  $('g-detail-mode').addEventListener('change', function () {
    state.detail = $('g-detail-mode').checked;
    state.expanded = null;
    $('g-fold').hidden = !(state.detail && BIG);
    refreshGraph();
    view.fit();
  });
  $('g-expand').addEventListener('change', function () { state.expand = $('g-expand').checked; refreshGraph(); });
  $('g-search').addEventListener('input', function () { state.search.i = 0; applySearch(true); });
  $('g-search').addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    state.search.i++;
    applySearch(true);
  });
  $('g-fit').addEventListener('click', function () { view.fit(); });
}
function initChrome() {
  $('t-meta').textContent = [GRAPH.source, '実行 ' + GRAPH.runId, formatJst(GRAPH.generatedAt), '対応 ' + GRAPH.links.length + ' 件'].filter(Boolean).join(' ・ ');
  $('tab-gaps-count').textContent = String(GAPS.undocumented.length + GAPS.noSource.length);
  document.querySelectorAll('[data-tab]').forEach(function (b, i, all) {
    b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
    b.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      var next = all[(i + (ev.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      next.focus();
      showTab(next.getAttribute('data-tab'));
    });
  });
  $('io-json').addEventListener('click', exportJson);
  $('io-csv').addEventListener('click', exportCsv);
  $('io-import').addEventListener('click', openImport);
  $('io-file').addEventListener('change', function () {
    var f = $('io-file').files[0];
    if (f) importFile(f);
    $('io-file').value = '';
  });
  var side = $('trace-side');
  $('side-open').addEventListener('click', function () { side.classList.add('open'); });
  $('side-close').addEventListener('click', function () { side.classList.remove('open'); });
  setSaveStatus(API ? '変更はサーバに保存します' : '変更はこの端末に保存します');
  window.addEventListener('pagehide', function () { if (state.saveTimer) save(true); });
}

loadLocal();
initChrome();
initSide();
initFilters();
refreshGraph();
showDetail(null);
showTab('graph');
loadRemote();
`;
