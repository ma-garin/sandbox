// 改修 F: D08 冒頭の「確度のまとめ」「自動度」。文書ごとの件数・割合、不明の多い節、節ごとの自動度。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyIr } from '../src/ir/schema.ts';
import type { Document, Provenance, TableBlock } from '../src/doc/model.ts';
import { D09Registry, type GenCtx } from '../src/generate/common.ts';
import { disabledLlm } from '../src/llm/index.ts';
import { buildD08, summarySections } from '../src/generate/d08.ts';

const fact: Provenance = { evidence: 'fact', source: [{ file: 'a.ts', line: 1 }] };
const llm: Provenance = { evidence: 'inference', source: [], origin: 'llm' };
const ana: Provenance = { evidence: 'inference', source: [], origin: 'analysis' };
const unk: Provenance = { evidence: 'unknown', source: [], d09Ref: 'D09-1' };
const rows = (ps: Provenance[]) => ({ type: 'table' as const, columns: ['x'], rows: ps.map((p, i) => ({ cells: [String(i)], ...p })) });

function docs(): Document[] {
  return [
    {
      id: 'D02', title: 't', revision: [],
      sections: [
        { heading: '機能一覧', level: 2, blocks: [rows([fact, fact, fact])] },
        { heading: '説明', level: 2, blocks: [rows([fact, llm, ana]), { type: 'paragraph', text: 'p', ...unk }] },
        { heading: '改版履歴', level: 2, blocks: [rows([unk, unk])] },
      ],
    },
    {
      id: 'D05', title: 't', revision: [],
      sections: [{ heading: '業務ルール', level: 2, blocks: [{ type: 'list', ordered: false, items: [{ text: 'a', ...unk, children: [{ text: 'b', ...unk }] }] }] }],
    },
  ];
}

const tables = (s: { blocks: unknown[] }) => s.blocks.filter((b): b is TableBlock => (b as TableBlock).type === 'table');

test('Given 2 文書 When まとめる Then 文書ごとに行数と 事実/推測（LLM）/推測（解析）/不明 の件数と割合が出る', () => {
  const [conf] = summarySections(docs());
  assert.equal(conf!.heading, '確度のまとめ');
  const [perDoc] = tables(conf!);
  assert.deepEqual(perDoc!.columns, ['文書ID', '行数', '事実', '推測（LLM）', '推測（解析）', '不明']);
  assert.deepEqual(perDoc!.rows[0]!.cells, ['D02', '7', '4（57.1%）', '1（14.3%）', '1（14.3%）', '1（14.3%）']); // 改版履歴は数えない
  assert.deepEqual(perDoc!.rows[1]!.cells, ['D05', '2', '0（0.0%）', '0（0.0%）', '0（0.0%）', '2（100.0%）']); // 入れ子の箇条も数える
});

test('Given 不明を含む節 When まとめる Then 不明の多い順に上位の節が出る（不明 0 の節は出ない）', () => {
  const [conf] = summarySections(docs());
  const top = tables(conf!)[1]!;
  assert.deepEqual(top.rows.map((r) => r.cells), [
    ['D05', '業務ルール', '2', '2', '100.0%'],
    ['D02', '説明', '1', '4', '25.0%'],
  ]);
});

test('Given 7 節が不明を持つ When まとめる Then 上位 5 節に絞る', () => {
  const many: Document = { id: 'D04', title: 't', revision: [], sections: Array.from({ length: 7 }, (_, i) => ({ heading: `節${i}`, level: 2 as const, blocks: [rows(Array(i + 1).fill(unk))] })) };
  const top = tables(summarySections([many])[0]!)[1]!;
  assert.deepEqual(top.rows.map((r) => r.cells[1]), ['節6', '節5', '節4', '節3', '節2']);
});

test('Given 全事実・混在・全不明の節 When まとめる Then 自動度は 自動・半自動・対象外', () => {
  const auto = summarySections(docs())[1]!;
  assert.equal(auto.heading, '自動度');
  const cells = tables(auto)[0]!.rows.map((r) => [r.cells[0], r.cells[1], r.cells[2]]);
  assert.deepEqual(cells, [
    ['D02', '機能一覧', '自動（ソースから確定）'],
    ['D02', '説明', '半自動（推測を含む。人の確認が要る）'],
    ['D05', '業務ルール', '対象外（ソースから作れない。D09 へ）'],
  ]);
});

test('Given IR When D08 を作る Then 冒頭 2 節が 確度のまとめ・自動度 で、D08 のみの集計である旨を注記する', async () => {
  const ctx: GenCtx = { llm: disabledLlm, d09: new D09Registry(), generatedAt: '2026-09-26T00:00:00Z' };
  const ir = emptyIr({ kind: 'folder', label: 's' }, '2026-09-26T00:00:00Z');
  const d = await buildD08({ ...ir, files: [{ id: 'file:a.ts', path: 'a.ts', language: 'typescript', status: 'analyzed', lines: 3, source: [{ file: 'a.ts', line: 1 }] }] }, ctx);
  assert.deepEqual(d.sections.slice(0, 2).map((s) => s.heading), ['確度のまとめ', '自動度']);
  const note = d.sections[0]!.blocks[0]!;
  assert.ok(note.type === 'paragraph' && note.text.includes('他の文書の件数は含まない'));
  const perDoc = tables(d.sections[0]!)[0]!;
  assert.equal(perDoc.rows[0]!.cells[0], 'D08');
  const autoHeads = tables(d.sections[1]!)[0]!.rows.map((r) => r.cells[1]);
  assert.ok(autoHeads.includes('ファイル別の解析結果') && !autoHeads.includes('改版履歴'));
});
