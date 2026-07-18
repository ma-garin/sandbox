// Quality Forward 連携コネクタ（アダプタ）
//
// ベリサーブのテスト管理SaaS「QualityForward」へ、生成物を同期する。
// - 既定は dryRun: 送信せず変換ペイロードのみ返す（キー不要・安全）
// - config.apiKey と fetchImpl を与えると実POSTを試みる
// - APIキーはここに持たない。呼び出し側（web=localStorage / CLI=env）から注入する。
//
// マッピング方針（QualityForward の概念に対応）:
//   フィーチャー         -> テストスイート(Test Suite)
//   ローレベルケース     -> テストケース(Test Case)
//   実行結果             -> テスト結果(Test Result / Run)

import { seqId } from '../util/id.js';

/**
 * Run を QualityForward 形式のペイロードへ変換する（純粋関数）。
 * @param {object} run 完了済み run（caseLow / execution を含む）
 * @returns {object} payload
 */
export function toQualityForwardPayload(run) {
  const features = run.artifacts.featureAnalysis?.features || [];
  const cases = run.artifacts.caseLow?.cases || [];
  const results = run.artifacts.execution?.results || [];
  const resultById = new Map(results.map((r) => [r.caseId, r]));

  const suites = features.map((f, i) => ({
    externalId: f.id,
    number: seqId('QF-TS', i + 1),
    name: f.name,
    kind: f.type,
  }));

  const testCases = cases.map((c, i) => ({
    externalId: c.id,
    number: seqId('QF-TC', i + 1),
    suiteRef: c.featureId,
    title: c.title,
    precondition: c.precondition,
    steps: c.steps,
    expected: c.expected,
    priority: c.priority,
    technique: c.technique,
  }));

  const testResults = cases.map((c) => {
    const r = resultById.get(c.id);
    return {
      caseRef: c.id,
      status: mapStatus(r?.status),
      comment: r?.detail || '',
    };
  });

  return {
    project: run.meta.name,
    generatedAt: run.meta.timestamp,
    suites,
    testCases,
    testResults,
    counts: { suites: suites.length, testCases: testCases.length, testResults: testResults.length },
  };
}

// TESTRA-Next の状態 -> QualityForward の結果コード
function mapStatus(status) {
  switch (status) {
    case 'pass':
      return 'Passed';
    case 'fail':
      return 'Failed';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Untested';
  }
}

/**
 * Run を QualityForward へ同期する。
 * @param {object} run
 * @param {object} [config]
 * @param {boolean} [config.dryRun=true]
 * @param {string} [config.baseUrl]
 * @param {string} [config.apiKey]
 * @param {Function} [config.fetchImpl]
 * @returns {Promise<object>} { mode, payload, response? }
 */
export async function syncToQualityForward(run, config = {}) {
  const payload = toQualityForwardPayload(run);
  const dryRun = config.dryRun !== false;

  if (dryRun || !config.apiKey || !config.baseUrl) {
    return { mode: 'dry-run', payload, sent: false };
  }

  const fetchImpl = config.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchImpl) return { mode: 'dry-run', payload, sent: false, note: 'fetch 実装なし' };

  try {
    const res = await fetchImpl(`${config.baseUrl.replace(/\/$/, '')}/api/v2/test_results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ApiToken': config.apiKey },
      body: JSON.stringify(payload),
    });
    return { mode: 'live', payload, sent: res.ok, status: res.status };
  } catch (e) {
    return { mode: 'live', payload, sent: false, error: String(e) };
  }
}
