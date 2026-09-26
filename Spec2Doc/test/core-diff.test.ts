// REQ-F-035: 改版履歴「前回の生成から変わった節」。同じ入力元の直前の実行と節のハッシュで比べる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run, sourceKey } from '../src/core.ts';
import { applyRunDiff, diffSections, diffSummary, sectionDigests } from '../src/generate/index.ts';
import type { Document } from '../src/doc/model.ts';

const FIXTURE = resolve(import.meta.dirname, '../fixtures/sample-app');

function doc(sections: [string, string][]): Document {
  return {
    id: 'D01',
    title: '概要書',
    sections: [
      ...sections.map(([heading, text]) => ({ heading, level: 2 as const, blocks: [{ type: 'paragraph' as const, text, evidence: 'fact' as const, source: [] }] })),
      {
        heading: '改版履歴',
        level: 2,
        blocks: [{ type: 'table', columns: ['版', '生成日時', '入力コミット', '変更箇所'], rows: [{ cells: ['1', '2026-09-26T00:00:00.000Z', '（なし）', '初版'], evidence: 'fact', source: [] }] }],
      },
    ],
    revision: [{ generatedAt: '2026-09-26T00:00:00.000Z', changedSections: [] }],
  };
}

const revisionText = (d: Document): string => JSON.stringify(d.sections.at(-1));

test('節の追加・削除・変更を判定し、改版履歴は比較に含めない', () => {
  const before = sectionDigests(doc([['A', 'a'], ['B', 'b'], ['C', 'c']]));
  const after = sectionDigests(doc([['A', 'a'], ['B', 'b2'], ['D', 'd']]));
  assert.equal(Object.hasOwn(before, '改版履歴'), false);
  assert.deepEqual(diffSections(before, after), [
    { section: 'B', kind: 'changed' },
    { section: 'D', kind: 'added' },
    { section: 'C', kind: 'removed' },
  ]);
  assert.deepEqual(diffSections(before, before), []);
});

test('生成日時など指定した文字列は節のハッシュに影響しない', () => {
  const a = sectionDigests(doc([['A', '生成 2026-01-01T00:00:00.000Z']]), ['2026-01-01T00:00:00.000Z']);
  const b = sectionDigests(doc([['A', '生成 2026-02-02T00:00:00.000Z']]), ['2026-02-02T00:00:00.000Z']);
  assert.deepEqual(a, b);
});

test('行番号だけが違う節は「位置のみ変更」、見出しの行番号も伏せて同じ節として比べる', () => {
  const before = sectionDigests(doc([['F-001 無名関数（app.js:24）', '定義 app.js:24-30']]));
  const after = sectionDigests(doc([['F-001 無名関数（app.js:25）', '定義 app.js:25-31']]));
  assert.deepEqual(diffSections(before, after), [{ section: 'F-001 無名関数（app.js:#）', kind: 'moved' }]);
});

test('改版履歴に初回生成・前回から変更なし・変わった節を書く', () => {
  assert.equal(diffSummary(undefined), '初回生成');
  const first = applyRunDiff(doc([['A', 'a']]), undefined);
  assert.match(revisionText(first), /初回生成/);
  const same = applyRunDiff(doc([['A', 'a']]), { runId: 'R1', startedAt: '2026-09-25T00:00:00.000Z', version: 2, changes: [] });
  assert.match(revisionText(same), /前回から変更なし/);
  assert.match(revisionText(same), /R1/);
  assert.match(revisionText(same), /"cells":\["2",/);
  const changed = applyRunDiff(doc([['A', 'a']]), {
    runId: 'R1',
    startedAt: '2026-09-25T00:00:00.000Z',
    version: 3,
    changes: [{ section: 'A', kind: 'changed' }, { section: 'B', kind: 'moved' }],
  });
  assert.match(revisionText(changed), /変更 1 節（A）／位置のみ変更 1 節/);
  assert.match(revisionText(changed), /"cells":\["3",/);
  assert.deepEqual(changed.revision.at(-1)?.changedSections, ['A（変更）', 'B（位置のみ変更）']);
});

test('入力元キーは末尾の名前だけで、絶対パスを含めない', () => {
  assert.equal(sourceKey({ kind: 'folder', path: '/Users/x/work/sample-app' }), 'フォルダ: sample-app');
  assert.equal(sourceKey({ kind: 'github', url: 'https://github.com/owner/repo', ref: 'main' }), 'GitHub: owner/repo@main');
});

test('同じ入力元で 2 回実行すると前回から変更なし、1 行変えると変わった節が出る', async () => {
  const work = await mkdtemp(join(tmpdir(), 'spec2doc-diff-'));
  const src = join(work, 'sample-app');
  const outDir = join(work, 'out');
  await cp(FIXTURE, src, { recursive: true });
  const first = await run({ input: { kind: 'folder', path: src }, outDir });
  assert.equal(first.log.previous, undefined);
  assert.deepEqual(first.log.docChanges, {});
  assert.match(await readFile(join(first.outPath, 'D01.md'), 'utf8'), /初回生成/);

  const second = await run({ input: { kind: 'folder', path: src }, outDir });
  assert.equal(second.log.previous?.runId, first.runId);
  for (const [id, changes] of Object.entries(second.log.docChanges)) assert.deepEqual(changes, [], `${id} は変更なしのはず`);
  assert.equal(Object.keys(second.log.docChanges).length, second.log.settings.docIds.length);
  assert.match(await readFile(join(second.outPath, 'D01.md'), 'utf8'), /前回から変更なし/);

  assert.equal(second.log.docVersions.D01, 2);

  // 先頭に空行を 1 行足す: 内容の変更 0、位置のみ変更 > 0
  const app = join(src, 'app.js');
  await writeFile(app, `\n${await readFile(app, 'utf8')}`);
  const third = await run({ input: { kind: 'folder', path: src }, outDir });
  assert.equal(third.log.previous?.runId, second.runId);
  const shifted = Object.values(third.log.docChanges).flat();
  assert.deepEqual(shifted.filter((c) => c.kind !== 'moved'), [], '空行だけなら内容の変更は 0');
  assert.ok(shifted.some((c) => c.kind === 'moved'), '位置のみ変更が出る');

  // 関数を 1 行足す: 内容の変更が出る
  await writeFile(app, `${await readFile(app, 'utf8')}\nexport function addedForDiff(x) { return x + 1; }\n`);
  const fourth = await run({ input: { kind: 'folder', path: src }, outDir });
  assert.ok(Object.values(fourth.log.docChanges).flat().some((c) => c.kind !== 'moved'), '1 行変えたら内容の変わった節が出る');
  assert.equal(fourth.log.docVersions.D01, 4);
});
