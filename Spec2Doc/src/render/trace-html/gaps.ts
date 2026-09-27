// traceability.html の抜けタブ（未記述・根拠なし・トレース先の候補）。候補は根拠付きで出し、「この候補で確認済みにする」で判定する。
// 書き方の制約は lib.ts と同じ（String.raw の中。バッククォート・「$」+「{」・「</script」を書かない）。宣言だけを並べる。

export const TRACE_GAPS_JS = String.raw`
var CAND_SHOW = 5;
var CAND_LINKS = null;

function candidateLinks() {
  if (!CAND_LINKS) CAND_LINKS = GRAPH.links.filter(function (l) { return Array.isArray(l.candidates) && l.candidates.length > 0; });
  return CAND_LINKS;
}
function formatScore(s) { return typeof s === 'number' && isFinite(s) ? String(Math.round(s * 100) / 100) : '—'; }
/** 候補の一覧（名前・スコア・根拠）。onConfirm があれば「この候補で確認済みにする」を付ける */
function candidateList(cands, onConfirm) {
  if (!cands.length) return el('span', 'muted', '—');
  var ul = el('ul', 'cand-list');
  cands.slice(0, CAND_SHOW).forEach(function (c) {
    var li = el('li');
    var n = NODE_BY_ID.get(c.nodeId);
    var b = el('button', 'nb-btn', n ? n.label : c.nodeId);
    b.type = 'button';
    if (n) b.addEventListener('click', function () { revealNode(n); });
    else b.setAttribute('aria-disabled', 'true');
    li.appendChild(b);
    li.appendChild(el('span', 'muted', ' スコア ' + formatScore(c.score)));
    li.appendChild(el('span', 'cand-why', '根拠: ' + (c.why || '記載なし')));
    if (onConfirm) {
      var ok = el('button', 'btn', 'この候補で確認済みにする');
      ok.type = 'button';
      ok.addEventListener('click', function () { onConfirm(c, n); });
      li.appendChild(ok);
    }
    ul.appendChild(li);
  });
  if (cands.length > CAND_SHOW) ul.appendChild(el('li', 'muted', 'ほか ' + (cands.length - CAND_SHOW) + ' 件'));
  return ul;
}
function confirmCandidate(l, c, n) {
  var by = reviewerName(), now = nowIso();
  var text = 'トレース先の候補で確認: ' + (n ? n.label : c.nodeId) + (c.why ? '（根拠: ' + c.why + '）' : '');
  state.review = addComment(confirmLink(state.review, l.id, by, now), l.id, text, by, now);
  scheduleSave();
  noteNoReviewer();
  toast('ok', '「' + l.summary.slice(0, 30) + '」を確認済みにしました', '選んだ候補をコメントに残しました');
  renderKpi();
  renderGaps();
}
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
  var cand = el('td', 'cell-wrap');
  cand.appendChild(candidateList(gapCandidatesFor(GRAPH, n.id), null));
  tr.appendChild(cand);
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
function candRow(l) {
  var tr = el('tr');
  tr.appendChild(el('td', '', l.docId));
  tr.appendChild(el('td', 'cell-wrap', l.section));
  tr.appendChild(el('td', 'cell-wrap', l.summary));
  var st = statusOf(state.review, l.id);
  tr.appendChild(el('td', 'st st--' + st, LABELS.status[st]));
  var cand = el('td', 'cell-wrap');
  cand.appendChild(candidateList(l.candidates, function (c, n) { confirmCandidate(l, c, n); }));
  tr.appendChild(cand);
  return tr;
}
function renderGapTable(key, rows, rowFn, cols, emptyTitle, emptyDesc) {
  var body = $('gap-' + key + '-body');
  body.textContent = '';
  var page = state.gapPage[key] || 0;
  rows.slice(page * PAGE, (page + 1) * PAGE).forEach(function (r) { body.appendChild(rowFn(r)); });
  if (!rows.length) emptyRow(body, cols, emptyTitle, emptyDesc);
  renderPager($('gap-' + key + '-pagebar'), rows.length, page, function (p) { state.gapPage[key] = p; renderGaps(); });
}
function renderGaps() {
  renderGapTable('c', candidateLinks(), candRow, 5, 'トレース先の候補はありません', '解析からトレース先を推定できた行が、根拠と一緒にここに出ます');
  renderGapTable('u', GAPS.undocumented, undocRow, 5, '未記述の要素はありません', 'すべてのファイルとコード要素がどこかの節から参照されています');
  renderGapTable('s', GAPS.noSource, noSourceRow, 5, '根拠の無い行はありません', 'すべての行にソース位置があります');
}
`;
