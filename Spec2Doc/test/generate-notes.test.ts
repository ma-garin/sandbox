// 範囲の注記（先行研究の示唆）: D08「静的解析の限界」（Call Me Maybe, 2025）と設計意図の非復元の注記（Chikofsky & Cross, 1990）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyIr, type FunctionInfo, type IR, type Unknown } from '../src/ir/schema.ts';
import type { Block, Document, ParagraphBlock, TableBlock } from '../src/doc/model.ts';
import { generate } from '../src/generate/index.ts';
import { DESIGN_INTENT_NOTE, DYNAMIC_CALL_NOTE_SUFFIX, STATIC_LIMIT_HEADING, STATIC_LIMIT_NOTE } from '../src/generate/common.ts';
import { staticLimitCounts, staticLimits } from '../src/generate/d08.ts';
import type { LlmClient } from '../src/llm/index.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function fn(id: string, name: string, line: number, calls: string[], extra: Partial<FunctionInfo> = {}): FunctionInfo {
  return { id, source: [{ file: 'app.js', line, endLine: line + 3 }], name, moduleId: 'mod:app', params: [], complexity: 1, calls, exported: false, refCount: 1, async: false, throws: [], ...extra };
}

function sampleIr(): IR {
  const base = emptyIr({ kind: 'folder', label: 'notes' }, '2026-09-26T00:00:00.000Z');
  const unk = {
    id: 'UNK-1', source: [{ file: 'app.js', line: 40 }], evidence: 'unknown', topic: 'エラー「x」の発生条件', question: '到達しない可能性',
    relatedIds: [], category: 'unreachable-or-unknown-condition' as Unknown['category'],
  } as Unknown;
  return {
    ...base,
    files: [{ id: 'file:app.js', source: [], path: 'app.js', language: 'javascript', status: 'analyzed', lines: 60 }],
    modules: [{ id: 'mod:app', source: [{ file: 'app.js', line: 1 }], name: 'app', file: 'app.js', kind: 'script' }],
    functions: [
      fn('fn:main', 'main', 10, ['fn:calc', 'eval', 'cb', 'console.log']),
      fn('fn:calc', 'calc', 20, []),
      fn('fn:anon', '<anonymous@app.js:30>', 30, [], { refCount: 0 }),
    ],
    eventHandlers: [{ id: 'eh:1', source: [{ file: 'app.js', line: 5 }], target: '#go', event: 'click', handler: 'fn:main' }] as IR['eventHandlers'],
    unknowns: [unk, { ...unk, id: 'UNK-2', source: [{ file: 'app.js', line: 12 }], topic: 'eval', question: 'eval(s) の呼び出し先を静的解析で確定できない（実行時に決まる）', category: 'dynamic-call' as Unknown['category'] }],
  };
}

const paragraphs = (d: Document): ParagraphBlock[] =>
  d.sections.flatMap((s) => s.blocks.filter((b): b is ParagraphBlock => b.type === 'paragraph'));

function firstBlocks(d: Document): Block[] {
  return d.sections[0]?.blocks ?? [];
}

test('Given 解決できない呼び出し・コールバック・確定できない分岐 When D08 を作る Then 「静的解析の限界」に種類別の件数と場所が載り、冒頭に出典付きの 2 文がある', async () => {
  const ir = sampleIr();
  const limits = staticLimits(ir);
  assert.deepEqual(limits.map((l) => l.group), ['動的な呼び出し', '呼び出し先の未解決', '呼び出し元をたどれない関数', '確定できない分岐']);
  assert.ok(!limits.some((l) => l.where.includes('main → eval')), 'eval は dynamic-call の 1 件だけ（呼び出し先の名前から二重に数えない）');
  const [d08] = await generate(ir, ['D08']);
  const s = d08!.sections.find((x) => x.heading === STATIC_LIMIT_HEADING);
  assert.ok(s, '節がある');
  const note = s.blocks[0];
  assert.ok(note?.type === 'paragraph' && note.text === STATIC_LIMIT_NOTE && note.text.includes('Call Me Maybe') && note.text.includes('2025'));
  const t = s.blocks.find((b): b is TableBlock => b.type === 'table');
  assert.ok(t);
  const evalRow = t.rows.find((r) => r.cells[0] === '動的な呼び出し' && r.cells[1] === 'eval');
  assert.equal(evalRow?.cells[2], '1');
  assert.ok(evalRow?.cells[3]?.includes('app.js:12'));
  assert.ok(t.rows.find((r) => r.cells[0] === '呼び出し先の未解決')?.cells[3]?.includes('app.js:10（main → cb）'));
  assert.ok(!t.rows.some((r) => r.cells[3]?.includes('console.log')), '標準 API は含まない');
  assert.ok(t.rows.find((r) => r.cells[0] === '確定できない分岐')?.cells[3]?.includes('app.js:40'));
});

test('Given 呼び出し関係図 When D12 を作る Then 図の直後に D08 の件数付きの注記がある', async () => {
  const ir = sampleIr();
  const [d12] = await generate(ir, ['D12']);
  const blocks = d12!.sections.flatMap((s) => s.blocks);
  const i = blocks.findIndex((b) => b.type === 'diagram');
  assert.ok(i >= 0);
  const next = blocks[i + 1];
  assert.deepEqual(staticLimitCounts(ir), { dynamic: 1, untraced: 1 });
  assert.ok(next?.type === 'paragraph' && next.text === `図は次を含まない: 動的な呼び出し 1 件・呼び出し元をたどれない関数 1 件${DYNAMIC_CALL_NOTE_SUFFIX}`);
});

const mockLlm: LlmClient = {
  enabled: true,
  explain: async (req) => ({ text: `${req.targetId} の説明`, evidence: 'inference', source: [{ file: 'app.js', line: 10 }] }),
  usage: () => ({ inputTokens: 0, outputTokens: 0, requests: 0, sentFiles: [] }),
};

for (const [label, opts] of [['LLM 無効', {}], ['LLM 有効', { llm: mockLlm }]] as const) {
  test(`Given ${label} When D01・D02・D11・D12 を作る Then 冒頭の節に設計意図の注記が 1 回あり、link にならない根拠を持つ`, async () => {
    const docs = await generate(sampleIr(), ['D01', 'D02', 'D11', 'D12'], opts);
    for (const d of docs) {
      const notes = paragraphs(d).filter((p) => p.text === DESIGN_INTENT_NOTE);
      assert.equal(notes.length, 1, d.id);
      assert.ok(firstBlocks(d).some((b) => b.type === 'paragraph' && b.text === DESIGN_INTENT_NOTE), `${d.id} の冒頭`);
      const n = notes[0]!;
      assert.equal(n.evidence, 'fact');
      assert.deepEqual(n.source, []);
      assert.equal(n.irIds, undefined);
      assert.equal(n.d09Ref, undefined);
      assert.ok(n.text.includes('Chikofsky') && n.text.includes('1990'));
    }
  });
}

function runCli(args: string[]): Promise<number> {
  return new Promise((done) => {
    execFile(process.execPath, ['src/cli.ts', ...args], { cwd: ROOT, timeout: 60_000 }, (err) => done(err ? (typeof err.code === 'number' ? err.code : -1) : 0));
  });
}

function findDoc(dir: string, doc: string): string {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const found = findDoc(p, doc);
      if (found) return found;
    } else if (e.name.startsWith(doc) && e.name.endsWith('.md')) return readFileSync(p, 'utf8');
  }
  return '';
}

test('Given デモ用サンプル When D01・D08・D11 を出す Then D08 に「静的解析の限界」の表が 1 行以上、D01・D11 に注記がある', async () => {
  const out = mkdtempSync(join(tmpdir(), 'spec2doc-notes-'));
  try {
    assert.equal(await runCli(['--folder', 'fixtures/demo-library', '--out', out, '--docs', 'D01,D08,D11', '--format', 'md']), 0);
    const d08 = findDoc(out, 'D08');
    const sec = d08.split(STATIC_LIMIT_HEADING)[1] ?? '';
    const tableRows = sec.split('\n').filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l)).slice(1);
    assert.ok(tableRows.length >= 1, `表の行: ${tableRows.length}`);
    assert.ok(tableRows.some((l) => l.includes('動的な呼び出し') && l.includes('obj[key]()')) && tableRows.some((l) => l.includes('動的 import')));
    assert.ok(findDoc(out, 'D01').includes('設計の意図・業務上の背景'));
    const d11 = findDoc(out, 'D11');
    assert.ok(d11.includes('設計の意図・業務上の背景') && d11.includes(DYNAMIC_CALL_NOTE_SUFFIX));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
