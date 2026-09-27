// traceability.html のブラウザ側の純粋関数（レビュー・コメント・要確認・保存したビュー・マトリクス・比較・監査）。DOM に触れない。
// lib.ts と同じ IIFE に入る（lib.ts の関数を使う）。テストでは lib.ts と連結して new Function で評価する。
// 書き方の制約: String.raw の中なのでバッククォートと「$」+「{」を書かない。「</script」も書かない（埋め込みが閉じる）。

export const TRACE_REVIEW_LIB_JS = String.raw`
var COMMENT_MAX = 2000;
var VIEW_NAME_MAX = 40;
var VIEW_MAX = 50;
var VIEW_TABS = ['graph', 'matrix', 'manage', 'gaps', 'compare'];
var VIEW_FILTER_KEYS = ['doc', 'status', 'evidence', 'text', 'section', 'file', 'suspect', 'kind', 'node'];
var EDGE_LINK_KIND = { documents: 'describes', calls: 'calls', uses: 'uses' };
var AUDIT_FIELD_LABEL = { status: '状態', note: 'メモ', comment: 'コメント', reviewer: '確認者', baseline: 'ベースライン', savedView: '保存したビュー' };

/** コメントを 1 件足した新しい TraceReview（追記のみ。編集・削除は無い）。空なら Error */
function addComment(review, linkId, text, by, now) {
  var body = typeof text === 'string' ? text.trim() : '';
  if (!body) throw new Error('コメントが空です。書いてから追加してください');
  var prev = entryOf(review, linkId);
  var c = { at: now, text: body.slice(0, COMMENT_MAX) };
  if (by) c.by = by;
  var next = Object.assign({}, prev || { status: 'unreviewed' }, { updatedAt: now });
  delete next.carriedFrom;
  next.comments = (prev && Array.isArray(prev.comments) ? prev.comments : []).concat([c]);
  var reviews = Object.assign({}, review.reviews);
  reviews[linkId] = next;
  return withReviews(review, reviews);
}

/** 要確認がまだ残っているか。この実行の生成より後に確認者が判定していれば解消済み */
function isSuspectOpen(link, entry, generatedAt) {
  if (!link.suspect) return false;
  if (!entry || entry.status === 'unreviewed' || !entry.reviewedAt) return true;
  var at = Date.parse(entry.reviewedAt), gen = Date.parse(generatedAt);
  if (isNaN(at) || isNaN(gen)) return true;
  return at < gen;
}
function suspectCount(graph, review) {
  return graph.links.filter(function (l) { return isSuspectOpen(l, entryOf(review, l.id), graph.generatedAt); }).length;
}
/** 「確認済みにする」: 状態を確認済みにし、確認者・日時を記録し直す（要確認を解消扱いにする） */
function confirmLink(review, linkId, by, now) {
  return setReview(review, linkId, { status: 'ok', reviewer: by, confirm: true }, now);
}

/** 今の絞り込みを名前付きで保存した新しい TraceReview（同じ名前は上書き） */
function saveView(review, name, tab, filters) {
  var n = typeof name === 'string' ? name.trim().slice(0, VIEW_NAME_MAX) : '';
  if (!n) throw new Error('ビューの名前が空です。名前を入れてから保存してください');
  if (VIEW_TABS.indexOf(tab) < 0) throw new Error('タブが不正です: ' + tab);
  var f = {};
  VIEW_FILTER_KEYS.forEach(function (k) { if (typeof filters[k] === 'string' && filters[k] !== '') f[k] = filters[k]; });
  var views = (review.savedViews || []).filter(function (v) { return v.name !== n; });
  if (views.length >= VIEW_MAX) throw new Error('保存できるビューは ' + VIEW_MAX + ' 件までです。使わないビューを削除してください');
  var next = withReviews(review, review.reviews);
  next.savedViews = views.concat([{ name: n, tab: tab, filters: f }]);
  return next;
}
function deleteView(review, name) {
  var next = withReviews(review, review.reviews);
  next.savedViews = (review.savedViews || []).filter(function (v) { return v.name !== name; });
  return next;
}
function setBaseline(review, runId) {
  var next = withReviews(review, review.reviews);
  next.baselineRunId = runId;
  return next;
}

function dirOf(p) { var i = p.lastIndexOf('/'); return i > 0 ? p.slice(0, i) : '.'; }
function baseName(p) { var i = p.lastIndexOf('/'); return i >= 0 ? p.slice(i + 1) : p; }

/** トレーサビリティマトリクス。行=節（文書でまとめる）、列=ソースファイル（フォルダ順）。セル=対応の件数・判定済み・要確認 */
function buildMatrix(graph, review) {
  var colSet = new Set();
  graph.nodes.forEach(function (n) { if (n.kind === 'file' && n.path && n.fileStatus !== 'excluded') colSet.add(n.path); });
  graph.links.forEach(function (l) { l.sources.forEach(function (s) { colSet.add(s.file); }); });
  var cols = Array.from(colSet).map(function (f) { return { file: f, folder: dirOf(f), name: baseName(f), total: 0 }; });
  cols.sort(function (a, b) { return a.folder === b.folder ? (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) : a.folder < b.folder ? -1 : 1; });
  var colByFile = new Map(cols.map(function (c) { return [c.file, c]; }));
  var rows = [], rowById = new Map();
  function row(id, docId, label) {
    var r = rowById.get(id);
    if (!r) { r = { id: id, docId: docId, label: label, total: 0, links: 0, cells: {} }; rowById.set(id, r); rows.push(r); }
    return r;
  }
  graph.nodes.forEach(function (n) { if (n.kind === 'section' && n.docId) row(n.id, n.docId, n.label); });
  var max = 0;
  graph.links.forEach(function (l) {
    var r = row(l.sectionNodeId, l.docId, l.section);
    r.label = l.section;
    r.links++;
    var judged = statusOf(review, l.id) !== 'unreviewed';
    var suspect = isSuspectOpen(l, entryOf(review, l.id), graph.generatedAt);
    Array.from(new Set(l.sources.map(function (s) { return s.file; }))).forEach(function (f) {
      var c = r.cells[f] || (r.cells[f] = { count: 0, judged: 0, suspect: 0 });
      c.count++;
      if (judged) c.judged++;
      if (suspect) c.suspect++;
      if (c.count > max) max = c.count;
      r.total++;
      colByFile.get(f).total++;
    });
  });
  var docs = [], byDoc = new Map();
  rows.forEach(function (r) {
    var d = byDoc.get(r.docId);
    if (!d) { d = { docId: r.docId, rows: [], total: 0 }; byDoc.set(r.docId, d); docs.push(d); }
    d.rows.push(r);
    d.total += r.total;
  });
  docs.sort(function (a, b) { return a.docId < b.docId ? -1 : a.docId > b.docId ? 1 : 0; });
  return {
    docs: docs, cols: cols, max: max,
    uncoveredRows: rows.filter(function (r) { return r.total === 0; }).length,
    uncoveredCols: cols.filter(function (c) { return c.total === 0; }).length,
  };
}
/** セルの濃淡（0〜4 段）。件数を最大値で割って 4 段に */
function heatLevel(count, max) {
  if (!count) return 0;
  if (!max || max <= 1) return 4;
  return Math.max(1, Math.min(4, Math.ceil((count / max) * 4)));
}

/** 関係図の線ラベルにリンクの種類を足した新しい線（contains はそのまま） */
function withKindLabel(e, kindLabels) {
  var k = EDGE_LINK_KIND[e.kind];
  if (!k || !kindLabels || !kindLabels[k]) return e;
  var out = Object.assign({}, e);
  out.label = kindLabels[k] + (e.label ? ' ' + e.label : '');
  return out;
}

/** 保存先 API（…/runs/<id>/trace-review 等）から「…/runs/<id>」と「…/runs」を取り出す。取れなければ空 */
function apiParts(api) {
  var m = /^(.*?\/runs)\/([^/?#]+)/.exec(api || '');
  return m ? { runs: m[1], run: m[1] + '/' + m[2] } : { runs: '', run: '' };
}
/** 実行の一覧（配列か { runs: [] }）から、同じ入力元の過去の実行だけ（新しい順） */
function sameSourceRuns(raw, source, runId) {
  var list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.runs) ? raw.runs : [];
  return list.map(function (r) {
    return { runId: String(r.runId || r.id || ''), source: r.source, at: r.createdAt || r.generatedAt || r.startedAt || r.finishedAt || '' };
  }).filter(function (r) { return r.runId && r.runId !== runId && (!source || r.source === source); })
    .sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
}
/** 監査の記録（{ events: [] }）を検査して、linkId があればその対応だけ */
function auditEvents(raw, linkId) {
  var list = raw && Array.isArray(raw.events) ? raw.events : [];
  return list.filter(function (e) { return e && typeof e.at === 'string' && typeof e.field === 'string' && (!linkId || e.linkId === linkId); });
}
/** 比較の結果を、この実行の対応（追加・変更）と ID だけの削除に分ける */
function compareRows(cmp, linkById) {
  function pick(ids) { return (Array.isArray(ids) ? ids : []).map(function (id) { return linkById.get(id) || { id: id }; }); }
  return {
    added: pick(cmp.added), changed: pick(cmp.changed), removed: pick(cmp.removed),
    unchanged: typeof cmp.unchanged === 'number' ? cmp.unchanged : 0,
  };
}
/** 未記述の点に対するトレース先の候補（graph.gapCandidates は { nodeId: [...] } か [{ nodeId, candidates }]） */
function gapCandidatesFor(graph, nodeId) {
  var g = graph.gapCandidates;
  var list = !g ? [] : Array.isArray(g) ? (g.filter(function (x) { return x && x.nodeId === nodeId; })[0] || {}).candidates : g[nodeId];
  return Array.isArray(list) ? list.filter(function (c) { return c && typeof c.nodeId === 'string'; }) : [];
}
`;
