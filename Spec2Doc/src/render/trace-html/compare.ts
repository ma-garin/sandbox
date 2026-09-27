// traceability.html の比較タブ（ベースラインとの追加・削除・変更・変化なし）と、下段の監査の記録（すべての変更）。
// サーバ API が無い間（404）は空として扱い、画面は壊さない。
// 書き方の制約は lib.ts と同じ（String.raw の中。バッククォート・「$」+「{」・「</script」を書かない）。宣言だけを並べる。

export const TRACE_COMPARE_JS = String.raw`
var CMP = { runs: null, failed: '', base: '', result: null, loading: false, error: '', auto: false };
var CMP_KIND = { added: ['追加', 'badge badge-low'], removed: ['削除', 'badge badge-critical'], changed: ['変更', 'badge badge-high'] };
var CMP_MAX = 300;
var AUDIT_ALL_MAX = 200;

function getJson(url) {
  return fetch(url, { headers: { Accept: 'application/json' } }).then(function (res) {
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('サーバの応答が ' + res.status + ' でした。');
    return res.json();
  });
}
/** 同じ入力元の過去の実行（GET /api/runs）。この実行の入力元は一覧の中の自分から取る */
function loadRuns() {
  var url = apiParts(API).runs;
  if (!url) { CMP.runs = []; return; }
  getJson(url).then(function (json) {
    var list = json && Array.isArray(json.runs) ? json.runs : [];
    var me = list.filter(function (r) { return r && r.runId === GRAPH.runId; })[0];
    CMP.runs = sameSourceRuns(list.filter(function (r) { return r && r.hasTrace !== false; }), me ? me.source : GRAPH.source, GRAPH.runId);
    if (state.tab === 'compare') renderCompare();
  }).catch(function (e) {
    CMP.runs = [];
    CMP.failed = (e && e.message) || '通信に失敗しました。';
    if (state.tab === 'compare') renderCompare();
  });
}
function runCompare(base) {
  CMP.base = base;
  CMP.result = null;
  CMP.error = '';
  CMP.loading = !!base;
  renderCompare();
  if (!base) return;
  getJson(apiParts(API).run + '/trace-compare?base=' + encodeURIComponent(base)).then(function (json) {
    if (CMP.base !== base) return;
    CMP.loading = false;
    if (!json) CMP.error = 'サーバがまだ比較に対応していません。';
    else CMP.result = compareRows(json, LINK_BY_ID);
    renderCompare();
  }).catch(function (e) {
    if (CMP.base !== base) return;
    CMP.loading = false;
    CMP.error = (e && e.message) || '通信に失敗しました。';
    renderCompare();
  });
}
function openLinkInManage(id) {
  state.filter = emptyFilter();
  syncFilterInputs();
  state.page = 0;
  state.current = id;
  showTab('manage');
}
function linkCell(l) {
  var td = el('td', 'cell-wrap');
  if (!l.summary) { td.appendChild(el('span', 'muted', 'この実行に無い対応（ID ' + l.id + '）')); return td; }
  var b = el('button', 'nb-btn', l.summary);
  b.type = 'button';
  b.addEventListener('click', function () { openLinkInManage(l.id); });
  td.appendChild(b);
  return td;
}
function compareRow(kind, l) {
  var tr = el('tr');
  var k = el('td');
  k.appendChild(el('span', CMP_KIND[kind][1], CMP_KIND[kind][0]));
  tr.appendChild(k);
  tr.appendChild(el('td', '', l.docId ? docLabel(l.docId) : '—'));
  tr.appendChild(el('td', 'cell-wrap', l.section || '—'));
  tr.appendChild(linkCell(l));
  tr.appendChild(el('td', '', l.summary ? LABELS.status[statusOf(state.review, l.id)] : '—'));
  return tr;
}
function renderCompareBar() {
  var baseline = state.review.baselineRunId || '';
  var sel = $('c-base');
  sel.textContent = '';
  var runs = CMP.runs || [];
  var first = el('option', '', !API ? 'サーバから開いたときに選べます' : !CMP.runs ? '読み込んでいます…' : runs.length ? '選んでください' : '同じ入力元の過去の実行がありません');
  first.value = '';
  sel.appendChild(first);
  runs.forEach(function (r) {
    var o = el('option', '', (r.at ? formatJst(r.at) + '・' : '') + r.runId + (r.runId === baseline ? '（ベースライン）' : ''));
    o.value = r.runId;
    sel.appendChild(o);
  });
  sel.value = CMP.base;
  sel.disabled = !runs.length;
  $('c-note').textContent = !API ? 'サーバから開いたときに、同じ入力元の過去の実行と比べられます'
    : CMP.failed ? '実行の一覧を読み込めませんでした。' + CMP.failed + ' 読み込み直してください'
    : 'ベースライン: ' + (baseline ? (baseline === GRAPH.runId ? 'この実行' : baseline) : '未設定（下のボタンでこの実行を固定できます）');
  var isBase = baseline === GRAPH.runId;
  var btn = $('c-set-baseline');
  btn.textContent = isBase ? 'この実行がベースラインです' : 'この実行をベースラインにする';
  btn.setAttribute('aria-disabled', String(isBase));
}
function renderCompareKpi() {
  var row = $('c-kpi');
  row.textContent = '';
  var r = CMP.result;
  row.hidden = !r;
  $('tab-compare-count').hidden = !r;
  if (!r) return;
  [['追加', r.added.length], ['削除', r.removed.length], ['変更', r.changed.length], ['変化なし', r.unchanged]].forEach(function (x) {
    var card = el('div', 'card kpi');
    card.appendChild(el('span', 'kpi-label', x[0]));
    card.appendChild(el('span', 'kpi-value', x[1]));
    row.appendChild(card);
  });
  $('tab-compare-count').textContent = String(r.added.length + r.removed.length + r.changed.length);
}
function renderCompare() {
  var baseline = state.review.baselineRunId || '';
  if (!CMP.auto && CMP.runs && baseline && baseline !== GRAPH.runId && CMP.runs.some(function (r) { return r.runId === baseline; })) {
    CMP.auto = true;
    runCompare(baseline);
    return;
  }
  renderCompareBar();
  renderCompareKpi();
  var body = $('c-body');
  body.textContent = '';
  if (!API) emptyRow(body, 5, '比較はサーバから開いたときに使えます', 'Spec2Doc の画面からトレーサビリティを開いてください');
  else if (CMP.loading) emptyRow(body, 5, '比べています…', '');
  else if (CMP.error) emptyRow(body, 5, '比較できませんでした', CMP.error + ' 別の実行を選ぶか、読み込み直してください');
  else if (!CMP.result) emptyRow(body, 5, '比べる実行を選んでください', '上で同じ入力元の過去の実行を選ぶと、追加・削除・変更の一覧が出ます');
  else {
    var rows = [];
    ['changed', 'added', 'removed'].forEach(function (k) { CMP.result[k].forEach(function (l) { rows.push([k, l]); }); });
    rows.slice(0, CMP_MAX).forEach(function (x) { body.appendChild(compareRow(x[0], x[1])); });
    if (rows.length > CMP_MAX) emptyRow(body, 5, 'ほか ' + (rows.length - CMP_MAX) + ' 件', 'すべてを見るには Excel（マトリクス）か ReqIF で書き出してください');
    if (!rows.length) emptyRow(body, 5, 'ベースラインから変わった対応はありません', '変化なし ' + CMP.result.unchanged + ' 件');
  }
  renderAuditAll();
}
function setThisBaseline() {
  if (state.review.baselineRunId === GRAPH.runId) return;
  state.review = setBaseline(state.review, GRAPH.runId);
  scheduleSave();
  toast('ok', 'この実行をベースラインにしました', '次の実行からこの実行と比べられます');
  renderCompare();
}

/* ── 監査の記録（すべての変更。新しい順） ── */
function renderAuditAll() {
  var body = $('audit-body');
  body.textContent = '';
  if (!API) { emptyRow(body, 5, '監査の記録はサーバから開いたときに出ます', 'Spec2Doc の画面からトレーサビリティを開いてください'); return; }
  if (!AUDIT.loaded) {
    emptyRow(body, 5, AUDIT.failed ? '監査の記録を読み込めませんでした' : '監査の記録を読み込んでいます…', AUDIT.failed ? 'サーバが動いているか確かめて、読み込み直してください' : '');
    return;
  }
  if (!AUDIT.events.length) { emptyRow(body, 5, 'まだ変更の記録はありません', '状態・メモ・コメントを変えると、誰がいつ変えたかがここに残ります'); return; }
  AUDIT.events.slice(0, AUDIT_ALL_MAX).forEach(function (ev) {
    var tr = el('tr');
    tr.appendChild(el('td', 'mono', formatJst(ev.at)));
    tr.appendChild(el('td', '', ev.by || '名前なし'));
    var l = LINK_BY_ID.get(ev.linkId);
    tr.appendChild(l ? linkCell(l) : el('td', 'muted', ev.linkId || '—'));
    tr.appendChild(el('td', '', AUDIT_FIELD_LABEL[ev.field] || ev.field));
    tr.appendChild(el('td', 'cell-wrap', auditChange(ev)));
    body.appendChild(tr);
  });
  if (AUDIT.events.length > AUDIT_ALL_MAX) emptyRow(body, 5, 'ほか ' + (AUDIT.events.length - AUDIT_ALL_MAX) + ' 件', '新しい ' + AUDIT_ALL_MAX + ' 件だけを出しています');
}
function openAudit() {
  showTab('compare');
  if (!AUDIT.loaded) loadAudit();
  $('audit').scrollIntoView({ block: 'start' });
}
`;
