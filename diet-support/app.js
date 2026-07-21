/* =====================================================================
 * Diet Support — 体重管理 PWA
 * recstyle 乗り換え / GitHub Pages / localStorage 永続化 / オフライン動作
 *
 * データモデル（immutable 更新）
 *   records: [{ date:'YYYY-MM-DD', weight:Number, fat:Number|null, memo:String }]
 *   profile: { height, goalWeight, targetDate, startWeight }
 * localStorage キー: diet-support:records:v1 / diet-support:profile:v1 / diet-support:meta:v1
 * ===================================================================== */
'use strict';

const APP_VERSION = '1.0.0';
const SCHEMA_VERSION = 1;
const KEY = {
  records: 'diet-support:records:v1',
  profile: 'diet-support:profile:v1',
  meta:    'diet-support:meta:v1',
};

/* ---------------- storage layer ---------------- */
const store = {
  load(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { console.error('load failed', key, e); return fallback; }
  },
  save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) {
      console.error('save failed', key, e);
      toast(e && e.name === 'QuotaExceededError' ? 'ストレージ上限です。古い記録を整理してください' : '保存に失敗しました');
      return false;
    }
  },
};

let records = store.load(KEY.records, []);
let profile = store.load(KEY.profile, { height: null, goalWeight: null, targetDate: null, startWeight: null });
runMigrations();

/* Migration hook — スキーマ更新時に順次追記する */
function runMigrations() {
  const meta = store.load(KEY.meta, { schemaVersion: 0 });
  if (meta.schemaVersion < 1) {
    // v0 -> v1: 正規化（数値化・日付順ソート・重複排除）
    records = normalize(records);
    store.save(KEY.records, records);
  }
  if (meta.schemaVersion !== SCHEMA_VERSION) {
    store.save(KEY.meta, { schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString() });
  }
}

/* ---------------- utils ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const round1 = (n) => Math.round(n * 10) / 10;
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const pad = (n) => String(n).padStart(2, '0');
const fmtWeight = (n) => (n == null ? '—' : n.toFixed(1));
const fmtSigned = (n) => (n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1));

function fmtDateShort(iso) {
  const [y, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}
function daysBetween(a, b) { // b - a in days (ISO strings)
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/* 正規化: 数値化 → 日付でソート → 同日重複は後勝ちで排除 */
function normalize(list) {
  const map = new Map();
  for (const r of (list || [])) {
    if (!r || !r.date) continue;
    const date = String(r.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const w = num(r.weight);
    if (w == null) continue;
    map.set(date, { date, weight: round1(w), fat: num(r.fat), memo: (r.memo || '').toString() });
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------------- derived metrics ---------------- */
function latest() { return records.length ? records[records.length - 1] : null; }
function startWeight() {
  if (num(profile.startWeight) != null) return num(profile.startWeight);
  return records.length ? records[0].weight : null;
}
function bmiOf(w) {
  const h = num(profile.height);
  if (w == null || h == null || h <= 0) return null;
  return w / ((h / 100) ** 2);
}
function bmiLabel(bmi) {
  if (bmi == null) return '';
  if (bmi < 18.5) return '低体重';
  if (bmi < 25) return '普通体重';
  if (bmi < 30) return '肥満(1度)';
  return '肥満(2度+)';
}
// n日前に最も近い記録を返す（当日より前で最も近いもの）
function recordNDaysAgo(n) {
  const l = latest(); if (!l) return null;
  const target = Date.parse(l.date) - n * 86400000;
  let best = null;
  for (const r of records) {
    if (r.date === l.date) continue;
    if (Date.parse(r.date) <= target + 43200000) best = r; // 半日の許容
  }
  return best;
}
function movingAvg(series, key, win) {
  return series.map((_, i) => {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - win + 1); j <= i; j++) {
      const v = series[j][key];
      if (v != null) { sum += v; cnt++; }
    }
    return cnt ? sum / cnt : null;
  });
}

/* ============================================================
 * RENDER: ホーム
 * ============================================================ */
function renderHome() {
  const body = $('#home-body');
  const l = latest();
  if (!l) {
    body.innerHTML = `
      <div class="card empty">
        <div class="e-ico">⚖️</div>
        <p>まだ記録がありません。<br>下の <b>＋</b> ボタンから今日の体重を記録しましょう。</p>
        <button class="btn-primary" style="max-width:220px;margin:12px auto 0" onclick="go('record')">記録をはじめる</button>
        <p class="hint">recstyle からデータを移す場合は「設定 → recstyle CSV を読み込む」から。</p>
      </div>`;
    return;
  }

  const prev = records.length >= 2 ? records[records.length - 2] : null;
  const dPrev = prev ? round1(l.weight - prev.weight) : null;
  const w7 = recordNDaysAgo(7);
  const d7 = w7 ? round1(l.weight - w7.weight) : null;
  const sw = startWeight();
  const dStart = sw != null ? round1(l.weight - sw) : null;

  const bmi = bmiOf(l.weight);
  const goal = num(profile.goalWeight);

  // 目標進捗
  let progressHtml = '';
  if (goal != null && sw != null && sw !== goal) {
    const total = sw - goal;               // 減らす量（正なら減量、負なら増量目標）
    const done = sw - l.weight;            // これまでの変化
    const pct = Math.max(0, Math.min(100, (done / total) * 100));
    const remain = round1(l.weight - goal);
    const targetInfo = profile.targetDate
      ? `目標日 ${fmtDateShort(profile.targetDate)}（あと${Math.max(0, daysBetween(todayStr(), profile.targetDate))}日）` : '';
    progressHtml = `
      <div class="card">
        <p class="card-title">目標まで</p>
        <div class="progress-num">${remain > 0 ? 'あと ' : (remain < 0 ? '超過 ' : '達成 ')}
          <span>${fmtWeight(Math.abs(remain))}</span><small> kg</small></div>
        <div class="progress-wrap">
          <div class="progress-meta"><span>開始 ${fmtWeight(sw)}</span><span>目標 ${fmtWeight(goal)}</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-meta" style="margin-top:6px"><span>${Math.round(pct)}% 達成</span><span>${targetInfo}</span></div>
        </div>
      </div>`;
  } else if (goal == null) {
    progressHtml = `
      <div class="card empty" style="padding:20px">
        <p style="margin:0">🎯 目標体重を設定すると進捗が表示されます</p>
        <button class="btn-ghost" style="margin-top:10px" onclick="go('settings')">目標を設定</button>
      </div>`;
  }

  const deltaTag = (v, invert) => {
    if (v == null) return '<span class="flat">—</span>';
    const cls = v === 0 ? 'flat' : (v > 0 ? 'up' : 'down');
    return `<span class="${cls}">${fmtSigned(v)}</span>`;
  };

  body.innerHTML = `
    <div class="card hero">
      <div class="big">${fmtWeight(l.weight)}<span class="unit">kg</span></div>
      <div class="date">${fmtDateFull(l.date)} の記録</div>
      <div class="delta-row">
        <div class="delta"><span class="lbl">前回比</span><span class="val">${deltaTag(dPrev)}</span></div>
        <div class="delta"><span class="lbl">7日前比</span><span class="val">${deltaTag(d7)}</span></div>
        <div class="delta"><span class="lbl">開始から</span><span class="val">${deltaTag(dStart)}</span></div>
      </div>
    </div>

    ${progressHtml}

    <div class="card">
      <p class="card-title">サマリー</p>
      <div class="stat-grid">
        <div class="stat"><div class="v">${bmi != null ? bmi.toFixed(1) : '—'}</div><div class="l">BMI ${bmiLabel(bmi)}</div></div>
        <div class="stat"><div class="v">${l.fat != null ? l.fat.toFixed(1) + '<small style="font-size:14px">%</small>' : '—'}</div><div class="l">体脂肪率</div></div>
        <div class="stat"><div class="v">${records.length}</div><div class="l">記録日数</div></div>
        <div class="stat"><div class="v">${streak()}</div><div class="l">連続記録</div></div>
      </div>
    </div>

    <div class="card">
      <p class="card-title">直近14日</p>
      <div id="home-spark"></div>
      <div style="text-align:center;margin-top:12px"><button class="btn-ghost" onclick="go('chart')">詳しいグラフを見る →</button></div>
    </div>
  `;
  drawChart($('#home-spark'), sliceByRange(14), { height: 140, showGoal: true, showAvg: false, compact: true });
}

function fmtDateFull(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
  return `${y}年${m}月${d}日 (${wd})`;
}
// 連続記録日数（最新から遡って、日付が連続している数）
function streak() {
  if (!records.length) return 0;
  let s = 1;
  for (let i = records.length - 1; i > 0; i--) {
    if (daysBetween(records[i - 1].date, records[i].date) === 1) s++;
    else break;
  }
  return s;
}

/* ============================================================
 * RENDER: 記録フォーム
 * ============================================================ */
function loadRecordForm(date) {
  date = date || todayStr();
  $('#in-date').value = date;
  const existing = records.find((r) => r.date === date);
  $('#in-weight').value = existing ? existing.weight : (latest() ? latest().weight : '');
  $('#in-fat').value = existing && existing.fat != null ? existing.fat : '';
  $('#in-memo').value = existing ? existing.memo : '';
  $('#btn-delete-rec').style.display = existing ? 'block' : 'none';
  $('#save-hint').textContent = existing ? 'この日には既存の記録があります（保存で上書き）' : '';
  updateBmiPreview();
}
function updateBmiPreview() {
  const bmi = bmiOf(num($('#in-weight').value));
  $('#in-bmi').value = bmi != null ? `${bmi.toFixed(1)}（${bmiLabel(bmi)}）` : '';
}
function saveRecord() {
  const date = $('#in-date').value;
  const weight = num($('#in-weight').value);
  if (!date) { toast('日付を入力してください'); return; }
  if (weight == null || weight <= 0 || weight > 500) { toast('体重を正しく入力してください'); return; }
  const fat = num($('#in-fat').value);
  const memo = $('#in-memo').value.trim();
  const rec = { date, weight: round1(weight), fat, memo };

  // immutable 更新: 同日を除いた新配列に追加して正規化
  records = normalize([...records.filter((r) => r.date !== date), rec]);
  store.save(KEY.records, records);
  toast('保存しました ✓');
  go('home');
}
function deleteRecord(date) {
  records = records.filter((r) => r.date !== date);
  store.save(KEY.records, records);
  toast('削除しました');
}

/* ============================================================
 * RENDER: 履歴
 * ============================================================ */
function renderHistory() {
  $('#hist-count').textContent = `${records.length}件`;
  const list = $('#hist-list');
  if (!records.length) {
    list.innerHTML = `<div class="empty"><div class="e-ico">📋</div><p>記録がありません</p></div>`;
    return;
  }
  const rows = [];
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    const prev = i > 0 ? records[i - 1] : null;
    const d = prev ? round1(r.weight - prev.weight) : null;
    const cls = d == null || d === 0 ? 'flat' : (d > 0 ? 'up' : 'down');
    rows.push(`
      <div class="rec">
        <div class="r-date">${fmtDateShort(r.date)}<br><span style="font-size:10px">${weekday(r.date)}</span></div>
        <div class="r-w">${fmtWeight(r.weight)}<small> kg</small></div>
        <div class="r-d ${cls}">${d == null ? '' : fmtSigned(d)}</div>
        <div class="r-memo">${r.fat != null ? '📊' + r.fat.toFixed(1) + '% ' : ''}${escapeHtml(r.memo)}</div>
        <button class="r-edit" onclick="editRecord('${r.date}')" aria-label="編集">✎</button>
      </div>`);
  }
  list.innerHTML = rows.join('');
}
function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
}
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
window.editRecord = (date) => { loadRecordForm(date); go('record'); };

/* ============================================================
 * CHART (依存なしの自作 SVG 折れ線)
 * ============================================================ */
let currentRange = 30;
function sliceByRange(days) {
  if (!days || days <= 0) return records.slice();
  if (!records.length) return [];
  const cutoff = Date.parse(latest().date) - (days - 1) * 86400000;
  return records.filter((r) => Date.parse(r.date) >= cutoff);
}

function renderChart() {
  const data = sliceByRange(currentRange);
  drawChart($('#chart-box'), data, { height: 260, showGoal: true, showAvg: true });
  const hasFat = data.some((r) => r.fat != null);
  $('#chart-fat-card').style.display = hasFat ? 'block' : 'none';
  if (hasFat) drawChart($('#chart-fat-box'), data, { height: 180, key: 'fat', color: 'var(--color-info)', showGoal: false, showAvg: false });
}

/* generic line chart renderer */
function drawChart(container, data, opt = {}) {
  const key = opt.key || 'weight';
  const color = opt.color || 'var(--color-primary)';
  const W = 640, H = opt.height || 240;
  const padL = opt.compact ? 30 : 40, padR = 12, padT = 14, padB = 24;

  const pts = data.filter((r) => r[key] != null);
  if (pts.length === 0) {
    container.innerHTML = `<div class="empty" style="padding:32px"><div class="e-ico">📈</div><p>この期間のデータがありません</p></div>`;
    return;
  }

  const vals = pts.map((r) => r[key]);
  const goal = (key === 'weight' && opt.showGoal) ? num(profile.goalWeight) : null;
  let min = Math.min(...vals, goal != null ? goal : Infinity);
  let max = Math.max(...vals, goal != null ? goal : -Infinity);
  const span = max - min || 1;
  min -= span * 0.12; max += span * 0.12;

  const t0 = Date.parse(pts[0].date);
  const t1 = Date.parse(pts[pts.length - 1].date) || t0 + 1;
  const spanT = (t1 - t0) || 1;
  const x = (iso) => padL + (pts.length === 1 ? (W - padL - padR) / 2 : ((Date.parse(iso) - t0) / spanT) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  // grid + y labels
  let grid = '';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = min + (max - min) * (i / steps);
    const yy = y(v);
    grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--color-divider)" stroke-width="1"/>`;
    grid += `<text x="${padL - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--color-text-secondary)">${v.toFixed(1)}</text>`;
  }

  // goal line
  let goalLine = '';
  if (goal != null && goal >= min && goal <= max) {
    const gy = y(goal);
    goalLine = `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="var(--color-goal)" stroke-width="1.5" stroke-dasharray="5 4"/>
      <text x="${W - padR}" y="${gy - 5}" text-anchor="end" font-size="11" fill="var(--color-goal)" font-weight="700">目標 ${goal.toFixed(1)}</text>`;
  }

  // moving average path
  let avgPath = '';
  if (opt.showAvg && pts.length >= 3) {
    const avg = movingAvg(pts, key, 7);
    const seg = pts.map((r, i) => (avg[i] == null ? null : `${x(r.date)},${y(avg[i])}`)).filter(Boolean);
    avgPath = `<polyline points="${seg.join(' ')}" fill="none" stroke="var(--color-info)" stroke-width="2" stroke-opacity="0.55" stroke-linejoin="round"/>`;
  }

  // area + main line
  const linePts = pts.map((r) => `${x(r.date)},${y(r[key])}`);
  const area = `M ${padL},${H - padB} L ${linePts.join(' L ')} L ${x(pts[pts.length - 1].date)},${H - padB} Z`;
  const dots = pts.map((r) => `<circle cx="${x(r.date)}" cy="${y(r[key])}" r="${pts.length > 40 ? 1.5 : 3}" fill="${color}"/>`).join('');

  // x labels (first, middle, last)
  const xl = [];
  const idxs = pts.length === 1 ? [0] : [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  for (const i of [...new Set(idxs)]) {
    xl.push(`<text x="${x(pts[i].date)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--color-text-secondary)">${fmtDateShort(pts[i].date)}</text>`);
  }

  // latest value label
  const last = pts[pts.length - 1];
  const lastLabel = `<circle cx="${x(last.date)}" cy="${y(last[key])}" r="5" fill="${color}" stroke="#fff" stroke-width="2"/>
    <text x="${x(last.date)}" y="${y(last[key]) - 10}" text-anchor="end" font-size="13" font-weight="700" fill="${color}">${last[key].toFixed(1)}</text>`;

  container.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="推移グラフ">
      <defs><linearGradient id="grad-${key}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.18"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}${goalLine}
      <path d="${area}" fill="url(#grad-${key})"/>
      <polyline points="${linePts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${avgPath}${dots}${lastLabel}${xl.join('')}
    </svg>`;
}

/* ============================================================
 * 設定 / データ移行
 * ============================================================ */
function renderSettings() {
  $('#p-height').value = profile.height ?? '';
  $('#p-goal').value = profile.goalWeight ?? '';
  $('#p-target').value = profile.targetDate ?? '';
  $('#p-start').value = profile.startWeight ?? '';
  $('#app-meta').textContent = `Diet Support v${APP_VERSION} ／ schema v${SCHEMA_VERSION} ／ 記録 ${records.length}件`;
}
function saveProfile() {
  profile = {
    height: num($('#p-height').value),
    goalWeight: num($('#p-goal').value),
    targetDate: $('#p-target').value || null,
    startWeight: num($('#p-start').value),
  };
  store.save(KEY.profile, profile);
  toast('プロフィールを保存しました ✓');
}

/* ---- JSON export / import ---- */
function exportJSON() {
  const payload = { app: 'diet-support', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), profile, records };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `diet-support-backup-${todayStr()}.json`);
  toast('エクスポートしました');
}
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const incoming = normalize(data.records || []);
      if (!incoming.length) { toast('有効な記録が見つかりません'); return; }
      // マージ（同日は取り込み側を優先）
      const merged = new Map(records.map((r) => [r.date, r]));
      incoming.forEach((r) => merged.set(r.date, r));
      records = normalize(Array.from(merged.values()));
      store.save(KEY.records, records);
      if (data.profile) { profile = { ...profile, ...data.profile }; store.save(KEY.profile, profile); }
      toast(`${incoming.length}件を取り込みました ✓`);
      refresh();
    } catch (e) { console.error(e); toast('JSON の読み込みに失敗しました'); }
  };
  reader.readAsText(file);
}

/* ---- recstyle CSV import ----
 * recstyle 等のエクスポート CSV を柔軟にパースする。
 * ヘッダ名から 日付/体重/体脂肪率/メモ 列を自動判別。ヘッダ無しにも対応。
 */
function importRecstyleCSV(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseRecstyle(reader.result);
      if (!parsed.length) { toast('CSV から記録を読み取れませんでした'); return; }
      const merged = new Map(records.map((r) => [r.date, r]));
      parsed.forEach((r) => merged.set(r.date, r));
      records = normalize(Array.from(merged.values()));
      store.save(KEY.records, records);
      toast(`recstyle から ${parsed.length}件を取り込みました ✓`);
      refresh();
      go('home');
    } catch (e) { console.error(e); toast('CSV の読み込みに失敗しました'); }
  };
  reader.readAsText(file, 'UTF-8');
}

function parseRecstyle(text) {
  // BOM 除去・改行正規化
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const rows = lines.map(splitCsvLine);

  // ヘッダ判別
  const header = rows[0].map((c) => c.trim().toLowerCase());
  const findCol = (aliases) => header.findIndex((h) => aliases.some((a) => h.includes(a)));
  let iDate = findCol(['日付', '年月日', 'date', '記録日']);
  let iWeight = findCol(['体重', 'weight', 'kg']);
  let iFat = findCol(['体脂肪', 'fat', '%']);
  let iMemo = findCol(['メモ', 'memo', 'note', 'コメント']);

  let dataRows;
  if (iDate >= 0 && iWeight >= 0) {
    dataRows = rows.slice(1); // ヘッダあり
  } else {
    // ヘッダ無し: 先頭列=日付, 2列目=体重 と推定
    iDate = 0; iWeight = 1; iFat = 2; iMemo = 3;
    dataRows = rows;
  }

  const out = [];
  for (const cols of dataRows) {
    const date = parseDate(cols[iDate]);
    const weight = num((cols[iWeight] || '').replace(/[^\d.\-]/g, ''));
    if (!date || weight == null) continue;
    const fat = iFat >= 0 ? num((cols[iFat] || '').replace(/[^\d.\-]/g, '')) : null;
    const memo = iMemo >= 0 ? (cols[iMemo] || '').trim() : '';
    out.push({ date, weight, fat, memo });
  }
  return normalize(out);
}

// "2026/07/21" "2026-07-21" "2026.07.21" "20260721" などを YYYY-MM-DD に
function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  return null;
}
// カンマ区切り1行を分割（ダブルクォート対応）
function splitCsvLine(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',' || c === '\t') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function clearAll() {
  if (!confirm('すべての記録・プロフィールを削除します。よろしいですか？\n（この操作は取り消せません。先にエクスポートを推奨）')) return;
  records = []; profile = { height: null, goalWeight: null, targetDate: null, startWeight: null };
  store.save(KEY.records, records); store.save(KEY.profile, profile);
  toast('削除しました'); refresh(); go('home');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
 * ナビゲーション / 共通
 * ============================================================ */
const VIEWS = ['home', 'chart', 'record', 'history', 'settings'];
function go(view) {
  if (!VIEWS.includes(view)) view = 'home';
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  $$('nav.bottom button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  window.scrollTo(0, 0);
  if (view === 'home') renderHome();
  if (view === 'chart') renderChart();
  if (view === 'record') loadRecordForm($('#in-date').value || todayStr());
  if (view === 'history') renderHistory();
  if (view === 'settings') renderSettings();
  location.hash = view;
}
window.go = go;

function refresh() {
  const active = (location.hash || '#home').slice(1);
  renderHome();
  if (active === 'chart') renderChart();
  if (active === 'history') renderHistory();
  if (active === 'settings') renderSettings();
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------------- event wiring ---------------- */
function bind() {
  $$('nav.bottom button').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
  $('#fab').addEventListener('click', () => { loadRecordForm(todayStr()); go('record'); });

  $('#btn-save').addEventListener('click', saveRecord);
  $('#btn-delete-rec').addEventListener('click', () => {
    const d = $('#in-date').value;
    if (confirm(`${d} の記録を削除しますか？`)) { deleteRecord(d); go('history'); }
  });
  $('#in-weight').addEventListener('input', updateBmiPreview);
  $('#in-date').addEventListener('change', () => loadRecordForm($('#in-date').value));
  $('#w-minus').addEventListener('click', () => stepWeight(-0.1));
  $('#w-plus').addEventListener('click', () => stepWeight(0.1));

  $('#range-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    currentRange = Number(b.dataset.range);
    $$('#range-tabs button').forEach((x) => x.classList.toggle('active', x === b));
    renderChart();
  });

  $('#btn-save-profile').addEventListener('click', saveProfile);
  $('#btn-export').addEventListener('click', exportJSON);
  $('#btn-import-json').addEventListener('click', () => $('#file-json').click());
  $('#file-json').addEventListener('change', (e) => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; });
  $('#btn-import-recstyle').addEventListener('click', () => $('#file-recstyle').click());
  $('#file-recstyle').addEventListener('change', (e) => { if (e.target.files[0]) importRecstyleCSV(e.target.files[0]); e.target.value = ''; });
  $('#btn-clear').addEventListener('click', clearAll);

  window.addEventListener('hashchange', () => {
    const v = (location.hash || '#home').slice(1);
    if (VIEWS.includes(v) && !$(`#view-${v}`).classList.contains('active')) go(v);
  });
}
function stepWeight(delta) {
  const cur = num($('#in-weight').value) ?? (latest() ? latest().weight : 60);
  $('#in-weight').value = round1(cur + delta).toFixed(1);
  updateBmiPreview();
}

/* ---------------- boot ---------------- */
function init() {
  bind();
  const start = (location.hash || '#home').slice(1);
  go(VIEWS.includes(start) ? start : 'home');
  // Service Worker 登録（GitHub Pages のサブパスでも動くよう相対パス）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW register failed', e));
    });
  }
}
init();
