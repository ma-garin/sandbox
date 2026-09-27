// REQ-F-027・028・N-010: Web 画面の配信・入力の誤りの表示・out/ 外のパスを返さない
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createWebServer, safeOutPath, viewCsp, type Runner } from '../src/web/server.ts';
import { createHash } from 'node:crypto';
import type { RunResult } from '../src/core.ts';

let server: Server;
let base: string;
let outDir: string;
const RUN_ID = '20260925-000000-abcdef';
let lastExclude: string[] | undefined;
let calls = 0;
let hold: Promise<void> | undefined;
let docChanges: Record<string, unknown[]> | undefined;

const fakeRunner: Runner = async (options, onProgress) => {
  lastExclude = options.exclude;
  calls += 1;
  if (hold) await hold;
  onProgress({ stage: 'ingest', message: '入力を取得しています', ratio: 0 });
  onProgress({ stage: 'done', message: '完了しました', ratio: 1 });
  return {
    runId: RUN_ID,
    outPath: join(outDir, RUN_ID),
    ir: {},
    hasFailures: false,
    log: {
      settings: { docIds: options.docIds, formats: options.formats, exclude: [], llmEnabled: false },
      outputs: ['D01.md', 'D01.html', 'ir.json', 'run-log.json'],
      fileCounts: { total: 1, analyzed: 1, failed: 0, excluded: 0, unsupported: 0 },
      durationMs: 5,
      ...(docChanges ? { docChanges } : {}),
    },
  } as unknown as RunResult;
};

before(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'spec2doc-web-test-'));
  await mkdir(join(outDir, RUN_ID));
  await writeFile(join(outDir, RUN_ID, 'D01.html'), '<p>ok</p>');
  await writeFile(join(outDir, RUN_ID, 'D01.md'), '# ok');
  await writeFile(join(outDir, RUN_ID, 'D03.html'), '<p>x</p><script>document.body.dataset.ok = "1";</script>');
  server = createWebServer({ outDir, runner: fakeRunner, maxUploadBytes: 1024 * 1024 });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await rm(outDir, { recursive: true, force: true });
});

test('GET / は 200 で lang="ja" の画面を返す', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<html lang="ja"[ >]/);
  assert.match(html, /role="tablist"/);
});

test('out/ 外を指すダウンロードは 400、無いファイルは 404', async () => {
  for (const p of ['/files/..%2F..%2Fetc/passwd', '/files/x/..%2F..%2Fpasswd', '/view/x/..%2Fa.html', '/files/a/b/c', '/view/' + RUN_ID + '/D01.md']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 400, p);
    await res.body?.cancel();
  }
  for (const p of ['/files/../../etc/passwd', `/files/${RUN_ID}/D02.md`]) {
    const res = await fetch(base + p);
    assert.equal(res.status, 404, p);
    await res.body?.cancel();
  }
  assert.equal(safeOutPath(outDir, '..', 'D01.md'), undefined);
});

test('out/ の中のファイルはダウンロード・閲覧できる', async () => {
  const dl = await fetch(`${base}/files/${RUN_ID}/D01.md`);
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get('content-disposition') ?? '', /attachment/);
  assert.equal(await dl.text(), '# ok');
  const view = await fetch(`${base}/view/${RUN_ID}/D01.html`);
  assert.equal(view.status, 200);
  assert.match(view.headers.get('content-security-policy') ?? '', /sandbox/);
  await view.body?.cancel();
});

test('Host が 127.0.0.1 以外なら 403', async () => {
  const status = await new Promise<number>((done, fail) => {
    const req = request(`${base}/`, { headers: { host: 'evil.example' } }, (res) => {
      res.resume();
      done(res.statusCode ?? 0);
    });
    req.on('error', fail);
    req.end();
  });
  assert.equal(status, 403);
});

test('入力の誤りは原因と次の行動を返す（400）', async () => {
  const fd = new FormData();
  fd.set('kind', 'folder');
  fd.set('folder', '');
  fd.append('docs', 'D01');
  fd.append('formats', 'md');
  const res = await fetch(`${base}/api/run`, { method: 'POST', body: fd });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { message: string; hint: string };
  assert.ok(body.message.length > 0 && body.hint.length > 0);
});

test('上限を超える送信は 413', async () => {
  const fd = new FormData();
  fd.set('kind', 'zip');
  fd.set('zip', new Blob([new Uint8Array(2 * 1024 * 1024)]), 'big.zip');
  const res = await fetch(`${base}/api/run`, { method: 'POST', body: fd });
  assert.equal(res.status, 413);
  await res.body?.cancel();
});

test('実行すると SSE で進み具合と結果が届く', async () => {
  const fd = new FormData();
  fd.set('kind', 'github');
  fd.set('url', 'https://github.com/owner/repo');
  fd.append('docs', 'D01');
  fd.append('formats', 'md');
  fd.append('formats', 'html');
  const res = await fetch(`${base}/api/run`, { method: 'POST', body: fd });
  assert.equal(res.status, 202);
  const { jobId } = (await res.json()) as { jobId: string };
  const events = await (await fetch(`${base}/api/jobs/${jobId}/events`)).text();
  assert.match(events, /event: progress/);
  assert.match(events, /event: result/);
  const result = JSON.parse(/event: result\ndata: (.*)\n/.exec(events)?.[1] ?? '{}') as { docs: { id: string; files: string[] }[] };
  assert.deepEqual(result.docs, [{ id: 'D01', title: '概要書', files: ['D01.md', 'D01.html'] }]);
});

test('前回の実行と比べて内容が変わった節数が結果の文書行に載り、位置のみ変更は数えない（REQ-F-035）', async () => {
  docChanges = { D01: [{ section: '1. 概要', kind: 'changed' }, { section: '2. 構成', kind: 'added' }, { section: '3. 用語', kind: 'moved' }] };
  try {
    const fd = new FormData();
    fd.set('kind', 'github');
    fd.set('url', 'https://github.com/owner/repo');
    fd.append('docs', 'D01');
    fd.append('formats', 'md');
    const res = await fetch(`${base}/api/run`, { method: 'POST', body: fd });
    const { jobId } = (await res.json()) as { jobId: string };
    const events = await (await fetch(`${base}/api/jobs/${jobId}/events`)).text();
    const result = JSON.parse(/event: result\ndata: (.*)\n/.exec(events)?.[1] ?? '{}') as { docs: { id: string; changes?: number }[] };
    assert.equal(result.docs[0]?.changes, 2);
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /badge badge-neutral/);
  } finally {
    docChanges = undefined;
  }
});

test('LLM 有効でキーが無いと原因と次の行動を返す（400）', async () => {
  const saved = process.env['ANTHROPIC_API_KEY'];
  delete process.env['ANTHROPIC_API_KEY'];
  try {
    const fd = new FormData();
    fd.set('kind', 'github');
    fd.set('url', 'https://github.com/owner/repo');
    fd.append('docs', 'D01');
    fd.append('formats', 'md');
    fd.set('llm', 'on');
    const res = await fetch(`${base}/api/run`, { method: 'POST', body: fd });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { message: string; hint: string };
    assert.match(body.message, /ANTHROPIC_API_KEY/);
    assert.ok(body.hint.length > 0);
  } finally {
    if (saved !== undefined) process.env['ANTHROPIC_API_KEY'] = saved;
  }
});

test('除外パターン（改行区切り）が core の exclude に渡る', async () => {
  const fd = new FormData();
  fd.set('kind', 'github');
  fd.set('url', 'https://github.com/owner/repo');
  fd.append('docs', 'D01');
  fd.append('formats', 'md');
  fd.set('exclude', 'legacy/**\r\n\n  **/*.min.js  \n');
  const res = await fetch(`${base}/api/run`, { method: 'POST', body: fd });
  assert.equal(res.status, 202);
  const { jobId } = (await res.json()) as { jobId: string };
  await (await fetch(`${base}/api/jobs/${jobId}/events`)).text();
  assert.deepEqual(lastExclude, ['legacy/**', '**/*.min.js']);
});

test('画面に除外パターンの入力欄がラベル付きである', async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /<label for="exclude">/);
  assert.match(html, /<textarea id="exclude" name="exclude"/);
  assert.doesNotMatch(html, /（任意）/);
});

test('同時に 3 本送ると 202 は 1 本・409 は 2 本で、runner は 1 回だけ走る', async () => {
  let release = (): void => {};
  hold = new Promise<void>((r) => (release = r));
  const before = calls;
  const post = (): Promise<Response> => {
    const fd = new FormData();
    fd.set('kind', 'github');
    fd.set('url', 'https://github.com/owner/repo');
    fd.append('docs', 'D01');
    fd.append('formats', 'md');
    return fetch(`${base}/api/run`, { method: 'POST', body: fd });
  };
  try {
    const responses = await Promise.all([post(), post(), post()]);
    const statuses = responses.map((r) => r.status).sort();
    assert.deepEqual(statuses, [202, 409, 409]);
    const accepted = responses.find((r) => r.status === 202);
    const { jobId } = (await accepted!.json()) as { jobId: string };
    for (const r of responses.filter((x) => x.status === 409)) await r.body?.cancel();
    release();
    await (await fetch(`${base}/api/jobs/${jobId}/events`)).text();
    assert.equal(calls - before, 1);
  } finally {
    hold = undefined;
    release();
  }
  // 解放されていれば次の 1 本は受け付ける
  const next = await (async () => {
    const fd = new FormData();
    fd.set('kind', 'folder');
    fd.set('folder', '');
    fd.append('docs', 'D01');
    fd.append('formats', 'md');
    return fetch(`${base}/api/run`, { method: 'POST', body: fd });
  })();
  assert.equal(next.status, 400);
  await next.body?.cancel();
});

test('デザイントークンと部品の CSS を配信し、画面が読み込む', async () => {
  const html = await (await fetch(`${base}/`)).text();
  // 読み込み順は kit の ui/README.md どおり tokens → components → layout
  const order = ['/tokens.css', '/components.css', '/layout.css'].map((h) => html.indexOf(`<link rel="stylesheet" href="${h}">`));
  assert.ok(order.every((i) => i >= 0), String(order));
  assert.deepEqual([...order].sort((x, y) => x - y), order);
  for (const p of ['/icons.js', '/feedback.js']) {
    assert.match(html, new RegExp(`<script src="${p.replace('.', '\\.')}"></script>`));
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get('content-type') ?? '', /javascript/);
    await res.body?.cancel();
  }
  for (const p of ['/tokens.css', '/components.css', '/layout.css']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get('content-type') ?? '', /text\/css/);
    assert.match(await res.text(), /--color-|var\(--/);
  }
});

test('favicon は /favicon.ico の 204 で返し、タブ切替で前の実行の表示を戻す', async () => {
  const fav = await fetch(`${base}/favicon.ico`);
  assert.equal(fav.status, 204);
  assert.equal((await fav.arrayBuffer()).byteLength, 0);
  const res = await fetch(`${base}/`);
  assert.doesNotMatch(res.headers.get('content-security-policy') ?? '', /img-src[^;]*data:/);
  const html = await res.text();
  assert.doesNotMatch(html, /rel="icon"|data:,/);
  assert.match(html, /if \(!running\) resetFeedback\(\);/);
  assert.match(html, /const resetFeedback = \(\) => \{[\s\S]*?closeLastError\(\);[\s\S]*?\$\('progress-box'\)\.hidden = true;/);
});

test('骨格は kit の app シェル、操作の結果は Feedback に一本化する', async () => {
  const res = await fetch(`${base}/`);
  assert.match(res.headers.get('content-security-policy') ?? '', /script-src 'self'/);
  const html = await res.text();
  for (const cls of ['class="app"', 'class="app-globalbar"', 'class="sidebar"', 'class="app-topbar"', 'class="app-content"']) {
    assert.ok(html.includes(cls), cls);
  }
  // サイドバーは目的の時系列: 作成 → 結果 → 実行記録 → 使い方
  const nav = ['#make', '#result', '#log', '#help'].map((h) => html.indexOf(`href="${h}"`));
  assert.ok(nav.every((i) => i > 0));
  assert.deepEqual([...nav].sort((x, y) => x - y), nav);
  for (const api of ['Feedback.busy(', 'Feedback.ok(', 'Feedback.error(', 'Feedback.emptyState(']) {
    assert.ok(html.includes(api), api);
  }
  assert.doesNotMatch(html, /id="error"|alert\(|https?:\/\/(?!github\.com\/owner)[a-z]/i);
  assert.match(html, /data-icon="[a-z-]+"[^>]*aria-hidden="true"/);
  assert.match(html, /\$\('run'\)\.setAttribute\('aria-busy'/);
  assert.doesNotMatch(html, /（任意）/);
});

test('トーストは基準の要素の近くに出し、狭い幅では折りたたみを外して開く', async () => {
  const html = await (await fetch(`${base}/`)).text();
  // 成功トーストは結果画面へ移ってから、移った先の要素を基準に出す
  // 成功は押した実行ボタンの近く（feedback.js の既定）。画面を移った後に基準を差し替えない
  const successBlock = html.slice(html.indexOf("go('result');"), html.indexOf("Feedback.ok('文書を作りました')"));
  assert.ok(successBlock.length > 0, '成功時の処理が見つかる');
  assert.doesNotMatch(successBlock, /anchorAt\(/);
  assert.match(html, /anchorAt\(\$\('run'\)\);\s*const done = Feedback\.busy\(/);
  // off-canvas（768px 以下）では collapsed を外し、広い幅に戻ったら保存した状態を戻す
  assert.match(html, /matchMedia\('\(max-width: 768px\)'\)/);
  assert.match(html, /const collapsed = !narrow\.matches && collapsedPref;/);
  assert.match(html, /narrow\.addEventListener\('change', applyLayout\)/);
});

test('次の操作（入力変更・タブ切替・デモ・実行）で前の失敗トーストを閉じ、作成画面の失敗は入力カードを覆わない位置に出す', async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /const dismissError = \(\) => \{ if \(closeLastError\) \{ closeLastError\(\); closeLastError = null; \} \};/);
  // 入力変更: フォーム内の入力（文字・チェック・ファイル）すべて
  assert.match(html, /\$\('run-form'\)\.addEventListener\('input', dismissError\);/);
  // タブ切替: select → resetFeedback → closeLastError
  const selectBlock = html.slice(html.indexOf('const select = (tab, focus) => {'), html.indexOf('tabs.forEach('));
  assert.match(selectBlock, /if \(!running\) resetFeedback\(\);/);
  assert.match(html, /t\.addEventListener\('click', \(\) => select\(t, false\)\);/);
  // デモのボタン
  assert.match(html, /b\.addEventListener\('click', \(\) => \{\s*dismissError\(\);/);
  // 実行: submit の先頭で resetFeedback
  assert.match(html, /if \(running\) return;\s*resetFeedback\(\);/);
  // 失敗の基準は実行ボタン、作成画面では下端に出して入力カードの操作部品に重ねない
  assert.match(html, /anchorAt\(\$\('view-make'\)\.hidden \? resultAnchor\(\) : \$\('run'\)\);\s*closeLastError = Feedback\.error\(/);
  // 作成画面の失敗は topbar の空いた中央に出す（下端だと設定カードの LLM スイッチを塞いだ。docs/verify/p4-browser-scenarios.md B-2）
  assert.match(html, /body:has\(#view-make:not\(\[hidden\]\)\) \.toast-host:has\(> \.toast-error\) \{ top: var\(--space-2\) !important; bottom: auto !important; left: 50% !important;/);
  assert.doesNotMatch(html, /\.toast-host:has\(> \.toast-error\) \{ top: auto !important; bottom:/);
});

test('ライト既定・kit の骨格どおりの見出しとカードで組む', async () => {
  const html = await (await fetch(`${base}/`)).text();
  // ライト既定（OS がダークでも）。保存したテーマがあればそれを使う
  assert.match(html, /<html lang="ja" data-theme="light">/);
  assert.match(html, /localStorage\.getItem\(THEME_KEY\)/);
  assert.match(html, /applyTheme\(savedTheme === 'dark' \? 'dark' : 'light'\)/);
  // globalbar に製品名、サイドバー上部は「メニュー」＋折りたたみ（demo-shell と同じ）
  assert.match(html, /id="menu"[\s\S]*?<\/button>\s*<span class="brand">Spec2Doc<\/span>/);
  assert.match(html, /<div class="sidebar-head"><span class="brand">メニュー<\/span><button[^>]*id="collapse"/);
  // fieldset/legend をやめ .card ＋ h2。除外は details で既定は閉じる。LLM の状態は文字で重ねない
  assert.doesNotMatch(html, /<fieldset|<legend/);
  for (const h of ['入力', '文書の種類', '設定']) assert.match(html, new RegExp(`<h2 id="h-[a-z]+">${h}</h2>`));
  assert.match(html, /<details id="exclude-box">\s*<summary>除外パターン<\/summary>/);
  assert.doesNotMatch(html, /（オフ）|llm-state/);
  // 文書の種類は 3 グループ＋すべて選ぶ／外す
  assert.match(html, /\['概要・要求', \['D01', 'D02', 'D03', 'D09'\]\], \['データ・連携', \['D04', 'D05', 'D06'\]\], \['設計・移行', \['D11', 'D12', 'D13', 'D07', 'D08'\]\]/);
  assert.match(html, /id="docs-all">すべて選ぶ</);
  assert.match(html, /id="docs-none">すべて外す</);
  // 本文だけスクロール
  assert.match(html, /\.app \{ height: 100dvh; grid-template-rows: auto minmax\(0, 1fr\); \}/);
});

test('メニューの開閉ボタンは 768px 以下だけに出す', async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /@media \(min-width: 769px\) \{ #menu \{ display: none; \} \}/);
  assert.match(html, /id="menu" type="button" aria-label="メニューを開く"/);
});

test('閲覧の CSP は sandbox allow-scripts と文書内 script の sha256 だけを許す', async () => {
  const script = 'document.body.dataset.ok = "1";';
  const hash = createHash('sha256').update(script, 'utf8').digest('base64');
  const res = await fetch(`${base}/view/${RUN_ID}/D03.html`);
  assert.equal(res.status, 200);
  const csp = res.headers.get('content-security-policy') ?? '';
  await res.body?.cancel();
  assert.match(csp, /^sandbox allow-scripts;/);
  assert.doesNotMatch(csp, /allow-same-origin|unsafe-inline'[^;]*;\s*style|script-src[^;]*unsafe/);
  assert.ok(csp.includes(`script-src 'sha256-${hash}';`), csp);
  assert.match(csp, /default-src 'none'/);
  assert.match(viewCsp('<p>no script</p>'), /script-src 'none'/);
});

test('結果は番号順・KPI 列・行ごとの開く／ダウンロード群、閲覧は全高の iframe', async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /\.sort\(\(x, y\) => x\.id\.localeCompare\(y\.id\)\)/);
  assert.match(html, /<div class="kpi-row" id="kpis"><\/div>/);
  for (const k of ['解析したファイル', '失敗', '除外', '所要時間']) assert.ok(html.includes(`kpi('${k}'`), k);
  assert.match(html, /\.table tbody th \{ background: transparent;/);
  assert.match(html, /textContent: '開く'/);
  assert.match(html, /を新しいタブで開く'\);\s*tab\.append\(icon\('open-in-new'/);
  assert.match(html, /<iframe id="frame" title="文書の表示" sandbox="allow-scripts"><\/iframe>/);
  assert.doesNotMatch(html, /allow-same-origin|id="viewer"/);
  assert.match(html, /<div class="breadcrumb" id="crumb" hidden><a href="#result">結果<\/a>/);
  assert.match(html, /#page-title:focus:not\(:focus-visible\) \{ outline: none; \}/);
});

test('出力形式にトレーサビリティ（既定オン）、結果にトレーサビリティのカード、入力にデモのボタンがある', async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /<input type="checkbox" id="f-trace" name="formats" value="trace" checked>HTML（トレーサビリティ）/);
  assert.match(html, /id="trace-card"[^>]*hidden/);
  assert.match(html, /id="trace-open"[^>]*target="_blank"/);
  assert.match(html, /<button type="button" class="btn" id="demo" hidden>デモのサンプルで試す<\/button>/);
});

test('GET /api/config はデモのフォルダがあれば絶対パス、無ければ null を返す', async () => {
  const demo = await mkdtemp(join(tmpdir(), 'spec2doc-demo-'));
  const cases: [string, string | null][] = [[demo, demo], [join(demo, 'no-such'), null]];
  try {
    for (const [dir, expected] of cases) {
      const s = createWebServer({ outDir, runner: fakeRunner, demoDir: dir });
      await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
      try {
        const res = await fetch(`http://127.0.0.1:${(s.address() as AddressInfo).port}/api/config`);
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { demoPath: expected });
      } finally {
        s.closeAllConnections();
        await new Promise<void>((r) => s.close(() => r()));
      }
    }
  } finally {
    await rm(demo, { recursive: true, force: true });
  }
});
