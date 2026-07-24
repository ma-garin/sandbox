/* ============================================================
   Harness. — モックデータ
   実際のAPIはまだないため、デザイン確認用の静的データを提供する。
   変更は immutable に扱う（元配列を破壊しない）。
   ============================================================ */
(function (global) {
  'use strict';

  var USER = {
    name: '藤曲 由紀',
    firstName: '由紀',
    initials: 'YF',
    email: 'yuki.fujimagari@example.com',
    role: 'QAエンジニア / AIDD Kit メンテナー',
    tz: 'JST (UTC+9)',
    isOwner: true
  };

  // 状態: 'progress'（進行中）/ 'done'（完了）/ 'over'（期限超過）
  // 優先度: 'high' / 'mid' / 'low'
  var TASKS = [
    { id: 'TASK-241', title: 'リリースノート v5.0 のレビュー',        project: 'AIDD Kit', pri: 'high', assignee: 'YF', due: '07/06', status: 'progress', time: '10:30' },
    { id: 'TASK-238', title: '監査指摘 A-01 の修正確認',              project: 'AIDD Kit', pri: 'high', assignee: 'YF', due: '07/04', status: 'over',     time: '13:00' },
    { id: 'TASK-244', title: 'デザインシステムのダーク対応 方針決め', project: 'Design',   pri: 'mid',  assignee: 'TN', due: '07/06', status: 'progress', time: '15:00' },
    { id: 'TASK-236', title: '週次レトロの下書き',                    project: 'Process',  pri: 'low',  assignee: 'YF', due: '07/06', status: 'done',     time: '09:15' },
    { id: 'TASK-245', title: 'export-project.sh の実案件検証',         project: 'AIDD Kit', pri: 'low',  assignee: 'YF', due: '07/08', status: 'progress', time: '17:00' },
    { id: 'TASK-240', title: 'Playwright スモークテストの追加',        project: 'QA',       pri: 'mid',  assignee: 'SM', due: '07/03', status: 'over',     time: '11:00' },
    { id: 'TASK-231', title: 'INDEX.md の2層再構成',                  project: 'Docs',     pri: 'mid',  assignee: 'YF', due: '07/02', status: 'done',     time: '16:20' },
    { id: 'TASK-247', title: '新規PWAのスキャフォールド作成',         project: 'PWA',      pri: 'low',  assignee: 'TN', due: '07/10', status: 'progress', time: '14:00' },
    { id: 'TASK-249', title: 'セキュリティレビューの一次対応',        project: 'QA',       pri: 'high', assignee: 'SM', due: '07/09', status: 'progress', time: '10:00' },
    { id: 'TASK-233', title: '月次retro自動起票の設計メモ',           project: 'Process',  pri: 'low',  assignee: 'YF', due: '07/01', status: 'done',     time: '09:40' },
    { id: 'TASK-250', title: 'スキル棚卸し 14件の分類',               project: 'AIDD Kit', pri: 'mid',  assignee: 'YF', due: '07/12', status: 'progress', time: '13:30' },
    { id: 'TASK-251', title: 'ダークトークンのコントラスト検証',      project: 'Design',   pri: 'mid',  assignee: 'TN', due: '07/11', status: 'progress', time: '15:45' },
    { id: 'TASK-228', title: 'ISTQB severity 分類の運用整理',         project: 'QA',       pri: 'low',  assignee: 'SM', due: '06/30', status: 'done',     time: '18:00' },
    { id: 'TASK-252', title: 'GitHub Pages デプロイ手順の更新',       project: 'Docs',     pri: 'low',  assignee: 'YF', due: '07/14', status: 'progress', time: '11:20' }
  ];

  var TODAY_TASKS = ['TASK-241', 'TASK-238', 'TASK-244', 'TASK-236', 'TASK-245'];

  var PROJECTS = [
    { id: 'AK', name: 'AIDD Kit',        tasks: 12, progress: 71, pri: 'high', color: '#1976D2' },
    { id: 'QA', name: 'QA監査ツール',     tasks: 7,  progress: 44, pri: 'mid',  color: '#2FA35B' },
    { id: 'DS', name: 'デザインシステム刷新', tasks: 5, progress: 20, pri: 'low', color: '#E0932A' }
  ];

  var ACTIVITY = [
    { on: true,  text: '「PR #3」をマージしました', when: '12分前' },
    { on: true,  text: '田中さんが <b>UX監査</b> にコメント', when: '1時間前' },
    { on: false, text: 'タスク3件を完了', when: '3時間前' },
    { on: false, text: '新規プロジェクトを作成', when: '昨日 18:40' }
  ];

  var PROFILE_ACTIVITY = [
    { on: true,  text: 'TASK-231 を完了', when: '今日 09:15' },
    { on: true,  text: 'PR #3 をマージ', when: '今日 08:40' },
    { on: false, text: 'デザインシステム刷新を作成', when: '7月5日' },
    { on: false, text: '監査 AUDIT-2026-07 を承認', when: '7月3日' },
    { on: false, text: '14 スキルの棚卸しを実施', when: '7月3日' }
  ];

  var NOTIFICATIONS = [
    { unread: true,  text: '田中さんが「デザインシステムのダーク対応」に<b>コメント</b>しました', when: '12分前' },
    { unread: true,  text: '「監査指摘 A-01」の期限が<b>本日まで</b>です', when: '2時間前' },
    { unread: false, text: '佐藤さんが「Playwright スモークテストの追加」を完了しました', when: '昨日 17:40' },
    { unread: false, text: '「AIDD Kit」プロジェクトに新しいタスクが3件追加されました', when: '昨日 09:00' }
  ];

  global.DB = {
    user: USER,
    tasks: TASKS,
    todayTaskIds: TODAY_TASKS,
    projects: PROJECTS,
    activity: ACTIVITY,
    profileActivity: PROFILE_ACTIVITY,
    notifications: NOTIFICATIONS,
    // ホーム上部の統計
    stats: { todayCount: 5, todayHigh: 2, weekDone: 12, weekDelta: 3, overdue: 2, inProgress: 3, inProgressProjects: 2 },
    weekProgress: { pct: 71, done: 17, total: 24 },
    storage: { usedGB: 6.2, totalGB: 10 },
    heroStats: [
      { n: '24', k: 'アクティブなタスク' },
      { n: '87%', k: '今月の達成率' },
      { n: '4', k: 'プロジェクト' }
    ]
  };
})(window);
