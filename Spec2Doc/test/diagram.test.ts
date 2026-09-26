import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DiagramBlock, Document } from '../src/doc/model.ts';
import { isStandardApiCall } from '../src/generate/d12.ts';
import { assignLayers, diagramEdgeRows, EXTERNAL_GROUP, fitLabel, MAX_DIAGRAM_NODES, NODE_W_MAX, NODE_W_MIN, renderDiagramMermaid, renderDiagramSvg, TRUNCATION_NOTE } from '../src/render/diagram.ts';
import { render } from '../src/render/index.ts';

const prov = { evidence: 'fact' as const, source: [{ file: 'a.ts', line: 1 }], irIds: [] };

function block(nodes: string[], edges: [string, string, string?][]): DiagramBlock {
  return {
    type: 'diagram',
    title: '図',
    diagramType: 'flow',
    nodes: nodes.map((id) => ({ id, label: `名前${id}` })),
    edges: edges.map(([from, to, label]) => ({ from, to, ...(label ? { label } : {}) })),
    provenance: prov,
  };
}

const count = (text: string, needle: string): number => text.split(needle).length - 1;

test('段は最長経路で決まる（a→b→c と a→c なら c は段 2）', () => {
  const b = block(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['a', 'c']]);
  const layer = assignLayers(b.nodes, b.edges);
  assert.deepEqual([layer.get('a'), layer.get('b'), layer.get('c'), layer.get('d')], [0, 1, 2, 0]);
});

test('閉路と自己ループがあっても段が決まる', () => {
  const b = block(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['c', 'a'], ['b', 'b']]);
  const layer = assignLayers(b.nodes, b.edges);
  assert.deepEqual([layer.get('a'), layer.get('b'), layer.get('c')], [0, 1, 2]);
});

test('SVG はノードごとに矩形、辺ごとに矢印を持ち、色は kit のトークンだけを使う', () => {
  const svg = renderDiagramSvg(block(['a', 'b', 'c'], [['a', 'b', '押下'], ['a', 'c'], ['x', 'a']]));
  assert.match(svg, /^<svg /);
  assert.equal(count(svg, '<rect '), 3);
  assert.equal(count(svg, 'marker-end='), 2, '端が存在しない辺は描かない');
  assert.doesNotMatch(svg, /#[0-9a-fA-F]{3,6}\b(?![^<]*<\/title>)/, '色の直値を使わない');
  assert.match(svg, /var\(--color-/);
  assert.ok(!svg.includes(TRUNCATION_NOTE));
});

test('ラベルはエスケープされる', () => {
  const b = { ...block(['a'], []), nodes: [{ id: 'a', label: '<script>' }] };
  assert.ok(!renderDiagramSvg(b).includes('<script>'));
});

test(`ノードが ${MAX_DIAGRAM_NODES} を超えたら上位だけ描き、注記を付ける`, () => {
  const ids = Array.from({ length: 45 }, (_, i) => `n${i}`);
  const edges = ids.slice(1).map((id): [string, string] => ['n0', id]);
  const b = block(ids, edges);
  const svg = renderDiagramSvg(b);
  assert.equal(count(svg, '<rect '), MAX_DIAGRAM_NODES);
  assert.ok(svg.includes(TRUNCATION_NOTE));
  assert.ok(svg.includes('名前n0'), '次数の最も多いノードは残る');
  const md = renderDiagramMermaid(b);
  assert.equal(count(md, '["'), MAX_DIAGRAM_NODES);
  assert.equal(diagramEdgeRows(b).length, 44, '辺の一覧は全件');
});

test('mermaid は flowchart のコードブロックで、辺のラベルを持つ', () => {
  const md = renderDiagramMermaid(block(['a-1', 'b'], [['a-1', 'b', '送信']]));
  assert.match(md, /^```mermaid\nflowchart LR\n/);
  assert.match(md, /n0_a_1 -->\|"送信"\| n1_b/);
  assert.match(md, /```$/);
});

test('辺の一覧は接続のないノードも 1 行出す', () => {
  assert.deepEqual(diagramEdgeRows(block(['a', 'b', 'c'], [['a', 'b', 'x']])), [
    ['名前a', '名前b', 'x'],
    ['名前c', '—', '（接続なし）'],
  ]);
});

test('4 形式で図を出す（html は SVG、md は mermaid、docx・xlsx は辺の一覧）', async () => {
  const doc: Document = {
    id: 'D11',
    title: '基本設計書',
    sections: [{ heading: 'アーキテクチャ', level: 2, blocks: [block(['a', 'b'], [['a', 'b']])] }],
    revision: [],
  };
  const out = await Promise.all((['html', 'md', 'docx', 'xlsx'] as const).map((f) => render(doc, f)));
  const [html, md, docx, xlsx] = out.map((o) => (typeof o === 'string' ? o : Buffer.from(o as Uint8Array)));
  assert.match(String(html), /<figure class="diagram-wrap"><figcaption>図.*<svg /s);
  assert.match(String(md), /```mermaid\nflowchart LR/);
  assert.ok(Buffer.isBuffer(docx) && docx.length > 0);
  assert.ok(Buffer.isBuffer(xlsx) && xlsx.length > 0);
});

test('ノード幅はラベルに合わせて広がり、上限を超えるときだけ省略して全文を title に出す', () => {
  assert.deepEqual(fitLabel('abc'), { w: NODE_W_MIN, text: 'abc' });
  const mid = fitLabel('#calc-button の click');
  assert.equal(mid.text, '#calc-button の click');
  assert.ok(mid.w >= NODE_W_MIN && mid.w <= NODE_W_MAX);
  const long = 'x'.repeat(80);
  const fitted = fitLabel(long);
  assert.equal(fitted.w, NODE_W_MAX);
  assert.match(fitted.text, /…$/);
  const b = { ...block(['a'], []), nodes: [{ id: 'a', label: long }, { id: 'b', label: 'makeReservation' }] };
  const svg = renderDiagramSvg(b);
  assert.ok(svg.includes(`<title>${long}</title>`), '省略しても全文は title にある');
  assert.ok(svg.includes('>makeReservation</text>'), '上限内のラベルは省略しない');
  const widths = [...svg.matchAll(/<rect [^>]*width="(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(widths.length === 2 && Math.max(...widths) <= NODE_W_MAX, 'ノード幅は上限以内');
});

test('画面外のノードは点線で描き、mermaid でも点線にする。自己ループの辺も描く', () => {
  const b = { ...block(['s'], [['s', 's', '予約する（画面内で処理）'], ['s', 'ext:help.html']]), nodes: [{ id: 's', label: 'S-001' }, { id: 'ext:help.html', label: 'help.html', group: EXTERNAL_GROUP }] };
  const svg = renderDiagramSvg(b);
  assert.equal(count(svg, 'stroke-dasharray'), 1);
  assert.equal(count(svg, 'marker-end='), 2);
  assert.match(renderDiagramMermaid(b), /style n1_ext_help_html stroke-dasharray/);
});

test('html の図の見出しはソース位置を先頭 5 件＋「他 n 件」にする', async () => {
  const many = { ...block(['a'], []), provenance: { ...prov, source: Array.from({ length: 25 }, (_, i) => ({ file: 'a.ts', line: i + 1 })) } };
  const doc: Document = { id: 'D12', title: '詳細設計書', sections: [{ heading: '呼び出し', level: 2, blocks: [many] }], revision: [] };
  const html = String(await render(doc, 'html'));
  assert.ok(html.includes('a.ts:5, 他 20 件（全件は下の表）'));
  assert.ok(!html.includes('a.ts:6'));
});

test('標準 API（組み込み・DOM・Web API）の呼び出しを見分け、自前の関数名は標準に数えない', () => {
  for (const c of ['document.getElementById', 'Number', '[0, 6].includes', 'new Date().getDay', 'errors.push', 'res.json', 'status.classList.add', '/^a$/.test', 'fetch', 'JSON.parse']) {
    assert.ok(isStandardApiCall(c), c);
  }
  for (const c of ['makeReservation', 'helper.doWork', 'unknownFn']) assert.ok(!isStandardApiCall(c), c);
  assert.ok(!isStandardApiCall('store.render', new Set(['render'])), '同名の自前関数があれば未解決に残す');
});
