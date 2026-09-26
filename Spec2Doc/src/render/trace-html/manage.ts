// traceability.html の管理タブ（文書→節のグループ表・一括変更・右の詳細欄で状態とメモ）と抜けタブ。
// app.ts の state・GRAPH・LABELS 等を使う（同じ IIFE の中。上から順に宣言だけを並べ、初期化は app.ts の末尾）。
// 書き方の制約は lib.ts と同じ（String.raw の中。バッククォート・「$」+「{」・「</script」を書かない）。

export const TRACE_MANAGE_JS = String.raw`
var BULK_ORDER = ['ok', 'ng', 'na', 'unreviewed'];
var ORIGIN_LABEL = { llm: 'LLM', analysis: '解析による対応付け' };
var TOTALS = null;

/** 文書・節ごとの全件（絞り込み前）。判定済みの割合の分母 */
function totals() {
  if (TOTALS) return TOTALS;
  TOTALS = { doc: new Map(), sec: new Map() };
  GRAPH.links.forEach(function (l) {
    var sk = l.docId + '\u0000' + l.section;
    if (!TOTALS.doc.has(l.docId)) TOTALS.doc.set(l.docId, []);
    if (!TOTALS.sec.has(sk)) TOTALS.sec.set(sk, []);
    TOTALS.doc.get(l.docId).push(l);
    TOTALS.sec.get(sk).push(l);
  });
  return TOTALS;
}
function judgedText(links) {
  var j = links.filter(function (l) { return statusOf(state.review, l.id) !== 'unreviewed'; }).length;
  return '判定済み ' + pct(j, links.length);
}

function renderKpi() {
  var c = statusCounts(GRAPH, state.review);
  var row = $('m-kpi');
  row.textContent = '';
  function kpi(label, value, sub) {
    var card = el('div', 'card kpi');
    card.appendChild(el('span', 'kpi-label', label));
    card.appendChild(el('span', 'kpi-value', value));
    if (sub) card.appendChild(el('span', 'kpi-delta', sub));
    row.appendChild(card);
  }
  kpi('全件', c.total, '');
  STATUS_KEYS.forEach(function (k) { kpi(LABELS.status[k], c[k], pct(c[k], c.total)); });
}
function renderChips() {
  var row = $('m-chips');
  row.textContent = '';
  var f = state.filter;
  var items = [
    ['doc', '文書: ' + docLabel(f.doc), f.doc], ['status', '状態: ' + LABELS.status[f.status], f.status],
    ['evidence', '根拠: ' + LABELS.evidence[f.evidence], f.evidence], ['text', '語: ' + f.text, f.text],
    ['node', '点: ' + (f.node ? f.node.label : ''), f.node],
  ];
  items.forEach(function (it) {
    if (!it[2]) return;
    var chip = el('span', 'chip', it[1]);
    var x = el('button', 'x');
    x.type = 'button';
    x.setAttribute('aria-label', it[1] + ' を外す');
    x.innerHTML = ICON.closeSmall;
    x.addEventListener('click', function () {
      state.filter[it[0]] = it[0] === 'node' ? null : '';
      var input = $('f-' + it[0]);
      if (input) input.value = '';
      state.page = 0;
      renderManage();
    });
    chip.appendChild(x);
    row.appendChild(chip);
  });
}

/* ── 一括変更 ── */
function renderBulk() {
  var bar = $('m-bulk');
  bar.textContent = '';
  var ids = state.pageIds;
  var all = el('label', 'bulk-all');
  var cb = el('input');
  cb.type = 'checkbox';
  cb.checked = ids.length > 0 && ids.every(function (id) { return state.checked.has(id); });
  cb.addEventListener('change', function () {
    ids.forEach(function (id) { if (cb.checked) state.checked.add(id); else state.checked.delete(id); });
    renderManage();
  });
  all.appendChild(cb);
  all.appendChild(el('span', '', 'このページの ' + ids.length + ' 件を選ぶ'));
  bar.appendChild(all);
  var n = state.checked.size;
  bar.appendChild(el('span', 'bulk-count', '選んだ ' + n + ' 件の状態を'));
  BULK_ORDER.forEach(function (k) {
    var b = el('button', 'btn', LABELS.status[k]);
    b.type = 'button';
    if (!n) b.setAttribute('aria-disabled', 'true');
    else b.addEventListener('click', function () { applyBulk(k); });
    bar.appendChild(b);
  });
  bar.appendChild(el('span', '', 'にする'));
  if (n) {
    var clear = el('button', 'btn btn--ghost', '選択を外す');
    clear.type = 'button';
    clear.addEventListener('click', function () { state.checked.clear(); renderManage(); });
    bar.appendChild(clear);
  }
}
function applyBulk(status) {
  var ids = Array.from(state.checked);
  state.review = setReviewMany(state.review, ids, status, nowIso());
  state.checked.clear();
  scheduleSave();
  toast('ok', ids.length + ' 件を「' + LABELS.status[status] + '」にしました');
  renderManage();
}

/* ── 表（文書 → 節で折りたためるグループ。1 行表示） ── */
function groupRow(key, level, title, shown, all) {
  var tr = el('tr', 'grp grp--' + level);
  var td = el('td');
  td.colSpan = 5;
  var open = !state.collapsed.has(key);
  var b = el('button', 'grp-toggle');
  b.type = 'button';
  b.setAttribute('aria-expanded', String(open));
  b.appendChild(el('span', 'grp-caret', open ? '▾' : '▸'));
  var t = el('span', 'grp-title', title);
  t.title = title;
  b.appendChild(t);
  b.appendChild(el('span', 'grp-meta', shown + ' 件' + (shown !== all.length ? '（全 ' + all.length + ' 件）' : '') + '・' + judgedText(all)));
  b.addEventListener('click', function () {
    if (open) state.collapsed.add(key); else state.collapsed.delete(key);
    renderManage();
  });
  td.appendChild(b);
  tr.appendChild(td);
  return tr;
}
function evidenceTag(ev) { return el('span', 'badge ev-tag ev-tag--' + ev, LABELS.evidence[ev] || ev); }
function selectRow(id) {
  state.current = id;
  document.querySelectorAll('tr[data-link]').forEach(function (r) { r.classList.toggle('is-selected', r.getAttribute('data-link') === id); });
  renderLinkDetail();
}
function linkRow(l) {
  var tr = el('tr', 'link-row' + (state.current === l.id ? ' is-selected' : ''));
  tr.tabIndex = 0;
  tr.setAttribute('data-link', l.id);
  var c = el('td', 'col-check');
  var cb = el('input');
  cb.type = 'checkbox';
  cb.checked = state.checked.has(l.id);
  cb.setAttribute('aria-label', '選ぶ: ' + l.summary.slice(0, 40));
  cb.addEventListener('click', function (ev) { ev.stopPropagation(); });
  cb.addEventListener('change', function () {
    if (cb.checked) state.checked.add(l.id); else state.checked.delete(l.id);
    renderBulk();
  });
  c.appendChild(cb);
  tr.appendChild(c);
  var s = el('td', '', l.summary);
  s.title = l.summary;
  tr.appendChild(s);
  var ev = el('td');
  ev.appendChild(evidenceTag(l.evidence));
  tr.appendChild(ev);
  var all = l.sources.map(formatSource);
  var src = el('td', all.length ? 'mono' : 'muted', all.length ? all[0] + (all.length > 1 ? ' ほか ' + (all.length - 1) : '') : 'なし');
  src.title = all.join('\n');
  tr.appendChild(src);
  var st = statusOf(state.review, l.id);
  tr.appendChild(el('td', 'st st--' + st, LABELS.status[st]));
  tr.addEventListener('click', function () { selectRow(l.id); });
  tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRow(l.id); } });
  return tr;
}
function emptyRow(tbody, cols, title, description) {
  var tr = el('tr');
  var td = el('td');
  td.colSpan = cols;
  var box = el('div', 'empty-state');
  box.appendChild(el('p', 'empty-state-title', title));
  box.appendChild(el('p', 'empty-state-description', description));
  td.appendChild(box);
  tr.appendChild(td);
  tbody.appendChild(tr);
}
function renderPager(bar, total, page, onPage) {
  bar.textContent = '';
  var pages = Math.max(1, Math.ceil(total / PAGE));
  var from = total ? page * PAGE + 1 : 0;
  bar.appendChild(el('span', 'muted', total + ' 件中 ' + from + '〜' + Math.min(total, (page + 1) * PAGE) + ' 件'));
  var nav = el('nav', 'pager');
  nav.setAttribute('aria-label', 'ページ');
  function btn(label, p, active, disabled) {
    var b = el('button', 'page' + (active ? ' active' : ''), label);
    b.type = 'button';
    if (active) b.setAttribute('aria-current', 'page');
    if (disabled) b.setAttribute('aria-disabled', 'true');
    else b.addEventListener('click', function () { onPage(p); });
    nav.appendChild(b);
  }
  btn('前へ', page - 1, false, page === 0);
  var last = -1;
  for (var p = 0; p < pages; p++) {
    if (p !== 0 && p !== pages - 1 && Math.abs(p - page) > 2) continue;
    if (last >= 0 && p - last > 1) nav.appendChild(el('span', 'page gap', '…'));
    btn(String(p + 1), p, p === page, false);
    last = p;
  }
  btn('次へ', page + 1, false, page >= pages - 1);
  bar.appendChild(nav);
}
function renderManage() {
  renderKpi();
  renderChips();
  var groups = groupLinks(filterLinks(GRAPH, state.review, state.filter));
  var shownDoc = new Map(), shownSec = new Map(), rows = [];
  groups.forEach(function (g) {
    shownDoc.set(g.docId, g.count);
    g.sections.forEach(function (s) { shownSec.set(g.docId + '\u0000' + s.section, s.links.length); rows = rows.concat(s.links); });
  });
  state.rows = rows;
  var pages = Math.max(1, Math.ceil(rows.length / PAGE));
  if (state.page >= pages) state.page = pages - 1;
  var pageRows = rows.slice(state.page * PAGE, (state.page + 1) * PAGE);
  state.pageIds = pageRows.map(function (l) { return l.id; });
  var tbody = $('m-body');
  tbody.textContent = '';
  var lastDoc = null, lastSec = null, t = totals();
  pageRows.forEach(function (l) {
    var dk = 'doc:' + l.docId, sKey = l.docId + '\u0000' + l.section, sk = 'sec:' + sKey;
    if (l.docId !== lastDoc) { tbody.appendChild(groupRow(dk, 'doc', docLabel(l.docId), shownDoc.get(l.docId), t.doc.get(l.docId))); lastDoc = l.docId; lastSec = null; }
    if (state.collapsed.has(dk)) return;
    if (l.section !== lastSec) { tbody.appendChild(groupRow(sk, 'sec', l.section, shownSec.get(sKey), t.sec.get(sKey))); lastSec = l.section; }
    if (state.collapsed.has(sk)) return;
    tbody.appendChild(linkRow(l));
  });
  if (!rows.length) {
    emptyRow(tbody, 5, GRAPH.links.length ? '条件に合う行はありません' : '文書の行がありません',
      GRAPH.links.length ? '上の絞り込みを × で外すと全件が出ます' : '文書を生成し直すと、根拠のある行がここに並びます');
  }
  renderBulk();
  renderPager($('m-pagebar'), rows.length, state.page, function (p) { state.page = p; renderManage(); $('m-table').scrollIntoView({ block: 'start' }); });
  renderLinkDetail();
}

/* ── 右の詳細欄（状態とメモの編集） ── */
function changeStatus(id, status) {
  var idx = state.rows.findIndex(function (r) { return r.id === id; });
  state.review = setReview(state.review, id, { status: status }, nowIso());
  scheduleSave();
  var still = new Set(filterLinks(GRAPH, state.review, state.filter).map(function (r) { return r.id; }));
  if (idx >= 0 && !still.has(id)) {
    var rest = state.rows.filter(function (r) { return r.id === id || still.has(r.id); });
    var next = rest[rest.findIndex(function (r) { return r.id === id; }) + 1];
    if (next) state.current = next.id;
  }
  renderManage();
}
function renderLinkDetail() {
  var box = $('m-detail');
  box.textContent = '';
  var l = state.current ? LINK_BY_ID.get(state.current) : null;
  if (!l) { box.appendChild(el('p', 'muted', '行を選ぶと、ここで状態とメモを付けられます')); return; }
  var e = entryOf(state.review, l.id);
  box.appendChild(el('p', 'detail-kind', docLabel(l.docId)));
  box.appendChild(el('h2', 'detail-title', l.summary));
  var dl = el('dl', 'detail-meta');
  addMeta(dl, '節', l.section);
  addMeta(dl, '根拠', LABELS.evidence[l.evidence] || l.evidence);
  if (l.origin) addMeta(dl, '推測の出どころ', ORIGIN_LABEL[l.origin] || l.origin);
  addMeta(dl, 'D09 参照', l.d09Ref);
  addMeta(dl, 'ソース位置', l.sources.length ? l.sources.map(formatSource).join('\n') : 'なし', 'mono pre');
  if (e) addMeta(dl, '更新', formatJst(e.updatedAt));
  if (e && e.carriedFrom) addMeta(dl, '引き継ぎ元', e.carriedFrom);
  box.appendChild(dl);
  var cur = statusOf(state.review, l.id);
  var seg = el('div', 'seg detail-status');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', '状態');
  STATUS_KEYS.forEach(function (k) {
    var b = el('button', k === cur ? 'active' : '', LABELS.status[k]);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(k === cur));
    b.addEventListener('click', function () { if (k !== cur) changeStatus(l.id, k); });
    seg.appendChild(b);
  });
  box.appendChild(seg);
  var field = el('div', 'field detail-memo');
  var label = el('label', '', 'メモ');
  label.htmlFor = 'm-note';
  var ta = el('textarea', 'textarea');
  ta.id = 'm-note';
  ta.maxLength = NOTE_MAX;
  ta.value = e && e.note ? e.note : '';
  var count = el('span', 'muted', ta.value.length + ' / ' + NOTE_MAX);
  ta.addEventListener('input', function () {
    state.review = setReview(state.review, l.id, { note: ta.value }, nowIso());
    count.textContent = ta.value.length + ' / ' + NOTE_MAX;
    scheduleSave();
  });
  field.appendChild(label);
  field.appendChild(ta);
  field.appendChild(count);
  box.appendChild(field);
  var nav = el('div', 'detail-nav');
  var i = state.rows.findIndex(function (r) { return r.id === l.id; });
  [['前の行', i - 1], ['次の行', i + 1]].forEach(function (x) {
    var b = el('button', 'btn', x[0]);
    b.type = 'button';
    var target = i >= 0 ? state.rows[x[1]] : null;
    if (!target) b.setAttribute('aria-disabled', 'true');
    else b.addEventListener('click', function () { selectRow(target.id); });
    nav.appendChild(b);
  });
  var node = NODE_BY_ID.get(l.irIds.length ? 'code:' + l.irIds[0] : l.sectionNodeId) || NODE_BY_ID.get(l.sectionNodeId);
  if (node) {
    var g = el('button', 'btn btn--ghost', '関係図で見る');
    g.type = 'button';
    g.addEventListener('click', function () { revealNode(node); });
    nav.appendChild(g);
  }
  box.appendChild(nav);
}

/* ── 抜け ── */
function undocRow(n) {
  var tr = el('tr');
  tr.appendChild(el('td', '', KIND_LABEL[n.kind]));
  var name = el('td', 'cell-wrap');
  var b = el('button', 'nb-btn', n.label);
  b.type = 'button';
  b.addEventListener('click', function () { revealNode(n); });
  name.appendChild(b);
  tr.appendChild(name);
  var parent = n.parent ? NODE_BY_ID.get(n.parent) : null;
  var where = n.path || (parent && parent.path ? parent.path + (n.line ? ':' + n.line : '') : '');
  tr.appendChild(el('td', 'mono cell-wrap', where));
  tr.appendChild(el('td', '', n.codeKind || (n.fileStatus ? FILE_STATUS_LABEL[n.fileStatus] : '')));
  return tr;
}
function noSourceRow(l) {
  var tr = el('tr');
  tr.appendChild(el('td', '', l.docId));
  tr.appendChild(el('td', 'cell-wrap', l.section));
  tr.appendChild(el('td', 'cell-wrap', l.summary));
  var ev = el('td');
  ev.appendChild(evidenceTag(l.evidence));
  tr.appendChild(ev);
  tr.appendChild(el('td', '', LABELS.status[statusOf(state.review, l.id)]));
  return tr;
}
function renderGapTable(key, rows, rowFn, cols, emptyTitle, emptyDesc) {
  var body = $('gap-' + key + '-body');
  body.textContent = '';
  var page = state.gapPage[key];
  rows.slice(page * PAGE, (page + 1) * PAGE).forEach(function (r) { body.appendChild(rowFn(r)); });
  if (!rows.length) emptyRow(body, cols, emptyTitle, emptyDesc);
  renderPager($('gap-' + key + '-pagebar'), rows.length, page, function (p) { state.gapPage[key] = p; renderGaps(); });
}
function renderGaps() {
  renderGapTable('u', GAPS.undocumented, undocRow, 4, '未記述の要素はありません', 'すべてのファイルとコード要素がどこかの節から参照されています');
  renderGapTable('s', GAPS.noSource, noSourceRow, 5, '根拠の無い行はありません', 'すべての行にソース位置があります');
}

/* ── 絞り込み（既定は状態=未確認） ── */
function fillSelect(id, entries) {
  var s = $(id);
  entries.forEach(function (e) { var o = el('option', '', e[1]); o.value = e[0]; s.appendChild(o); });
  return s;
}
function initFilters() {
  var docs = Array.from(new Set(GRAPH.links.map(function (l) { return l.docId; }))).sort();
  fillSelect('f-doc', docs.map(function (d) { return [d, docLabel(d)]; }));
  fillSelect('f-status', STATUS_KEYS.map(function (k) { return [k, LABELS.status[k]]; }));
  fillSelect('f-evidence', Object.keys(LABELS.evidence).map(function (k) { return [k, LABELS.evidence[k]]; }));
  $('f-status').value = state.filter.status;
  ['doc', 'status', 'evidence'].forEach(function (k) {
    $('f-' + k).addEventListener('change', function () { state.filter[k] = $('f-' + k).value; state.page = 0; renderManage(); });
  });
  var timer = 0;
  $('f-text').addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { state.filter.text = $('f-text').value; state.page = 0; renderManage(); }, 200);
  });
}
`;
