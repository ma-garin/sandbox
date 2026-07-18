// パイプライン・オーケストレーション
// 11ステージを順に実行し、各ステージ成果物を Run へ不変で積み上げる。
// LLM は各ステージで任意に補強フックとして差し込める（既定 rule）。
//
// この関数はコアの唯一の公開エントリで、CLI / web / テストが共通利用する。

import { createRun, withArtifact, withMeta } from './model.js';
import { resolveLlm } from './llm/llm.js';
import { ingest } from './stages/ingest.js';
import { analyzeFeatures } from './stages/feature-analysis.js';
import { analyzeModels } from './stages/model-analysis.js';
import { designBasic, designDetail } from './stages/test-design.js';
import { caseHigh, caseLow } from './stages/test-case.js';
import { generateScripts } from './stages/test-script.js';
import { executeTests } from './stages/test-execution.js';
import { syncToQualityForward } from './connectors/qualityforward.js';
import { generateReport } from './stages/report.js';

/**
 * @param {object} input ingest 入力 { title, sources }
 * @param {object} [options]
 * @param {string} [options.timestamp] 決定論のため注入
 * @param {object} [options.llm] LLM 設定（既定 rule）
 * @param {object} [options.qualityForward] QF 設定（既定 dryRun）
 * @param {Function} [options.runner] 実行器（未指定なら simulated）
 * @param {(stage:string, run:object)=>void} [options.onStage] 進捗コールバック
 * @returns {Promise<object>} 完了 run（report 済み）
 */
export async function runPipeline(input, options = {}) {
  const llm = resolveLlm(options.llm);
  const notify = (stage, run) => options.onStage && options.onStage(stage, run);

  let run = createRun({ name: input.title || 'untitled', timestamp: options.timestamp });
  run = withMeta(run, { engine: llm.id });

  // 1. ingest
  const doc = ingest(input);
  run = withArtifact(run, 'ingest', doc, { requirements: doc.stats.requirementCount });
  notify('ingest', run);

  // 2. featureAnalysis (+LLM 補強)
  let fa = analyzeFeatures(doc);
  fa = { ...fa, features: await llm.enrich('featureAnalysis', fa.features) };
  run = withArtifact(run, 'featureAnalysis', fa, { features: fa.stats.total });
  notify('featureAnalysis', run);

  // 3. modelAnalysis
  let ma = analyzeModels(fa, doc);
  ma = { ...ma, models: await llm.enrich('modelAnalysis', ma.models) };
  run = withArtifact(run, 'modelAnalysis', ma, { models: ma.stats.total });
  notify('modelAnalysis', run);

  // 4. designBasic
  const db = designBasic(ma, fa, doc);
  run = withArtifact(run, 'designBasic', db, { conditions: db.stats.total });
  notify('designBasic', run);

  // 5. designDetail (+LLM 補強)
  let dd = designDetail(db);
  dd = { ...dd, items: await llm.enrich('designDetail', dd.items) };
  run = withArtifact(run, 'designDetail', dd, { coverageItems: dd.stats.coverageItems });
  notify('designDetail', run);

  // 6. caseHigh
  const ch = caseHigh(dd, db);
  run = withArtifact(run, 'caseHigh', ch, { cases: ch.stats.total });
  notify('caseHigh', run);

  // 7. caseLow (+LLM 補強)
  let cl = caseLow(ch);
  cl = { ...cl, cases: await llm.enrich('caseLow', cl.cases) };
  run = withArtifact(run, 'caseLow', cl, { cases: cl.stats.total });
  notify('caseLow', run);

  // 8. script
  const scr = generateScripts(cl, doc);
  run = withArtifact(run, 'script', scr, { scripts: scr.stats.total });
  notify('script', run);

  // 9. execution
  const ex = await executeTests(cl, { runner: options.runner });
  run = withArtifact(run, 'execution', ex, { passRate: ex.summary.passRate });
  notify('execution', run);

  // 10. qfSync
  const qf = await syncToQualityForward(run, options.qualityForward);
  run = withArtifact(run, 'qfSync', qf, { mode: qf.mode });
  notify('qfSync', run);

  // 11. report
  const rep = generateReport(run, qf);
  run = withArtifact(run, 'report', rep, { lowCases: rep.summary.lowCases });
  notify('report', run);

  return run;
}
