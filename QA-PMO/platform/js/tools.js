/* tools.js — 7つの実working MVPツール（AIなし＝決定的アルゴリズム/確立OSS）
 * 各ツールは { title, render(container) } を持つ。
 */

/* ── 共通ヘルパー ── */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function sevBadge(sev) {
  return `<span class="sev sev-${sev}">${sev}</span>`;
}
function sevSummary(counts) {
  return `<div class="sev-summary">
    <span class="sev sev-Critical">Critical ${counts.Critical || 0}</span>
    <span class="sev sev-Major">Major ${counts.Major || 0}</span>
    <span class="sev sev-Minor">Minor ${counts.Minor || 0}</span>
    <span class="sev sev-Cosmetic">Cosmetic ${counts.Cosmetic || 0}</span>
  </div>`;
}

const Tools = {};

/* ═══════════════════════════════════════════════════════
 * 1. ドキュメント検証（textlint/RedPen系ルールベース校正）
 * ═══════════════════════════════════════════════════════ */
Tools.docVerifier = {
  title: 'ドキュメント検証',
  // 曖昧語辞書（severityは影響度で分類）
  AMBIGUOUS: [
    { re: /(TBD|未定|要検討|追って|別途|可及的)/g, sev: 'Major', msg: '未確定・先送り表現' },
    { re: /(適宜|随時|なるべく|可能な限り|極力|柔軟に|臨機応変|必要に応じて)/g, sev: 'Minor', msg: 'あいまいな程度表現' },
    { re: /(など|等|その他)/g, sev: 'Minor', msg: '列挙の不完全（範囲が曖昧）' },
    { re: /(基本的に|原則|一般的に)/g, sev: 'Minor', msg: '例外が不明確な表現' },
    { re: /(と思われる|はずである|だろう|可能性がある)/g, sev: 'Minor', msg: '推量・非断定表現' },
  ],
  REQUIRED_HEADINGS: ['目的', '範囲', '前提', '受入基準'],

  render(c) {
    c.innerHTML = `
      <p class="tool-desc">要件定義書・設計書などを貼り付けて検証します。曖昧語・冗長文・必須節欠落を行番号付きで指摘します（ルールベース／AIなし）。</p>
      <textarea id="dv-input" class="tool-ta" placeholder="ここにドキュメント本文を貼り付け…">1. 目的&#10;本システムは業務効率を可能な限り向上させることを目的とする。&#10;2. 機能&#10;ユーザーは適宜データを登録できる等、必要に応じて操作する。詳細はTBD。</textarea>
      <div class="tool-actions">
        <button class="btn-primary" id="dv-run">検証する</button>
        <button class="btn-ghost" id="dv-clear">クリア</button>
      </div>
      <div id="dv-result"></div>`;
    c.querySelector('#dv-run').onclick = () => this.run(c);
    c.querySelector('#dv-clear').onclick = () => {
      c.querySelector('#dv-input').value = '';
      c.querySelector('#dv-result').innerHTML = '';
    };
  },

  run(c) {
    const text = c.querySelector('#dv-input').value;
    const lines = text.split('\n');
    const findings = [];

    lines.forEach((line, i) => {
      const ln = i + 1;
      // 曖昧語
      this.AMBIGUOUS.forEach(rule => {
        let m;
        const re = new RegExp(rule.re.source, 'g');
        while ((m = re.exec(line)) !== null) {
          findings.push({ sev: rule.sev, line: ln, term: m[1], msg: rule.msg, text: line.trim() });
        }
      });
      // 冗長文（一文100字超）
      line.split(/。/).forEach(s => {
        if (s.length > 100) {
          findings.push({ sev: 'Minor', line: ln, term: `${s.length}字`, msg: '一文が長く可読性が低い（100字超）', text: s.trim().slice(0, 40) + '…' });
        }
      });
    });

    // 必須見出しの欠落
    const missing = this.REQUIRED_HEADINGS.filter(h => !text.includes(h));
    missing.forEach(h => findings.push({ sev: 'Major', line: '-', term: h, msg: '必須セクションが見当たらない', text: '' }));

    const counts = {};
    findings.forEach(f => counts[f.sev] = (counts[f.sev] || 0) + 1);
    const score = Math.max(0, 100 - (counts.Major || 0) * 10 - (counts.Minor || 0) * 3 - (counts.Critical || 0) * 25);

    const rows = findings.length ? findings.map(f => `
      <tr>
        <td>${sevBadge(f.sev)}</td>
        <td>${f.line}</td>
        <td><code>${esc(f.term)}</code></td>
        <td>${esc(f.msg)}</td>
        <td class="muted">${esc(f.text)}</td>
      </tr>`).join('') : `<tr><td colspan="5" class="muted">指摘はありません。</td></tr>`;

    c.querySelector('#dv-result').innerHTML = `
      <div class="result-head">
        <div class="score-chip">品質スコア <strong>${score}</strong>/100</div>
        ${sevSummary(counts)}
      </div>
      <table class="tool-table">
        <thead><tr><th>Severity</th><th>行</th><th>該当</th><th>指摘</th><th>本文</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  },
};

/* ═══════════════════════════════════════════════════════
 * 2. トレーサビリティ（RTM：要件↔テストのカバレッジ算出）
 * ═══════════════════════════════════════════════════════ */
Tools.traceability = {
  title: 'トレーサビリティ',
  render(c) {
    c.innerHTML = `
      <p class="tool-desc">要件とテストケースを入力すると、トレーサビリティマトリクス（RTM）とカバレッジ・未カバー要件・孤立テストを算出します（ID解析／AIなし）。</p>
      <div class="two-col">
        <div>
          <label class="lbl">要件（1行に <code>REQ-001, 要件名</code>）</label>
          <textarea id="tr-req" class="tool-ta sm">REQ-001, ログイン機能&#10;REQ-002, パスワード再設定&#10;REQ-003, 利用履歴の表示</textarea>
        </div>
        <div>
          <label class="lbl">テスト（1行に <code>TC-001, REQ-001;REQ-002, テスト名</code>）</label>
          <textarea id="tr-tc" class="tool-ta sm">TC-001, REQ-001, 正常ログイン&#10;TC-002, REQ-001, ロックアウト&#10;TC-003, REQ-009, 期限切れリンク</textarea>
        </div>
      </div>
      <div class="tool-actions"><button class="btn-primary" id="tr-run">マトリクス生成</button></div>
      <div id="tr-result"></div>`;
    c.querySelector('#tr-run').onclick = () => this.run(c);
  },

  run(c) {
    const reqs = {};
    c.querySelector('#tr-req').value.split('\n').forEach(l => {
      const p = l.split(',');
      if (p[0] && p[0].trim()) reqs[p[0].trim()] = (p[1] || '').trim();
    });
    const tests = [];
    c.querySelector('#tr-tc').value.split('\n').forEach(l => {
      const p = l.split(',');
      if (!p[0] || !p[0].trim()) return;
      const links = (p[1] || '').split(';').map(s => s.trim()).filter(Boolean);
      tests.push({ id: p[0].trim(), links, name: (p[2] || '').trim() });
    });

    const reqIds = Object.keys(reqs);
    // 各要件にひもづくテスト
    const covMap = {};
    reqIds.forEach(r => covMap[r] = []);
    const orphanTests = [];
    tests.forEach(t => {
      let matched = false;
      t.links.forEach(r => {
        if (covMap[r]) { covMap[r].push(t.id); matched = true; }
      });
      if (!matched) orphanTests.push(t);
    });
    const uncovered = reqIds.filter(r => covMap[r].length === 0);
    const coverage = reqIds.length ? Math.round((reqIds.length - uncovered.length) / reqIds.length * 100) : 0;

    const matrixRows = reqIds.map(r => `
      <tr>
        <td><code>${esc(r)}</code></td>
        <td>${esc(reqs[r])}</td>
        <td>${covMap[r].length
          ? covMap[r].map(t => `<code>${esc(t)}</code>`).join(' ')
          : '<span class="sev sev-Major">未カバー</span>'}</td>
      </tr>`).join('');

    const gaps = [];
    uncovered.forEach(r => gaps.push({ sev: 'Major', msg: `要件 ${r}（${reqs[r]}）にテストが存在しない` }));
    orphanTests.forEach(t => gaps.push({ sev: 'Minor', msg: `テスト ${t.id} が未登録要件（${t.links.join(',') || 'なし'}）を参照` }));
    const gapRows = gaps.length ? gaps.map(g => `<tr><td>${sevBadge(g.sev)}</td><td>${esc(g.msg)}</td></tr>`).join('')
      : `<tr><td colspan="2" class="muted">ギャップはありません。</td></tr>`;

    c.querySelector('#tr-result').innerHTML = `
      <div class="result-head">
        <div class="score-chip">要件カバレッジ <strong>${coverage}</strong>%</div>
        <div class="muted">要件 ${reqIds.length} / テスト ${tests.length} / 未カバー ${uncovered.length} / 孤立テスト ${orphanTests.length}</div>
      </div>
      <h4>トレーサビリティマトリクス</h4>
      <table class="tool-table">
        <thead><tr><th>要件ID</th><th>要件名</th><th>ひもづくテスト</th></tr></thead>
        <tbody>${matrixRows}</tbody>
      </table>
      <h4>ギャップ一覧</h4>
      <table class="tool-table">
        <thead><tr><th>Severity</th><th>内容</th></tr></thead>
        <tbody>${gapRows}</tbody>
      </table>`;
  },
};

/* ═══════════════════════════════════════════════════════
 * 3. 計画策定（ISO 29119-3テンプレート生成）
 * ═══════════════════════════════════════════════════════ */
Tools.testPlan = {
  title: '計画策定',
  render(c) {
    c.innerHTML = `
      <p class="tool-desc">フォームに入力すると、ISO/IEC 29119-3準拠のテスト計画書（Markdown）を生成します。</p>
      <div class="form-grid">
        <label class="lbl">プロジェクト名<input id="tp-name" class="inp" value="新規ECサイト構築"></label>
        <label class="lbl">テスト対象・範囲<input id="tp-scope" class="inp" value="購入フロー（カート〜決済）"></label>
        <label class="lbl">テスト環境<input id="tp-env" class="inp" value="ステージング環境 / Chrome・Safari"></label>
        <label class="lbl">開始予定<input id="tp-start" class="inp" type="date"></label>
        <label class="lbl">終了予定<input id="tp-end" class="inp" type="date"></label>
        <label class="lbl">開始基準（entry）<input id="tp-entry" class="inp" value="対象機能の結合完了"></label>
        <label class="lbl">終了基準（exit）<input id="tp-exit" class="inp" value="Critical/Major欠陥0件、テスト消化率100%"></label>
        <label class="lbl">主要リスク<input id="tp-risk" class="inp" value="決済外部連携の遅延"></label>
      </div>
      <div class="tool-actions">
        <button class="btn-primary" id="tp-run">計画書を生成</button>
        <button class="btn-ghost" id="tp-dl" disabled>Markdownをダウンロード</button>
      </div>
      <div id="tp-result"></div>`;
    let md = '';
    c.querySelector('#tp-run').onclick = () => {
      md = this.build(c);
      c.querySelector('#tp-result').innerHTML = `<pre class="codeblock">${esc(md)}</pre>`;
      c.querySelector('#tp-dl').disabled = false;
    };
    c.querySelector('#tp-dl').onclick = () => download('test_plan.md', md, 'text/markdown');
  },

  build(c) {
    const v = id => c.querySelector(id).value || '（未入力）';
    const now = new Date().toISOString().slice(0, 10);
    return `# テスト計画書（ISO/IEC 29119-3準拠）

## 1. テスト計画識別子
TP-${now}-${v('#tp-name')}

## 2. 概要
本書は「${v('#tp-name')}」のテスト計画を定義する。

## 3. テスト対象・範囲
${v('#tp-scope')}

## 4. テスト環境
${v('#tp-env')}

## 5. テストアプローチ
- レベル: 結合テスト / システムテスト
- 技法: 境界値分析・同値分割・ペアワイズ（ISTQB）
- 自動化: UI(Playwright) / API(pytest) を併用

## 6. 合否基準
- 開始基準（Entry）: ${v('#tp-entry')}
- 終了基準（Exit）: ${v('#tp-exit')}

## 7. スケジュール
- 開始予定: ${v('#tp-start')}
- 終了予定: ${v('#tp-end')}

## 8. リスクと対策
- ${v('#tp-risk')}（早期に連携テストを前倒しで実施）

## 9. 成果物
- テストケース、テスト結果、欠陥一覧（ISTQB severity付き）、テストサマリーレポート

## 10. 承認
| 役割 | 氏名 | 日付 |
|---|---|---|
| テストマネージャー | | |
| PMO | | |
`;
  },
};

/* ═══════════════════════════════════════════════════════
 * 4. テスト設計（境界値・同値分割・ペアワイズ）
 * ═══════════════════════════════════════════════════════ */
Tools.testDesign = {
  title: 'テスト設計',
  render(c) {
    c.innerHTML = `
      <p class="tool-desc">ISTQBのテスト技法でテストケースを自動生成します（決定的アルゴリズム／AIなし）。</p>
      <div class="subtabs">
        <button class="subtab active" data-t="bva">境界値分析</button>
        <button class="subtab" data-t="ep">同値分割</button>
        <button class="subtab" data-t="pw">ペアワイズ</button>
      </div>
      <div id="td-panel"></div>`;
    const panel = c.querySelector('#td-panel');
    const tabs = c.querySelectorAll('.subtab');
    tabs.forEach(t => t.onclick = () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      this['render_' + t.dataset.t](panel);
    });
    this.render_bva(panel);
  },

  render_bva(p) {
    p.innerHTML = `
      <div class="form-row">
        <label class="lbl">項目名<input id="bva-n" class="inp" value="年齢"></label>
        <label class="lbl">最小<input id="bva-min" class="inp" type="number" value="18"></label>
        <label class="lbl">最大<input id="bva-max" class="inp" type="number" value="65"></label>
        <button class="btn-primary" id="bva-run">生成</button>
      </div><div id="bva-out"></div>`;
    p.querySelector('#bva-run').onclick = () => {
      const n = p.querySelector('#bva-n').value;
      const mn = Number(p.querySelector('#bva-min').value);
      const mx = Number(p.querySelector('#bva-max').value);
      const cases = [
        [mn - 1, '無効（下限未満）'], [mn, '有効（下限）'], [mn + 1, '有効（下限+1）'],
        [mx - 1, '有効（上限-1）'], [mx, '有効（上限）'], [mx + 1, '無効（上限超）'],
      ];
      const rows = cases.map((cs, i) => `<tr><td>BVA-${i + 1}</td><td>${esc(n)} = ${cs[0]}</td><td>${cs[1]}</td></tr>`).join('');
      p.querySelector('#bva-out').innerHTML = this.table(['ID', '入力', '期待区分'], rows);
    };
    p.querySelector('#bva-run').click();
  },

  render_ep(p) {
    p.innerHTML = `
      <div class="form-row">
        <label class="lbl">項目名<input id="ep-n" class="inp" value="数量"></label>
        <label class="lbl">最小<input id="ep-min" class="inp" type="number" value="1"></label>
        <label class="lbl">最大<input id="ep-max" class="inp" type="number" value="99"></label>
        <button class="btn-primary" id="ep-run">生成</button>
      </div><div id="ep-out"></div>`;
    p.querySelector('#ep-run').onclick = () => {
      const n = p.querySelector('#ep-n').value;
      const mn = Number(p.querySelector('#ep-min').value);
      const mx = Number(p.querySelector('#ep-max').value);
      const nominal = Math.floor((mn + mx) / 2);
      const cases = [
        [`${mn}〜${mx}（代表値 ${nominal}）`, '有効同値クラス'],
        [`${mn - 1}`, '無効同値クラス（小さすぎ）'],
        [`${mx + 1}`, '無効同値クラス（大きすぎ）'],
      ];
      const rows = cases.map((cs, i) => `<tr><td>EP-${i + 1}</td><td>${esc(n)} = ${esc(cs[0])}</td><td>${cs[1]}</td></tr>`).join('');
      p.querySelector('#ep-out').innerHTML = this.table(['ID', '入力', 'クラス'], rows);
    };
    p.querySelector('#ep-run').click();
  },

  render_pw(p) {
    p.innerHTML = `
      <p class="muted">各パラメータの値をカンマ区切りで入力（行ごとに1パラメータ）。全ペアを網羅する最小ケースを貪欲法で生成します。</p>
      <textarea id="pw-in" class="tool-ta sm">OS, Windows, macOS, Linux&#10;ブラウザ, Chrome, Firefox, Safari&#10;権限, 管理者, 一般</textarea>
      <div class="tool-actions">
        <button class="btn-primary" id="pw-run">ペアワイズ生成</button>
        <button class="btn-ghost" id="pw-dl" disabled>CSVダウンロード</button>
      </div>
      <div id="pw-out"></div>`;
    let csv = '';
    p.querySelector('#pw-run').onclick = () => {
      const params = [];
      p.querySelector('#pw-in').value.split('\n').forEach(l => {
        const parts = l.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) params.push({ name: parts[0], values: parts.slice(1) });
      });
      if (params.length < 2) { p.querySelector('#pw-out').innerHTML = '<p class="muted">2つ以上のパラメータが必要です。</p>'; return; }
      const cases = this.allPairs(params);
      const head = params.map(x => x.name);
      const rows = cases.map((cs, i) => `<tr><td>PW-${i + 1}</td>${cs.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
      p.querySelector('#pw-out').innerHTML = `<p class="muted">${cases.length}ケースで全ペアを網羅（総組合せは ${params.reduce((a, x) => a * x.values.length, 1)} 通り）</p>`
        + this.table(['ID', ...head], rows);
      csv = ['ID,' + head.join(',')].concat(cases.map((cs, i) => `PW-${i + 1},` + cs.join(','))).join('\n');
      p.querySelector('#pw-dl').disabled = false;
    };
    p.querySelector('#pw-dl').onclick = () => download('pairwise.csv', csv, 'text/csv');
    p.querySelector('#pw-run').click();
  },

  // 貪欲法による全ペア（all-pairs）生成
  allPairs(params) {
    const n = params.length;
    const key = (i, j, a, b) => `${i}|${j}|${a}|${b}`;
    const covered = new Set();
    const allKeys = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        for (const a of params[i].values)
          for (const b of params[j].values) allKeys.push({ i, j, a, b, k: key(i, j, a, b) });

    const cases = [];
    let guard = 0;
    while (allKeys.some(p => !covered.has(p.k)) && guard++ < 2000) {
      const test = new Array(n).fill(null);
      const seed = allKeys.find(p => !covered.has(p.k));
      test[seed.i] = seed.a; test[seed.j] = seed.b;
      for (let k = 0; k < n; k++) {
        if (test[k] !== null) continue;
        let best = params[k].values[0], bestScore = -1;
        for (const val of params[k].values) {
          let score = 0;
          for (let m = 0; m < n; m++) {
            if (m === k || test[m] === null) continue;
            const i2 = Math.min(k, m), j2 = Math.max(k, m);
            const a2 = i2 === k ? val : test[m], b2 = j2 === k ? val : test[m];
            if (!covered.has(key(i2, j2, a2, b2))) score++;
          }
          if (score > bestScore) { bestScore = score; best = val; }
        }
        test[k] = best;
      }
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) covered.add(key(i, j, test[i], test[j]));
      cases.push(test);
    }
    return cases;
  },

  table(head, rows) {
    return `<table class="tool-table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  },
};

/* ═══════════════════════════════════════════════════════
 * 5. UI/UX検証（axe-core ＋ 決定的ヒューリスティック）
 * ═══════════════════════════════════════════════════════ */
Tools.uiuxChecker = {
  title: 'UI/UX検証',
  render(c) {
    c.innerHTML = `
      <p class="tool-desc">HTMLを貼り付けて検証します。決定的なアクセシビリティ検査（alt/lang/ラベル/ボタン名）に加え、axe-coreが読み込めれば WCAG 検査も実行します（AIなし）。</p>
      <textarea id="ux-in" class="tool-ta" placeholder="検証するHTMLを貼り付け…">&lt;html&gt;&#10;  &lt;body&gt;&#10;    &lt;img src="logo.png"&gt;&#10;    &lt;button&gt;&lt;/button&gt;&#10;    &lt;input type="text"&gt;&#10;  &lt;/body&gt;&#10;&lt;/html&gt;</textarea>
      <div class="tool-actions"><button class="btn-primary" id="ux-run">検証する</button></div>
      <div id="ux-out"></div>`;
    c.querySelector('#ux-run').onclick = () => this.run(c);
  },

  run(c) {
    const html = c.querySelector('#ux-in').value;
    const findings = this.heuristics(html);
    const render = (axeNote, axeRows) => {
      const counts = {};
      findings.forEach(f => counts[f.sev] = (counts[f.sev] || 0) + 1);
      const rows = findings.length ? findings.map(f => `
        <tr><td>${sevBadge(f.sev)}</td><td>${esc(f.wcag)}</td><td>${esc(f.msg)}</td><td class="muted">${esc(f.iso)}</td></tr>`).join('')
        : `<tr><td colspan="4" class="muted">ヒューリスティック検査で問題は見つかりませんでした。</td></tr>`;
      c.querySelector('#ux-out').innerHTML = `
        <div class="result-head">${sevSummary(counts)}</div>
        <h4>決定的ヒューリスティック検査</h4>
        <table class="tool-table"><thead><tr><th>Severity</th><th>WCAG</th><th>指摘</th><th>ISO 25010</th></tr></thead><tbody>${rows}</tbody></table>
        <h4>axe-core（WCAGエンジン）</h4>${axeNote}${axeRows || ''}`;
    };
    this.runAxe(html, render);
  },

  // DOMParserによる決定的検査（ネットワーク不要）
  heuristics(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const f = [];
    const root = doc.documentElement;
    // lang
    if (!root || !root.getAttribute('lang'))
      f.push({ sev: 'Major', wcag: '3.1.1', msg: '<html>にlang属性がない', iso: 'UI快美性/アクセシビリティ' });
    // img alt
    const noAlt = [...doc.querySelectorAll('img')].filter(i => !i.hasAttribute('alt'));
    if (noAlt.length) f.push({ sev: 'Major', wcag: '1.1.1', msg: `代替テキスト(alt)がない画像 ${noAlt.length}件`, iso: '適切度認識性' });
    // ボタン/リンクの名前
    const emptyCtl = [...doc.querySelectorAll('button, a')].filter(b =>
      !b.textContent.trim() && !b.getAttribute('aria-label') && !b.querySelector('img[alt]'));
    if (emptyCtl.length) f.push({ sev: 'Major', wcag: '4.1.2', msg: `アクセシブルな名前がないボタン/リンク ${emptyCtl.length}件`, iso: '運用操作性' });
    // input ラベル
    const noLabel = [...doc.querySelectorAll('input, select, textarea')].filter(el => {
      const t = (el.getAttribute('type') || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset'].includes(t)) return false;
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
      if (el.closest('label')) return false;
      const id = el.getAttribute('id');
      if (id && doc.querySelector(`label[for="${id}"]`)) return false;
      return true;
    });
    if (noLabel.length) f.push({ sev: 'Major', wcag: '1.3.1 / 3.3.2', msg: `ラベルがない入力要素 ${noLabel.length}件`, iso: 'ユーザーエラー防止性' });
    // title
    if (!doc.querySelector('title')) f.push({ sev: 'Minor', wcag: '2.4.2', msg: '<title>がない', iso: '習得性' });
    // viewport
    if (!doc.querySelector('meta[name="viewport"]')) f.push({ sev: 'Minor', wcag: '1.4.10', msg: 'viewport metaがない（レスポンシブ未対応の恐れ）', iso: '運用操作性' });
    return f;
  },

  // axe-coreが利用可能なら同一オリジンのiframeで実行
  runAxe(html, cb) {
    if (typeof window.axe === 'undefined') {
      cb('<p class="muted">axe-coreが読み込めていないため、WCAGエンジン検査はスキップしました（オフライン時はヒューリスティックのみ）。</p>', '');
      return;
    }
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:1024px;height:768px;left:-9999px;top:0;';
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      const finish = (note, rows) => { cb(note, rows); setTimeout(() => iframe.remove(), 100); };
      try {
        window.axe.run(iframe.contentDocument).then(res => {
          if (!res.violations.length) { finish('<p class="muted">axe-core: 違反は検出されませんでした。</p>', ''); return; }
          const rows = res.violations.map(v =>
            `<tr><td>${esc(v.impact || '')}</td><td><code>${esc(v.id)}</code></td><td>${esc(v.description)}</td><td>${v.nodes.length}</td></tr>`).join('');
          finish('', `<table class="tool-table"><thead><tr><th>impact</th><th>rule</th><th>概要</th><th>件数</th></tr></thead><tbody>${rows}</tbody></table>`);
        }).catch(() => finish('<p class="muted">axe-core実行に失敗しました（ヒューリスティック結果を参照）。</p>', ''));
      } catch (e) {
        finish('<p class="muted">axe-core実行に失敗しました（ヒューリスティック結果を参照）。</p>', '');
      }
    };
  },
};

/* ═══════════════════════════════════════════════════════
 * 6. テスト自動化（Playwright / pytest / bats scaffold生成）
 * ═══════════════════════════════════════════════════════ */
Tools.testAuto = {
  title: 'テスト自動化',
  render(c) {
    c.innerHTML = `
      <p class="tool-desc">種別を選んでパラメータを入力すると、確立フレームワークのテストscaffoldを生成します（テンプレート／AIなし）。</p>
      <div class="form-row">
        <label class="lbl">種別
          <select id="ta-type" class="inp">
            <option value="ui">UI（Playwright）</option>
            <option value="api">API（pytest + requests）</option>
            <option value="bat">BAT（bats-core）</option>
          </select>
        </label>
        <label class="lbl" id="ta-l1">対象URL<input id="ta-p1" class="inp" value="https://example.com/login"></label>
        <label class="lbl" id="ta-l2">操作/期待<input id="ta-p2" class="inp" value="ログインボタン押下で /home へ遷移"></label>
        <button class="btn-primary" id="ta-run">生成</button>
      </div>
      <div class="tool-actions"><button class="btn-ghost" id="ta-dl" disabled>ファイルをダウンロード</button></div>
      <div id="ta-out"></div>`;
    let code = '', fname = '';
    const sync = () => {
      const t = c.querySelector('#ta-type').value;
      const L = { ui: ['対象URL', '操作/期待'], api: ['エンドポイント', '期待ステータス'], bat: ['コマンド', '期待出力に含む文字列'] }[t];
      c.querySelector('#ta-l1').childNodes[0].nodeValue = L[0];
      c.querySelector('#ta-l2').childNodes[0].nodeValue = L[1];
    };
    c.querySelector('#ta-type').onchange = sync; sync();
    c.querySelector('#ta-run').onclick = () => {
      const t = c.querySelector('#ta-type').value;
      const p1 = c.querySelector('#ta-p1').value, p2 = c.querySelector('#ta-p2').value;
      [code, fname] = this.gen(t, p1, p2);
      c.querySelector('#ta-out').innerHTML = `<pre class="codeblock">${esc(code)}</pre>`;
      c.querySelector('#ta-dl').disabled = false;
    };
    c.querySelector('#ta-dl').onclick = () => download(fname, code);
  },

  gen(type, p1, p2) {
    if (type === 'ui') return [`// Playwright UIテスト（Page Objectパターン）
import { test, expect } from '@playwright/test';

class LoginPage {
  constructor(page) { this.page = page; }
  async goto() { await this.page.goto('${p1}'); }
  async submit() { await this.page.getByRole('button', { name: /ログイン|login/i }).click(); }
}

test('${p2}', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.submit();
  // 期待: ${p2}
  await expect(page).toHaveURL(/home/);
});
`, 'login.spec.ts'];

    if (type === 'api') return [`# API テスト（pytest + requests）
import requests

BASE = "${p1}"

def test_endpoint_returns_expected_status():
    """期待: ${p2}"""
    resp = requests.get(BASE, timeout=10)
    assert resp.status_code == ${/\d+/.test(p2) ? p2.match(/\d+/)[0] : 200}
    # スキーマ検証はSchemathesis等のOSS活用を推奨:
    #   schemathesis run ${p1}/openapi.json
`, 'test_api.py'];

    return [`#!/usr/bin/env bats
# BAT テスト（bats-core）

@test "${p2}" {
  run ${p1}
  [ "$status" -eq 0 ]
  [[ "$output" == *"${p2}"* ]]
}
`, 'test.bats'];
  },
};

/* ═══════════════════════════════════════════════════════
 * 7. CI/CD構築（GitHub Actions YAMLジェネレータ）
 * ═══════════════════════════════════════════════════════ */
Tools.cicd = {
  title: 'CI/CD構築',
  render(c) {
    c.innerHTML = `
      <p class="tool-desc">ランタイムとオプションを選ぶと、GitHub Actionsのパイプライン（build→test→品質ゲート→deploy）を生成します（テンプレート／AIなし）。</p>
      <div class="form-row">
        <label class="lbl">ランタイム
          <select id="ci-rt" class="inp">
            <option value="node">Node.js</option>
            <option value="python">Python</option>
            <option value="java">Java (Maven)</option>
          </select>
        </label>
        <label class="lbl">テストコマンド<input id="ci-test" class="inp" value="npm test"></label>
        <label class="lbl">デプロイ
          <select id="ci-dep" class="inp">
            <option value="none">なし</option>
            <option value="pages">GitHub Pages</option>
          </select>
        </label>
        <button class="btn-primary" id="ci-run">生成</button>
      </div>
      <div class="tool-actions"><button class="btn-ghost" id="ci-dl" disabled>ci.ymlをダウンロード</button></div>
      <div id="ci-out"></div>`;
    let yml = '';
    const presets = { node: 'npm test', python: 'pytest', java: 'mvn test' };
    c.querySelector('#ci-rt').onchange = e => c.querySelector('#ci-test').value = presets[e.target.value];
    c.querySelector('#ci-run').onclick = () => {
      yml = this.gen(c.querySelector('#ci-rt').value, c.querySelector('#ci-test').value, c.querySelector('#ci-dep').value);
      c.querySelector('#ci-out').innerHTML = `<pre class="codeblock">${esc(yml)}</pre>`;
      c.querySelector('#ci-dl').disabled = false;
    };
    c.querySelector('#ci-dl').onclick = () => download('ci.yml', yml, 'text/yaml');
  },

  gen(rt, testCmd, deploy) {
    const setup = {
      node: `      - uses: actions/setup-node@v4\n        with: { node-version: '20' }\n      - run: npm ci`,
      python: `      - uses: actions/setup-python@v5\n        with: { python-version: '3.12' }\n      - run: pip install -r requirements.txt`,
      java: `      - uses: actions/setup-java@v4\n        with: { distribution: 'temurin', java-version: '21' }`,
    }[rt];
    const deployJob = deploy === 'pages' ? `
  deploy:
    needs: build-test
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with: { path: '.' }
      - uses: actions/deploy-pages@v4` : '';
    return `name: CI
on:
  push: { branches: [ main ] }
  pull_request: { branches: [ main ] }

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${setup}
      - name: テスト実行
        run: ${testCmd}
      - name: 品質ゲート（カバレッジ/静的解析はここに追加）
        run: echo "Critical/Major欠陥0件・カバレッジ閾値をここで検証"
${deployJob}`;
  },
};
