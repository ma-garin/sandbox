// REQ-F-005・007・008・010・015・033・037: sample-app の HTML・CSS・package.json から IR が取れること
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { analyze } from '../src/analyze/index.ts';
import type { IR } from '../src/ir/schema.ts';
import type { ScreenWithHeadings } from '../src/analyze/html.ts';
import type { MergedDependency } from '../src/analyze/deps.ts';

const FIXTURE = resolve(import.meta.dirname, '../fixtures/sample-app');

async function analyzeFixture(): Promise<IR> {
  const names = (await readdir(FIXTURE)).sort();
  return analyze(names.map((n) => ({ path: n, abs: join(FIXTURE, n) })), FIXTURE, { generatedAt: '2026-01-01T00:00:00.000Z' });
}

const byDomId = (ir: IR, domId: string) => {
  const el = ir.uiElements.find((u) => u.domId === domId);
  assert.ok(el, `部品 #${domId} が無い`);
  return el;
};

test('HTML: 画面と画面部品（ラベル・種類・制約属性・遷移先）が取れる', async () => {
  const ir = await analyzeFixture();
  assert.equal(ir.screens.length, 1);
  const screen = ir.screens[0]!;
  assert.equal(screen.title, '入場券予約');
  assert.equal(screen.file, 'index.html');

  const age = byDomId(ir, 'age');
  assert.equal(age.label, '年齢');
  assert.equal(age.kind, 'input');
  assert.deepEqual(age.constraints, { type: 'number', required: 'true', min: '0', max: '119', step: '1' });
  assert.equal(age.source[0]!.line, 20);
  assert.equal(age.evidence, 'fact');

  assert.equal(byDomId(ir, 'ticket-type').kind, 'select');
  assert.equal(byDomId(ir, 'ticket-type').constraints['options'], 'day,night,annual');
  assert.equal(byDomId(ir, 'coupon').constraints['pattern'], '[A-Z0-9]{8}');
  assert.equal(byDomId(ir, 'submit-button').navigatesTo, '#');
  assert.equal(byDomId(ir, 'submit-button').label, '予約する');
  assert.equal(byDomId(ir, 'calc-button').navigatesTo, undefined);
  assert.equal(byDomId(ir, 'help-link').navigatesTo, 'help.html');
  assert.equal(byDomId(ir, 'help-link').kind, 'link');
  assert.equal(byDomId(ir, 'error-message').kind, 'output');

  const inputs = ir.uiElements.filter((u) => u.kind === 'input' || u.kind === 'select');
  assert.equal(inputs.length, 6);
  assert.equal(ir.uiElements.filter((u) => u.kind === 'button').length, 2);
  for (const u of ir.uiElements) assert.ok(screen.elementIds.includes(u.id));
  assert.equal(new Set(ir.uiElements.map((u) => u.id)).size, ir.uiElements.length);
});

test('HTML: 制約属性から境界（含む/含まない・内側例・外側例）と既定値が取れる', async () => {
  const ir = await analyzeFixture();
  const age = byDomId(ir, 'age');
  const ageB = ir.boundaries.filter((b) => b.uiElementId === age.id);
  const lower = ageB.find((b) => b.bound === 'lower')!;
  const upper = ageB.find((b) => b.bound === 'upper')!;
  assert.deepEqual([lower.value, lower.inclusive, lower.insideExample, lower.outsideExample], ['0', true, '0', '-1']);
  assert.deepEqual([upper.value, upper.inclusive, upper.insideExample, upper.outsideExample], ['119', true, '119', '120']);

  const nameLen = ir.boundaries.find((b) => b.uiElementId === byDomId(ir, 'name').id && b.bound === 'length')!;
  assert.deepEqual([nameLen.value, nameLen.unit, nameLen.insideExample, nameLen.outsideExample], ['40', '文字', '40文字', '41文字']);

  const coupon = ir.boundaries.find((b) => b.uiElementId === byDomId(ir, 'coupon').id && b.bound === 'pattern')!;
  assert.match(coupon.insideExample, /^[A-Z0-9]{8}$/);
  assert.doesNotMatch(coupon.outsideExample, /^[A-Z0-9]{8}$/);
  const email = ir.boundaries.find((b) => b.uiElementId === byDomId(ir, 'email').id && b.bound === 'pattern')!;
  assert.match(email.insideExample, /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);

  const qtyDefault = ir.defaults.find((d) => d.uiElementId === byDomId(ir, 'qty').id);
  assert.equal(qtyDefault?.value, '1');
  assert.equal(qtyDefault?.subject, '数量');
});

test('CSS: メディアクエリの境界幅と状態クラスの表示規則が取れる', async () => {
  const ir = await analyzeFixture();
  const media = ir.cssRules.filter((r) => r.kind === 'media');
  assert.deepEqual(
    media.map((r) => r.media),
    [
      { feature: 'max-width', value: '767px', inclusive: true },
      { feature: 'min-width', value: '1200px', inclusive: true },
    ],
  );
  assert.equal(media[0]!.declarations['#help-link { display }'], 'none');

  const shown = ir.cssRules.find((r) => r.kind === 'stateClass' && r.className === 'is-error' && r.selector === '.error-message.is-error');
  assert.equal(shown?.effect, 'show');
  assert.equal(shown?.source[0]!.line, 4);
  assert.equal(ir.cssRules.find((r) => r.className === 'is-hidden')?.effect, 'hide');
  assert.equal(ir.cssRules.find((r) => r.className === 'is-loading')?.effect, 'other');
});

test('依存: package.json の dependencies/devDependencies と CDN script が取れる', async () => {
  const ir = await analyzeFixture();
  const deps = ir.dependencies as MergedDependency[];
  assert.deepEqual(deps.map((d) => d.name).sort(), ['dayjs', 'typescript']);
  const dayjs = deps.find((d) => d.name === 'dayjs')!;
  assert.equal(dayjs.loadedFrom, 'package.json');
  assert.deepEqual(dayjs.origins.map((o) => [o.loadedFrom, o.version, o.url ?? null]), [
    ['package.json', '^1.11.10', null],
    ['cdn', '1.11.10', 'https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js'],
  ]);
  assert.deepEqual(dayjs.versions, ['^1.11.10', '1.11.10']);
  assert.equal(dayjs.version, '^1.11.10 / 1.11.10');
  assert.deepEqual(dayjs.source.map((s) => s.file).sort(), ['index.html', 'package.json']);
  const ts = deps.find((d) => d.name === 'typescript')!;
  assert.deepEqual([ts.version, ts.loadedFrom, ts.origins.length], ['^5.4.0', 'package.json(dev)', 1]);
  for (const d of deps) assert.ok(d.id && d.source[0]!.line > 0);
});

test('HTML: 単位不明の数値境界は画面ごとに 1 件の確認事項へ集約し、h1〜h3 の見出しを画面に残す', async () => {
  const ir = await analyzeFixture();
  const unit = ir.unknowns.filter((u) => u.category === 'unit-unknown');
  // 画面・ファイルごとに 1 件（REQ-F-025）。同じ根拠位置を 2 件の確認事項に積まない
  const perFile = new Map<string, number>();
  for (const u of unit) for (const f of new Set(u.source.map((s) => s.file))) perFile.set(f, (perFile.get(f) ?? 0) + 1);
  for (const [f, n] of perFile) assert.equal(n, 1, `${f} の単位不明が ${n} 件`);
  const htmlUnit = unit.filter((u) => u.source.every((s) => s.file === 'index.html'));
  assert.equal(htmlUnit.length, 1);
  assert.deepEqual([...htmlUnit[0]!.relatedIds].sort(), [byDomId(ir, 'age').id, byDomId(ir, 'qty').id].sort());
  const screen = ir.screens[0] as ScreenWithHeadings;
  assert.deepEqual(screen.headings, [{ level: 1, text: '入場券予約', line: 11 }]);
});

test('HTML 内の script・style を解析し、位置を元の HTML の行に直す', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spec2doc-inline-'));
  try {
    const html = [
      '<title>P</title>',
      '<style>',
      '.box { color: red; }',
      '@media (max-width: 599px) {',
      '  .box.is-open { display: block; }',
      '}',
      '</style>',
      '<script type="application/ld+json">{"a":1}</script>',
      '<script>',
      'function hello() { return 1; }',
      '</script>',
    ].join('\n');
    await writeFile(join(dir, 'page.html'), html);
    const ir = await analyze([{ path: 'page.html', abs: join(dir, 'page.html') }], dir);
    assert.equal(ir.files[0]!.status, 'analyzed');
    assert.equal(ir.files.length, 1);
    const media = ir.cssRules.find((r) => r.kind === 'media')!;
    assert.deepEqual([media.media?.value, media.source[0]!.file, media.source[0]!.line], ['599px', 'page.html', 4]);
    const open = ir.cssRules.find((r) => r.className === 'is-open')!;
    assert.deepEqual([open.effect, open.source[0]!.line], ['show', 5]);
    assert.doesNotMatch(JSON.stringify(ir), /"file":"page\.html#/);
    const hello = ir.functions.find((f) => f.name === 'hello');
    assert.ok(hello, 'HTML 内 script の関数 hello が取れる');
    assert.deepEqual([hello.source[0]!.file, hello.source[0]!.line], ['page.html', 10]);
    assert.ok(ir.modules.some((m) => m.file === 'page.html'));
    assert.equal(ir.unknowns.filter((u) => u.category === 'parse-failure').length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('files: 未対応言語は unsupported、壊れたファイルは failed で、全体は止まらない', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spec2doc-markup-'));
  try {
    await writeFile(join(dir, 'a.css'), '.x { color: red');
    await writeFile(join(dir, 'b.java'), 'class B {}');
    await writeFile(join(dir, 'c.html'), '<title>C</title><input id="q" maxlength="3">');
    await writeFile(join(dir, 'package.json'), '{ broken');
    const names = ['a.css', 'b.java', 'c.html', 'package.json'];
    const ir = await analyze(names.map((n) => ({ path: n, abs: join(dir, n) })), dir);
    const status = Object.fromEntries(ir.files.map((f) => [f.path, f.status]));
    assert.deepEqual(status, { 'a.css': 'failed', 'b.java': 'unsupported', 'c.html': 'analyzed', 'package.json': 'failed' });
    assert.equal(ir.files.find((f) => f.path === 'b.java')?.reason, '対象外（未対応言語）');
    assert.equal(ir.boundaries.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('ID は同じ入力なら実行をまたいで同じ', async () => {
  const a = await analyzeFixture();
  const b = await analyzeFixture();
  assert.deepEqual(a.uiElements.map((u) => u.id), b.uiElements.map((u) => u.id));
  assert.deepEqual(a.cssRules.map((u) => u.id), b.cssRules.map((u) => u.id));
});
