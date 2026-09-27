// traceability.html のマトリクスタブ（行=文書の節、列=ソースファイル。セル=対応の件数の濃淡・判定済みの割合のバー・要確認の印）。
// セルを押すと管理タブをその節×ファイルで絞り込む。どこにも対応の無い行・列は見出しを色で強調する（カバレッジ）。
// 書き方の制約は lib.ts と同じ（String.raw の中。バッククォート・「$」+「{」・「</script」を書かない）。宣言だけを並べる。

export const TRACE_MATRIX_JS = String.raw`
var MX_STATE = { collapsed: new Set(), onlyGaps: false };

function mxShort(label) {
  var p = String(label).split(' / ');
  return p.length > 2 ? p.slice(-2).join(' / ') : String(label);
}
function emptyBox(title, desc) {
  var box = el('div', 'empty-state');
  box.appendChild(el('p', 'empty-state-title', title));
  box.appendChild(el('p', 'empty-state-description', desc));
  return box;
}
function emptyFilter() {
  return { doc: '', status: '', evidence: '', text: '', node: null, section: '', file: '', suspect: '', kind: '' };
}
function syncFilterInputs() {
  ['doc', 'status', 'evidence', 'text', 'suspect', 'kind'].forEach(function (k) { var i = $('f-' + k); if (i) i.value = state.filter[k] || ''; });
}
/** マトリクスのセルから: 管理タブをその節×ファイルで開く（状態は全件） */
function openManageFor(sectionId, file) {
  state.filter = Object.assign(emptyFilter(), { section: sectionId, file: file });
  syncFilterInputs();
  state.page = 0;
  state.current = null;
  showTab('manage');
}
function matrixCell(r, c, cell, max) {
  var b = el('button', 'mx-btn mx-l' + heatLevel(cell.count, max));
  b.type = 'button';
  b.appendChild(el('span', 'mx-num', cell.count));
  var bar = el('span', 'mx-bar');
  bar.setAttribute('aria-hidden', 'true');
  var fill = el('span', 'mx-bar-fill');
  fill.style.width = Math.round((cell.judged / cell.count) * 100) + '%';
  bar.appendChild(fill);
  b.appendChild(bar);
  if (cell.suspect) {
    var s = el('span', 'mx-sus');
    s.setAttribute('aria-hidden', 'true');
    b.appendChild(s);
  }
  var text = mxShort(r.label) + ' × ' + c.file + ': 対応 ' + cell.count + ' 件・判定済み ' + cell.judged + ' 件' + (cell.suspect ? '・要確認 ' + cell.suspect + ' 件' : '') + '。押すと管理で開きます';
  b.setAttribute('aria-label', text);
  b.title = text;
  b.addEventListener('click', function () { openManageFor(r.id, c.file); });
  return b;
}
function matrixRow(r, cols, max) {
  var tr = el('tr');
  var th = el('th', 'mx-row' + (r.total ? '' : ' is-gap'), mxShort(r.label));
  th.scope = 'row';
  th.title = r.label + (r.total ? '' : '（どのファイルとも対応なし）');
  tr.appendChild(th);
  cols.forEach(function (c) {
    var td = el('td', 'mx-cell');
    var cell = r.cells[c.file];
    if (cell) td.appendChild(matrixCell(r, c, cell, max));
    tr.appendChild(td);
  });
  tr.appendChild(el('td', 'mx-total' + (r.total ? '' : ' is-gap'), r.total));
  return tr;
}
function matrixHead(cols) {
  var thead = el('thead'), r1 = el('tr'), r2 = el('tr');
  var corner = el('th', 'mx-corner', '節 ＼ ファイル');
  corner.rowSpan = 2;
  corner.scope = 'col';
  r1.appendChild(corner);
  var i = 0;
  while (i < cols.length) {
    var j = i;
    while (j < cols.length && cols[j].folder === cols[i].folder) j++;
    var th = el('th', 'mx-folder', cols[i].folder);
    th.colSpan = j - i;
    th.scope = 'colgroup';
    th.title = cols[i].folder;
    r1.appendChild(th);
    i = j;
  }
  var tot = el('th', 'mx-total', '合計');
  tot.rowSpan = 2;
  tot.scope = 'col';
  r1.appendChild(tot);
  cols.forEach(function (c) {
    var h = el('th', 'mx-col' + (c.total ? '' : ' is-gap'), c.name);
    h.scope = 'col';
    h.title = c.file + '（対応 ' + c.total + ' 件' + (c.total ? '' : '・どの節とも対応なし') + '）';
    r2.appendChild(h);
  });
  thead.appendChild(r1);
  thead.appendChild(r2);
  return thead;
}
function matrixDocRow(d, span) {
  var key = d.docId, open = !MX_STATE.collapsed.has(key);
  var tr = el('tr', 'grp grp--doc');
  var td = el('td');
  td.colSpan = span;
  var b = el('button', 'grp-toggle');
  b.type = 'button';
  b.setAttribute('aria-expanded', String(open));
  b.appendChild(el('span', 'grp-caret', open ? '▾' : '▸'));
  b.appendChild(el('span', 'grp-title', docLabel(d.docId)));
  var gaps = d.rows.filter(function (r) { return r.total === 0; }).length;
  b.appendChild(el('span', 'grp-meta', d.rows.length + ' 節・対応 ' + d.total + ' 件' + (gaps ? '・対応の無い節 ' + gaps : '')));
  b.addEventListener('click', function () {
    if (open) MX_STATE.collapsed.add(key); else MX_STATE.collapsed.delete(key);
    renderMatrix();
  });
  td.appendChild(b);
  tr.appendChild(td);
  return tr;
}
function renderMatrix() {
  var m = buildMatrix(GRAPH, state.review);
  var host = $('mx-host');
  host.textContent = '';
  var rowsAll = 0;
  m.docs.forEach(function (d) { rowsAll += d.rows.length; });
  $('mx-summary').textContent = '節 ' + rowsAll + '・ファイル ' + m.cols.length + '。どこにも対応の無い節 ' + m.uncoveredRows + '・ファイル ' + m.uncoveredCols + '（見出しを色付きで表示）';
  if (!rowsAll || !m.cols.length) {
    host.appendChild(emptyBox('マトリクスに出せる対応がありません', '文書の節とソースファイルの対応ができると、ここに表で出ます'));
    return;
  }
  var cols = MX_STATE.onlyGaps ? m.cols.filter(function (c) { return c.total === 0; }) : m.cols;
  var table = el('table', 'table mx-table');
  table.appendChild(el('caption', 'visually-hidden', '行が文書の節、列がソースファイル。セルの数字は対応の件数、下のバーは判定済みの割合、右上の印は要確認'));
  table.appendChild(matrixHead(cols));
  var tbody = el('tbody'), shown = 0;
  m.docs.forEach(function (d) {
    var rows = MX_STATE.onlyGaps ? d.rows.filter(function (r) { return r.total === 0; }) : d.rows;
    if (!rows.length) return;
    tbody.appendChild(matrixDocRow(d, cols.length + 2));
    if (MX_STATE.collapsed.has(d.docId)) return;
    rows.forEach(function (r) { tbody.appendChild(matrixRow(r, cols, m.max)); shown++; });
  });
  table.appendChild(tbody);
  var tfoot = el('tfoot'), fr = el('tr');
  var fh = el('th', 'mx-row', '合計');
  fh.scope = 'row';
  fr.appendChild(fh);
  var grand = 0;
  cols.forEach(function (c) { grand += c.total; fr.appendChild(el('td', 'mx-total' + (c.total ? '' : ' is-gap'), c.total)); });
  fr.appendChild(el('td', 'mx-total', grand));
  tfoot.appendChild(fr);
  table.appendChild(tfoot);
  host.appendChild(table);
  if (MX_STATE.onlyGaps && !shown && !cols.length) host.appendChild(emptyBox('対応の無い節・ファイルはありません', 'すべての節とファイルがどこかと対応しています'));
}
`;
