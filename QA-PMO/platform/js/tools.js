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
    { re: /TBD|未定|要検討|追って|別途|可及的/g, sev: 'Major', msg: '未確定・先送り表現' },
    { re: /適宜|随時|なるべく|可能な限り|極力|柔軟に|臨機応変|必要に応じて/g, sev: 'Minor', msg: 'あいまいな程度表現' },
    // 「等」は列挙の助詞/句読点が続く場合のみ検出し、平等・均等等の複合語を除外（精度向上）
    { re: /など|その他|(?<![平均同高対上初中本])等(?=[、。\sのをがにはでや）)]|$)/g, sev: 'Minor', msg: '列挙の不完全（範囲が曖昧）' },
    { re: /基本的に|原則|一般的に/g, sev: 'Minor', msg: '例外が不明確な表現' },
    { re: /と思われる|はずである|だろう|可能性がある/g, sev: 'Minor', msg: '推量・非断定表現' },
  ],
  REQUIRED_HEADINGS: ['目的', '範囲', '前提', '受入基準'],

  // ドキュメント種別固有ルール（必須セクション＋追加チェック）
  DOC_TYPE_RULES: {
    general: {
      label: '汎用', required: ['目的', '範囲', '前提', '受入基準'], extraAmbiguous: [],
    },
    requirements: {
      label: '要件定義書',
      required: ['目的', '範囲', '前提', '受入基準', 'ステークホルダー'],
      extraAmbiguous: [
        { re: /するものとする|することができる|してもよい/g, sev: 'Minor', msg: '要件の義務度が不明確（MUST/SHOULDで明示を推奨）' },
        { re: /詳細は別途|詳細は後述|後で決定/g, sev: 'Major', msg: '要件の先送り（実装前に確定が必要）' },
      ],
    },
    'test-design': {
      label: 'テスト設計書',
      required: ['テスト対象', '合否基準', 'テスト環境', 'テスト手順'],
      extraAmbiguous: [
        { re: /確認する|テストする/g, sev: 'Cosmetic', msg: '観点と期待値を具体的に記述（何をどう確認するか）' },
        { re: /正しく動作|正常に動く/g, sev: 'Minor', msg: '「正しく」の基準を定量的に定義する' },
      ],
    },
    'api-spec': {
      label: 'API仕様書',
      required: ['エンドポイント', 'リクエスト', 'レスポンス', 'エラー'],
      extraAmbiguous: [
        { re: /TBD|未定|後ほど/g, sev: 'Critical', msg: 'API仕様の未確定項目は実装ブロッカー（即座に解決が必要）' },
        { re: /任意|optional/gi, sev: 'Minor', msg: 'オプションフィールドはデフォルト値・null許容を明記' },
        { re: /エラーの場合|エラー時/g, sev: 'Minor', msg: 'エラーケースはHTTPステータスコードと本文スキーマを明記' },
      ],
    },
  },

  render(c) {
    c.innerHTML = `
      <p class="tool-desc">要件定義書・設計書などを貼り付けて検証します。曖昧語・冗長文・必須節欠落を行番号付きで指摘します（ルールベース／AIなし）。</p>
      <div class="form-row" style="margin-bottom:10px">
        <label class="lbl" style="flex:0 0 auto">ドキュメント種別
          <select id="dv-type" class="inp">
            <option value="general">汎用（共通ルール）</option>
            <option value="requirements">要件定義書</option>
            <option value="test-design">テスト設計書</option>
            <option value="api-spec">API仕様書</option>
          </select>
        </label>
      </div>
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
    const typeKey = (c.querySelector('#dv-type') || {}).value || 'general';
    const typeConfig = this.DOC_TYPE_RULES[typeKey] || this.DOC_TYPE_RULES.general;
    const lines = text.split('\n');
    const findings = [];

    lines.forEach((line, i) => {
      const ln = i + 1;
      // 共通曖昧語
      this.AMBIGUOUS.forEach(rule => {
        let m;
        const re = new RegExp(rule.re.source, 'g');
        while ((m = re.exec(line)) !== null) {
          if (m.index === re.lastIndex) re.lastIndex++; // ゼロ幅マッチ対策
          findings.push({ sev: rule.sev, line: ln, term: m[0], msg: rule.msg, text: line.trim() });
        }
      });
      // ドキュメント種別固有ルール
      (typeConfig.extraAmbiguous || []).forEach(rule => {
        let m;
        const re = new RegExp(rule.re.source, rule.re.flags || 'g');
        while ((m = re.exec(line)) !== null) {
          if (m.index === re.lastIndex) re.lastIndex++;
          findings.push({ sev: rule.sev, line: ln, term: m[0], msg: rule.msg, text: line.trim() });
        }
      });
      // 冗長文（一文100字超）
      line.split(/。/).forEach(s => {
        if (s.length > 100) {
          findings.push({ sev: 'Minor', line: ln, term: `${s.length}字`, msg: '一文が長く可読性が低い（100字超）', text: s.trim().slice(0, 40) + '…' });
        }
      });
    });

    // 必須見出しの欠落（ドキュメント種別に応じた必須セクション）
    const requiredHeadings = typeConfig.required || this.REQUIRED_HEADINGS;
    const missing = requiredHeadings.filter(h => !text.includes(h));
    missing.forEach(h => findings.push({ sev: 'Major', line: '-', term: h, msg: `必須セクションが見当たらない（${typeConfig.label}）`, text: '' }));

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
      <p class="tool-desc">ISTQBのテスト技法に加え、<strong>テスト観点ライブラリ</strong>を駆使してテスト条件を自動生成します（決定的アルゴリズム／AIなし）。観点ベース設計は観点カバレッジと追跡証跡を出力します。</p>
      <div class="subtabs">
        <button class="subtab active" data-t="vp">★ 観点ベース設計</button>
        <button class="subtab" data-t="bva">境界値分析</button>
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
    this.render_vp(panel);
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

  // ── 観点ベース設計（差別化の中核：観点ライブラリ駆動） ──
  render_vp(p) {
    p.innerHTML = `
      <p class="muted">機能と入力項目・特性を入力すると、観点ライブラリ(v${VIEWPOINTS.version})から該当観点を適用し、観点カバレッジ付きでテスト条件を生成します。各条件は観点→技法→カテゴリに追跡可能（監査証跡）。</p>
      <label class="lbl">機能名<input id="vp-feat" class="inp" value="ユーザー登録フォーム"></label>
      <div style="margin:12px 0">
        <div class="lbl" style="margin-bottom:6px">入力項目（名称と型）</div>
        <div id="vp-fields"></div>
        <button class="btn-ghost" id="vp-add" style="margin-top:8px">＋ 項目を追加</button>
      </div>
      <div class="lbl" style="margin-bottom:6px">機能特性（該当するものを選択）</div>
      <div class="vp-flags" id="vp-flags">
        ${[['auth', '認証あり'], ['integration', '外部連携あり'], ['money', '金額を扱う'], ['pii', '個人情報を扱う'], ['state', '状態遷移あり'], ['concurrent', '同時実行あり'], ['perf', '性能要件あり']]
        .map(([k, l]) => `<label class="chk"><input type="checkbox" value="${k}">${l}</label>`).join('')}
      </div>
      <div class="lbl" style="margin:14px 0 6px">業種別観点（オプション）</div>
      <div class="vp-industry" id="vp-industry">
        <label class="chk"><input type="radio" name="vp-ind" value="" checked>なし（業種共通のみ）</label>
        <label class="chk"><input type="radio" name="vp-ind" value="finance">🏦 金融</label>
        <label class="chk"><input type="radio" name="vp-ind" value="ecommerce">🛒 EC/小売</label>
        <label class="chk"><input type="radio" name="vp-ind" value="healthcare">🏥 医療/ヘルスケア</label>
        <label class="chk"><input type="radio" name="vp-ind" value="saas">☁️ SaaS/B2B</label>
      </div>
      <div class="tool-actions">
        <button class="btn-primary" id="vp-run">観点ベースで生成</button>
        <button class="btn-ghost" id="vp-csv" disabled>CSV</button>
        <button class="btn-ghost" id="vp-md" disabled>Markdown</button>
      </div>
      <div id="vp-out"></div>`;

    const fieldsBox = p.querySelector('#vp-fields');
    const addField = (name = '', type = 'text') => {
      const row = document.createElement('div');
      row.className = 'vp-field-row';
      row.innerHTML = `
        <input class="inp vp-fn" placeholder="項目名" value="${esc(name)}">
        <select class="inp vp-ft">
          ${['text', 'number', 'date', 'select', 'email', 'file'].map(t => `<option ${t === type ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <button class="btn-ghost vp-del" title="削除">✕</button>`;
      row.querySelector('.vp-del').onclick = () => row.remove();
      fieldsBox.appendChild(row);
    };
    addField('メールアドレス', 'email');
    addField('年齢', 'number');
    addField('プロフィール', 'text');
    p.querySelector('#vp-add').onclick = () => addField();

    let lastResult = null;
    p.querySelector('#vp-run').onclick = () => {
      const feat = p.querySelector('#vp-feat').value || '対象機能';
      const fields = [...fieldsBox.querySelectorAll('.vp-field-row')].map(r => ({
        name: r.querySelector('.vp-fn').value.trim() || '(無名)',
        type: r.querySelector('.vp-ft').value,
      }));
      const flags = [...p.querySelectorAll('#vp-flags input:checked')].map(i => i.value);
      const industry = (p.querySelector('input[name="vp-ind"]:checked') || {}).value || '';
      lastResult = this.genViewpoints(feat, fields, flags, industry);
      this.renderVpResult(p, lastResult);
      p.querySelector('#vp-csv').disabled = false;
      p.querySelector('#vp-md').disabled = false;
    };
    p.querySelector('#vp-csv').onclick = () => download('test_conditions.csv', this.vpToCsv(lastResult), 'text/csv');
    p.querySelector('#vp-md').onclick = () => download('test_design.md', this.vpToMd(lastResult), 'text/markdown');
    p.querySelector('#vp-run').click();
  },

  // 観点ライブラリを適用してテスト条件を生成（決定的）
  genViewpoints(feature, fields, flags, industry) {
    const rows = [];
    let n = 0;
    const add = (target, item) => rows.push({
      id: 'TC-' + String(++n).padStart(3, '0'),
      target, viewpoint: item.vp, technique: item.tech, cat: item.cat, catName: VIEWPOINTS.catName(item.cat),
    });
    // 常時観点
    VIEWPOINTS.always.forEach(v => add(feature, v));
    // 項目型別観点
    fields.forEach(f => (VIEWPOINTS.byFieldType[f.type] || []).forEach(v => add(`${f.name}（${f.type}）`, v)));
    // 特性別観点
    flags.forEach(fl => (VIEWPOINTS.byFlag[fl] || []).forEach(v => add(feature, v)));
    // 業種別観点（選択された場合のみ）
    if (industry && VIEWPOINTS.byIndustry[industry]) {
      const indLabel = `${feature}（${VIEWPOINTS.industryName(industry)}）`;
      VIEWPOINTS.byIndustry[industry].forEach(v => add(indLabel, v));
    }

    // 観点カバレッジ
    const touched = new Set(rows.map(r => r.cat));
    const covered = VIEWPOINTS.categories.filter(c => touched.has(c.id));
    const missing = VIEWPOINTS.categories.filter(c => !touched.has(c.id));
    return {
      feature, industry, rows, total: VIEWPOINTS.categories.length,
      coveredCats: covered, missingCats: missing,
      coverage: Math.round(covered.length / VIEWPOINTS.categories.length * 100),
    };
  },

  renderVpResult(p, r) {
    const rowsHtml = r.rows.map(x =>
      `<tr><td>${x.id}</td><td>${esc(x.target)}</td><td>${esc(x.viewpoint)}</td><td>${esc(x.technique)}</td><td><code>${x.cat}</code> ${esc(x.catName)}</td></tr>`).join('');
    const missing = r.missingCats.length
      ? `<div class="vp-warn">⚠ 未カバー観点（要確認）: ${r.missingCats.map(c => esc(c.name)).join(' / ')}</div>`
      : `<div class="vp-ok">✓ 全観点カテゴリをカバー</div>`;
    p.querySelector('#vp-out').innerHTML = `
      <div class="result-head">
        <div class="score-chip">観点カバレッジ <strong>${r.coverage}</strong>% (${r.coveredCats.length}/${r.total})</div>
        <div class="muted">テスト条件 ${r.rows.length}件 ｜ 監査証跡: 各条件が観点→技法→カテゴリに紐づく</div>
      </div>
      ${missing}
      ${this.table(['ID', '対象', 'テスト観点', '技法', 'カテゴリ'], rowsHtml)}`;
  },

  vpToCsv(r) {
    return ['ID,対象,テスト観点,技法,カテゴリID,カテゴリ名']
      .concat(r.rows.map(x => [x.id, x.target, x.viewpoint, x.technique, x.cat, x.catName]
        .map(s => `"${String(s).replace(/"/g, '""')}"`).join(','))).join('\n');
  },

  vpToMd(r) {
    const lines = [`# テスト設計（観点ベース） — ${r.feature}`, ''];
    lines.push(`- 観点ライブラリ: v${VIEWPOINTS.version}`);
    if (r.industry) lines.push(`- 業種別観点: ${VIEWPOINTS.industryName(r.industry)}`);
    lines.push(`- 観点カバレッジ: ${r.coverage}% (${r.coveredCats.length}/${r.total}カテゴリ)`);
    lines.push(`- テスト条件数: ${r.rows.length}`);
    if (r.missingCats.length) lines.push(`- ⚠ 未カバー観点: ${r.missingCats.map(c => c.name).join(' / ')}`);
    lines.push('', '| ID | 対象 | テスト観点 | 技法 | カテゴリ |', '|---|---|---|---|---|');
    r.rows.forEach(x => lines.push(`| ${x.id} | ${x.target} | ${x.viewpoint} | ${x.technique} | ${x.catName} |`));
    return lines.join('\n');
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

/* ═══════════════════════════════════════════════════════
 * 8. 観点ライブラリブラウザ（知識資産の可視化・探索）
 * ═══════════════════════════════════════════════════════ */
Tools.viewpointBrowser = {
  title: '観点ライブラリ',

  countAll() {
    return VIEWPOINTS.always.length
      + Object.values(VIEWPOINTS.byFieldType).flat().length
      + Object.values(VIEWPOINTS.byFlag).flat().length
      + Object.values(VIEWPOINTS.byIndustry).flat().length;
  },

  getAllViewpoints() {
    const result = [];
    VIEWPOINTS.always.forEach(v => result.push({ ...v, _src: 'always', _label: '常時適用' }));
    Object.entries(VIEWPOINTS.byFieldType).forEach(([k, vs]) =>
      vs.forEach(v => result.push({ ...v, _src: 'field', _label: `項目型: ${k}` })));
    Object.entries(VIEWPOINTS.byFlag).forEach(([k, vs]) =>
      vs.forEach(v => result.push({ ...v, _src: 'flag', _label: `機能特性: ${k}` })));
    Object.entries(VIEWPOINTS.byIndustry).forEach(([k, vs]) =>
      vs.forEach(v => result.push({ ...v, _src: 'industry', _label: `業種: ${VIEWPOINTS.industryName(k)}` })));
    return result;
  },

  render(c) {
    const total = this.countAll();
    c.innerHTML = `
      <p class="tool-desc">テスト観点ナレッジベース（v${VIEWPOINTS.version}）を閲覧・検索します。業種別・カテゴリ別フィルタ、欠陥パターンDB、カバレッジマップを内包します。</p>
      <div class="kb-stats">
        <div class="kb-stat"><div class="kb-stat-n">${total}</div><div class="kb-stat-l">観点総数</div></div>
        <div class="kb-stat"><div class="kb-stat-n">${VIEWPOINTS.categories.length}</div><div class="kb-stat-l">カテゴリ</div></div>
        <div class="kb-stat"><div class="kb-stat-n">${Object.keys(VIEWPOINTS.byIndustry).length}</div><div class="kb-stat-l">対応業種</div></div>
        <div class="kb-stat"><div class="kb-stat-n">${VIEWPOINTS.defectPatterns.length}</div><div class="kb-stat-l">欠陥パターン</div></div>
      </div>
      <div class="subtabs">
        <button class="subtab active" data-t="browse">観点ブラウザ</button>
        <button class="subtab" data-t="defects">欠陥パターンDB</button>
        <button class="subtab" data-t="coverage">カバレッジマップ</button>
      </div>
      <div id="kb-panel"></div>`;
    const panel = c.querySelector('#kb-panel');
    const tabs = c.querySelectorAll('.subtab');
    tabs.forEach(t => t.onclick = () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      this['render_' + t.dataset.t](panel);
    });
    this.render_browse(panel);
  },

  render_browse(p) {
    const allVps = this.getAllViewpoints();
    p.innerHTML = `
      <div class="kb-filter">
        <input id="kb-search" class="inp" placeholder="キーワードで絞り込み…" style="flex:1;min-width:160px;max-width:240px">
        <select id="kb-cat" class="inp" style="min-width:160px">
          <option value="">すべてのカテゴリ</option>
          ${VIEWPOINTS.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
        <select id="kb-src" class="inp" style="min-width:160px">
          <option value="">すべての観点種別</option>
          <option value="always">常時観点</option>
          <option value="field">入力項目別</option>
          <option value="flag">機能特性別</option>
          <option value="industry">業種別</option>
        </select>
        <span class="muted" id="kb-count" style="white-space:nowrap">${allVps.length}件</span>
      </div>
      <div id="kb-table"></div>`;
    const render = () => {
      const q = p.querySelector('#kb-search').value.toLowerCase();
      const cat = p.querySelector('#kb-cat').value;
      const src = p.querySelector('#kb-src').value;
      const filtered = allVps.filter(v => {
        if (cat && v.cat !== cat) return false;
        if (src && v._src !== src) return false;
        if (q && !v.vp.includes(q) && !v.tech.includes(q) && !v._label.includes(q)) return false;
        return true;
      });
      p.querySelector('#kb-count').textContent = `${filtered.length}件`;
      const rows = filtered.map(v => `
        <tr>
          <td><code>${esc(v.cat)}</code></td>
          <td class="muted">${esc(VIEWPOINTS.catName(v.cat))}</td>
          <td>${esc(v.vp)}</td>
          <td><span class="tech-badge">${esc(v.tech)}</span></td>
          <td class="muted">${esc(v._label)}</td>
        </tr>`).join('') || `<tr><td colspan="5" class="muted">該当する観点がありません。</td></tr>`;
      p.querySelector('#kb-table').innerHTML = `
        <table class="tool-table">
          <thead><tr><th>Cat</th><th>カテゴリ</th><th>テスト観点</th><th>技法</th><th>適用対象</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    };
    p.querySelector('#kb-search').oninput = render;
    p.querySelector('#kb-cat').onchange = render;
    p.querySelector('#kb-src').onchange = render;
    render();
  },

  render_defects(p) {
    const rows = VIEWPOINTS.defectPatterns.map(dp => `
      <tr>
        <td><code>${esc(dp.id)}</code></td>
        <td><code>${esc(dp.cat)}</code> <span class="muted">${esc(VIEWPOINTS.catName(dp.cat))}</span></td>
        <td><strong>${esc(dp.pattern)}</strong></td>
        <td class="muted">${esc(dp.example)}</td>
        <td style="color:var(--cos);font-size:12px">${esc(dp.prevention)}</td>
      </tr>`).join('');
    p.innerHTML = `
      <p class="muted" style="margin-bottom:12px">業界で繰り返し発生する既知の欠陥パターン。テスト設計時にこれらのパターンが発生しないか観点として追加することを推奨します。</p>
      <table class="tool-table">
        <thead><tr><th>ID</th><th>カテゴリ</th><th>欠陥パターン</th><th>典型例</th><th>予防策</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  },

  render_coverage(p) {
    const allVps = this.getAllViewpoints();
    const catCounts = {};
    VIEWPOINTS.categories.forEach(c => { catCounts[c.id] = 0; });
    allVps.forEach(v => { if (catCounts[v.cat] !== undefined) catCounts[v.cat]++; });
    const max = Math.max(...Object.values(catCounts), 1);
    const bars = VIEWPOINTS.categories.map(c => {
      const count = catCounts[c.id];
      const pct = Math.round(count / max * 100);
      return `
        <div class="cov-row">
          <div class="cov-label">${esc(c.name)}</div>
          <div class="cov-bar-wrap"><div class="cov-bar" style="width:${pct}%"></div></div>
          <div class="cov-count">${count}</div>
        </div>`;
    }).join('');
    p.innerHTML = `
      <p class="muted" style="margin-bottom:16px">カテゴリ別の観点数分布。観点数が少ないカテゴリは知識資産の拡充余地です。</p>
      <div class="cov-chart">${bars}</div>
      <p class="muted" style="margin-top:14px">総観点数: <strong>${allVps.length}</strong> ／ カテゴリ数: ${VIEWPOINTS.categories.length}</p>`;
  },
};

/* ═══════════════════════════════════════════════════════
 * 9. 欠陥管理（ISTQB severity・localStorage永続化）
 * ═══════════════════════════════════════════════════════ */
Tools.defectMgr = {
  title: '欠陥管理',
  STORE_KEY: 'pmo_defects',
  _defects: null,

  getDefects() {
    if (this._defects !== null) return this._defects;
    try { this._defects = JSON.parse(localStorage.getItem(this.STORE_KEY) || '[]'); }
    catch { this._defects = []; }
    return this._defects;
  },

  saveDefects(defects) {
    this._defects = defects;
    try { localStorage.setItem(this.STORE_KEY, JSON.stringify(defects)); } catch {}
  },

  nextId(defects) {
    if (!defects.length) return 'D-001';
    const nums = defects.map(d => parseInt(d.id.replace('D-', ''), 10)).filter(n => !isNaN(n));
    return 'D-' + String(Math.max(...nums) + 1).padStart(3, '0');
  },

  render(c) {
    c.innerHTML = `
      <p class="tool-desc">欠陥（バグ）をISTQB severityで登録・追跡します。ブラウザのlocalStorageに保存されるため、ページ再読み込み後も保持されます。</p>
      <div class="panel defect-form">
        <h4>欠陥を登録</h4>
        <div class="form-grid">
          <label class="lbl">タイトル<input id="dm-title" class="inp" placeholder="例：ログインボタン押下でエラー500が発生"></label>
          <label class="lbl">Severity
            <select id="dm-sev" class="inp">
              <option value="Critical">Critical（システム停止・データ破損）</option>
              <option value="Major" selected>Major（主要機能が動作不可）</option>
              <option value="Minor">Minor（機能は動くが一部不具合）</option>
              <option value="Cosmetic">Cosmetic（見た目・微細な問題）</option>
            </select>
          </label>
          <label class="lbl">検出フェーズ
            <select id="dm-phase" class="inp">
              <option>単体テスト</option><option>結合テスト</option>
              <option>システムテスト</option><option>UAT</option><option>本番</option>
            </select>
          </label>
          <label class="lbl">根本原因
            <select id="dm-root" class="inp">
              <option>仕様漏れ</option><option>実装誤り</option><option>設計誤り</option>
              <option>テスト漏れ</option><option>環境問題</option><option>外部要因</option>
            </select>
          </label>
        </div>
        <label class="lbl" style="margin-top:10px">概要・再現手順
          <textarea id="dm-desc" class="tool-ta sm" placeholder="再現手順: 1. ログインページを開く  2. 誤ったパスワードを入力して送信  3. エラーコード500が表示される"></textarea>
        </label>
        <div class="tool-actions">
          <button class="btn-primary" id="dm-add">欠陥を登録</button>
          <button class="btn-ghost" id="dm-csv" disabled>CSVエクスポート</button>
        </div>
      </div>
      <div id="dm-list"></div>`;
    c.querySelector('#dm-add').onclick = () => this.addDefect(c);
    c.querySelector('#dm-csv').onclick = () => this.exportCsv();
    this.renderList(c);
  },

  addDefect(c) {
    const title = c.querySelector('#dm-title').value.trim();
    if (!title) { alert('タイトルを入力してください。'); return; }
    const defects = this.getDefects();
    defects.unshift({
      id: this.nextId(defects),
      title,
      sev: c.querySelector('#dm-sev').value,
      phase: c.querySelector('#dm-phase').value,
      root: c.querySelector('#dm-root').value,
      desc: c.querySelector('#dm-desc').value.trim(),
      status: 'Open',
      created: new Date().toISOString().slice(0, 10),
    });
    this.saveDefects(defects);
    c.querySelector('#dm-title').value = '';
    c.querySelector('#dm-desc').value = '';
    this.renderList(c);
  },

  renderList(c) {
    const defects = this.getDefects();
    const csvBtn = c.querySelector('#dm-csv');
    if (csvBtn) csvBtn.disabled = !defects.length;
    const counts = {};
    defects.forEach(d => { counts[d.sev] = (counts[d.sev] || 0) + 1; });
    const summary = defects.length
      ? `<div class="result-head">${sevSummary(counts)}<div class="muted">合計 ${defects.length}件</div></div>` : '';
    const rows = defects.length ? defects.map(d => `
      <tr>
        <td><code>${esc(d.id)}</code></td>
        <td>${sevBadge(d.sev)}</td>
        <td>${esc(d.title)}</td>
        <td class="muted">${esc(d.phase)}</td>
        <td class="muted">${esc(d.root)}</td>
        <td>
          <select class="inp-sm" data-id="${esc(d.id)}" onchange="window._dmStatusChange(this)">
            ${['Open', 'In Progress', 'Fixed', 'Closed', 'Rejected'].map(s =>
              `<option${s === d.status ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td class="muted">${esc(d.created)}</td>
        <td><button class="btn-icon" onclick="window._dmDelete('${esc(d.id)}')" title="削除">🗑</button></td>
      </tr>`).join('')
      : `<tr><td colspan="8" class="muted">まだ欠陥が登録されていません。フォームから登録してください。</td></tr>`;
    c.querySelector('#dm-list').innerHTML = `
      ${summary}
      <table class="tool-table">
        <thead><tr><th>ID</th><th>Sev</th><th>タイトル</th><th>フェーズ</th><th>根本原因</th><th>ステータス</th><th>登録日</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    window._dmStatusChange = sel => {
      const defs = this.getDefects();
      const d = defs.find(x => x.id === sel.dataset.id);
      if (d) { d.status = sel.value; this.saveDefects(defs); }
    };
    window._dmDelete = id => {
      if (!confirm(`欠陥 ${id} を削除しますか？`)) return;
      this.saveDefects(this.getDefects().filter(d => d.id !== id));
      this.renderList(c);
    };
  },

  exportCsv() {
    const defects = this.getDefects();
    const csv = ['ID,Severity,タイトル,検出フェーズ,根本原因,ステータス,登録日,概要']
      .concat(defects.map(d => [d.id, d.sev, d.title, d.phase, d.root, d.status, d.created, d.desc]
        .map(s => `"${String(s || '').replace(/"/g, '""')}"`).join(','))).join('\n');
    download('defects.csv', csv, 'text/csv');
  },
};

/* ═══════════════════════════════════════════════════════
 * 10. ROI計算機（バリデーション研究結果 → 年間コスト削減試算）
 * ═══════════════════════════════════════════════════════ */
Tools.roiCalc = {
  title: 'ROI計算機',

  INDUSTRY: {
    finance:       { label: '金融・保険',       defaultIncidents: 10, defaultCost: 1000 },
    ecommerce:     { label: 'EC・小売',         defaultIncidents: 20, defaultCost: 200  },
    healthcare:    { label: '医療・ヘルスケア', defaultIncidents: 8,  defaultCost: 800  },
    saas:          { label: 'SaaS・B2B',        defaultIncidents: 15, defaultCost: 300  },
    manufacturing: { label: '製造・組込み',     defaultIncidents: 6,  defaultCost: 600  },
    other:         { label: 'その他',           defaultIncidents: 12, defaultCost: 200  },
  },

  METHODS: [
    { value: '5',  label: 'ISTQB/一般チェックリスト' },
    { value: '10', label: 'GPT-4o等AI活用' },
    { value: '0',  label: '経験則・アドホック' },
    { value: '50', label: '独自観点を整備済み' },
  ],

  VP_CAPTURE: 85,
  VP_DOMAIN_CAPTURE: 88,
  SETUP_COST: 240,

  render(c) {
    const indOpts = Object.entries(this.INDUSTRY).map(([k, v]) =>
      `<option value="${k}">${v.label}</option>`).join('');
    const methodOpts = this.METHODS.map(m =>
      `<option value="${m.value}">${m.label}</option>`).join('');

    c.innerHTML = `
      <p class="tool-desc">バリデーション研究（事前登録 commit <code>1024e21</code>、対象: Saleor Commerce本番障害20件）の捕捉率データを使い、観点ライブラリ導入効果を試算します。</p>
      <div class="roi-disclaimer">⚑ 本試算はシミュレーションです。実際の効果は開発規模・障害特性によって異なります。</div>
      <div class="form-grid">
        <label class="lbl">業種
          <select id="roi-industry" class="inp">${indOpts}</select>
        </label>
        <label class="lbl">年間本番障害件数（推定）
          <input id="roi-incidents" class="inp" type="number" min="1" max="9999" value="15">
        </label>
        <label class="lbl">障害1件あたりコスト（万円）
          <input id="roi-cost" class="inp" type="number" min="1" max="99999" value="300">
        </label>
        <label class="lbl">現在のテスト設計アプローチ
          <select id="roi-method" class="inp">${methodOpts}</select>
        </label>
      </div>
      <div class="tool-actions">
        <button class="btn-primary" id="roi-run">ROIを試算する</button>
      </div>
      <div id="roi-result"></div>`;

    c.querySelector('#roi-industry').onchange = () => {
      const ind = this.INDUSTRY[c.querySelector('#roi-industry').value];
      c.querySelector('#roi-incidents').value = ind.defaultIncidents;
      c.querySelector('#roi-cost').value = ind.defaultCost;
      this.run(c);
    };
    c.querySelector('#roi-run').onclick = () => this.run(c);
    c.querySelector('#roi-run').click();
  },

  run(c) {
    const incidents    = Math.max(1, parseInt(c.querySelector('#roi-incidents').value) || 15);
    const costPer      = Math.max(1, parseInt(c.querySelector('#roi-cost').value) || 300);
    const currentPct   = parseInt(c.querySelector('#roi-method').value) || 5;
    const vpPct        = this.VP_CAPTURE;
    const delta        = (vpPct - currentPct) / 100;
    const prevented    = Math.max(0, Math.round(incidents * delta));
    const annualSaving = prevented * costPer;
    const totalCost    = incidents * costPer;
    const monthlySave  = annualSaving / 12;
    const payback      = monthlySave > 0 ? (this.SETUP_COST / monthlySave).toFixed(1) : '—';
    const roi3y        = monthlySave > 0 ? Math.round((annualSaving * 3 - this.SETUP_COST) / this.SETUP_COST * 100) : 0;
    const fmt          = n => n.toLocaleString('ja-JP');

    const barW = w => `style="width:${Math.max(w, 2)}%;background:${w >= 80 ? '#66bb6a' : w >= 40 ? '#ffa726' : '#ef5350'}"`;

    c.querySelector('#roi-result').innerHTML = `
      <div class="roi-cards">
        <div class="roi-kpi">
          <div class="roi-kpi-v">¥${fmt(annualSaving)}<span class="roi-kpi-unit">万円</span></div>
          <div class="roi-kpi-l">年間コスト削減額（推定）</div>
        </div>
        <div class="roi-kpi">
          <div class="roi-kpi-v">${prevented}<span class="roi-kpi-unit">件</span></div>
          <div class="roi-kpi-l">年間予防可能障害数</div>
        </div>
        <div class="roi-kpi">
          <div class="roi-kpi-v">${payback}<span class="roi-kpi-unit">ヶ月</span></div>
          <div class="roi-kpi-l">投資回収期間（初期¥${this.SETUP_COST}万円想定）</div>
        </div>
        <div class="roi-kpi ${roi3y > 0 ? 'roi-kpi-pos' : ''}">
          <div class="roi-kpi-v">${fmt(roi3y)}<span class="roi-kpi-unit">%</span></div>
          <div class="roi-kpi-l">3年ROI</div>
        </div>
      </div>

      <h4>バグ捕捉率の比較（バリデーション研究結果）</h4>
      <div class="roi-compare">
        <div class="roi-bar-row">
          <div class="roi-bar-label">現在の手法</div>
          <div class="roi-bar-wrap"><div class="roi-bar" ${barW(currentPct)}><span>${currentPct}%</span></div></div>
          <div class="roi-bar-cost muted">漏れコスト ¥${fmt(Math.round(totalCost * (1 - currentPct / 100)))}万円/年</div>
        </div>
        <div class="roi-bar-row">
          <div class="roi-bar-label"><strong>観点ライブラリ</strong></div>
          <div class="roi-bar-wrap"><div class="roi-bar" ${barW(vpPct)}><span>${vpPct}%</span></div></div>
          <div class="roi-bar-cost muted">漏れコスト ¥${fmt(Math.round(totalCost * (1 - vpPct / 100)))}万円/年</div>
        </div>
      </div>

      <h4>根拠データ（事前登録バリデーション研究 — commit 1024e21）</h4>
      <table class="tool-table">
        <thead><tr><th>手法</th><th>全バグ捕捉率（N=20）</th><th>ドメイン特有バグ捕捉率（N=16）</th><th>評価</th></tr></thead>
        <tbody>
          <tr><td>ISTQB/一般チェックリスト</td><td>5%（1/20）</td><td>0%（0/16）</td><td><span class="sev sev-Major">△</span></td></tr>
          <tr><td>GPT-4o（標準プロンプト）</td><td>10%（2/20）</td><td>0%（0/16）</td><td><span class="sev sev-Minor">△</span></td></tr>
          <tr style="background:var(--acc-l)"><td><strong>観点ライブラリ（VeriServe）</strong></td><td><strong>85%（17/20）</strong></td><td><strong>88%（14/16）</strong></td><td><span class="sev sev-Cosmetic">◎</span></td></tr>
        </tbody>
      </table>
      <p class="muted" style="font-size:11.5px;margin-top:6px">対象: Saleor Commerce 本番クローズ障害20件（2022〜2024年）。疑わしい場合は「捕捉なし」と判定する自己採点不利方向原則を適用。初期設定コストは3人月×80万円=240万円で試算。</p>`;
  },
};
