// TESTRA-Next Web ランタイム
// コア（../core/pipeline.js）をブラウザから直接 import して実行する。
// オンプレ/クラウドいずれも同じ静的配信で動作する（ビルド不要）。

import { runPipeline } from '../core/pipeline.js';
import { STAGE_ORDER } from '../core/model.js';

const LS = 'testra-next.config.v1';
const STAGE_LABEL = {
  ingest: 'ドキュメント取込',
  featureAnalysis: 'テストフィーチャー分析',
  modelAnalysis: 'テストモデル分析',
  designBasic: 'テスト設計（基本）',
  designDetail: 'テスト設計（詳細）',
  caseHigh: 'テストケース（ハイレベル）',
  caseLow: 'テストケース（ローレベル）',
  script: 'テストスクリプト作成',
  execution: 'テスト実行',
  qfSync: 'Quality Forward連携',
  report: 'テストレポート生成',
};

const SAMPLE = `# ログイン機能 仕様

- ユーザーはメールアドレスとパスワードでログインできる。
- パスワードは8文字以上32文字以下でなければならない。
- パスワードを5回連続で誤入力するとアカウントがロックされる。
- ログイン成功後はダッシュボードへ遷移する。
- ログイン処理は3秒以内に応答すること。
- Chrome / Safari / Edge の最新版で動作すること。`;

const $ = (id) => document.getElementById(id);
let currentRun = null;

/* ---------- 設定 ---------- */
function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(LS)) || {};
  } catch {
    return {};
  }
}
function applyConfigToUI() {
  const c = loadConfig();
  $('cfg-provider').value = c.provider || 'rule';
  $('cfg-key').value = c.apiKey || '';
  $('cfg-model').value = c.model || '';
  $('cfg-qf-url').value = c.qfUrl || '';
  $('cfg-qf-token').value = c.qfToken || '';
  $('cfg-qf-live').checked = Boolean(c.qfLive);
}
$('save-settings').addEventListener('click', () => {
  const c = {
    provider: $('cfg-provider').value,
    apiKey: $('cfg-key').value.trim(),
    model: $('cfg-model').value.trim(),
    qfUrl: $('cfg-qf-url').value.trim(),
    qfToken: $('cfg-qf-token').value.trim(),
    qfLive: $('cfg-qf-live').checked,
  };
  localStorage.setItem(LS, JSON.stringify(c));
  $('settings-status').textContent = '保存しました';
  setTimeout(() => ($('settings-status').textContent = ''), 1500);
});

/* ---------- タブ ---------- */
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    $(`tab-${t.dataset.tab}`).classList.add('active');
  })
);

/* ---------- フロー描画 ---------- */
function initFlow() {
  $('flow').innerHTML = STAGE_ORDER.map(
    (s) => `<li data-stage="${s}"><span class="dot"></span>${STAGE_LABEL[s]}</li>`
  ).join('');
}
function markStage(stage, info) {
  const li = document.querySelector(`#flow li[data-stage="${stage}"]`);
  if (li) {
    li.classList.add('done');
    const n = Object.entries(info).find(([k]) => k !== 'stage');
    if (n) li.insertAdjacentHTML('beforeend', ` <em>${n[1]}</em>`);
  }
}

/* ---------- 実行 ---------- */
$('sample').addEventListener('click', () => {
  $('spec').value = SAMPLE;
  $('name').value = 'ログイン';
});

$('fetch-url').addEventListener('click', async () => {
  const url = $('url').value.trim();
  if (!url) return;
  $('status').textContent = '取得中…';
  try {
    const res = await fetch(url);
    let text = await res.text();
    if (/<html[\s>]/i.test(text)) text = text.replace(/<[^>]+>/g, ' ');
    $('spec').value = text.trim();
    $('status').textContent = '取得しました';
  } catch (e) {
    $('status').textContent = `取得失敗（CORS等）: ${e.message}`;
  }
});

$('run').addEventListener('click', async () => {
  const spec = $('spec').value.trim();
  if (!spec) {
    $('status').textContent = '仕様テキストを入力してください';
    return;
  }
  initFlow();
  $('stages').innerHTML = '';
  $('status').textContent = '実行中…';

  const c = loadConfig();
  const sources = [{ name: 'spec', kind: 'spec', text: spec }];
  const pkg = $('apk-pkg').value.trim();
  if (pkg) {
    sources.push({
      name: `${pkg}.apk`,
      kind: 'apk',
      meta: {
        package: pkg,
        permissions: $('apk-perms').value.split(',').map((s) => s.trim()).filter(Boolean),
        activities: [],
      },
    });
  }

  const options = {
    timestamp: new Date().toISOString(),
    llm: c.provider === 'openai' && c.apiKey ? { provider: 'openai', apiKey: c.apiKey, model: c.model } : { provider: 'rule' },
    qualityForward:
      c.qfLive && c.qfUrl && c.qfToken ? { dryRun: false, baseUrl: c.qfUrl, apiKey: c.qfToken } : { dryRun: true },
    onStage: (stage, run) => markStage(stage, run.trace[run.trace.length - 1]),
  };

  try {
    currentRun = await runPipeline({ title: $('name').value.trim() || 'untitled', sources }, options);
    renderStages(currentRun);
    renderReport(currentRun);
    $('status').textContent = '完了 — レポートタブで結果を確認できます';
  } catch (e) {
    $('status').textContent = `エラー: ${e.message}`;
    console.error(e);
  }
});

/* ---------- 成果物描画 ---------- */
function renderStages(run) {
  const html = STAGE_ORDER.map((stage) => {
    const art = run.artifacts[stage];
    return `<details class="stage-card">
      <summary>${STAGE_LABEL[stage]} <code>${stage}</code></summary>
      <pre>${escapeHtml(JSON.stringify(summaryOf(stage, art), null, 2))}</pre>
    </details>`;
  }).join('');
  $('stages').innerHTML = html;
}

// ステージごとに読みやすい要約を返す（巨大JSON全体は出さない）
function summaryOf(stage, art) {
  if (!art) return null;
  switch (stage) {
    case 'featureAnalysis':
      return art.features.map((f) => ({ id: f.id, type: f.type, name: f.name, risk: f.risk }));
    case 'modelAnalysis':
      return art.models.map((m) => ({ feature: m.featureName, techniques: m.techniques.map((t) => t.technique) }));
    case 'caseLow':
      return art.cases.slice(0, 8).map((c) => ({ id: c.id, title: c.title, data: c.testData.value, expected: c.expected }));
    case 'script':
      return art.scripts.map((s) => ({ id: s.id, file: s.filename, format: s.format }));
    case 'execution':
      return { mode: art.mode, summary: art.summary };
    case 'qfSync':
      return { mode: art.mode, counts: art.payload.counts };
    case 'report':
      return art.summary;
    default:
      return art.stats || art;
  }
}

function renderReport(run) {
  $('report').innerHTML = mdToHtml(run.artifacts.report.markdown);
}

/* ---------- ダウンロード ---------- */
function download(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
$('dl-md').addEventListener('click', () => currentRun && download('report.md', currentRun.artifacts.report.markdown));
$('dl-json').addEventListener('click', () => currentRun && download('run.json', JSON.stringify(currentRun, null, 2), 'application/json'));
$('dl-qf').addEventListener('click', () => currentRun && download('qualityforward.json', JSON.stringify(currentRun.artifacts.qfSync.payload, null, 2), 'application/json'));
$('dl-csv').addEventListener('click', () => {
  if (!currentRun) return;
  const rows = [['ID', '親', '機能', '技法', '優先度', 'タイトル', '事前条件', 'テストデータ', '期待結果']];
  for (const c of currentRun.artifacts.caseLow.cases) {
    rows.push([c.id, c.parentId, c.featureName, c.technique, c.priority, c.title, c.precondition, c.testData.value, c.expected]);
  }
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  download('testcases.csv', csv, 'text/csv');
});

/* ---------- 最小 Markdown / エスケープ ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function mdToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  for (const line of lines) {
    if (/^\|/.test(line)) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (/^\|[-\s|]+$/.test(line)) continue;
      if (!inTable) {
        html += '<table>';
        inTable = true;
      }
      html += '<tr>' + cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>';
      continue;
    }
    if (inTable) {
      html += '</table>';
      inTable = false;
    }
    if (/^# /.test(line)) html += `<h1>${escapeHtml(line.slice(2))}</h1>`;
    else if (/^## /.test(line)) html += `<h2>${escapeHtml(line.slice(3))}</h2>`;
    else if (/^- /.test(line)) html += `<p class="li">• ${escapeHtml(line.slice(2))}</p>`;
    else if (line.trim()) html += `<p>${escapeHtml(line)}</p>`;
  }
  if (inTable) html += '</table>';
  return html;
}

/* ---------- 初期化 ---------- */
applyConfigToUI();
initFlow();
$('spec').value = SAMPLE;
