/* ============================================================
   Harness. — アプリ本体（ルーティング・状態・ビュー・操作）
   依存: icons.js, data.js（この順で読み込み済み）
   フレームワーク不使用。状態変更 → render() で再描画する単純構成。
   ============================================================ */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var LS = window.localStorage;

  /* ---------- 永続化ヘルパ ---------- */
  function load(key, def) {
    try { var v = LS.getItem('harness.' + key); return v === null ? def : JSON.parse(v); }
    catch (e) { return def; }
  }
  function save(key, val) { try { LS.setItem('harness.' + key, JSON.stringify(val)); } catch (e) {} }

  /* ---------- 状態 ---------- */
  var state = {
    authed: load('authed', true),
    theme: load('theme', 'system'),          // 'light' | 'dark' | 'system'
    collapsed: load('collapsed', false),
    route: 'home',
    // ToDo一覧フィルタ
    tab: 'all',                               // all | progress | done | over
    priFilter: [],                            // ['high','mid','low'] 空 = 全件
    query: '',
    page: 1,
    perPage: 10,
    // オーバーレイ・デモ状態
    modal: null,                              // 'new' | { type:'delete', id }
    panel: null,                              // 'notif' | 'avatar' | 'colPri' | 'colStatus'
    settingsTab: 'notify',
    demoEmpty: false,
    loginError: false,
    toast: null
  };

  /* ---------- テーマ適用 ---------- */
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function effectiveTheme() {
    return state.theme === 'system' ? (mq.matches ? 'dark' : 'light') : state.theme;
  }
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', effectiveTheme());
  }
  mq.addEventListener('change', function () { if (state.theme === 'system') { applyTheme(); render(); } });

  /* ---------- ユーティリティ ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var PRI_LABEL = { high: '高', mid: '中', low: '低' };
  var ST = {
    progress: { cls: 'progress', label: '進行中' },
    done: { cls: 'done', label: '完了' },
    over: { cls: 'over', label: '期限超過' }
  };

  function priBadge(p) { return '<span class="pri ' + p + '">' + PRI_LABEL[p] + '</span>'; }
  function statusBadge(s) { return '<span class="badge ' + ST[s].cls + '">' + ST[s].label + '</span>'; }

  /* ============================================================
     フィルタ済みタスク
     ============================================================ */
  function filteredTasks() {
    return DB.tasks.filter(function (t) {
      if (state.tab === 'progress' && t.status !== 'progress') { return false; }
      if (state.tab === 'done' && t.status !== 'done') { return false; }
      if (state.tab === 'over' && t.status !== 'over') { return false; }
      if (state.priFilter.length && state.priFilter.indexOf(t.pri) === -1) { return false; }
      if (state.query && t.title.toLowerCase().indexOf(state.query.toLowerCase()) === -1) { return false; }
      return true;
    });
  }
  function tabCount(tab) {
    if (tab === 'all') { return DB.tasks.length; }
    return DB.tasks.filter(function (t) { return t.status === tab; }).length;
  }

  /* ============================================================
     ビュー: ログイン
     ============================================================ */
  function viewLogin() {
    var u = DB.user;
    var heroStats = DB.heroStats.map(function (s) {
      return '<div><div class="n">' + s.n + '</div><div class="k">' + s.k + '</div></div>';
    }).join('');

    var errorBlock = state.loginError
      ? '<div class="alert"><span class="ic">' + ic('alert') + '</span><div>' +
        '<b>ログインできませんでした</b>' +
        '<span>メールアドレスまたはパスワードが正しくありません。</span></div></div>'
      : '';

    var pwField =
      '<div class="field' + (state.loginError ? ' error' : '') + '">' +
        '<label>パスワード</label>' +
        '<input type="password" value="password123" autocomplete="current-password">' +
        (state.loginError ? '<div class="err-text">' + ic('alert') + 'パスワードが正しくありません</div>' : '') +
      '</div>';

    var demoToggle = state.loginError
      ? '<a class="demo-link" data-act="login-demo-off">(デモ) 通常表示に戻す</a>'
      : '<a class="demo-link" data-act="login-demo-on">(デモ) エラー表示を見る</a>';

    return '' +
    '<div class="auth">' +
      '<div class="auth__brand">' +
        '<div class="auth__logo"><span class="mark">' + ic('check', 22) + '</span> Harness.</div>' +
        '<div class="auth__tagline">' +
          '<h2>チームのタスクを、<br>ひとつの土台で。</h2>' +
          '<p>優先度・期限・担当を体系的に管理し、迷わず今日やることに集中できるタスク管理システム。</p>' +
        '</div>' +
        '<div class="auth__stats">' + heroStats + '</div>' +
      '</div>' +
      '<div class="auth__panel">' +
        '<form class="auth__form" data-act="login-submit">' +
          '<h1>おかえりなさい</h1>' +
          '<p class="sub">アカウントにログインして続けます。</p>' +
          errorBlock +
          '<div class="field"><label>メールアドレス</label>' +
            '<input type="email" value="' + esc(u.email) + '" autocomplete="username"></div>' +
          pwField +
          '<a class="forgot" data-act="noop">パスワードをお忘れですか？</a>' +
          '<button type="submit" class="btn btn-primary">ログイン</button>' +
          demoToggle +
          '<div class="divider">または</div>' +
          '<button type="button" class="btn btn-oauth" data-act="login-submit">' + googleG() + ' Google で続ける</button>' +
          '<div class="auth__foot">アカウントをお持ちでないですか？ <a data-act="noop">新規登録</a></div>' +
        '</form>' +
      '</div>' +
    '</div>';
  }

  /* ============================================================
     シェル（サイドバー・トップバー）
     ============================================================ */
  var NAV = [
    { id: 'home', label: 'ホーム', icon: 'home' },
    { id: 'todos', label: 'ToDo一覧', icon: 'list', badge: 10 },
    { id: 'calendar', label: 'カレンダー', icon: 'calendar' },
    { id: 'projects', label: 'プロジェクト', icon: 'folder', badge: 4 }
  ];
  var NAV_PERSONAL = [
    { id: 'me', label: 'マイページ', icon: 'user' },
    { id: 'settings', label: '設定', icon: 'settings' }
  ];

  function navItem(item) {
    var active = state.route === item.id ? ' active' : '';
    var badge = item.badge != null ? '<span class="badge-count">' + item.badge + '</span>' : '';
    return '<a class="nav-item' + active + '" data-act="go" data-route="' + item.id + '" title="' + item.label + '">' +
      ic(item.icon) + '<span class="nav-label">' + item.label + '</span>' + badge + '</a>';
  }

  function sidebar() {
    var s = DB.storage;
    var pct = Math.round(s.usedGB / s.totalGB * 100);
    return '' +
    '<aside class="sidebar">' +
      '<div class="sidebar__head">' +
        '<div class="sidebar__logo"><span class="mark">' + ic('check', 18) + '</span>' +
          '<span class="txt">Harness.</span></div>' +
        '<button class="icon-btn collapse-btn" data-act="toggle-collapse" title="サイドバーを折りたたむ">' +
          ic(state.collapsed ? 'chevronRight' : 'chevronLeft') + '</button>' +
      '</div>' +
      '<nav class="nav">' +
        NAV.map(navItem).join('') +
        '<div class="nav__section">個人</div>' +
        NAV_PERSONAL.map(navItem).join('') +
      '</nav>' +
      '<div class="storage">' +
        '<div class="storage__meta">' +
          '<div class="storage__row">' + ic('database', 14) + ' ストレージ <b>' + s.usedGB + ' / ' + s.totalGB + ' GB</b></div>' +
          '<div class="storage__bar"><i style="width:' + pct + '%"></i></div>' +
        '</div>' +
        '<div class="storage__mini">' + pct + '%</div>' +
      '</div>' +
    '</aside>';
  }

  function topbar() {
    var u = DB.user;
    var themeIcon = effectiveTheme() === 'dark' ? 'moon' : 'sun';
    return '' +
    '<header class="topbar">' +
      '<div class="search">' + ic('search', 17) +
        '<input placeholder="タスク・プロジェクトを検索" data-act="global-search">' +
        '<kbd>⌘K</kbd></div>' +
      '<div class="topbar__spacer"></div>' +
      '<div class="topbar__actions">' +
        '<button class="icon-btn badge-dot" data-act="toggle-notif" title="通知">' + ic('bell') + '</button>' +
        '<button class="icon-btn" data-act="cycle-theme" title="テーマ切替（現在: ' + themeLabel() + '）">' + ic(themeIcon) + '</button>' +
        '<button class="avatar-btn" data-act="toggle-avatar"><span class="avatar">' + u.initials + '</span></button>' +
        (state.panel === 'notif' ? notifDropdown() : '') +
        (state.panel === 'avatar' ? avatarMenu() : '') +
      '</div>' +
    '</header>';
  }

  function themeLabel() {
    return { light: 'ライト', dark: 'ダーク', system: 'システム' }[state.theme];
  }

  function notifDropdown() {
    var items = DB.notifications.map(function (n) {
      return '<div class="notif' + (n.unread ? '' : ' read') + '">' +
        '<span class="dot"></span><div><div class="body">' + n.text + '</div>' +
        '<div class="when">' + n.when + '</div></div></div>';
    }).join('');
    return '<div class="dropdown" data-stop>' +
      '<div class="dropdown__head"><h4>通知</h4><a data-act="mark-read">すべて既読にする</a></div>' +
      items + '</div>';
  }

  function avatarMenu() {
    var u = DB.user;
    return '<div class="menu" data-stop>' +
      '<div class="who"><div class="n">' + esc(u.name) + '</div><div class="e">' + esc(u.email) + '</div></div>' +
      '<button data-act="go" data-route="me">' + ic('user', 16) + ' マイページ</button>' +
      '<button data-act="go" data-route="settings">' + ic('settings', 16) + ' 設定</button>' +
      '<button class="danger" data-act="logout">' + ic('logout', 16) + ' ログアウト</button>' +
    '</div>';
  }

  function shell(content) {
    return '<div class="shell' + (state.collapsed ? ' collapsed' : '') + '">' +
      sidebar() +
      '<div class="main">' + topbar() +
        '<div class="content">' + content + '</div>' +
      '</div>' +
    '</div>' + overlays();
  }

  /* ============================================================
     ビュー: ホーム（ダッシュボード）
     ============================================================ */
  function statCard(o) {
    return '<div class="stat ' + (o.accent || '') + '">' +
      '<div class="top">' + ic(o.icon, 16) + ' ' + o.label + '</div>' +
      '<div class="n">' + o.n + '</div>' +
      '<div class="k">' + o.k + '</div></div>';
  }

  function donut(pct, done, total) {
    var r = 52, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return '<div class="donut"><svg viewBox="0 0 140 140">' +
      '<circle class="track" cx="70" cy="70" r="' + r + '" fill="none" stroke-width="14"/>' +
      '<circle class="val" cx="70" cy="70" r="' + r + '" fill="none" stroke-width="14" ' +
        'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" ' +
        'transform="rotate(-90 70 70)"/>' +
      '<text class="pct" x="70" y="68" text-anchor="middle" dominant-baseline="middle">' + pct + '%</text>' +
      '<text class="cap" x="70" y="90" text-anchor="middle">' + done + ' / ' + total + ' 完了</text>' +
      '</svg></div>';
  }

  function viewHome() {
    var st = DB.stats, wp = DB.weekProgress, u = DB.user;
    var stats = [
      statCard({ icon: 'clock', label: '今日のタスク', n: st.todayCount, k: 'うち高優先度 ' + st.todayHigh + ' 件' }),
      statCard({ icon: 'checkCircle', label: '今週の完了', n: st.weekDone, k: '先週比 +' + st.weekDelta, accent: 'accent-green' }),
      statCard({ icon: 'alert', label: '期限超過', n: st.overdue, k: '対応が必要です', accent: 'accent-red' }),
      statCard({ icon: 'activity', label: '進行中', n: st.inProgress, k: st.inProgressProjects + ' プロジェクト' })
    ].join('');

    var todayRows = DB.todayTaskIds.map(function (id) {
      var t = DB.tasks.filter(function (x) { return x.id === id; })[0];
      var done = t.status === 'done';
      return '<div class="task-row' + (done ? ' done' : '') + '">' +
        '<input type="checkbox" class="check" data-act="toggle-task" data-id="' + t.id + '"' + (done ? ' checked' : '') + '>' +
        '<span class="name">' + esc(t.title) + '</span>' +
        (done ? statusBadge('done') : priBadge(t.pri)) +
        '<span class="time">' + t.time + '</span></div>';
    }).join('');

    var activity = DB.activity.map(function (a) {
      return '<div class="tl-item"><span class="dot ' + (a.on ? 'on' : 'off') + '"></span>' +
        '<div><div class="t">' + a.text + '</div><div class="when">' + a.when + '</div></div></div>';
    }).join('');

    return '' +
    '<div class="crumb">home</div>' +
    '<div class="page-head"><div>' +
      '<h1>おはようございます、' + esc(u.firstName) + 'さん</h1>' +
      '<p class="lead">今日は 2026年7月6日（月）。期限が近いタスクが ' + st.todayHigh + ' 件あります。</p>' +
    '</div><div class="actions">' +
      '<button class="btn btn-primary" data-act="open-new">' + ic('plus', 16) + ' 新規タスク</button>' +
    '</div></div>' +
    '<div class="stat-grid">' + stats + '</div>' +
    '<div class="two-col">' +
      '<div class="card"><div class="card__head"><h3>今日のタスク</h3>' +
        '<a class="link" data-act="go" data-route="todos">すべて表示</a></div>' +
        '<div class="card__body">' + todayRows + '</div></div>' +
      '<div style="display:flex;flex-direction:column;gap:20px">' +
        '<div class="card"><div class="card__head"><h3>今週の進捗</h3></div>' +
          '<div class="card__body">' + donut(wp.pct, wp.done, wp.total) + '</div></div>' +
        '<div class="card"><div class="card__head"><h3>最近のアクティビティ</h3></div>' +
          '<div class="card__body"><div class="timeline">' + activity + '</div></div></div>' +
      '</div>' +
    '</div>';
  }

  /* ============================================================
     ビュー: ToDo一覧
     ============================================================ */
  var TABS = [
    { id: 'all', label: 'すべて' },
    { id: 'progress', label: '進行中' },
    { id: 'done', label: '完了' },
    { id: 'over', label: '期限超過' }
  ];

  function colFilterPop() {
    var opts = ['high', 'mid', 'low'].map(function (p) {
      var on = state.priFilter.length === 0 || state.priFilter.indexOf(p) !== -1;
      return '<label>' + priBadge(p) +
        '<input type="checkbox" class="check" data-act="pri-toggle" data-pri="' + p + '"' + (on ? ' checked' : '') + '>' +
        '</label>';
    }).join('');
    return '<div class="pop" data-stop>' + opts +
      '<div class="pop__foot"><a data-act="pri-clear">すべて解除</a>' +
      '<button class="btn btn-primary btn-sm" data-act="pri-apply">適用</button></div></div>';
  }

  function viewTodos() {
    var over = tabCount('over');
    var head =
      '<div class="crumb">todos</div>' +
      '<div class="page-head"><div>' +
        '<h1>ToDo一覧</h1>' +
        '<p class="lead">全 ' + DB.tasks.length + ' 件のタスク・うち ' + over + ' 件が期限超過です。</p>' +
      '</div><div class="actions">' +
        (state.demoEmpty
          ? '<button class="btn btn-ghost btn-sm" data-act="demo-empty-off">(デモ)一覧に戻す</button>'
          : '<button class="btn btn-ghost btn-sm" data-act="demo-empty-on">(デモ)空状態を見る</button>') +
        '<button class="btn btn-primary" data-act="open-new">' + ic('plus', 16) + ' 新規タスク</button>' +
      '</div></div>';

    var tabs = '<div class="tabs">' + TABS.map(function (t) {
      return '<button class="tab' + (state.tab === t.id ? ' active' : '') + '" data-act="set-tab" data-tab="' + t.id + '">' +
        t.label + '<span class="cnt">' + tabCount(t.id) + '</span></button>';
    }).join('') + '</div>';

    var toolbar =
      '<div class="toolbar">' +
        '<div class="search">' + ic('search', 17) +
          '<input placeholder="タスク名で絞り込み" value="' + esc(state.query) + '" data-act="todo-search"></div>' +
        '<button class="btn btn-sm" data-act="noop">' + ic('chevronDown', 14) + ' 期限が近い順</button>' +
      '</div>' +
      '<div class="filter-note">列見出しの ' + ic('filter', 12) + ' アイコンから列ごとに絞り込めます。行右端の ' + ic('trash', 12) + ' から削除できます。</div>';

    if (state.demoEmpty) {
      return head + tabs + toolbar + emptyState();
    }

    // データ整形
    var all = filteredTasks();
    var totalPages = Math.max(1, Math.ceil(all.length / state.perPage));
    if (state.page > totalPages) { state.page = totalPages; }
    var start = (state.page - 1) * state.perPage;
    var rows = all.slice(start, start + state.perPage);

    var priOn = state.priFilter.length > 0 && state.priFilter.length < 3;

    var body = rows.length ? rows.map(function (t) {
      var done = t.status === 'done';
      return '<tr>' +
        '<td style="width:34px"><input type="checkbox" class="check" data-act="toggle-task" data-id="' + t.id + '"' + (done ? ' checked' : '') + '></td>' +
        '<td class="cell-task' + (done ? ' done' : '') + '"><div class="tname">' + esc(t.title) + '</div>' +
          '<div class="tid">' + t.id + '</div></td>' +
        '<td><span class="tag">' + esc(t.project) + '</span></td>' +
        '<td>' + priBadge(t.pri) + '</td>' +
        '<td><span class="chip">' + t.assignee + '</span></td>' +
        '<td class="' + (t.status === 'over' ? 'due-over' : '') + '" style="font-variant-numeric:tabular-nums">' + t.due + '</td>' +
        '<td>' + statusBadge(t.status) + '</td>' +
        '<td style="width:40px;text-align:right"><button class="row-del" data-act="ask-delete" data-id="' + t.id + '" title="削除">' + ic('trash', 15) + '</button></td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--ink-3);padding:40px">条件に一致するタスクがありません</td></tr>';

    var table =
      '<div class="table-wrap"><table class="grid"><thead><tr>' +
        '<th></th>' +
        '<th>タスク</th>' +
        '<th><span class="th">プロジェクト <button class="fbtn" data-act="noop">' + ic('filter', 13) + '</button></span></th>' +
        '<th style="position:relative"><span class="th">優先度 ' +
          '<button class="fbtn' + (priOn ? ' on' : '') + '" data-act="toggle-colpri">' + ic('filter', 13) + '</button></span>' +
          (state.panel === 'colPri' ? colFilterPop() : '') + '</th>' +
        '<th><span class="th">担当 <button class="fbtn" data-act="noop">' + ic('filter', 13) + '</button></span></th>' +
        '<th><span class="th">期限 <button class="fbtn" data-act="noop">' + ic('chevronDown', 13) + '</button></span></th>' +
        '<th><span class="th">状態 <button class="fbtn" data-act="noop" title="進行中＝着手済み未完了／完了＝チェック済み／期限超過＝期限を過ぎた未完了タスク">' + ic('info', 13) + '</button></span></th>' +
        '<th></th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';

    return head + tabs + toolbar + table + pager(all.length, totalPages);
  }

  function pager(total, totalPages) {
    var perOpts = [5, 10, 30, 50, 100].map(function (n) {
      return '<button class="' + (state.perPage === n ? 'on' : '') + '" data-act="set-per" data-per="' + n + '">' + n + '</button>';
    }).join('');
    var start = total === 0 ? 0 : (state.page - 1) * state.perPage + 1;
    var end = Math.min(total, state.page * state.perPage);

    var pages = '';
    for (var i = 1; i <= totalPages; i++) {
      pages += '<button class="pg' + (state.page === i ? ' on' : '') + '" data-act="set-page" data-page="' + i + '">' + i + '</button>';
    }

    return '<div class="pager">' +
      '<span class="per">表示件数 ' + perOpts + '</span>' +
      '<span>' + start + '–' + end + ' / ' + total + ' 件</span>' +
      '<span class="pages">' +
        '<button class="pg nav" data-act="page-prev">' + ic('chevronLeft', 15) + '</button>' +
        pages +
        '<button class="pg nav" data-act="page-next">' + ic('chevronRight', 15) + '</button>' +
      '</span></div>';
  }

  function emptyState() {
    return '<div class="empty"><div class="glyph">' + ic('search', 24) + '</div>' +
      '<h4>条件に一致するタスクがありません</h4>' +
      '<p>フィルタや検索条件を変更するか、新しいタスクを作成してください。</p>' +
      '<button class="btn btn-sm" data-act="clear-filters">' + ic('reset', 15) + ' フィルタを解除</button></div>';
  }

  /* ============================================================
     ビュー: マイページ
     ============================================================ */
  function viewMe() {
    var u = DB.user;
    var metrics =
      metric('完了タスク（累計）', '148', '今月 32 件') +
      metric('継続日数', '23<small> 日</small>', '自己ベスト更新中') +
      metric('今月の達成率', '87<small>%</small>', '目標 80% を達成');

    var projs = DB.projects.map(function (p) {
      return '<div class="proj-row"><span class="badge-sq" style="background:' + p.color + '">' + p.id + '</span>' +
        '<div class="info"><div class="n">' + esc(p.name) + '</div>' +
        '<div class="s">' + p.tasks + ' タスク · 進捗 ' + p.progress + '%</div></div>' +
        priBadge(p.pri) + '</div>';
    }).join('');

    var acts = DB.profileActivity.map(function (a) {
      return '<div class="tl-item"><span class="dot ' + (a.on ? 'on' : 'off') + '"></span>' +
        '<div><div class="t">' + a.text + '</div><div class="when">' + a.when + '</div></div></div>';
    }).join('');

    return '' +
    '<div class="crumb">me</div>' +
    '<div class="card" style="margin-bottom:20px"><div class="card__body">' +
      '<div class="profile">' +
        '<span class="big-avatar">' + u.initials + '</span>' +
        '<div style="flex:1">' +
          '<h2>' + esc(u.name) + ' <span class="owner-tag">Owner</span></h2>' +
          '<p class="role">' + esc(u.role) + '</p>' +
          '<p class="meta">' + esc(u.email) + ' · ' + u.tz + '</p>' +
        '</div>' +
        '<button class="btn" data-act="noop">' + ic('edit', 16) + ' プロフィールを編集</button>' +
      '</div>' +
    '</div></div>' +
    '<div class="metric-grid">' + metrics + '</div>' +
    '<div class="two-col">' +
      '<div class="card"><div class="card__head"><h3>担当プロジェクト</h3>' +
        '<a class="link" data-act="go" data-route="todos">すべて表示</a></div>' +
        '<div class="card__body">' + projs + '</div></div>' +
      '<div class="card"><div class="card__head"><h3>アクティビティ履歴</h3></div>' +
        '<div class="card__body"><div class="timeline">' + acts + '</div></div></div>' +
    '</div>';
  }

  function metric(k, n, sub) {
    return '<div class="metric"><div class="k">' + k + '</div>' +
      '<div class="n">' + n + '</div><div class="sub">' + sub + '</div></div>';
  }

  /* ============================================================
     ビュー: 設定
     ============================================================ */
  var SETTINGS_TABS = [
    { id: 'account', label: 'アカウント' },
    { id: 'notify', label: '通知' },
    { id: 'display', label: '表示' },
    { id: 'security', label: 'セキュリティ' },
    { id: 'integration', label: '連携' }
  ];

  function toggleRow(t, d, on) {
    return '<div class="setting-row"><div class="txt"><div class="t">' + t + '</div><div class="d">' + d + '</div></div>' +
      '<input type="checkbox" class="toggle" data-act="noop"' + (on ? ' checked' : '') + '></div>';
  }

  function viewSettings() {
    var nav = '<div class="settings-nav">' + SETTINGS_TABS.map(function (t) {
      return '<button class="' + (state.settingsTab === t.id ? 'active' : '') + '" data-act="set-settings-tab" data-tab="' + t.id + '">' + t.label + '</button>';
    }).join('') + '</div>';

    var panel;
    if (state.settingsTab === 'display') {
      panel = displayPanel();
    } else if (state.settingsTab === 'notify') {
      panel = notifyPanel();
    } else {
      panel =
        '<div class="card"><div class="card__body" style="color:var(--ink-3);padding:40px;text-align:center">' +
          '「' + settingsLabel() + '」の設定項目はデザインモックのため準備中です。' +
        '</div></div>';
    }

    return '' +
    '<div class="crumb">settings</div>' +
    '<div class="page-head"><div><h1>設定</h1>' +
      '<p class="lead">アカウント・通知・表示の設定を管理します。</p></div></div>' +
    '<div class="settings-grid">' + nav +
      '<div>' + panel +
        '<div class="settings-foot">' +
          '<button class="btn btn-ghost" data-act="noop">キャンセル</button>' +
          '<button class="btn btn-primary" data-act="save-settings">変更を保存</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function settingsLabel() {
    var f = SETTINGS_TABS.filter(function (t) { return t.id === state.settingsTab; })[0];
    return f ? f.label : '';
  }

  function notifyPanel() {
    return '<div class="card"><div class="card__head"><h3>通知</h3></div><div class="card__body" style="padding-top:4px">' +
      toggleRow('期限リマインダー', '期限の24時間前にプッシュ通知を送ります', true) +
      toggleRow('タスク割り当て', '自分にタスクが割り当てられたら通知', true) +
      toggleRow('週次サマリーメール', '毎週月曜の朝に先週の実績を送信', false) +
      toggleRow('メンション', 'コメントで @ メンションされたら通知', true) +
    '</div></div>';
  }

  function displayPanel() {
    var seg = ['light', 'dark', 'system'].map(function (v) {
      var lbl = { light: 'ライト', dark: 'ダーク', system: 'システム' }[v];
      return '<button class="' + (state.theme === v ? 'on' : '') + '" data-act="set-theme" data-theme="' + v + '">' + lbl + '</button>';
    }).join('');

    return '<div class="card"><div class="card__head"><h3>表示</h3></div><div class="card__body" style="padding-top:4px">' +
      '<div class="setting-row"><div class="txt"><div class="t">テーマ</div>' +
        '<div class="d">ライト / ダーク / システム設定に追従</div></div>' +
        '<div class="seg">' + seg + '</div></div>' +
      '<div class="setting-row"><div class="txt"><div class="t">言語</div>' +
        '<div class="d">アプリ全体の表示言語</div></div>' +
        '<select data-act="noop"><option>日本語</option><option>English</option></select></div>' +
      '<div class="setting-row"><div class="txt"><div class="t">タスクの初期表示</div>' +
        '<div class="d">ToDo一覧を開いたときの既定タブ</div></div>' +
        '<select data-act="noop"><option>進行中</option><option>すべて</option><option>期限超過</option></select></div>' +
    '</div></div>';
  }

  /* ============================================================
     オーバーレイ（モーダル・ダイアログ・トースト）
     ============================================================ */
  function overlays() {
    var html = '';
    if (state.modal === 'new') { html += modalNew(); }
    else if (state.modal && state.modal.type === 'delete') { html += dialogDelete(state.modal.id); }
    if (state.toast) { html += '<div class="toast">' + ic('checkCircle', 16) + ' ' + esc(state.toast) + '</div>'; }
    return html;
  }

  function modalNew() {
    var projOpts = ['AIDD Kit', 'QA監査ツール', 'Design', 'Docs', 'Process', 'PWA']
      .map(function (p) { return '<option>' + p + '</option>'; }).join('');
    return '<div class="overlay" data-act="close-overlay"><div class="modal" data-stop>' +
      '<div class="modal__head"><h3>新規タスクを作成</h3>' +
        '<button class="icon-btn" data-act="close-overlay">' + ic('x', 18) + '</button></div>' +
      '<div class="modal__body">' +
        '<div class="field"><label>タスク名 <span class="req">*</span></label>' +
          '<input placeholder="例: リリースノートのレビュー" autofocus></div>' +
        '<div class="field"><label>プロジェクト</label><select>' + projOpts + '</select></div>' +
        '<div class="form-2col">' +
          '<div class="field"><label>優先度</label><select><option>中</option><option>高</option><option>低</option></select></div>' +
          '<div class="field"><label>期限</label><input type="date" value="2026-07-12"></div>' +
        '</div>' +
        '<div class="field"><label>メモ</label><textarea placeholder="補足があれば入力"></textarea></div>' +
      '</div>' +
      '<div class="modal__foot">' +
        '<button class="btn btn-ghost" data-act="close-overlay">キャンセル</button>' +
        '<button class="btn btn-primary" data-act="create-task">作成する</button>' +
      '</div>' +
    '</div></div>';
  }

  function dialogDelete(id) {
    var t = DB.tasks.filter(function (x) { return x.id === id; })[0];
    var name = t ? t.title : 'このタスク';
    return '<div class="overlay" data-act="close-overlay"><div class="modal dialog" data-stop>' +
      '<div class="modal__head"><h3>タスクを削除しますか？</h3>' +
        '<button class="icon-btn" data-act="close-overlay">' + ic('x', 18) + '</button></div>' +
      '<div class="modal__body"><span class="warn">' + ic('alert', 20) + '</span>' +
        '<div class="msg"><div class="t">「' + esc(name) + '」を削除します</div>' +
        '<div class="d">この操作は取り消せません。関連するコメントも削除されます。</div></div></div>' +
      '<div class="modal__foot">' +
        '<button class="btn btn-ghost" data-act="close-overlay">キャンセル</button>' +
        '<button class="btn btn-danger" data-act="confirm-delete" data-id="' + id + '">削除する</button>' +
      '</div>' +
    '</div></div>';
  }

  /* ============================================================
     レンダリング
     ============================================================ */
  function render() {
    applyTheme();
    if (!state.authed) { app.innerHTML = viewLogin(); return; }
    var view;
    switch (state.route) {
      case 'todos': view = viewTodos(); break;
      case 'me': view = viewMe(); break;
      case 'settings': view = viewSettings(); break;
      case 'calendar':
      case 'projects':
        view = placeholderView(); break;
      default: view = viewHome();
    }
    app.innerHTML = shell(view);
  }

  function placeholderView() {
    var label = { calendar: 'カレンダー', projects: 'プロジェクト' }[state.route] || '';
    return '<div class="crumb">' + state.route + '</div>' +
      '<div class="page-head"><div><h1>' + label + '</h1>' +
      '<p class="lead">この画面はデザインモックのため準備中です。</p></div></div>' +
      '<div class="empty"><div class="glyph">' + ic('folder', 24) + '</div>' +
      '<h4>' + label + 'は準備中です</h4>' +
      '<p>ホームやToDo一覧のデザインをご確認ください。</p>' +
      '<button class="btn btn-sm" data-act="go" data-route="home">ホームへ戻る</button></div>';
  }

  /* トースト表示（自動消滅） ---------- */
  var toastTimer = null;
  function showToast(msg) {
    state.toast = msg;
    render();
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { state.toast = null; render(); }, 2200);
  }

  /* ============================================================
     イベント（委譲）
     ============================================================ */
  var ACTIONS = {
    // ナビ・シェル
    'go': function (el) { navigate(el.getAttribute('data-route')); },
    'toggle-collapse': function () { state.collapsed = !state.collapsed; save('collapsed', state.collapsed); state.panel = null; render(); },
    'cycle-theme': function () {
      var order = ['light', 'dark', 'system'];
      state.theme = order[(order.indexOf(state.theme) + 1) % 3];
      save('theme', state.theme); state.panel = null; render();
    },
    'toggle-notif': function () { state.panel = state.panel === 'notif' ? null : 'notif'; render(); },
    'toggle-avatar': function () { state.panel = state.panel === 'avatar' ? null : 'avatar'; render(); },
    'mark-read': function () { DB.notifications = DB.notifications.map(function (n) { return Object.assign({}, n, { unread: false }); }); render(); },

    // ログイン
    'login-submit': function () { state.authed = true; state.loginError = false; save('authed', true); navigate('home'); },
    'login-demo-on': function () { state.loginError = true; render(); },
    'login-demo-off': function () { state.loginError = false; render(); },
    'logout': function () { state.authed = false; save('authed', false); state.panel = null; render(); },

    // ホーム / タスク操作
    'open-new': function () { state.modal = 'new'; state.panel = null; render(); },
    'toggle-task': function (el) {
      var id = el.getAttribute('data-id');
      DB.tasks = DB.tasks.map(function (t) {
        if (t.id !== id) { return t; }
        return Object.assign({}, t, { status: t.status === 'done' ? 'progress' : 'done' });
      });
      render();
    },

    // モーダル
    'close-overlay': function () { state.modal = null; render(); },
    'create-task': function () {
      var input = app.querySelector('.modal input');
      var title = input && input.value.trim() ? input.value.trim() : '無題のタスク';
      state.modal = null;
      showToast('タスク「' + (title.length > 16 ? title.slice(0, 16) + '…' : title) + '」を作成しました');
    },
    'ask-delete': function (el) { state.modal = { type: 'delete', id: el.getAttribute('data-id') }; render(); },
    'confirm-delete': function (el) {
      var id = el.getAttribute('data-id');
      DB.tasks = DB.tasks.filter(function (t) { return t.id !== id; });
      state.modal = null;
      showToast('タスクを削除しました');
    },

    // ToDo一覧
    'set-tab': function (el) { state.tab = el.getAttribute('data-tab'); state.page = 1; render(); },
    'toggle-colpri': function () { state.panel = state.panel === 'colPri' ? null : 'colPri'; render(); },
    'pri-toggle': function (el) {
      var p = el.getAttribute('data-pri');
      var set = state.priFilter.slice();
      // 空 = 全選択状態。まず全選択に展開してからトグルする
      if (set.length === 0) { set = ['high', 'mid', 'low']; }
      var i = set.indexOf(p);
      if (i === -1) { set.push(p); } else { set.splice(i, 1); }
      state.priFilter = set.length === 3 ? [] : set;
      state.page = 1; render();
    },
    'pri-clear': function () { state.priFilter = ['__none__']; state.page = 1; render(); },
    'pri-apply': function () { state.panel = null; render(); },
    'set-per': function (el) { state.perPage = parseInt(el.getAttribute('data-per'), 10); state.page = 1; render(); },
    'set-page': function (el) { state.page = parseInt(el.getAttribute('data-page'), 10); render(); },
    'page-prev': function () { if (state.page > 1) { state.page--; render(); } },
    'page-next': function () {
      var total = filteredTasks().length, tp = Math.max(1, Math.ceil(total / state.perPage));
      if (state.page < tp) { state.page++; render(); }
    },
    'demo-empty-on': function () { state.demoEmpty = true; render(); },
    'demo-empty-off': function () { state.demoEmpty = false; render(); },
    'clear-filters': function () { state.tab = 'all'; state.priFilter = []; state.query = ''; state.demoEmpty = false; state.page = 1; render(); },

    // 設定
    'set-settings-tab': function (el) { state.settingsTab = el.getAttribute('data-tab'); render(); },
    'set-theme': function (el) { state.theme = el.getAttribute('data-theme'); save('theme', state.theme); render(); },
    'save-settings': function () { showToast('設定を保存しました'); },

    'noop': function () {}
  };

  // クリック
  app.addEventListener('click', function (e) {
    var target = e.target.closest('[data-act]');

    // オーバーレイ/パネル外クリックで閉じる
    if (!target) {
      if (state.panel && !e.target.closest('[data-stop]')) { state.panel = null; render(); }
      return;
    }

    var act = target.getAttribute('data-act');

    // フォーム送信ボタンの既定動作を抑止
    if (act === 'login-submit' || act === 'create-task' || act === 'confirm-delete') { e.preventDefault(); }

    // パネルは data-stop 内クリックでは閉じない。外側の通常アクションでは閉じる
    var insideStop = e.target.closest('[data-stop]');
    if (state.panel && !insideStop &&
        act !== 'toggle-notif' && act !== 'toggle-avatar' && act !== 'toggle-colpri') {
      state.panel = null;
    }

    // チェックボックス(toggle-task/pri-toggle)は既定のチェック動作を活かすため preventDefault しない
    var fn = ACTIONS[act];
    if (fn) { fn(target, e); }
  });

  // フォーム送信（Enter対応）
  app.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-act="login-submit"]');
    if (form) { e.preventDefault(); ACTIONS['login-submit'](form); }
  });

  // 入力（検索・絞り込み）
  app.addEventListener('input', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) { return; }
    var act = el.getAttribute('data-act');
    if (act === 'todo-search') {
      state.query = el.value; state.page = 1;
      // 再描画で入力欄が作り直されるためカーソル位置を保持
      var pos = el.selectionStart;
      render();
      var again = app.querySelector('[data-act="todo-search"]');
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (x) {} }
    }
  });

  // Esc でオーバーレイ/パネルを閉じる
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (state.modal) { state.modal = null; render(); }
      else if (state.panel) { state.panel = null; render(); }
    }
  });

  /* ---------- ルーティング（ハッシュ） ---------- */
  var ROUTES = ['home', 'todos', 'calendar', 'projects', 'me', 'settings'];
  function navigate(route) { location.hash = '#/' + route; }
  function syncRoute() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    state.route = ROUTES.indexOf(h) !== -1 ? h : 'home';
    state.panel = null;
    render();
  }
  window.addEventListener('hashchange', syncRoute);

  /* ---------- 起動 ---------- */
  applyTheme();
  syncRoute();
})();
