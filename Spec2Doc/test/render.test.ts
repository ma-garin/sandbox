// REQ-F-021・017: 4 形式で出力でき、表の行数が Markdown と一致し、根拠（evidence・source・d09Ref）を落とさない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import type { Document } from '../src/doc/model.ts';
import { ALL_FORMATS, render } from '../src/render/index.ts';

const doc: Document = {
  id: 'D02',
  title: '要求仕様書',
  revision: [{ generatedAt: '2026-09-25T00:00:00Z', commit: 'abc123', changedSections: ['機能一覧'] }],
  sections: [
    {
      heading: '機能一覧',
      level: 1,
      blocks: [
        { type: 'paragraph', text: '本節は機能を列挙する。', evidence: 'fact', source: [{ file: 'src/app.js', line: 3, endLine: 9 }] },
        {
          type: 'table',
          caption: '機能',
          columns: ['機能', '説明'],
          rows: [
            { cells: ['保存', 'a|b <script>'], evidence: 'fact', source: [{ file: 'src/save.js', line: 12 }] },
            { cells: ['検索', '一覧を絞る'], evidence: 'inference', origin: 'llm', source: [{ file: 'src/search.js', line: 40 }] },
            { cells: ['削除', '不明'], evidence: 'unknown', source: [], d09Ref: 'D09-007' },
          ],
        },
      ],
    },
    {
      heading: '入力制約',
      level: 2,
      blocks: [
        {
          type: 'list',
          ordered: false,
          items: [{ text: '全角のみ', evidence: 'fact', source: [{ file: 'src/form.js', line: 5 }], children: [{ text: '20 文字以内', evidence: 'unknown', source: [], d09Ref: 'D09-008' }] }],
        },
      ],
    },
  ],
};

const MARKERS = ['src/app.js:3-9', 'src/save.js:12', 'src/search.js:40', 'D09-007', 'src/form.js:5', 'D09-008'];

test('md: GFM の表で行数が一致し、根拠ラベルとソース位置・D09 番号が全記述に付く', async () => {
  const md = (await render(doc, 'md')).toString('utf8');
  const tableLines = md.split('\n').filter((l) => l.startsWith('| 保存') || l.startsWith('| 検索') || l.startsWith('| 削除'));
  assert.equal(tableLines.length, 3);
  assert.match(md, /\| 機能 \| 説明 \| 根拠 \|\n\| --- \| --- \| --- \|/);
  assert.match(md, /a\\\|b/);
  for (const m of MARKERS) assert.ok(md.includes(m), m);
  assert.match(md, /推測（LLM。src\/search\.js:40）/);
  assert.match(md, /不明（D09-007）/);
});

test('html: 自己完結で、kit の骨格（.layout-2pane・目次・本文）と部品クラス（表・バッジ・コールアウト）を使い、本文はエスケープする', async () => {
  const html = (await render(doc, 'html')).toString('utf8');
  assert.ok(html.startsWith('<!doctype html>'));
  const outside = html.replace(/<style>[\s\S]*?<\/style>/, '');
  assert.doesNotMatch(outside, /<link\b|<script[^>]*\bsrc=|https?:\/\//i, '外部読み込みがある');
  assert.match(html, /<div class="layout-2pane">\s*<aside class="sidenav" id="toc-nav"><nav class="toc" aria-label="目次">/);
  assert.match(html, /<main class="doc-main">/);
  assert.match(html, /<button class="btn btn--ghost toc-toggle" type="button" aria-controls="toc-nav" aria-expanded="false"><svg /, '狭幅で目次を開くボタンが無い');
  assert.match(html, /href="#sec-1"[\s\S]*href="#sec-2"[\s\S]*href="#revision"/);
  assert.match(html, /aria-current', 'location'/, '目次の現在位置の付け替えが無い');
  assert.equal((html.match(/<div class="table-wrap"><table class="table">/g) ?? []).length, 2); // 本表 + 改版履歴
  assert.match(html, /<span class="badge ev-tag ev-tag--fact" data-evidence="fact">事実<\/span><span class="ev-src muted mono">src\/save\.js:12<\/span>/);
  assert.match(html, /<span class="badge ev-tag ev-tag--inference" data-evidence="inference">推測（[^<）]+）<\/span><span class="ev-src muted mono">src\/search\.js:40<\/span>/);
  assert.match(html, /<span class="badge ev-tag ev-tag--unknown" data-evidence="unknown">不明<\/span><span class="ev-src muted mono">D09-007<\/span>/);
  assert.match(html, /<div class="callout callout--info" role="note">/);
  const body = outside;
  assert.equal((body.match(/badge-(critical|high|medium|low|info)\b/g) ?? []).length, 0, '根拠ラベルに severity バッジを流用している');
  assert.match(html, /<section class="card"[^>]*><h2 id="revision">改版履歴<\/h2>/);
  assert.ok(html.includes('a|b &lt;script&gt;'));
  for (const m of MARKERS) assert.ok(html.includes(m), m);
  const levels = [...outside.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  levels.forEach((lv, i) => i > 0 && assert.ok(lv <= levels[i - 1]! + 1, `見出しが飛んでいる: ${levels.join(',')}`));
});

test('html: kit の tokens.css・components.css・layout.css を無改変の写しで順に埋め込み、独自 CSS は var(--*) だけ', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { KIT_FILES, KIT_ICONS_FILE, extractIcons, kitDir } = await import('../src/render/sync-kit-css.ts');
  const kit = await import('../src/render/kit-css.ts');
  const { DOC_CSS } = await import('../src/render/html.ts');
  const { TOKEN_HEX } = await import('../src/render/tokens.ts');
  const root = kitDir();
  if (!existsSync(root)) return void assert.fail(`kit が見つからない: ${root}（AIDD_KIT_DIR で指定）`);
  for (const [name, rel] of Object.entries(KIT_FILES)) {
    assert.equal(kit[name as keyof typeof KIT_FILES], readFileSync(join(root, rel), 'utf8'), `${rel} の写しが kit と一致しない（sync-kit-css.ts で作り直す）`);
  }
  assert.deepEqual({ ...kit.KIT_ICONS }, extractIcons(readFileSync(join(root, KIT_ICONS_FILE), 'utf8')), 'アイコンの写しが kit と一致しない');
  const html = (await render(doc, 'html')).toString('utf8');
  const i = [kit.TOKENS_CSS, kit.COMPONENTS_CSS, kit.LAYOUT_CSS, DOC_CSS].map((c) => html.indexOf(c));
  assert.ok(i.every((v) => v > 0) && i[0]! < i[1]! && i[1]! < i[2]! && i[2]! < i[3]!, `埋め込み順: ${i.join(',')}`);
  assert.doesNotMatch(DOC_CSS, /#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(/, '独自 CSS に色の直値がある');
  assert.match(DOC_CSS, /@media print \{/);
  // docx・xlsx の色値も tokens.css の値と一致する
  for (const [name, hex] of Object.entries(TOKEN_HEX)) {
    assert.match(kit.TOKENS_CSS, new RegExp(`--${name}:\\s*#${hex}\\b`, 'i'), `${name} の値が tokens.css と違う`);
  }
});

test('html 360px: 目次は off-canvas（.sidenav.open）で開閉でき、aria-expanded・Esc・リンク選択・閉じるボタンで閉じる', async () => {
  const html = (await render(doc, 'html')).toString('utf8');
  assert.match(html, /<aside class="sidenav" id="toc-nav">/);
  assert.match(html, /@media \(max-width: 768px\) \{[^}]*\.toc-toggle \{ display: inline-flex; \}\s*\.sidenav\.open \{ display: block; position: fixed;/);
  assert.match(html, /class="btn btn--ghost toc-close" type="button" aria-label="目次を閉じる"><svg viewBox="0 -960 960 960"/);
  const js = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
  assert.match(js, /setAttribute\('aria-expanded', String\(open\)\)/);
  assert.match(js, /e\.key === 'Escape'/);
  assert.match(js, /closest\('a'\)\) setOpen\(false/);
  assert.doesNotMatch(js, /\bsrc=|fetch\(|import\(/, '外部読み込みがある');
});

test('html 360px: 表は内容に応じた最小幅で横スクロールし、長い値の列だけ折り返す', async () => {
  const wide: Document = {
    ...doc,
    sections: [{ heading: '業務ルール', level: 1, blocks: [{ type: 'table', columns: ['ID', '条件式'], rows: [
      { cells: ['R-1', 'amount > 0 && amount <= 100000 && currency === "JPY"'], evidence: 'fact', source: [{ file: 'src/rules/validation/amount.js', line: 120, endLine: 140 }] },
    ] }] }],
  };
  const html = (await render(wide, 'html')).toString('utf8');
  assert.match(html, /\.doc-main \.table \{ width: auto; min-width: 100%; \}/);
  assert.match(html, /\.doc-main \.table th, \.doc-main \.table td \{ white-space: nowrap; \}/);
  assert.match(html, /\.cell-wrap \{ white-space: normal; overflow-wrap: anywhere; min-width: calc\(var\(--text-measure\) \/ 3\); \}/);
  assert.match(html, /<th scope="col">ID<\/th><th scope="col" class="cell-wrap">条件式<\/th><th scope="col" class="cell-wrap">根拠<\/th>/);
  assert.match(html, /<td>R-1<\/td><td class="cell-wrap">amount/);
});

test('html: 根拠ラベル 3 種は文字色・背景・ボーダーの 3 点セットがそれぞれ違い、危険色を使わない', async () => {
  const { DOC_CSS } = await import('../src/render/html.ts');
  const rule = (k: string): string => new RegExp(`\\.ev-tag--${k} \\{([^}]*)\\}`).exec(DOC_CSS)?.[1] ?? '';
  const props = ['fact', 'inference', 'unknown'].map((k) => {
    const r = rule(k);
    return ['color', 'background', 'border-color', 'border-style'].map((p) => new RegExp(`(?:^|;)\\s*${p}: ([^;]+)`).exec(r)?.[1]);
  });
  for (let i = 0; i < 4; i++) assert.equal(new Set(props.map((p) => p[i])).size, 3, `3 種で同じ値: ${props.map((p) => p[i]).join(' / ')}`);
  assert.doesNotMatch(DOC_CSS, /--color-(critical|high|medium)\b/, '根拠ラベルに危険・警告色を使っている');
});

test('html 見た目: ライト既定・.card ヘッダ（文書名＋メタ）・目次は h2/h3 のみで省略表示・見出しの段差・根拠タグは区分だけでソース位置は外', async () => {
  const deep: Document = {
    ...doc,
    sections: [
      { heading: '機能ごとの仕様', level: 1, blocks: [] },
      { heading: 'F-001 init', level: 2, blocks: [] },
      { heading: 'F-001-1 機能一覧', level: 3, blocks: [{ type: 'paragraph', text: '本文', evidence: 'fact', source: [{ file: 'src/app.js', line: 17, endLine: 29 }] }] },
    ],
  };
  const html = (await render(deep, 'html')).toString('utf8');
  const { DOC_CSS } = await import('../src/render/html.ts');
  // 1 ライト既定
  assert.match(html, /<html lang="ja" data-theme="light">/);
  assert.match(html, /<meta name="color-scheme" content="light">/);
  // 2 ヘッダ（.card）に文書名とメタ、その下に表示の意味の callout が 1 つ
  assert.match(html, /<header class="card doc-header"><h1>D02 要求仕様書<\/h1><dl class="meta"><div><dt>コミット<\/dt><dd>abc123<\/dd><\/div><div><dt>生成日時<\/dt><dd>2026-09-25 09:00（JST）<\/dd><\/div><\/dl><\/header>\s*<div class="callout callout--info"/);
  assert.equal((html.match(/class="callout /g) ?? []).length, 1);
  const noRev = (await render({ ...deep, revision: [] }, 'html')).toString('utf8');
  assert.match(noRev, /<header class="card doc-header"><h1>D02 要求仕様書<\/h1><\/header>/, 'メタが無ければ行を出さない');
  // 3 目次は h2・h3 まで、title 付き、1 行省略、デスクトップで tap-min を当てない、選択状態は kit のサイドバーと同じ
  const toc = /<aside class="sidenav"[\s\S]*?<\/aside>/.exec(html)?.[0] ?? '';
  assert.match(toc, /<li class="toc-l1"><a href="#sec-1" title="機能ごとの仕様">/);
  assert.match(toc, /<li class="toc-l2"><a href="#sec-2" title="F-001 init">/);
  assert.doesNotMatch(toc, /F-001-1/, 'h4 が目次に出ている');
  assert.match(DOC_CSS, /\.toc a \{ display: block; min-height: 0; min-width: 0;[^}]*white-space: nowrap; overflow: hidden; text-overflow: ellipsis;/);
  assert.match(DOC_CSS, /\.toc a\[aria-current="location"\] \{ background: var\(--color-primary-light\); color: var\(--color-primary-dark\); border-left-color: var\(--color-primary\); font-weight: 600; \}/);
  // 4 見出しの段差と h2 の区切り線、本文の行幅
  const size = (h: string) => new RegExp(`\\.doc-main ${h} \\{ font-size: (var\\(--text-[a-z0-9]+\\))`).exec(DOC_CSS)?.[1];
  assert.deepEqual(['h1', 'h2', 'h3', 'h4'].map(size), ['var(--text-2xl)', 'var(--text-xl)', 'var(--text-lg)', 'var(--text-md)']);
  assert.match(DOC_CSS, /\.doc-main h2 \{[^}]*border-top: 1px solid var\(--color-border\);/);
  assert.match(DOC_CSS, /\.doc-main p, \.doc-main ul, \.doc-main ol \{ max-width: var\(--text-measure\); \}/);
  // 5 根拠タグは区分だけ、ソース位置は外に muted の小さい文字
  assert.match(html, /<p>本文<span class="ev"><span class="badge ev-tag ev-tag--fact" data-evidence="fact">事実<\/span><span class="ev-src muted mono">src\/app\.js:17-29<\/span><\/span><\/p>/);
  assert.match(DOC_CSS, /\.ev-src \{ margin-left: var\(--space-1\); font-size: var\(--text-xs\); \}/);
});

test('生成日時は 4 形式のヘッダ・改版履歴で「YYYY-MM-DD HH:mm（JST）」（AIDD_TZ で切替、データは ISO のまま）', async () => {
  const { formatDisplayDate } = await import('../src/render/display-date.ts');
  assert.equal(formatDisplayDate('2026-09-26T05:18:02.888Z', 'Asia/Tokyo'), '2026-09-26 14:18（JST）');
  assert.equal(formatDisplayDate('2026-09-26T05:18:02.888Z', 'UTC'), '2026-09-26 05:18（UTC）');
  assert.equal(formatDisplayDate('abc123'), 'abc123');
  const d: Document = {
    ...doc,
    revision: [{ generatedAt: '2026-09-26T05:18:02.888Z', commit: 'abc123', changedSections: [] }],
    sections: [...doc.sections, { heading: '改版履歴', level: 1, blocks: [{ type: 'table', columns: ['版', '生成日時'], rows: [{ cells: ['1', '2026-09-26T05:18:02.888Z'], evidence: 'fact', source: [] }] }] }],
  };
  const want = '2026-09-26 14:18（JST）';
  const saved = process.env['AIDD_TZ'];
  delete process.env['AIDD_TZ'];
  try {
    const md = (await render(d, 'md')).toString('utf8');
    const html = (await render(d, 'html')).toString('utf8');
    assert.ok(md.includes(`| 1 | ${want} |`), 'md 改版履歴');
    assert.ok(html.includes(`<dt>生成日時</dt><dd>${want}</dd>`), 'html ヘッダ');
    assert.ok(html.includes(`<td>${want}</td>`), 'html 改版履歴');
    for (const t of [md, html]) assert.ok(!t.includes('2026-09-26T05:18'), 'ISO が残っている');
    const JSZip = (await import('jszip')).default;
    const xml = await (await JSZip.loadAsync(await render(d, 'docx'))).file('word/document.xml')!.async('string');
    assert.ok(xml.includes(want) && !xml.includes('2026-09-26T05:18'), 'docx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await render({ ...d, sections: doc.sections }, 'xlsx')) as unknown as ArrayBuffer);
    const cells: string[] = [];
    wb.getWorksheet('文書情報')!.eachRow((r) => cells.push(...(r.values as unknown[]).map((v) => String(v ?? ''))));
    assert.ok(cells.includes(want), 'xlsx 文書情報');
    process.env['AIDD_TZ'] = 'UTC';
    assert.ok((await render(d, 'md')).toString('utf8').includes('2026-09-26 05:18（UTC）'), 'AIDD_TZ');
    assert.equal(d.revision[0]!.generatedAt, '2026-09-26T05:18:02.888Z', '元の文書を変えていない');
  } finally {
    if (saved === undefined) delete process.env['AIDD_TZ'];
    else process.env['AIDD_TZ'] = saved;
  }
});

test('docx: zip（PK）で生成され、根拠が本文に残る', async () => {
  const buf = await render(doc, 'docx');
  assert.equal(buf.subarray(0, 2).toString('latin1'), 'PK');
  const JSZip = (await import('jszip')).default;
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string');
  for (const m of MARKERS) assert.ok(xml.includes(m), m);
  assert.equal((xml.match(/<w:tr[ >]/g) ?? []).length, 4 + 2); // 本表 1+3 行、改版履歴 1+1 行
});

test('xlsx: zip（PK）で生成され、節ごとのシートに表が行のまま根拠・ソース位置列付きで入る', async () => {
  const buf = await render(doc, 'xlsx');
  assert.equal(buf.subarray(0, 2).toString('latin1'), 'PK');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['文書情報', '1_機能一覧', '2_入力制約']);
  const rows: string[][] = [];
  wb.getWorksheet('1_機能一覧')!.eachRow((r) => rows.push((r.values as unknown[]).slice(1).map((v) => String(v ?? ''))));
  const header = rows.find((r) => r[0] === '機能' && r.length > 1);
  assert.deepEqual(header, ['機能', '説明', '根拠', 'ソース位置', '確認事項']);
  const data = rows.filter((r) => ['保存', '検索', '削除'].includes(r[0] ?? ''));
  assert.equal(data.length, 3);
  assert.deepEqual(data[2], ['削除', '不明', '不明', '', 'D09-007']);
  assert.deepEqual(data[1]?.slice(2, 4), ['推測（LLM）', 'src/search.js:40']);
});

test('4 形式すべてが空でないバッファを返す', async () => {
  for (const f of ALL_FORMATS) assert.ok((await render(doc, f)).length > 100, f);
});

test('推測は出どころで表示を分ける: LLM は「推測（LLM。位置）」、解析は「推測（解析による対応付け。位置）」（4 形式）', async () => {
  const d: Document = {
    id: 'D04',
    title: 'D04 データ仕様書',
    sections: [
      {
        heading: '推測の出どころ',
        level: 1,
        blocks: [
          {
            type: 'table',
            columns: ['項目'],
            rows: [
              { cells: ['説明'], evidence: 'inference', origin: 'llm', source: [{ file: 'src/a.js', line: 1 }] },
              { cells: ['型対応'], evidence: 'inference', origin: 'analysis', source: [{ file: 'src/b.ts', line: 2 }] },
              { cells: ['出どころ未指定'], evidence: 'inference', source: [{ file: 'src/c.ts', line: 3 }] },
            ],
          },
        ],
      },
    ],
    revision: [],
  };
  const llm = '推測（LLM。src/a.js:1）';
  const ana = '推測（解析による対応付け。src/b.ts:2）';
  const none = '推測（解析による対応付け。src/c.ts:3）';
  const md = (await render(d, 'md')).toString('utf8');
  for (const t of [llm, ana, none]) assert.ok(md.includes(t), `md: ${t}`);
  assert.equal((md.match(/推測（LLM/g) ?? []).length, 1);
  const html = (await render(d, 'html')).toString('utf8');
  for (const [t, src] of [['推測（LLM）', 'src/a.js:1'], ['推測（解析による対応付け）', 'src/b.ts:2'], ['推測（解析による対応付け）', 'src/c.ts:3']] as const) {
    assert.ok(html.includes(`>${t}</span><span class="ev-src muted mono">${src}</span>`), `html: ${t} ${src}`);
  }
  const JSZip = (await import('jszip')).default;
  const xml = await (await JSZip.loadAsync(await render(d, 'docx'))).file('word/document.xml')!.async('string');
  for (const t of [llm, ana, none]) assert.ok(xml.includes(t), `docx: ${t}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await render(d, 'xlsx')) as unknown as ArrayBuffer);
  const rows: string[][] = [];
  wb.worksheets[1]!.eachRow((r) => rows.push((r.values as unknown[]).slice(1).map((v) => String(v ?? ''))));
  const label = (name: string) => rows.find((r) => r[0] === name)?.[1];
  assert.equal(label('説明'), '推測（LLM）');
  assert.equal(label('型対応'), '推測（解析による対応付け）');
  assert.equal(label('出どころ未指定'), '推測（解析による対応付け）');
});

test('入力元: html はヘッダのメタに、md・docx・xlsx は改版履歴に 1 行。値が無ければ出さない', async () => {
  const base: Document = {
    id: 'D06', title: '依存ライブラリ一覧',
    sections: [{ heading: '依存', level: 1, blocks: [{ type: 'paragraph', text: '本文', evidence: 'fact', source: [{ file: 'package.json', line: 1 }] }] }],
    revision: [{ generatedAt: '2026-09-26T00:00:00.000Z', commit: 'abc', source: 'フォルダ: sample-app', changedSections: [] }],
  };
  const html = (await render(base, 'html')).toString('utf8');
  assert.match(html, /<dt>入力元<\/dt><dd>フォルダ: sample-app<\/dd>/);
  assert.match(html, /<dt>コミット<\/dt><dd>abc<\/dd>/);
  const md = (await render(base, 'md')).toString('utf8');
  assert.match(md, /## 改版履歴\n\n入力元: フォルダ: sample-app\n/);
  const JSZip = (await import('jszip')).default;
  const xml = await (await JSZip.loadAsync(await render(base, 'docx'))).file('word/document.xml')!.async('string');
  assert.ok(xml.includes('入力元: フォルダ: sample-app'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await render(base, 'xlsx')) as unknown as ArrayBuffer);
  const info: string[][] = [];
  wb.getWorksheet('文書情報')!.eachRow((r) => info.push((r.values as unknown[]).slice(1).map((v) => String(v ?? ''))));
  assert.ok(info.some((r) => r[0] === '入力元' && r[1] === 'フォルダ: sample-app'));
  const none: Document = { ...base, revision: [{ generatedAt: 'x', changedSections: [] }] };
  assert.ok(!(await render(none, 'html')).toString('utf8').includes('<dt>入力元</dt>'));
  assert.ok(!(await render(none, 'md')).toString('utf8').includes('入力元'));
});
