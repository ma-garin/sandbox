// 検証の工程（src/verify）: 根拠位置を元のソースと照合し、不一致の行を不明に下げて D09・D08 に載せる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyIr, type FunctionInfo, type IR } from '../src/ir/schema.ts';
import type { Document, TableBlock } from '../src/doc/model.ts';
import { textIdentifiers, verifyDocuments } from '../src/verify/index.ts';

const SRC = [
  '// 蔵書の保存',
  'function saveBook(title) {',
  "  localStorage.setItem('books', title);",
  '}',
  '',
  '',
  '',
  '',
  '',
  'export { saveBook };',
  '',
].join('\n');

function fn(id: string, name: string): FunctionInfo {
  return { id, name, source: [{ file: 'src/app.js', line: 2 }] } as unknown as FunctionInfo;
}

function irFixture(): IR {
  const ir = emptyIr({ kind: 'folder', label: 'demo' }, '2026-01-01T00:00:00.000Z');
  return { ...ir, functions: [fn('FN-app-saveBook', 'saveBook'), fn('FN-app-deleteBook', 'deleteBook')] };
}

function docs(): Document[] {
  const d02: Document = {
    id: 'D02',
    title: '要求仕様書',
    revision: [],
    sections: [
      {
        heading: '1. 機能',
        level: 1,
        blocks: [
          {
            type: 'table',
            columns: ['機能', '関数'],
            rows: [
              { cells: ['保存', '`saveBook`'], evidence: 'fact', source: [{ file: 'src/app.js', line: 2 }], irIds: ['FN-app-saveBook'] },
              { cells: ['範囲外', '`saveBook`'], evidence: 'fact', source: [{ file: 'src/app.js', line: 99 }], irIds: ['FN-app-saveBook'] },
              { cells: ['差し替え', '`deleteBook`'], evidence: 'fact', source: [{ file: 'src/app.js', line: 2 }], irIds: ['FN-app-deleteBook'] },
              { cells: ['根拠なし', '-'], evidence: 'fact', source: [] },
            ],
          },
          { type: 'paragraph', text: '候補の無い行は位置だけ見る', evidence: 'fact', source: [{ file: 'src/app.js', line: 10 }] },
        ],
      },
    ],
  };
  const d08: Document = {
    id: 'D08',
    title: '解析カバレッジ・追跡レポート',
    revision: [],
    sections: [
      { heading: '1. 解析カバレッジ', level: 1, blocks: [] },
      { heading: '改版履歴', level: 1, blocks: [] },
    ],
  };
  const d09: Document = {
    id: 'D09',
    title: '確認事項一覧',
    revision: [],
    sections: [
      {
        heading: '1. 確認事項一覧',
        level: 1,
        blocks: [
          {
            type: 'table',
            columns: ['No.', '分類', '事項', '確認したいこと', '参照元の文書', '関連ID', '根拠位置'],
            rows: [{ cells: ['D09-1', 'その他', 'x', 'y', 'D02', '', ''], evidence: 'unknown', source: [], d09Ref: 'D09-1' }],
          },
        ],
      },
      { heading: '改版履歴', level: 1, blocks: [] },
    ],
  };
  return [d02, d08, d09];
}

const FILES = new Map([['src/app.js', SRC]]);

test('正しい行は一致し、範囲外の行と識別子を差し替えた行は不一致で不明に下がり D09 に載る', () => {
  const input = docs();
  const before = JSON.stringify(input);
  const r = verifyDocuments(input, irFixture(), FILES);
  assert.equal(JSON.stringify(input), before, '元の文書を変更しない');
  assert.deepEqual(r.counts, { checked: 4, matched: 2, mismatchLocation: 1, mismatchIdentifier: 1, skipped: 2 });

  const rows = (r.docs[0]?.sections[0]?.blocks[0] as TableBlock).rows;
  assert.equal(rows[0]?.evidence, 'fact');
  assert.equal(rows[0]?.d09Ref, undefined);
  assert.equal(rows[1]?.evidence, 'unknown');
  assert.equal(rows[1]?.d09Ref, 'D09-2');
  assert.equal(rows[2]?.evidence, 'unknown');
  assert.equal(rows[2]?.d09Ref, 'D09-3');
  assert.equal(rows[3]?.evidence, 'fact');

  const d09Rows = (r.docs[2]?.sections[0]?.blocks[0] as TableBlock).rows;
  assert.deepEqual(d09Rows.map((x) => x.cells[0]), ['D09-1', 'D09-2', 'D09-3']);
  assert.match(d09Rows[1]?.cells[3] ?? '', /照合で不一致（src\/app\.js:99/);
  assert.match(d09Rows[2]?.cells[3] ?? '', /照合で不一致（src\/app\.js:2 に deleteBook が見当たらない）/);
});

test('D08 の改版履歴の前に「照合の結果」が入り、不一致の一覧を載せる', () => {
  const r = verifyDocuments(docs(), irFixture(), FILES);
  const headings = r.docs[1]?.sections.map((s) => s.heading);
  assert.deepEqual(headings, ['1. 解析カバレッジ', '2. 照合の結果', '改版履歴']);
  const blocks = r.docs[1]?.sections[1]?.blocks ?? [];
  const list = blocks[2] as TableBlock;
  assert.equal(list.rows.length, 2);
  assert.deepEqual(list.rows.map((x) => x.cells[5]), ['D09-2', 'D09-3']);
});

test('入力に無いファイルは位置の不一致、本文の識別子は `xxx` と FN-…-name の末尾から取る', () => {
  const r = verifyDocuments(docs(), irFixture(), new Map());
  assert.equal(r.counts.mismatchLocation, 4);
  assert.deepEqual(textIdentifiers('関数 `saveBook` と FN-app.js-2-loadBooks'), ['saveBook', 'loadBooks']);
});

const SRC_B = [
  "const RECENT_KEY = 'recentSearches';",
  "const form = document.getElementById('loan-form');",
  '',
  'export function clearRecent() {',
  '  // a',
  '  // b',
  '  // c',
  '  // d',
  '  localStorage.removeItem(RECENT_KEY);',
  '}',
  '',
  '',
  '',
  '',
  '',
  "form.addEventListener('submit', handleLoan);",
  'function requestWithRetry(url) {',
  '  // 1',
  '  // 2',
  '  // 3',
  '  // 4',
  "  if (res.status === 401) throw new Error('x');",
  '}',
  '',
].join('\n');

function irB(): IR {
  const ir = emptyIr({ kind: 'folder', label: 'demo' }, '2026-01-01T00:00:00.000Z');
  const at = (line: number, endLine: number) => [{ file: 'src/b.js', line, endLine }];
  return {
    ...ir,
    functions: [
      { id: 'FN-b-clearRecent', name: 'clearRecent', source: at(4, 10) },
      { id: 'FN-b-requestWithRetry', name: 'requestWithRetry', source: at(17, 23) },
      { id: 'FN-app-deleteBook', name: 'deleteBook', source: [{ file: 'src/app.js', line: 2 }] },
    ] as unknown as FunctionInfo[],
    dataItems: [{ id: 'DATA-recent', name: 'recentSearches', source: [] }] as unknown as IR['dataItems'],
    uiElements: [{ id: 'UI-loan-form', domId: 'loan-form', source: [] }] as unknown as IR['uiElements'],
  };
}

test('定数経由・変数経由・関数途中の行は一致し、識別子を差し替えた行は不一致のまま。D09 の行は照合しない', () => {
  const at = (line: number) => [{ file: 'src/b.js', line }];
  const doc: Document = {
    id: 'D04',
    title: 'データ仕様書',
    revision: [],
    sections: [
      {
        heading: '1. 保存域',
        level: 1,
        blocks: [
          {
            type: 'table',
            columns: ['項目'],
            rows: [
              { cells: ['定数経由'], evidence: 'fact', source: at(9), irIds: ['DATA-recent'] },
              { cells: ['変数経由'], evidence: 'fact', source: at(16), irIds: ['UI-loan-form'] },
              { cells: ['関数途中'], evidence: 'fact', source: at(22), irIds: ['FN-b-requestWithRetry'] },
              { cells: ['差し替え'], evidence: 'fact', source: at(22), irIds: ['FN-app-deleteBook'] },
            ],
          },
        ],
      },
    ],
  };
  const d09: Document = {
    id: 'D09',
    title: '確認事項一覧',
    revision: [],
    sections: [
      {
        heading: '1. 確認事項一覧',
        level: 1,
        blocks: [
          {
            type: 'table',
            columns: ['No.', '分類', '事項', '確認したいこと', '参照元の文書', '関連ID', '根拠位置'],
            rows: [{ cells: ['D09-1', 'その他', 'x', 'y', 'D04', '', 'src/b.js:999'], evidence: 'unknown', source: at(999), d09Ref: 'D09-1' }],
          },
        ],
      },
    ],
  };
  const r = verifyDocuments([doc, d09], irB(), new Map([['src/b.js', SRC_B]]));
  assert.deepEqual(r.counts, { checked: 4, matched: 3, mismatchLocation: 0, mismatchIdentifier: 1, skipped: 1 });
  const rows = (r.docs[0]?.sections[0]?.blocks[0] as TableBlock).rows;
  assert.deepEqual(rows.map((x) => x.evidence), ['fact', 'fact', 'fact', 'unknown']);
  assert.equal(rows[3]?.d09Ref, 'D09-2');
  const d09Rows = (r.docs[1]?.sections[0]?.blocks[0] as TableBlock).rows;
  assert.equal(d09Rows[0]?.evidence, 'unknown');
  assert.equal(d09Rows[0]?.d09Ref, 'D09-1');
  assert.match(d09Rows[1]?.cells[3] ?? '', /src\/b\.js:22 に deleteBook が見当たらない/);
});
