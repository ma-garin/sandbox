// デモ用サンプル（fixtures/demo-library）が CLI で文書化でき、主要な論点が各文書に現れることを確かめる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((done) => {
    execFile(process.execPath, ['src/cli.ts', ...args], { cwd: ROOT, timeout: 60_000 }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : -1) : 0;
      done({ code, stdout, stderr });
    });
  });
}

/** 出力フォルダ（日時のサブフォルダを含む）から文書を探して読む */
function findDoc(dir: string, doc: string): string {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const found = findDoc(p, doc);
      if (found) return found;
    } else if (e.name === `${doc}.md`) {
      return readFileSync(p, 'utf8');
    }
  }
  return '';
}

function distinct(text: string, re: RegExp): Set<string> {
  return new Set(text.match(re) ?? []);
}

test('demo-library: 7 文書を生成し、画面・連携・未参照関数・境界値が現れる', async () => {
  const out = mkdtempSync(join(tmpdir(), 'spec2doc-demo-'));
  try {
    const r = await run(['--folder', 'fixtures/demo-library', '--out', out, '--docs', 'D01,D02,D03,D04,D05,D07,D13', '--format', 'md']);
    assert.equal(r.code, 0, r.stderr);

    const docs = Object.fromEntries(['D01', 'D02', 'D03', 'D04', 'D05', 'D07', 'D13'].map((d) => [d, findDoc(out, d)])) as Record<'D01' | 'D02' | 'D03' | 'D04' | 'D05' | 'D07' | 'D13', string>;
    for (const [name, body] of Object.entries(docs)) assert.ok(body.length > 0, `${name}.md が出力されている`);

    // 画面一覧の行の先頭列（表示番号 S-001 形式、または内部 ID SCR- 形式）
    const screens = distinct(docs.D03, /^\| (?:S-\d+|SCR-[A-Za-z0-9_]+) \|/gm);
    assert.ok(screens.size >= 4, `D03 の画面が 4 以上（実際 ${[...screens].join(', ')}）`);

    const integrations = distinct(docs.D05, /INT-[^\s|（）]+/g);
    assert.ok(integrations.size >= 4, `D05 の連携が 4 以上（実際 ${[...integrations].join(', ')}）`);
    for (const path of ['/books', '/loans', '/members/']) assert.ok(docs.D05.includes(path), `D05 に ${path} がある`);
    // 共通の送信処理を経由しても、呼び出し箇所ごとのメソッドと URL（途中の式は {id}）が出る
    for (const [m, path] of [['POST', '/v1/loans'], ['DELETE', '/v1/loans/{id}'], ['GET', '/v1/members/{id}']] as const) {
      assert.match(docs.D05, new RegExp(`\\| fetch ${m} \\| [^|]*${path.replace(/[{}]/g, '\\$&')} \\|`), `D05 に ${m} ${path}`);
    }

    assert.match(docs.D07, /^\|.*exportMonthlyReport.*\|/m, 'D07 の表に未参照関数 exportMonthlyReport がある');
    assert.match(docs.D13, /^\|.*境界値.*\|/m, 'D13 に境界値の行がある');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
