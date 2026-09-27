// traceability.html の管理タブ右の詳細欄のレビュー部品（要確認・確認者・コメント・変更の履歴）と、監査の記録の読み込み。
// 書き方の制約は lib.ts と同じ（String.raw の中。バッククォート・「$」+「{」・「</script」を書かない）。宣言だけを並べる。

export const TRACE_DETAIL_JS = String.raw`
var REVIEWER_KEY = 'spec2doc-reviewer';
var AUDIT = { loaded: false, failed: false, events: [] };
var AUDIT_LINK_MAX = 20;

function reviewerName() {
  try { return (localStorage.getItem(REVIEWER_KEY) || '').slice(0, 100); } catch (e) { return state.reviewerFallback || ''; }
}
function saveReviewerName(v) {
  state.reviewerFallback = v;
  try {
    if (v) localStorage.setItem(REVIEWER_KEY, v); else localStorage.removeItem(REVIEWER_KEY);
  } catch (e) {
    toast('error', '名前をこの端末に保存できませんでした', 'この画面を開いている間だけ確認者として使います。開き直したら入れ直してください');
  }
}
/** 名前が未入力のまま判定したときに 1 回だけ知らせる */
function noteNoReviewer() {
  if (reviewerName() || state.nameHinted) return;
  state.nameHinted = true;
  toast('info', '確認者の名前なしで記録しました', '詳細欄の「あなたの名前」に入れると、次から確認者として記録します');
}
function fmtWhen(v) { return v && !isNaN(Date.parse(v)) ? formatJst(v) : v || ''; }

/* 要確認（前回の実行から変わった対応）の知らせと「確認済みにする」 */
function detailSuspect(box, l, e) {
  if (!l.suspect) return;
  var open = isSuspectOpen(l, e, GRAPH.generatedAt);
  var c = el('div', 'callout ' + (open ? 'callout--high' : 'callout--low') + ' detail-callout');
  c.setAttribute('role', 'note');
  c.appendChild(el('p', 'callout-title', open ? '要確認: 前回の実行から変わった対応です' : '要確認は確認済みにしました'));
  c.appendChild(el('p', '', '前回との違い: ' + (LABELS.suspect[l.suspect.reason] || l.suspect.reason)));
  if (l.suspect.since) c.appendChild(el('p', 'muted', '変わった時点: ' + fmtWhen(l.suspect.since)));
  if (e && e.carriedFrom) c.appendChild(el('p', 'muted', '前回の判定: ' + LABELS.status[statusOf(state.review, l.id)] + '（実行 ' + e.carriedFrom + ' から引き継ぎ）'));
  if (CMP.result && CMP.result.changed.some(function (x) { return x.id === l.id; })) c.appendChild(el('p', 'muted', 'ベースライン ' + CMP.base + ' との比較でも「変更」に入っています'));
  if (!open && e && e.reviewedAt) c.appendChild(el('p', 'muted', (e.reviewer || '名前なし') + '・' + formatJst(e.reviewedAt)));
  if (open) {
    var b = el('button', 'btn', '確認済みにする');
    b.type = 'button';
    b.addEventListener('click', function () {
      state.review = confirmLink(state.review, l.id, reviewerName(), nowIso());
      scheduleSave();
      noteNoReviewer();
      toast('ok', '要確認を確認済みにしました', reviewerName() ? '確認者「' + reviewerName() + '」と日時を記録しました' : '日時を記録しました');
      renderManage();
    });
    c.appendChild(b);
  }
  box.appendChild(c);
}

/* 確認者の名前（初回に入れる。この端末に保存） */
function detailReviewer(box) {
  var field = el('div', 'field detail-reviewer');
  var label = el('label', '', 'あなたの名前（確認者）');
  label.htmlFor = 'm-reviewer';
  var input = el('input', 'input');
  input.id = 'm-reviewer';
  input.type = 'text';
  input.maxLength = 100;
  input.autocomplete = 'name';
  input.placeholder = '例: 山田';
  input.value = reviewerName();
  input.addEventListener('change', function () { saveReviewerName(input.value.trim()); });
  field.appendChild(label);
  field.appendChild(input);
  field.appendChild(el('span', 'muted side-note', '状態を変えると、この名前と日時を記録します。名前はこの端末に保存します'));
  box.appendChild(field);
}

/* コメントの履歴（追記のみ） */
function detailComments(box, l, e) {
  var list = e && Array.isArray(e.comments) ? e.comments : [];
  var sec = el('section', 'detail-sec detail-comment');
  sec.appendChild(el('h3', '', 'コメント（' + list.length + '）'));
  if (!list.length) sec.appendChild(el('p', 'muted side-note', 'まだコメントはありません'));
  else {
    var ul = el('ul', 'detail-list');
    list.forEach(function (c) {
      var li = el('li');
      li.appendChild(el('div', 'sec', formatJst(c.at) + '・' + (c.by || '名前なし')));
      li.appendChild(el('div', 'comment-text', c.text));
      ul.appendChild(li);
    });
    sec.appendChild(ul);
  }
  var field = el('div', 'field');
  var label = el('label', '', 'コメントを追記');
  label.htmlFor = 'm-comment';
  var ta = el('textarea', 'textarea');
  ta.id = 'm-comment';
  ta.maxLength = COMMENT_MAX;
  field.appendChild(label);
  field.appendChild(ta);
  field.appendChild(el('span', 'muted side-note', '追記したコメントは直せません'));
  sec.appendChild(field);
  var b = el('button', 'btn', 'コメントを追記する');
  b.type = 'button';
  b.addEventListener('click', function () {
    try {
      state.review = addComment(state.review, l.id, ta.value, reviewerName(), nowIso());
    } catch (err) {
      toast('error', 'コメントを追記できませんでした', (err && err.message) || '');
      ta.focus();
      return;
    }
    scheduleSave();
    toast('ok', 'コメントを追記しました');
    renderLinkDetail();
  });
  sec.appendChild(b);
  box.appendChild(sec);
}

/* 変更の履歴（監査の記録をこの対応で絞る）。中身は読み込み後に fillLinkAudit で差し替える */
function detailAudit(box, l) {
  var sec = el('section', 'detail-sec');
  sec.appendChild(el('h3', '', 'この対応の変更の履歴'));
  var ul = el('ul', 'detail-list');
  ul.id = 'm-audit-list';
  sec.appendChild(ul);
  box.appendChild(sec);
  fillLinkAudit(ul, l.id);
}
function auditValue(field, v) {
  if (v === undefined || v === null || v === '') return '（なし）';
  var s = field === 'status' && LABELS.status[v] ? LABELS.status[v] : String(v);
  return s.length > 80 ? s.slice(0, 79) + '…' : s;
}
function auditChange(ev) {
  if (ev.field === 'comment') return auditValue(ev.field, ev.to);
  return auditValue(ev.field, ev.from) + ' → ' + auditValue(ev.field, ev.to);
}
function fillLinkAudit(ul, linkId) {
  ul.textContent = '';
  if (!API) { ul.appendChild(el('li', 'muted', 'サーバから開いたときに、誰がいつ変えたかが出ます')); return; }
  if (!AUDIT.loaded) { ul.appendChild(el('li', 'muted', AUDIT.failed ? '変更の履歴を読み込めませんでした。サーバが動いているか確かめて、読み込み直してください' : '変更の履歴を読み込んでいます…')); return; }
  var evs = auditEvents({ events: AUDIT.events }, linkId);
  if (!evs.length) { ul.appendChild(el('li', 'muted', 'まだ変更の記録はありません')); return; }
  evs.slice(0, AUDIT_LINK_MAX).forEach(function (ev) {
    var li = el('li');
    li.appendChild(el('div', 'sec', formatJst(ev.at) + '・' + (ev.by || '名前なし')));
    li.appendChild(el('div', 'comment-text', (AUDIT_FIELD_LABEL[ev.field] || ev.field) + ': ' + auditChange(ev)));
    ul.appendChild(li);
  });
  if (evs.length > AUDIT_LINK_MAX) ul.appendChild(el('li', 'muted', 'ほか ' + (evs.length - AUDIT_LINK_MAX) + ' 件（比較タブの監査の記録で全件）'));
}
/* 監査の記録を読み込む（無い間は 404 を空として扱う）。保存のたびに読み直す */
function loadAudit() {
  var run = apiParts(API).run;
  if (!run) return;
  fetch(run + '/trace-audit', { headers: { Accept: 'application/json' } })
    .then(function (res) {
      if (res.status === 404) return { events: [] };
      if (!res.ok) throw new Error('サーバの応答が ' + res.status + ' でした。');
      return res.json();
    })
    .then(function (json) { AUDIT.events = auditEvents(json); AUDIT.loaded = true; AUDIT.failed = false; refreshAuditViews(); })
    .catch(function () { AUDIT.failed = true; refreshAuditViews(); });
}
function refreshAuditViews() {
  var ul = $('m-audit-list');
  if (ul && state.current) fillLinkAudit(ul, state.current);
  if (state.tab === 'compare') renderAuditAll();
}
`;
