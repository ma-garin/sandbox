// D05 データ連携仕様書: 連携の組ごとの方向・タイミング・データ・応答・定期通信・異常条件（REQ-F-013・034）。

import type { Boundary, IR, Integration, SourceRef } from '../ir/schema.ts';
import type { DocId, Document, Provenance, TableRow } from '../doc/model.ts';
import { boundaryMatchesIntegration, factProv, type GenCtx, hasFailedFiles, makeDocument, mergeProv, provOf, row, section, srcText, table, unknownProv, zeroResult } from './common.ts';
import { boundaryCells, judgeSetting } from './d04.ts';

const ORIGIN: DocId = 'D05';

const DIRECTION: Readonly<Record<Integration['direction'], string>> = { outbound: '送信（本システム→外部）', inbound: '受信（外部→本システム）' };

/** 連携に対応する境界値（タイムアウト・再試行・間隔）。対象名が連携 ID・URL・関数 ID のどれかに一致するもの */
function findBoundary(ir: IR, i: Integration, bound: Boundary['bound']): Boundary | undefined {
  const keys = new Set([i.id, i.url, ...(i.functionId ? [i.functionId] : [])]);
  // 名前の一致 → 定数名（TIMEOUT_MS 等）→ その他 の順に採る
  const rank = (b: Boundary): number => (keys.has(b.subject) ? 0 : /^[A-Z][A-Z0-9_]*$/.test(b.subject) ? 1 : 2);
  return ir.boundaries
    .filter((b) => b.bound === bound && boundaryMatchesIntegration(b, i))
    .sort((a, b) => rank(a) - rank(b))[0];
}

/** 連携の数値（タイムアウト ms・再試行回数）を「値 単位・固定／設定」で表す */
function numberCell(
  ir: IR,
  i: Integration,
  ctx: GenCtx,
  bound: 'timeout' | 'retry',
  raw: number | undefined,
): { text: string; prov?: Provenance } {
  const b = findBoundary(ir, i, bound);
  if (b) {
    const c = boundaryCells(b, ctx, ORIGIN);
    return { text: `${c.value} ${c.unit}・${c.setting}`, prov: c.prov };
  }
  if (raw === undefined) return { text: '指定なし' };
  const unit = bound === 'timeout' ? 'ms' : '回';
  const subject = `${i.url} の${bound === 'timeout' ? 'タイムアウト' : '再試行回数'}`;
  const j = judgeSetting(ctx, ORIGIN, { irId: i.id, subject, value: String(raw), source: i.source }, ir);
  return { text: `${raw} ${unit}・${j.text}`, prov: j.prov };
}

/** 呼び出し箇所ごとの連携（解析の追加欄 wrapperOf）が指す、共通の送信処理の連携 ID */
function wrapperIdOf(i: Integration): string | undefined {
  const w = (i as { wrapperOf?: unknown }).wrapperOf;
  return typeof w === 'string' ? w : undefined;
}

/** URL の一部が関数の引数で決まる連携（共通の送信処理） */
function isWrapper(ir: IR, i: Integration): boolean {
  if (ir.integrations.some((x) => wrapperIdOf(x) === i.id)) return true;
  // 呼び出し箇所ごとの連携は、URL に呼び出し元の引数（{id} 等）が残っても共通の送信処理ではない
  if (wrapperIdOf(i)) return false;
  const fn = ir.functions.find((f) => f.id === i.functionId);
  return fn !== undefined && fn.params.some((p) => i.url.includes(`{${p.name}}`));
}

function urlCell(ir: IR, i: Integration): string {
  if (!isWrapper(ir, i)) return i.url;
  const fn = ir.functions.find((f) => f.id === i.functionId);
  return `共通の送信処理 ${fn?.name ?? i.timing}（${i.url}）`;
}

/** 別ファイルからの呼び出しは解析が URL を代入しないので、共通の送信処理があれば D09 に 1 件登録する */
function registerCrossFileUrl(ir: IR, ctx: GenCtx): void {
  const wrappers = ir.integrations.filter((i) => isWrapper(ir, i));
  if (wrappers.length === 0) return;
  ctx.d09.register({
    key: 'wrapper-url-cross-file',
    topic: '共通の送信処理の URL',
    question: `別ファイルからの呼び出しの URL は未解決。共通の送信処理（${wrappers.map((w) => w.id).join('、')}）を別ファイルから呼ぶ箇所があれば、その URL を確認してください`,
    category: 'other',
    relatedIds: wrappers.map((w) => w.id),
    source: wrappers.flatMap((w) => w.source),
    origin: ORIGIN,
  });
}

function pairRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.integrations.map((i) => {
    const t = numberCell(ir, i, ctx, 'timeout', i.timeoutMs);
    const r = numberCell(ir, i, ctx, 'retry', i.retries);
    const prov = mergeProv([provOf(i, ctx, ORIGIN, `連携 ${i.url}`), ...(t.prov ? [t.prov] : []), ...(r.prov ? [r.prov] : [])]);
    return row(
      [
        i.id,
        DIRECTION[i.direction],
        `${i.mechanism} ${i.method}`,
        urlCell(ir, i),
        i.timing,
        i.requestData ?? 'なし',
        i.response ?? 'ソースから読めず',
        t.text,
        r.text,
        srcText(i.source),
      ],
      prov,
    );
  });
}

function periodicRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.boundaries
    .filter((b) => b.bound === 'interval')
    .map((b) => {
      const c = boundaryCells(b, ctx, ORIGIN);
      const target = ir.integrations.find((i) => boundaryMatchesIntegration(b, i));
      return row([b.id, target?.id ?? '—', b.subject, c.value, c.unit, c.setting, srcText(b.source)], c.prov);
    });
}

/** 解析が異常条件ごとに残したソース位置（追加欄 failureSources。failureConditions と同じ並び） */
function failureSourceOf(i: Integration, n: number): SourceRef | undefined {
  const list = (i as { failureSources?: unknown }).failureSources;
  const s = Array.isArray(list) ? (list[n] as SourceRef | undefined) : undefined;
  return s && typeof s.file === 'string' && typeof s.line === 'number' ? s : undefined;
}

/** 異常条件の行は、その条件自身の位置があれば事実（連携の URL の確度を引き継がない） */
function failureRows(ir: IR, ctx: GenCtx): TableRow[] {
  return ir.integrations.flatMap((i) => {
    // 呼び出し箇所ごとの連携は、異常条件を共通の送信処理の行に任せて参照だけ置く（2 重に載せない）
    const w = wrapperIdOf(i);
    if (w && ir.integrations.some((x) => x.id === w)) {
      return [row([i.id, '—', `異常条件: 共通の送信処理（${w}）に同じ`, srcText(i.source)], provOf(i, ctx, ORIGIN, `連携 ${i.url} の異常条件`))];
    }
    return i.failureConditions.map((cond, n) => {
      const at = failureSourceOf(i, n);
      return at
        ? row([i.id, String(n + 1), cond, srcText([at])], factProv([at], [i.id]))
        : row([i.id, String(n + 1), cond, srcText(i.source)], provOf(i, ctx, ORIGIN, `連携 ${i.url} の異常条件`));
    });
  });
}

export function buildD05(ir: IR, ctx: GenCtx): Document {
  const uncertain = hasFailedFiles(ir);
  const pairs = pairRows(ir, ctx);
  const periodic = periodicRows(ir, ctx);
  const failures = failureRows(ir, ctx);
  registerCrossFileUrl(ir, ctx);
  return makeDocument(ORIGIN, ctx, [
    section('連携の組', 2, [
      pairs.length > 0
        ? table(['連携ID', '方向', '方式', '接続先', 'タイミング', 'データ', '応答', 'タイムアウト', '再試行', '根拠位置'], pairs)
        : zeroResult(ctx, ORIGIN, '外部連携', { uncertain }),
    ]),
    section('定期通信', 2, [
      periodic.length > 0
        ? table(['境界ID', '連携ID', '対象', '間隔', '単位', '固定／設定', '根拠位置'], periodic)
        : zeroResult(ctx, ORIGIN, '定期通信', { uncertain }),
    ]),
    section('異常と判断する条件', 2, [
      failures.length > 0
        ? table(['連携ID', 'No.', '条件', '根拠位置'], failures)
        : zeroResult(ctx, ORIGIN, '連携の異常条件', { uncertain }),
    ]),
  ]);
}
