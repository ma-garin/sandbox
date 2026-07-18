#!/usr/bin/env node
// TESTRA-Next CLI
// ドキュメント/URL/apk からテストレポートまでを一気通貫で実行する。
//
// 使い方:
//   node cli/testra.mjs run <spec.md|https://...> [options]
//     --apk <path>        apk を対象に追加（メタ解析: package/権限）
//     --name <text>       プロジェクト名
//     --out <dir>         成果物出力先（既定: ./out）
//     --qf-live           QualityForward 実連携（要 QF_BASE_URL / QF_API_TOKEN）
//     --timestamp <iso>   決定論的タイムスタンプ（既定は固定値）
//   node cli/testra.mjs --help

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { runPipeline } from '../core/pipeline.js';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else args[key] = true;
    } else args._.push(a);
  }
  return args;
}

function help() {
  console.log(`TESTRA-Next — 一気通貫テスト自動設計/実行パイプライン (CLI)

  node cli/testra.mjs run <spec.md|URL> [--apk <path>] [--name <n>] [--out <dir>] [--qf-live]

例:
  node cli/testra.mjs run samples/login-spec.md --name ログイン --out out
`);
}

/** 仕様ソースを読み込む（ローカルファイル or URL） */
async function loadSpec(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`取得失敗 ${res.status}: ${src}`);
    const text = await res.text();
    // 極簡易にHTMLタグ除去（本格抽出は将来 parsers に委譲）
    const clean = /<html[\s>]/i.test(text) ? text.replace(/<[^>]+>/g, ' ') : text;
    return { name: basename(src) || 'spec', kind: 'spec', url: src, text: clean };
  }
  const text = await readFile(src, 'utf8');
  return { name: basename(src), kind: 'spec', text };
}

/** apk メタを組み立てる（ファイル名からの推定 + 将来 aapt 連携） */
function loadApkMeta(path) {
  const name = basename(path);
  return {
    name,
    kind: 'apk',
    meta: {
      package: name.replace(/\.apk$/i, ''),
      // 実バイナリ解析は未接続。存在する場合のみ note を残す。
      activities: [],
      permissions: [],
      note: existsSync(path) ? 'apk存在(メタ抽出は未接続)' : 'apkパス未検出',
    },
  };
}

async function writeArtifacts(run, outDir) {
  await mkdir(outDir, { recursive: true });
  await mkdir(join(outDir, 'scripts'), { recursive: true });

  await writeFile(join(outDir, 'run.json'), JSON.stringify(run, null, 2));
  await writeFile(join(outDir, 'report.md'), run.artifacts.report.markdown);
  await writeFile(join(outDir, 'report.summary.json'), JSON.stringify(run.artifacts.report.summary, null, 2));
  await writeFile(join(outDir, 'qualityforward.json'), JSON.stringify(run.artifacts.qfSync.payload, null, 2));

  // テストケースCSV
  const cases = run.artifacts.caseLow.cases;
  const csv = ['ID,親,機能,技法,優先度,タイトル,事前条件,テストデータ,期待結果']
    .concat(
      cases.map((c) =>
        [c.id, c.parentId, c.featureName, c.technique, c.priority, c.title, c.precondition, c.testData.value, c.expected]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
    )
    .join('\n');
  await writeFile(join(outDir, 'testcases.csv'), csv);

  // スクリプト
  for (const s of run.artifacts.script.scripts) {
    await writeFile(join(outDir, 'scripts', s.filename), s.content);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._[0] !== 'run' || !args._[1]) {
    help();
    process.exit(args.help ? 0 : 1);
  }

  const specSrc = args._[1];
  const sources = [await loadSpec(specSrc)];
  if (args.apk) sources.push(loadApkMeta(args.apk));

  const outDir = resolve(args.out || 'out');
  const options = {
    timestamp: typeof args.timestamp === 'string' ? args.timestamp : '2026-07-18T00:00:00Z',
    qualityForward:
      args['qf-live'] && process.env.QF_BASE_URL && process.env.QF_API_TOKEN
        ? { dryRun: false, baseUrl: process.env.QF_BASE_URL, apiKey: process.env.QF_API_TOKEN }
        : { dryRun: true },
    llm:
      process.env.OPENAI_API_KEY
        ? { provider: 'openai', apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL }
        : { provider: 'rule' },
    onStage: (stage, run) => {
      const info = run.trace[run.trace.length - 1];
      console.log(`  ✓ ${stage}`, JSON.stringify({ ...info, stage: undefined }));
    },
  };

  console.log(`▶ TESTRA-Next 実行: ${args.name || specSrc}`);
  const run = await runPipeline({ title: args.name || sources[0].name, sources }, options);
  await writeArtifacts(run, outDir);

  const s = run.artifacts.report.summary;
  console.log(`\n─ 完了 ─`);
  console.log(`  フィーチャー ${s.features} / 条件 ${s.conditions} / ケース(低) ${s.lowCases} / スクリプト ${s.scripts}`);
  console.log(`  実行: ${s.execution.pass} pass / ${s.execution.fail} fail / ${s.execution.blocked} blocked`);
  console.log(`  出力: ${outDir}/ (report.md, testcases.csv, scripts/, qualityforward.json)`);
}

main().catch((e) => {
  console.error('✗ エラー:', e.message);
  process.exit(1);
});
