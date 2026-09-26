// CLI（REQ-F-026）。中核 run を呼ぶだけ。終了コード 0 成功／1 一部解析失敗／2 入力の誤り。
// 使い方は `node src/cli.ts --help`。

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, type OutputFormat, type RunOptions } from './core.ts';
import { InputError, type IngestInput } from './ingest/index.ts';
import { ALL_DOC_IDS, type DocId } from './doc/model.ts';
import { ALL_FORMATS } from './render/index.ts';
import { selectLlm, type LlmClient } from './llm/index.ts';

export const EXIT_OK = 0;
export const EXIT_PARTIAL = 1;
export const EXIT_INPUT = 2;

/** --format で選べるもの。文書の形式に加え、実行全体で 1 つ出すトレーサビリティ（trace） */
export const ALL_OUTPUT_FORMATS: readonly OutputFormat[] = [...ALL_FORMATS, 'trace'];

export const HELP = `Spec2Doc — ソースコードから仕様書・設計書を生成する

使い方:
  node src/cli.ts <入力> [--out <dir>] [--docs D01,D02,...] [--format md,html,docx,xlsx,trace] [--llm] [--exclude <pat>]

入力（どれか 1 つ）:
  --github <url> [--ref <ブランチ・タグ・コミット>]   GitHub のリポジトリ（トークンは環境変数 GITHUB_TOKEN）
  --folder <path>                                     フォルダ
  --files <a,b,...>                                   ファイルの列挙（カンマ区切り）
  --zip <path>                                        .zip ファイル

選択:
  --out <dir>        出力の親フォルダ（既定: out）。実体は <dir>/<実行ID>/
  --docs <ids>       文書の種類（既定: 全部 ${ALL_DOC_IDS.join(',')}）
  --format <fmts>    出力形式（既定: md。選べるもの ${ALL_OUTPUT_FORMATS.join(',')}）
                     trace: トレーサビリティの HTML（関係図と確認の管理）
  --llm              LLM で説明文を生成する（既定: 無効。キーは環境変数 ANTHROPIC_API_KEY）
  --exclude <pat>    除外パターン（glob。繰り返し指定・カンマ区切り可）
  -h, --help         この説明を表示する

終了コード: 0 成功 / 1 一部のファイルが解析失敗 / 2 入力の誤り
  想定外の失敗（入力の誤り以外の例外）も 1 で終わる
`;

/** カンマ区切り・繰り返し指定を平らな一覧にする */
export function splitList(values: readonly string[] | string | undefined): string[] {
  const arr = values === undefined ? [] : Array.isArray(values) ? values : [values as string];
  return arr.flatMap((v) => v.split(',')).map((v) => v.trim()).filter((v) => v !== '');
}

export function parseDocIds(values: readonly string[]): DocId[] {
  const unknown = values.filter((v) => !(ALL_DOC_IDS as readonly string[]).includes(v));
  if (unknown.length > 0) {
    throw new InputError(`文書の種類が不正です: ${unknown.join(', ')}`, `${ALL_DOC_IDS.join(', ')} から選んでください`);
  }
  if (values.length === 0) throw new InputError('文書の種類が選ばれていません', '少なくとも 1 つ選んでください');
  return [...new Set(values)] as DocId[];
}

export function parseFormats(values: readonly string[]): OutputFormat[] {
  const unknown = values.filter((v) => !(ALL_OUTPUT_FORMATS as readonly string[]).includes(v));
  if (unknown.length > 0) {
    throw new InputError(`出力形式が不正です: ${unknown.join(', ')}`, `${ALL_OUTPUT_FORMATS.join(', ')} から選んでください`);
  }
  if (values.length === 0) throw new InputError('出力形式が選ばれていません', '少なくとも 1 つ選んでください');
  return [...new Set(values)] as OutputFormat[];
}

/** LLM クライアントを用意する。有効指定なのにキーが無いときは、黙って無効にせず入力の誤りとして止める */
export function resolveLlm(enabled: boolean): LlmClient {
  if (enabled && !process.env['ANTHROPIC_API_KEY']) {
    throw new InputError('LLM が有効ですが、環境変数 ANTHROPIC_API_KEY が設定されていません', 'キーを環境変数に設定してから起動し直すか、LLM を無効にして実行してください');
  }
  return selectLlm(enabled);
}

/** InputError か（別の読み込み経路で作られた同名クラスも受ける） */
export function isInputError(e: unknown): e is InputError {
  return e instanceof InputError || (e instanceof Error && e.name === 'InputError' && typeof (e as InputError).hint === 'string');
}

interface CliValues {
  github?: string;
  ref?: string;
  folder?: string;
  files?: string;
  zip?: string;
  out?: string;
  docs?: string;
  format?: string;
  llm?: boolean;
  exclude?: string[];
}

function buildInput(v: CliValues): IngestInput {
  const given = (['github', 'folder', 'files', 'zip'] as const).filter((k) => v[k] !== undefined);
  if (given.length !== 1) {
    throw new InputError(
      given.length === 0 ? '入力が指定されていません' : `入力は 1 つだけ指定できます: ${given.map((k) => `--${k}`).join(' ')}`,
      '--github・--folder・--files・--zip のどれか 1 つを指定してください',
    );
  }
  if (v.ref !== undefined && v.github === undefined) {
    throw new InputError('--ref は --github と一緒にだけ使えます', '--ref を外すか --github を指定してください');
  }
  const value = (v.github ?? v.folder ?? v.files ?? v.zip ?? '').trim();
  if (value === '') throw new InputError(`--${given[0]} の値が空です`, '値を指定してください');
  if (v.github !== undefined) {
    const token = process.env['GITHUB_TOKEN'];
    return { kind: 'github', url: value, ...(v.ref ? { ref: v.ref } : {}), ...(token ? { token } : {}) };
  }
  if (v.folder !== undefined) return { kind: 'folder', path: value };
  if (v.zip !== undefined) return { kind: 'zip', path: value };
  return { kind: 'files', paths: splitList(value) };
}

function buildOptions(v: CliValues): RunOptions {
  return {
    input: buildInput(v),
    outDir: v.out ?? 'out',
    docIds: v.docs === undefined ? [...ALL_DOC_IDS] : parseDocIds(splitList(v.docs)),
    formats: v.format === undefined ? ['md'] : parseFormats(splitList(v.format)),
    exclude: splitList(v.exclude),
    llm: resolveLlm(v.llm === true),
  };
}

export interface CliIo {
  out: (s: string) => void;
  err: (s: string) => void;
}

const stdio: CliIo = {
  out: (s) => process.stdout.write(`${s}\n`),
  err: (s) => process.stderr.write(`${s}\n`),
};

export async function main(argv: string[], io: CliIo = stdio): Promise<number> {
  let values: CliValues & { help?: boolean };
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        github: { type: 'string' },
        ref: { type: 'string' },
        folder: { type: 'string' },
        files: { type: 'string' },
        zip: { type: 'string' },
        out: { type: 'string' },
        docs: { type: 'string' },
        format: { type: 'string' },
        llm: { type: 'boolean' },
        exclude: { type: 'string', multiple: true },
        help: { type: 'boolean', short: 'h' },
      },
    }));
  } catch (e) {
    io.err(`エラー: 引数が不正です（${(e as Error).message}）`);
    io.err('次の行動: node src/cli.ts --help で使い方を確かめてください');
    return EXIT_INPUT;
  }
  if (values.help) {
    io.out(HELP);
    return EXIT_OK;
  }
  try {
    const options = buildOptions(values);
    const result = await run(options, (p) => io.err(`[${String(Math.round(p.ratio * 100)).padStart(3)}%] ${p.message}`));
    const c = result.log.fileCounts;
    io.out(result.outPath);
    io.err(`ファイル ${c.total} 件（解析 ${c.analyzed}・失敗 ${c.failed}・除外 ${c.excluded}・対象外 ${c.unsupported}）`);
    if (result.hasFailures) {
      io.err('一部のファイルの解析に失敗しました。D08 と D09 で対象のファイルを確かめてください');
      return EXIT_PARTIAL;
    }
    return EXIT_OK;
  } catch (e) {
    if (isInputError(e)) {
      io.err(`エラー: ${e.message}`);
      io.err(`次の行動: ${e.hint}`);
      return EXIT_INPUT;
    }
    io.err(`エラー: 処理中に想定外の失敗が起きました（${(e as Error)?.message ?? String(e)}）`);
    io.err('次の行動: 入力を確かめてもう一度実行し、続く場合はこの出力を添えて報告してください');
    return EXIT_PARTIAL;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
