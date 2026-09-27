// ReqIF 1.2 の書き出し（最小構成）。文書の行とソース要素を SPEC-OBJECT、対応を LINK_KIND ごとの SPEC-RELATION にする。
// 値はすべて XML エスケープする。識別子は xsd:ID に使える文字だけで作る。
import { createHash } from 'node:crypto';
import { LINK_KIND_LABEL, REVIEW_STATUS_LABEL, SUSPECT_REASON_LABEL, type LinkKind, type TraceGraph, type TraceLink, type TraceReview } from './schema.ts';

const XML_INVALID = /[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu;

export function xmlEscape(text: string): string {
  return text
    .replace(XML_INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

const hid = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 16);
const rowId = (linkId: string): string => `ROW-${hid(linkId)}`;
const srcId = (nodeId: string): string => `SRC-${hid(nodeId)}`;

const ROW_ATTRS = [
  ['AD-ROW-TEXT', '記述'],
  ['AD-ROW-DOC', '文書'],
  ['AD-ROW-SECTION', '節'],
  ['AD-ROW-KIND', '種類'],
  ['AD-ROW-EVIDENCE', '根拠'],
  ['AD-ROW-STATUS', '状態'],
  ['AD-ROW-REVIEWER', '確認者'],
  ['AD-ROW-REVIEWED-AT', '確認日時'],
  ['AD-ROW-SUSPECT', '要確認'],
  ['AD-ROW-LINK-ID', 'Spec2Doc の行 ID'],
] as const;
const SRC_ATTRS = [
  ['AD-SRC-NAME', '名前'],
  ['AD-SRC-KIND', '種類'],
  ['AD-SRC-PATH', '位置'],
] as const;

function attrDef(id: string, name: string, at: string): string {
  return `<ATTRIBUTE-DEFINITION-STRING IDENTIFIER="${id}" LAST-CHANGE="${at}" LONG-NAME="${xmlEscape(name)}"><TYPE><DATATYPE-DEFINITION-STRING-REF>DT-STRING</DATATYPE-DEFINITION-STRING-REF></TYPE></ATTRIBUTE-DEFINITION-STRING>`;
}

function value(def: string, text: string): string {
  return `<ATTRIBUTE-VALUE-STRING THE-VALUE="${xmlEscape(text)}"><DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>${def}</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION></ATTRIBUTE-VALUE-STRING>`;
}

function specObject(id: string, type: string, at: string, values: readonly string[]): string {
  return `<SPEC-OBJECT IDENTIFIER="${id}" LAST-CHANGE="${at}"><VALUES>${values.join('')}</VALUES><TYPE><SPEC-OBJECT-TYPE-REF>${type}</SPEC-OBJECT-TYPE-REF></TYPE></SPEC-OBJECT>`;
}

/** 行の根拠になるソース要素の nodeId（IR の要素と根拠のファイル。グラフに点があるものだけ） */
function targetsOf(l: TraceLink, nodes: ReadonlySet<string>): string[] {
  const ids = [...l.irIds.map((id) => `code:${id}`), ...l.sources.map((s) => `file:${s.file}`)];
  return [...new Set(ids)].filter((id) => nodes.has(id));
}

function rowObject(l: TraceLink, review: TraceReview, at: string): string {
  const r = Object.hasOwn(review.reviews, l.id) ? review.reviews[l.id] : undefined;
  const kind: LinkKind = l.kind ?? 'describes';
  const vals = [
    value('AD-ROW-TEXT', l.summary),
    value('AD-ROW-DOC', l.docId),
    value('AD-ROW-SECTION', l.section),
    value('AD-ROW-KIND', LINK_KIND_LABEL[kind]),
    value('AD-ROW-EVIDENCE', String(l.evidence)),
    value('AD-ROW-STATUS', REVIEW_STATUS_LABEL[r?.status ?? 'unreviewed']),
    value('AD-ROW-REVIEWER', r?.reviewer ?? ''),
    value('AD-ROW-REVIEWED-AT', r?.reviewedAt ?? ''),
    value('AD-ROW-SUSPECT', l.suspect ? SUSPECT_REASON_LABEL[l.suspect.reason] : ''),
    value('AD-ROW-LINK-ID', l.id),
  ];
  return specObject(rowId(l.id), 'SOT-DOC-ROW', at, vals);
}

export function toReqIF(graph: TraceGraph, review: TraceReview): string {
  const at = xmlEscape(graph.generatedAt);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n] as const));
  const nodeIds = new Set(nodeMap.keys());
  const targets = [...new Set(graph.links.flatMap((l) => targetsOf(l, nodeIds)))];
  const kinds = Object.keys(LINK_KIND_LABEL) as LinkKind[];
  const types = [
    `<DATATYPES><DATATYPE-DEFINITION-STRING IDENTIFIER="DT-STRING" LAST-CHANGE="${at}" LONG-NAME="文字列" MAX-LENGTH="100000"/></DATATYPES>`,
    '<SPEC-TYPES>',
    `<SPEC-OBJECT-TYPE IDENTIFIER="SOT-DOC-ROW" LAST-CHANGE="${at}" LONG-NAME="文書の行"><SPEC-ATTRIBUTES>${ROW_ATTRS.map(([id, n]) => attrDef(id, n, at)).join('')}</SPEC-ATTRIBUTES></SPEC-OBJECT-TYPE>`,
    `<SPEC-OBJECT-TYPE IDENTIFIER="SOT-SOURCE" LAST-CHANGE="${at}" LONG-NAME="ソース要素"><SPEC-ATTRIBUTES>${SRC_ATTRS.map(([id, n]) => attrDef(id, n, at)).join('')}</SPEC-ATTRIBUTES></SPEC-OBJECT-TYPE>`,
    ...kinds.map((k) => `<SPEC-RELATION-TYPE IDENTIFIER="SRT-${k}" LAST-CHANGE="${at}" LONG-NAME="${xmlEscape(LINK_KIND_LABEL[k])}"/>`),
    `<SPECIFICATION-TYPE IDENTIFIER="ST-DOC" LAST-CHANGE="${at}" LONG-NAME="Spec2Doc の文書"/>`,
    '</SPEC-TYPES>',
  ];
  const rows = graph.links.map((l) => rowObject(l, review, at));
  const sources = targets.map((id) => {
    const n = nodeMap.get(id);
    const path = n?.kind === 'file' ? (n.path ?? '') : `${nodeMap.get(n?.parent ?? '')?.path ?? ''}${n?.line !== undefined ? `:${n.line}` : ''}`;
    return specObject(srcId(id), 'SOT-SOURCE', at, [value('AD-SRC-NAME', n?.label ?? id), value('AD-SRC-KIND', n?.codeKind ?? n?.kind ?? ''), value('AD-SRC-PATH', path)]);
  });
  const relations = graph.links.flatMap((l) =>
    targetsOf(l, nodeIds).map(
      (t) =>
        `<SPEC-RELATION IDENTIFIER="REL-${hid(`${l.id}\n${t}`)}" LAST-CHANGE="${at}"><SOURCE><SPEC-OBJECT-REF>${rowId(l.id)}</SPEC-OBJECT-REF></SOURCE><TARGET><SPEC-OBJECT-REF>${srcId(t)}</SPEC-OBJECT-REF></TARGET><TYPE><SPEC-RELATION-TYPE-REF>SRT-${l.kind ?? 'describes'}</SPEC-RELATION-TYPE-REF></TYPE></SPEC-RELATION>`,
    ),
  );
  const children = graph.links.map((l) => `<SPEC-HIERARCHY IDENTIFIER="H-${hid(l.id)}" LAST-CHANGE="${at}"><OBJECT><SPEC-OBJECT-REF>${rowId(l.id)}</SPEC-OBJECT-REF></OBJECT></SPEC-HIERARCHY>`);
  const title = xmlEscape(`Spec2Doc トレーサビリティ ${graph.source ?? ''} ${graph.runId}`.trim());
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<REQ-IF xmlns="http://www.omg.org/spec/ReqIF/20110401/reqif.xsd">',
    `<THE-HEADER><REQ-IF-HEADER IDENTIFIER="HDR-${hid(graph.runId)}"><CREATION-TIME>${at}</CREATION-TIME><REQ-IF-TOOL-ID>Spec2Doc</REQ-IF-TOOL-ID><REQ-IF-VERSION>1.0</REQ-IF-VERSION><SOURCE-TOOL-ID>Spec2Doc</SOURCE-TOOL-ID><TITLE>${title}</TITLE></REQ-IF-HEADER></THE-HEADER>`,
    '<CORE-CONTENT><REQ-IF-CONTENT>',
    ...types,
    `<SPEC-OBJECTS>${[...rows, ...sources].join('')}</SPEC-OBJECTS>`,
    `<SPEC-RELATIONS>${relations.join('')}</SPEC-RELATIONS>`,
    `<SPECIFICATIONS><SPECIFICATION IDENTIFIER="SPEC-ROWS" LAST-CHANGE="${at}" LONG-NAME="${title}"><TYPE><SPECIFICATION-TYPE-REF>ST-DOC</SPECIFICATION-TYPE-REF></TYPE><CHILDREN>${children.join('')}</CHILDREN></SPECIFICATION></SPECIFICATIONS>`,
    '</REQ-IF-CONTENT></CORE-CONTENT>',
    '</REQ-IF>',
    '',
  ].join('\n');
}
