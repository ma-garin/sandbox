// D04 データ仕様書: データ項目定義・レコードレイアウト・データの状態と遷移・使用制限（REQ-F-014・034）。

import { uniqueSources } from './common.ts';
import type { Boundary, DataItem, IR, SourceRef } from '../ir/schema.ts';
import type { CrudOp, DataAccess } from '../analyze/js-data.ts';
import type { DocId, Document, Provenance, Section, TableRow } from '../doc/model.ts';
import {
  type GenCtx,
  factProv,
  hasFailedFiles,
  idMaps,
  makeDocument,
  mergeProv,
  provOf,
  row,
  section,
  srcText,
  table,
  unknownProv,
  zeroResult,
} from './common.ts';

const ORIGIN: DocId = 'D04';

const KIND_LABEL: Readonly<Record<DataItem['kind'], string>> = {
  localStorage: 'localStorage のキー',
  sessionStorage: 'sessionStorage のキー',
  indexedDB: 'IndexedDB',
  interface: '型定義（interface）',
  typeAlias: '型定義（type）',
  layout: 'レコードレイアウト',
};

/**
 * 数値（境界値）の表示と根拠（REQ-F-034）。D05・D11 も使う。
 * 単位が読めないものは D09 に「単位不明」として登録し、行の根拠を不明にする。
 */
/** 固定／設定の判定結果（REQ-F-034）。全文書がこの 1 か所の判定を使う */
export interface SettingJudgement {
  kind: 'fixed' | 'config' | 'unknown';
  text: string;
  prov: Provenance;
}

/**
 * 数値が「コード固定」か「設定で変更可」かを判定する。
 * 境界値があればその configurable（analyze が設定ファイル・環境変数・引数・storage からの読み込みを見た結果）に従う。
 * 無ければ同じファイルの既定値（DefaultValue）で判定し、context='config' なら設定、それ以外はソースのリテラル＝コード固定。
 * どちらも無いときだけ D09 に登録する。
 */
export function judgeSetting(
  ctx: GenCtx,
  origin: DocId,
  target: { irId: string; subject: string; value: string; source: SourceRef[]; boundary?: Boundary },
  ir?: IR,
): SettingJudgement {
  const b = target.boundary;
  if (b) {
    if (b.configurable === 'config') {
      const where = b.configSource ? [b.configSource] : b.source;
      return { kind: 'config', text: `設定で変更可（${srcText(where)}）`, prov: factProv([...b.source, ...(b.configSource ? [b.configSource] : [])], [b.id]) };
    }
    return { kind: 'fixed', text: `コード固定（${srcText(b.source)}）`, prov: factProv(b.source, [b.id]) };
  }
  const files = new Set(target.source.map((s) => s.file));
  const def = ir?.defaults.find((d) => d.value === target.value && (d.subject === target.subject || d.source.some((s) => files.has(s.file))));
  if (def) {
    const kind = def.context === 'config' ? 'config' : 'fixed';
    const text = kind === 'config' ? `設定で変更可（${srcText(def.source)}）` : `コード固定（${srcText(def.source)}）`;
    return { kind, text, prov: factProv(def.source, [def.id, target.irId]) };
  }
  const d09Ref = ctx.d09.register({
    key: `setting:${target.irId}:${target.subject}`,
    topic: `${target.subject} の値 ${target.value}`,
    question: `${target.subject} の値 ${target.value} がコード固定か設定で変更可かをソースから判定できない`,
    category: 'unknown-value',
    relatedIds: [target.irId],
    source: target.source,
    origin,
  });
  return { kind: 'unknown', text: `固定／設定不明（${d09Ref}）`, prov: unknownProv(d09Ref, [target.irId], target.source) };
}

export function boundaryCells(
  b: Boundary,
  ctx: GenCtx,
  origin: DocId,
): { value: string; unit: string; setting: string; prov: Provenance } {
  const j = judgeSetting(ctx, origin, { irId: b.id, subject: b.subject, value: b.value, source: b.source, boundary: b });
  const base = mergeProv([provOf(b, ctx, origin, `${b.subject} の${b.bound}`), j.prov]);
  const setting = j.text;
  if (b.unit !== null) return { value: b.value, unit: b.unit, setting, prov: base };
  const d09Ref = ctx.d09.register({
    key: `unit:${b.id}`,
    topic: `${b.subject} の単位`,
    question: `${b.subject} の値 ${b.value} の単位をソースから読めない。単位を確認してください`,
    category: 'unit-unknown',
    relatedIds: [b.id],
    source: b.source,
    origin,
  });
  return {
    value: b.value,
    unit: `単位不明（${d09Ref}）`,
    setting,
    prov: mergeProv([base, unknownProv(d09Ref, [b.id], b.source)]),
  };
}

function layoutText(d: DataItem): string {
  const parts = d.fields.map((f) => (f.length !== undefined ? `${f.length} 桁` : `${f.name}（桁不明）`));
  const joined = parts.join('＋');
  return d.separator !== undefined ? `${joined}＋区切り \`${d.separator}\`` : joined;
}

function isLayout(d: DataItem): boolean {
  return d.kind === 'layout' || d.separator !== undefined;
}

function itemRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.dataItems.flatMap((d) => {
    const prov = provOf(d, ctx, ORIGIN, `データ項目 ${d.name}`);
    const head = [d.id, KIND_LABEL[d.kind], d.name];
    if (d.fields.length === 0) {
      if (d.kind !== 'localStorage' && d.kind !== 'sessionStorage' && d.kind !== 'indexedDB') {
        return [row([...head, '—', '—', '—', '—', srcText(d.source)], prov)];
      }
      // 解析が保存する値の型（valueTypeId）を推定していれば、その型定義の項目を「推測」として載せる
      const typeId = (d as typeof d & { valueTypeId?: unknown }).valueTypeId;
      const t = typeof typeId === 'string' ? ir.dataItems.find((x) => x.id === typeId) : undefined;
      if (t && t.fields.length > 0) {
        const inferred: Provenance = { evidence: 'inference', source: uniqueSources([...d.source, ...t.source]), irIds: [d.id, t.id], origin: 'analysis' };
        return t.fields.map((f) =>
          row(
            [...head, `${f.name}（${t.id} から推測）`, f.type ?? '型注釈なし', f.length !== undefined ? `${f.length} 桁` : '—', f.optional ? '省略可' : '必須', srcText(d.source)],
            inferred,
          ),
        );
      }
      const d09Ref = ctx.d09.register({
        key: `value-shape:${d.id}`,
        topic: `${d.name} に保存する値の構造`,
        question: `保存域のキー ${d.name} に保存する値の項目・型をソースから確定できない。対応する型定義（D04 のデータID）を確認してください`,
        category: 'unknown-value',
        relatedIds: [d.id],
        source: d.source,
        origin: ORIGIN,
      });
      return [row([...head, `値の構造不明（${d09Ref}）`, '—', '—', '—', srcText(d.source)], mergeProv([prov, unknownProv(d09Ref, [d.id], d.source)]))];
    }
    // 項目が取れていても、解析が値の型（valueTypeId）を推定していれば対応する型定義を「推測」の行で添える
    const vtId = (d as typeof d & { valueTypeId?: unknown }).valueTypeId;
    const vt = typeof vtId === 'string' ? ir.dataItems.find((x) => x.id === vtId) : undefined;
    const typeRow = vt
      ? [
          row(
            [...head, `（値の型）${vt.name}`, `${vt.id} に対応（推測）`, '—', '—', srcText(uniqueSources([...d.source, ...vt.source]))],
            { evidence: 'inference', source: uniqueSources([...d.source, ...vt.source]), irIds: [d.id, vt.id], origin: 'analysis' },
          ),
        ]
      : [];
    return [...typeRow, ...d.fields.map((f) =>
      row(
        [
          ...head,
          f.name,
          f.type ?? '型注釈なし',
          f.length !== undefined ? `${f.length} 桁` : '—',
          f.optional ? '省略可' : '必須',
          srcText(d.source),
        ],
        prov,
      ),
    )];
  });
}

function layoutRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.dataItems.filter(isLayout).map((d) =>
    row(
      [d.id, d.name, layoutText(d), d.fields.map((f) => f.name).join('・') || '—', d.separator ?? 'なし', d.example ?? '—', srcText(d.source)],
      provOf(d, ctx, ORIGIN, `レイアウト ${d.name}`),
    ),
  );
}

function stateSections(ir: IR, ctx: GenCtx): Section {
  if (ir.states.length === 0) {
    return section('データの状態と遷移', 2, [zeroResult(ctx, ORIGIN, 'データの状態と遷移', { uncertain: hasFailedFiles(ir) })]);
  }
  const stateRows = ir.states.map((s) =>
    row(
      [s.id, s.variable, s.mechanism, s.values.join('・'), s.initial ?? '—', srcText(s.source)],
      provOf(s, ctx, ORIGIN, `状態 ${s.variable}`),
    ),
  );
  const transRows = ir.states.flatMap((s) =>
    s.transitions.map((t) =>
      row(
        [s.id, t.from, t.trigger, t.condition ?? '—', t.to, t.action ?? '—', srcText(t.source)],
        t.source.length > 0 ? factProv(t.source, [s.id]) : provOf(s, ctx, ORIGIN, `状態 ${s.variable} の遷移`),
      ),
    ),
  );
  return section('データの状態と遷移', 2, [
    table(['状態ID', '対象', '仕組み', '取りうる値', '初期値', '根拠位置'], stateRows, '状態'),
    table(['状態ID', '遷移前', '契機', '条件', '遷移後', '処理', '根拠位置'], transRows, '状態遷移表'),
  ]);
}

function restrictionRows(ir: IR, ctx: GenCtx): TableRow[] {
  const names = new Set(ir.dataItems.flatMap((d) => [d.name, ...d.fields.map((f) => f.name)]));
  return ir.boundaries
    .filter((b) => names.has(b.subject))
    .map((b) => {
      const c = boundaryCells(b, ctx, ORIGIN);
      return row([b.id, b.subject, b.bound, c.value, c.unit, c.setting, srcText(b.source)], c.prov);
    });
}

// ---------- CRUD 表 ----------

const OP_ORDER: readonly CrudOp[] = ['C', 'C/U', 'R', 'U', 'D'];

interface CrudTarget {
  id: string;
  label: string;
  source: SourceRef[];
  access: DataAccess[];
}

function accessOf(x: object): DataAccess[] {
  const a = (x as { access?: unknown }).access;
  return Array.isArray(a) ? (a as DataAccess[]) : [];
}

/** 列: 保存域のキー・IndexedDB のストア（操作が読めたもの）・API／ルートのリソース */
function crudTargets(ir: IR): CrudTarget[] {
  const stores = ir.dataItems
    .filter((d) => d.kind === 'localStorage' || d.kind === 'sessionStorage' || (d.kind === 'indexedDB' && accessOf(d).length > 0))
    .map((d) => ({ id: d.id, label: `${d.name}（${d.kind}）`, source: d.source, access: accessOf(d) }));
  const apis = new Map<string, CrudTarget>();
  for (const i of ir.integrations) {
    const access = accessOf(i);
    if (access.length === 0) continue;
    const res = (i as { resource?: unknown }).resource;
    const path = typeof res === 'string' ? res : i.url;
    const key = `${i.direction}:${path}`;
    const prev = apis.get(key);
    apis.set(
      key,
      prev
        ? { ...prev, source: [...prev.source, ...i.source], access: [...prev.access, ...access] }
        : { id: i.id, label: `${i.direction === 'inbound' ? 'ルート' : 'API'} ${path}`, source: i.source, access },
    );
  }
  return [...stores, ...apis.values()];
}

/** 機能の関数から呼び出し（calls）と入れ子の定義（他の機能の入口を除く）をたどって到達する関数 */
function reachable(ir: IR, startId: string, entryIds: ReadonlySet<string>): Set<string> {
  const byId = new Map(ir.functions.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    const f = byId.get(id);
    if (seen.has(id) || !f) continue;
    seen.add(id);
    const s = f.source[0];
    const nested = ir.functions.filter((g) => {
      const t = g.source[0];
      return g.id !== f.id && !entryIds.has(g.id) && s && t && t.file === s.file && t.line >= s.line && (t.endLine ?? t.line) <= (s.endLine ?? s.line) && (t.line > s.line || (t.endLine ?? t.line) < (s.endLine ?? s.line));
    });
    stack.push(...f.calls.filter((c) => byId.has(c)), ...nested.map((g) => g.id));
  }
  return seen;
}

function opsText(access: readonly DataAccess[]): string {
  const ops = new Set(access.map((a) => a.op));
  return OP_ORDER.filter((o) => ops.has(o)).join(' ');
}

function accessProv(access: readonly DataAccess[], irIds: string[]): Provenance {
  const source = uniqueSources(access.map((a) => a.source));
  return access.some((a) => a.evidence === 'inference') ? { evidence: 'inference', source, irIds, origin: 'analysis' } : factProv(source, irIds);
}

function crudSection(ir: IR, ctx: GenCtx, uncertain: boolean): Section {
  const targets = crudTargets(ir);
  if (targets.length === 0) return section('CRUD 表', 2, [zeroResult(ctx, ORIGIN, 'CRUD 表', { uncertain })]);
  const { features } = idMaps(ir);
  const entryIds = new Set(features.map((f) => f.fn.id));
  const used = new Set<string>();
  const rows = features.flatMap((f) => {
    const reach = reachable(ir, f.fn.id, entryIds);
    const per = targets.map((t) => t.access.filter((a) => reach.has(a.functionId)));
    const all = per.flat();
    if (all.length === 0) return [];
    targets.forEach((t, i) => (per[i]?.length ? used.add(t.id) : undefined));
    const irIds = [f.fn.id, ...targets.filter((_, i) => per[i]?.length).map((t) => t.id)];
    return [row([f.no, f.fn.name, ...per.map((a) => opsText(a) || '—')], accessProv(all, irIds))];
  });
  const unusedRows = targets
    .filter((t) => !used.has(t.id))
    .map((t) => {
      const d09Ref = ctx.d09.register({
        key: `crud-unused:${t.id}`,
        topic: `${t.label} を使う機能`,
        question: `${t.label} を読み書きする機能（D02 の機能ID）をソースからたどれない。どの機能から使われるかを確認してください`,
        category: 'other',
        relatedIds: [t.id],
        source: t.source,
        origin: ORIGIN,
      });
      return row([t.id, t.label, opsText(t.access) || '—', d09Ref, srcText(t.source)], unknownProv(d09Ref, [t.id], t.source));
    });
  const caption = 'C=作成・R=参照・U=更新・D=削除・C/U=作成か更新かを区別できない（推測）。機能から推移的に到達する関数の操作を集約';
  return section('CRUD 表', 2, [
    rows.length > 0
      ? table(['機能ID', '機能名', ...targets.map((t) => t.label)], rows, caption)
      : zeroResult(ctx, ORIGIN, 'CRUD 表（機能から使われるデータ）', { uncertain }),
    ...(unusedRows.length > 0 ? [table(['データID', 'データ', '操作', '確認事項', '根拠位置'], unusedRows, 'どの機能からも使われないデータ')] : []),
  ]);
}

export function buildD04(ir: IR, ctx: GenCtx): Document {
  const uncertain = hasFailedFiles(ir);
  const items = itemRows(ir, ctx);
  const layouts = layoutRows(ir, ctx);
  const limits = restrictionRows(ir, ctx);
  return makeDocument(ORIGIN, ctx, [
    section('データ項目定義', 2, [
      items.length > 0
        ? table(['データID', '種別', '名前', '項目', '型', '桁', '必須', '根拠位置'], items)
        : zeroResult(ctx, ORIGIN, 'データ項目定義', { uncertain }),
    ]),
    section('レコードレイアウト', 2, [
      layouts.length > 0
        ? table(['データID', '名前', '構成', '項目', '区切り', '具体例', '根拠位置'], layouts)
        : zeroResult(ctx, ORIGIN, 'レコードレイアウト', { uncertain }),
    ]),
    stateSections(ir, ctx),
    crudSection(ir, ctx, uncertain),
    section('使用制限', 2, [
      limits.length > 0
        ? table(['境界ID', '対象', '種別', '現在値', '単位', '固定／設定', '根拠位置'], limits)
        : zeroResult(ctx, ORIGIN, 'データの使用制限', { uncertain }),
    ]),
  ]);
}
