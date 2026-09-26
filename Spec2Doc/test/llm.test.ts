// REQ-F-016・029、REQ-N-008・011: 既定は無効・送信前の伏字・usage・失敗時は unknown（ネットワークは使わない）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAnthropicLlm,
  disabledLlm,
  LLM_DISABLED_TEXT,
  LLM_FAILED_TEXT,
  REDACTED_LINE,
  redact,
  selectLlm,
  DEFAULT_MODEL,
  type ExplainRequest,
  type MessagesApi,
} from '../src/llm/index.ts';

const SECRETS = ['sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUV', 'hunter2pass', 'ghp_abcdefghijklmnopqrstuvwxyz0123', 'dbpass99', 'ENVVALUE123'];

const req: ExplainRequest = {
  targetId: 'fn:save',
  kind: 'function',
  summary: 'save() は localStorage に書く。 apiKey = "sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUV"',
  snippets: [
    { source: { file: 'src/save.js', line: 1, endLine: 5 }, text: 'function save(v) {\n  const password = "hunter2pass";\n  localStorage.setItem("k", v);\n}' },
    { source: { file: 'src/db.js', line: 10 }, text: 'const url = "postgres://admin:dbpass99@db:5432/app";\nconst t = "ghp_abcdefghijklmnopqrstuvwxyz0123";' },
    { source: { file: '.env', line: 1 }, text: 'SECRET=ENVVALUE123' },
  ],
};

function mock(impl: MessagesApi['create']): { api: MessagesApi; calls: Parameters<MessagesApi['create']>[] } {
  const calls: Parameters<MessagesApi['create']>[] = [];
  return { calls, api: { create: (...a) => (calls.push(a), impl(...a)) } };
}

test('既定は無効: selectLlm(false) は disabledLlm で送信 0 件、説明文は「LLM 無効のため未生成」', async () => {
  const llm = selectLlm(false, { apiKey: 'x' });
  assert.equal(llm, disabledLlm);
  assert.equal(llm.enabled, false);
  assert.deepEqual(await llm.explain(req), { text: LLM_DISABLED_TEXT, evidence: 'unknown', source: [] });
  assert.equal(llm.usage().requests, 0);
});

test('キーが無ければ有効を選んでも無効扱い', () => {
  const saved = process.env['ANTHROPIC_API_KEY'];
  delete process.env['ANTHROPIC_API_KEY'];
  try {
    assert.equal(createAnthropicLlm(), undefined);
    assert.equal(selectLlm(true), disabledLlm);
  } finally {
    if (saved !== undefined) process.env['ANTHROPIC_API_KEY'] = saved;
  }
});

test('送信内容から秘密情報が消え、.env 由来の断片は送らず、usage にトークンと送信ファイルが残る', async () => {
  const m = mock(async () => ({ content: [{ type: 'text', text: '入力値を端末に保存する機能。' }], usage: { input_tokens: 120, output_tokens: 30 } }));
  const llm = createAnthropicLlm({ messages: m.api })!;
  assert.equal(llm.enabled, true);
  const res = await llm.explain(req);
  assert.equal(res.evidence, 'inference');
  assert.equal(res.text, '入力値を端末に保存する機能。');
  assert.deepEqual(res.source.map((s) => s.file), ['src/save.js', 'src/db.js']);

  assert.equal(m.calls.length, 1);
  const params = m.calls[0]![0];
  assert.equal(params.model, DEFAULT_MODEL);
  assert.equal(DEFAULT_MODEL, 'claude-sonnet-5');
  const sent = JSON.stringify(params);
  for (const s of SECRETS) assert.ok(!sent.includes(s), `送信内容に秘密情報: ${s}`);
  assert.ok(sent.includes(REDACTED_LINE));
  assert.ok(sent.includes('localStorage.setItem'));
  assert.ok(!sent.includes('.env'));

  assert.deepEqual(llm.usage(), { inputTokens: 120, outputTokens: 30, requests: 1, sentFiles: ['src/db.js', 'src/save.js'] });
});

test('API の失敗は例外にせず evidence=unknown を返す', async () => {
  const llm = createAnthropicLlm({ messages: mock(async () => { throw new Error('529 overloaded'); }).api })!;
  const res = await llm.explain(req);
  assert.deepEqual(res, { text: LLM_FAILED_TEXT, evidence: 'unknown', source: [] });
});

test('タイムアウトは例外にせず evidence=unknown を返し、中断信号を送る', async () => {
  let aborted = false;
  const m = mock((_p, opt) => new Promise((resolve) => {
    opt?.signal?.addEventListener('abort', () => { aborted = true; });
    setTimeout(() => resolve({ content: [{ type: 'text', text: '遅い' }] }), 1000);
  }));
  const llm = createAnthropicLlm({ messages: m.api, timeoutMs: 20 })!;
  const res = await llm.explain(req);
  assert.equal(res.evidence, 'unknown');
  assert.equal(aborted, true);
});

test('redact は秘密情報らしき行だけを字下げを残して伏字にする', () => {
  const r = redact('a = 1\n  token: "abcdef"\nconn = "mysql://u:p@h/db"\nAuthorization: Bearer abcdefghijkl\nb = 2');
  assert.equal(r.redactedLines, 3);
  assert.equal(r.text, `a = 1\n  ${REDACTED_LINE}\n${REDACTED_LINE}\n${REDACTED_LINE}\nb = 2`);
});
