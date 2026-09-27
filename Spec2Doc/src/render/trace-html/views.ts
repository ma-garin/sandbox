// traceability.html の保存したビュー（今のタブと絞り込みに名前を付けて保存・適用・削除）と、サーバの書き出し（Excel・ReqIF）。
// 書き方の制約は lib.ts と同じ（String.raw の中。バッククォート・「$」+「{」・「</script」を書かない）。宣言だけを並べる。

export const TRACE_VIEWS_JS = String.raw`
var TAB_LABEL = { graph: '関係図', matrix: 'マトリクス', manage: '管理', gaps: '抜け', compare: '比較' };

function currentFilters() {
  var f = state.filter, out = {};
  ['doc', 'status', 'evidence', 'text', 'section', 'file', 'suspect', 'kind'].forEach(function (k) { if (f[k]) out[k] = String(f[k]); });
  if (f.node) out.node = f.node.id;
  return out;
}
function applyView(v) {
  var f = emptyFilter();
  Object.keys(v.filters || {}).forEach(function (k) {
    if (k === 'node') f.node = NODE_BY_ID.get(v.filters.node) || null;
    else if (Object.prototype.hasOwnProperty.call(f, k)) f[k] = String(v.filters[k]);
  });
  state.filter = f;
  syncFilterInputs();
  state.page = 0;
  state.current = null;
  showTab(VIEW_TABS.indexOf(v.tab) >= 0 ? v.tab : 'manage');
  toast('ok', '「' + v.name + '」を適用しました');
}
function onSaveView() {
  var input = $('v-name');
  try {
    state.review = saveView(state.review, input.value, state.tab, currentFilters());
  } catch (e) {
    toast('error', 'ビューを保存できませんでした', (e && e.message) || '');
    input.focus();
    return;
  }
  var name = input.value.trim();
  input.value = '';
  scheduleSave();
  renderViews();
  toast('ok', '「' + name + '」を保存しました', TAB_LABEL[state.tab] + 'タブと今の絞り込みを覚えました');
}
function onDeleteView(v) {
  state.review = deleteView(state.review, v.name);
  scheduleSave();
  renderViews();
  toast('ok', '「' + v.name + '」を削除しました', '', {
    label: '元に戻す',
    run: function () { state.review = saveView(state.review, v.name, v.tab, v.filters || {}); scheduleSave(); renderViews(); },
  });
}
function renderViews() {
  var ul = $('v-list');
  ul.textContent = '';
  var views = state.review.savedViews || [];
  if (!views.length) { ul.appendChild(el('li', 'muted side-note', '保存したビューはありません。名前を入れて保存すると、ここから同じ表示に戻れます')); return; }
  views.forEach(function (v) {
    var li = el('li', 'view-item');
    var b = el('button', 'nb-btn', v.name);
    b.type = 'button';
    b.title = '「' + v.name + '」を適用（' + (TAB_LABEL[v.tab] || v.tab) + '）';
    b.addEventListener('click', function () { applyView(v); });
    li.appendChild(b);
    li.appendChild(el('span', 'muted side-note', TAB_LABEL[v.tab] || v.tab));
    var del = el('button', 'btn btn--ghost', '削除');
    del.type = 'button';
    del.setAttribute('aria-label', '「' + v.name + '」を削除');
    del.addEventListener('click', function () { onDeleteView(v); });
    li.appendChild(del);
    ul.appendChild(li);
  });
}

/* ── サーバの書き出し（Excel のマトリクス・ReqIF）。無い間は 404 を知らせて CSV に誘導 ── */
function downloadBlob(name, blob) {
  var a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}
function exportServer(format, label) {
  var run = apiParts(API).run;
  var fallback = { label: 'CSV で書き出す', run: exportCsv };
  if (!run) { toast('error', label + ' はサーバから開いたときに書き出せます', 'この画面では CSV か JSON で書き出してください', fallback); return; }
  fetch(run + '/trace-export?format=' + encodeURIComponent(format))
    .then(function (res) {
      if (res.status === 404) throw new Error('サーバがこの書き出しにまだ対応していません。');
      if (!res.ok) throw new Error('サーバの応答が ' + res.status + ' でした。');
      return res.blob();
    })
    .then(function (blob) {
      downloadBlob('trace-' + fileStem() + '.' + format, blob);
      toast('ok', label + ' で書き出しました');
    })
    .catch(function (e) {
      toast('error', label + ' で書き出せませんでした', ((e && e.message) || '通信に失敗しました。') + ' CSV か JSON で書き出してください', fallback);
    });
}
`;
