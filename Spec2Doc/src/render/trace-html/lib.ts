// traceability.html のブラウザ側の純粋関数（DOM に触れない）。文字列のまま inline <script> に入れ、テストでは new Function で評価する。
// 書き方の制約: String.raw の中なのでバッククォートと「$」+「{」を書かない。「</script」も書かない（埋め込みが閉じる）。

export const TRACE_LIB_JS = String.raw`
var TRACE_VERSION = '1';
var STATUS_KEYS = ['unreviewed', 'ok', 'ng', 'na'];
var NOTE_MAX = 2000;
var CSV_COLUMNS = ['ID', '文書', '節', '要約', '根拠', 'ソース位置', '状態', 'メモ', '更新日時'];

function emptyReview(runId) {
  return { version: TRACE_VERSION, runId: runId, reviews: {} };
}

function statusOf(review, linkId) {
  var e = Object.prototype.hasOwnProperty.call(review.reviews, linkId) ? review.reviews[linkId] : null;
  return e && STATUS_KEYS.indexOf(e.status) >= 0 ? e.status : 'unreviewed';
}

function entryOf(review, linkId) {
  return Object.prototype.hasOwnProperty.call(review.reviews, linkId) ? review.reviews[linkId] : null;
}

/** reviews 以外（保存したビュー・ベースライン）を引き継いで reviews を差し替えた新しい TraceReview */
function withReviews(review, reviews) {
  var next = { version: TRACE_VERSION, runId: review.runId, reviews: reviews };
  if (Array.isArray(review.savedViews)) next.savedViews = review.savedViews;
  if (typeof review.baselineRunId === 'string' && review.baselineRunId !== '') next.baselineRunId = review.baselineRunId;
  return next;
}

/** 状態を変えた 1 行。判定（未確認以外）に変わった時と confirm の時は確認者・確認日時を記録し直す。メモとコメントは残す */
function nextEntry(prev, status, now, by, confirm) {
  var next = { status: status, updatedAt: now };
  if (prev && typeof prev.note === 'string' && prev.note !== '') next.note = prev.note;
  if (status !== 'unreviewed') {
    if (confirm || !prev || prev.status !== status) {
      if (typeof by === 'string' && by !== '') next.reviewer = by.slice(0, 100);
      next.reviewedAt = now;
    } else {
      if (prev.reviewer) next.reviewer = prev.reviewer;
      if (prev.reviewedAt) next.reviewedAt = prev.reviewedAt;
    }
  }
  if (prev && Array.isArray(prev.comments) && prev.comments.length) next.comments = prev.comments;
  return next;
}

/** 1 行の状態・メモを変えた新しい TraceReview を返す（元は変えない）。利用者が触った行は引き継ぎ元を外す。patch = { status, note, reviewer, confirm } */
function setReview(review, linkId, patch, now) {
  var prev = entryOf(review, linkId) || { status: 'unreviewed' };
  var status = patch.status !== undefined ? patch.status : prev.status;
  if (STATUS_KEYS.indexOf(status) < 0) throw new Error('状態が不正です: ' + status);
  var next = nextEntry(prev, status, now, patch.reviewer, patch.confirm === true);
  if (patch.note !== undefined) {
    if (typeof patch.note === 'string' && patch.note !== '') next.note = patch.note.slice(0, NOTE_MAX);
    else delete next.note;
  }
  var reviews = Object.assign({}, review.reviews);
  reviews[linkId] = next;
  return withReviews(review, reviews);
}

function cleanComments(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(function (c) { return c && typeof c.at === 'string' && typeof c.text === 'string' && c.text !== ''; }).map(function (c) {
    var out = { at: c.at, text: c.text.slice(0, NOTE_MAX) };
    if (typeof c.by === 'string' && c.by !== '') out.by = c.by.slice(0, 100);
    return out;
  });
}
function cleanViews(list) {
  if (!Array.isArray(list)) return undefined;
  return list.filter(function (v) { return v && typeof v.name === 'string' && v.name !== '' && VIEW_TABS.indexOf(v.tab) >= 0; }).map(function (v) {
    var f = {};
    if (v.filters && typeof v.filters === 'object') Object.keys(v.filters).forEach(function (k) { if (typeof v.filters[k] === 'string') f[k] = v.filters[k]; });
    return { name: v.name, tab: v.tab, filters: f };
  });
}

/** 読み込んだ JSON を検査し、この実行の link にある行だけを取り込む。形が違えば Error（利用者向けの文） */
function normalizeReview(raw, graph, now) {
  if (!raw || typeof raw !== 'object') throw new Error('JSON の形が確認状態のファイルではありません');
  if (raw.version !== TRACE_VERSION) throw new Error('版が違います（' + String(raw.version) + '）。この画面で書き出したファイルを選んでください');
  if (!raw.reviews || typeof raw.reviews !== 'object' || Array.isArray(raw.reviews)) throw new Error('reviews がありません');
  var known = new Set(graph.links.map(function (l) { return l.id; }));
  var reviews = {};
  var accepted = 0;
  var skipped = 0;
  var otherRun = typeof raw.runId === 'string' && raw.runId !== graph.runId ? raw.runId : undefined;
  Object.keys(raw.reviews).forEach(function (id) {
    var e = raw.reviews[id];
    if (!known.has(id) || !e || STATUS_KEYS.indexOf(e.status) < 0) { skipped++; return; }
    var entry = { status: e.status, updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : now };
    if (typeof e.note === 'string' && e.note !== '') entry.note = e.note.slice(0, NOTE_MAX);
    if (typeof e.reviewer === 'string' && e.reviewer !== '') entry.reviewer = e.reviewer.slice(0, 100);
    if (typeof e.reviewedAt === 'string' && e.reviewedAt !== '') entry.reviewedAt = e.reviewedAt;
    var comments = cleanComments(e.comments);
    if (comments.length) entry.comments = comments;
    var from = typeof e.carriedFrom === 'string' ? e.carriedFrom : otherRun;
    if (from) entry.carriedFrom = from;
    reviews[id] = entry;
    accepted++;
  });
  var head = { runId: graph.runId, savedViews: cleanViews(raw.savedViews), baselineRunId: typeof raw.baselineRunId === 'string' ? raw.baselineRunId : '' };
  return { review: withReviews(head, reviews), accepted: accepted, skipped: skipped };
}

/** base に over の行を上書きした新しい TraceReview（保存したビュー・ベースラインは over にあれば over） */
function mergeReviews(base, over) {
  var next = withReviews(base, Object.assign({}, base.reviews, over.reviews));
  if (Array.isArray(over.savedViews)) next.savedViews = over.savedViews;
  if (typeof over.baselineRunId === 'string' && over.baselineRunId !== '') next.baselineRunId = over.baselineRunId;
  return next;
}

function statusCounts(graph, review) {
  var c = { total: graph.links.length, unreviewed: 0, ok: 0, ng: 0, na: 0 };
  graph.links.forEach(function (l) { c[statusOf(review, l.id)]++; });
  return c;
}

function formatSource(s) {
  return s.line !== undefined && s.line !== null ? s.file + ':' + s.line : s.file;
}

/** Excel が式として解釈しないよう、先頭が = + - @ タブ CR の値には ' を付ける */
function csvCell(v) {
  var s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

/** Excel で開ける CSV（UTF-8 BOM 付き・CRLF・全セル引用） */
function buildCsv(graph, review, labels) {
  var lines = [CSV_COLUMNS.map(csvCell).join(',')];
  graph.links.forEach(function (l) {
    var e = entryOf(review, l.id);
    var doc = labels.docs && labels.docs[l.docId] ? l.docId + ' ' + labels.docs[l.docId] : l.docId;
    lines.push([
      l.id, doc, l.section, l.summary, labels.evidence[l.evidence] || l.evidence,
      l.sources.map(formatSource).join(', '), labels.status[statusOf(review, l.id)],
      e && e.note ? e.note : '', e ? e.updatedAt : '',
    ].map(csvCell).join(','));
  });
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** どの節からも参照されないファイル・コード要素（未記述）と、ソース位置の無い行（根拠なし）。対象外のファイルは除く */
function findGaps(graph) {
  var ref = new Set();
  graph.edges.forEach(function (e) { if (e.kind === 'documents') { ref.add(e.from); ref.add(e.to); } });
  var files = new Set();
  graph.links.forEach(function (l) {
    l.irIds.forEach(function (id) { ref.add(id); ref.add('code:' + id); });
    l.sources.forEach(function (s) { files.add(s.file); });
  });
  var docChild = new Set();
  graph.nodes.forEach(function (n) { if (n.kind === 'code' && ref.has(n.id) && n.parent) docChild.add(n.parent); });
  var undocumented = graph.nodes.filter(function (n) {
    if (n.kind === 'code') return !ref.has(n.id);
    if (n.kind !== 'file' || n.fileStatus === 'excluded') return false;
    return !ref.has(n.id) && !docChild.has(n.id) && !(n.path && files.has(n.path));
  });
  var noSource = graph.links.filter(function (l) { return l.sources.length === 0; });
  return { undocumented: undocumented, noSource: noSource };
}

/** code を親の file に畳む（線は付け替えて重複を除く）。親の無い code はそのまま残す */
function foldGraph(nodes, edges, fold) {
  if (!fold) return { nodes: nodes, edges: edges };
  var ids = new Set(nodes.map(function (n) { return n.id; }));
  var to = new Map();
  nodes.forEach(function (n) { if (n.kind === 'code' && n.parent && ids.has(n.parent)) to.set(n.id, n.parent); });
  var seen = new Set();
  var out = [];
  edges.forEach(function (e) {
    var a = to.get(e.from) || e.from;
    var b = to.get(e.to) || e.to;
    var key = a + '\u0000' + b + '\u0000' + e.kind + '\u0000' + (e.label || '');
    if (a === b || seen.has(key)) return;
    seen.add(key);
    var edge = { from: a, to: b, kind: e.kind };
    if (e.label) edge.label = e.label;
    out.push(edge);
  });
  return { nodes: nodes.filter(function (n) { return !to.has(n.id); }), edges: out };
}

/** 点に関わる link（節・文書・コード要素・ファイル・フォルダの別に対応を取る） */
function linksForNode(graph, node) {
  return graph.links.filter(function (l) {
    if (node.kind === 'section') return l.sectionNodeId === node.id;
    if (node.kind === 'doc') return l.docId === node.docId || 'doc:' + l.docId === node.id;
    if (node.kind === 'code') return l.irIds.indexOf(node.id.replace(/^code:/, '')) >= 0;
    var p = node.path || '';
    if (node.kind === 'file') return l.sources.some(function (s) { return s.file === p; });
    return p !== '' && l.sources.some(function (s) { return s.file.indexOf(p + '/') === 0; });
  });
}

/** 管理の絞り込み。f = { doc, status, evidence, text, node } */
function filterLinks(graph, review, f) {
  var text = (f.text || '').trim().toLowerCase();
  var base = f.node ? linksForNode(graph, f.node) : graph.links;
  return base.filter(function (l) {
    if (f.doc && l.docId !== f.doc) return false;
    if (f.status && statusOf(review, l.id) !== f.status) return false;
    if (f.evidence && l.evidence !== f.evidence) return false;
    if (f.section && l.sectionNodeId !== f.section) return false;
    if (f.file && !l.sources.some(function (s) { return s.file === f.file; })) return false;
    if (f.kind && (l.kind || '') !== f.kind) return false;
    if (f.suspect && !isSuspectOpen(l, entryOf(review, l.id), graph.generatedAt)) return false;
    if (!text) return true;
    var e = entryOf(review, l.id);
    var hay = [l.section, l.summary, l.sources.map(formatSource).join(' '), e && e.note ? e.note : ''].join('\n').toLowerCase();
    return hay.indexOf(text) >= 0;
  });
}
/** 複数行の状態をまとめて変えた新しい TraceReview（メモ・コメントは残し、確認者・日時を記録する。コピーは 1 回だけ） */
function setReviewMany(review, ids, status, now, by) {
  if (STATUS_KEYS.indexOf(status) < 0) throw new Error('状態が不正です: ' + status);
  var reviews = Object.assign({}, review.reviews);
  ids.forEach(function (id) { reviews[id] = nextEntry(entryOf(review, id), status, now, by, false); });
  return withReviews(review, reviews);
}

var OVERVIEW_KINDS = { folder: true, file: true, doc: true };

/** 点を概観の点（folder / file / doc）へ寄せる。code は親の file、section は親の doc */
function overviewOwner(byId, id) {
  var n = byId.get(id), guard = 0;
  while (n && !OVERVIEW_KINDS[n.kind] && n.parent && byId.has(n.parent) && guard++ < 50) n = byId.get(n.parent);
  if (n && OVERVIEW_KINDS[n.kind]) return n.id;
  if (n && n.kind === 'section' && n.docId && byId.has('doc:' + n.docId)) return 'doc:' + n.docId;
  return null;
}

/** 概観: folder・file・doc の点と、それらの間の集約線（weight=件数。file→doc は documents の集約） */
function overviewGraph(graph) {
  var byId = new Map(graph.nodes.map(function (n) { return [n.id, n]; }));
  var nodes = graph.nodes.filter(function (n) { return OVERVIEW_KINDS[n.kind]; });
  var agg = new Map();
  var edges = [];
  graph.edges.forEach(function (e) {
    var a = overviewOwner(byId, e.from), b = overviewOwner(byId, e.to);
    if (!a || !b || a === b) return;
    if (e.kind === 'contains') {
      if (a === e.from && b === e.to) edges.push({ from: a, to: b, kind: 'contains' });
      return;
    }
    if (e.kind === 'documents' && byId.get(a).kind === 'doc' && byId.get(b).kind !== 'doc') { var t = a; a = b; b = t; }
    var key = a + '\u0000' + b + '\u0000' + e.kind;
    var cur = agg.get(key);
    if (cur) { cur.weight++; return; }
    cur = { from: a, to: b, kind: e.kind, weight: 1 };
    agg.set(key, cur);
    edges.push(cur);
  });
  edges.forEach(function (e) { if (e.weight) e.label = e.weight + ' 件'; });
  return { nodes: nodes, edges: edges };
}

/** 概観で点を選んだときに足す code・section の id（ローカルグラフ）。limit 個まで */
function localExpand(graph, id, limit) {
  var byId = new Map(graph.nodes.map(function (n) { return [n.id, n]; }));
  var node = byId.get(id);
  if (!node) return [];
  var seeds;
  if (node.kind === 'file') seeds = graph.nodes.filter(function (n) { return n.kind === 'code' && n.parent === id; });
  else if (node.kind === 'doc') seeds = graph.nodes.filter(function (n) { return n.kind === 'section' && (n.parent === id || 'doc:' + n.docId === id); });
  else if (node.kind === 'folder') seeds = [];
  else seeds = [node];
  var out = new Set();
  function add(x) { if (out.size < limit) out.add(x); }
  seeds.forEach(function (n) { add(n.id); });
  var seedIds = new Set(seeds.map(function (n) { return n.id; }));
  function detailKind(x) { var n = byId.get(x); return n && (n.kind === 'code' || n.kind === 'section'); }
  graph.edges.forEach(function (e) {
    if (e.kind === 'contains') return;
    if (seedIds.has(e.from) && detailKind(e.to)) add(e.to);
    if (seedIds.has(e.to) && detailKind(e.from)) add(e.from);
  });
  return Array.from(out);
}

/** 文書 → 節の順にまとめる（最初に現れた順） */
function groupLinks(links) {
  var docs = [], byDoc = new Map();
  links.forEach(function (l) {
    var d = byDoc.get(l.docId);
    if (!d) { d = { docId: l.docId, count: 0, sections: [], bySec: new Map() }; byDoc.set(l.docId, d); docs.push(d); }
    var s = d.bySec.get(l.section);
    if (!s) { s = { section: l.section, links: [] }; d.bySec.set(l.section, s); d.sections.push(s); }
    s.links.push(l);
    d.count++;
  });
  return docs.map(function (d) { return { docId: d.docId, count: d.count, sections: d.sections }; });
}

/** 表示用の日時「2026-09-26 15:19（JST）」。ISO として読めなければそのまま返す */
function formatJst(iso) {
  var d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return iso || '';
  var p = {};
  new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute + '（JST）';
}
`;
