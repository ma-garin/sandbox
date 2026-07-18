// 共通データモデルとパイプライン基盤（純粋・immutable）
//
// パイプラインは「Run」オブジェクトを段階的に不変更新していく。
// 各ステージは (run) => 新しい run を返す純粋関数。元の run は破壊しない。

/** ISTQB severity 分類 */
export const SEVERITY = Object.freeze(['Critical', 'High', 'Medium', 'Low']);

/** サポートするテスト設計技法（ISO/IEC/IEEE 29119-4 準拠） */
export const TECHNIQUES = Object.freeze({
  EP: '同値分割',
  BVA: '境界値分析',
  DT: 'デシジョンテーブル',
  STT: '状態遷移テスト',
  CFD: '原因結果グラフ/CFD',
  PW: 'ペアワイズ（組合せ）',
  UC: 'ユースケーステスト',
  ERR: 'エラー推測',
});

/** パイプラインのステージ順序（この配列が実行順の正） */
export const STAGE_ORDER = Object.freeze([
  'ingest',
  'featureAnalysis',
  'modelAnalysis',
  'designBasic',
  'designDetail',
  'caseHigh',
  'caseLow',
  'script',
  'execution',
  'qfSync',
  'report',
]);

/**
 * 空の Run を生成する。
 * @param {object} opts
 * @param {string} opts.name 対象プロダクト/機能名
 * @param {string} [opts.timestamp] 呼び出し側から注入（決定論のため内部でDateを使わない）
 * @returns {object} run
 */
export function createRun({ name = 'untitled', timestamp = '1970-01-01T00:00:00Z' } = {}) {
  return Object.freeze({
    meta: Object.freeze({ name, timestamp, engine: 'rule' }),
    // 各ステージの成果物を格納する。未実行ステージは undefined。
    artifacts: Object.freeze({}),
    // 実行ログ（ステージ名・件数・所要指標）
    trace: Object.freeze([]),
  });
}

/**
 * Run に1ステージ分の成果物を不変で追記する。
 * @param {object} run
 * @param {string} stage STAGE_ORDER のいずれか
 * @param {*} artifact 成果物
 * @param {object} [info] traceに残す補足（件数など）
 * @returns {object} 新しい run
 */
export function withArtifact(run, stage, artifact, info = {}) {
  return Object.freeze({
    ...run,
    artifacts: Object.freeze({ ...run.artifacts, [stage]: artifact }),
    trace: Object.freeze([...run.trace, Object.freeze({ stage, ...info })]),
  });
}

/** meta を不変更新 */
export function withMeta(run, patch) {
  return Object.freeze({ ...run, meta: Object.freeze({ ...run.meta, ...patch }) });
}
