// client.test.mjs — client.js（リソースラッパー）のURL/メソッド/ボディ組み立て検証
// 実行: node tests/client.test.mjs（実APIは呼ばない。fetch注入で捕捉するのみ）

import assert from "node:assert";
import {
  getCurrentProject, listTestCases, createTestCase,
  createTestSuiteAssignment, submitTestResult, updateTestResult,
  createBugCountSnapshots,
} from "../src/client.js";

let pass = 0, fail = 0;
function test(name, fn) {
  const p = (async () => fn())();
  return p.then(
    () => { pass++; console.log(`  ✓ ${name}`); },
    (e) => { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
  );
}

function captureFetch() {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
  };
  return { calls, fetchImpl };
}

console.log("client: 単純GET");
await test("getCurrentProjectは/current_projectへBearer付きGET", async () => {
  const { calls, fetchImpl } = captureFetch();
  await getCurrentProject({ apiKey: "k" }, { fetchImpl });
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/current_project"));
  assert.strictEqual(calls[0].opts.method, "GET");
  assert.strictEqual(calls[0].opts.headers.Authorization, "Bearer k");
});

console.log("client: ネストしたパスの組み立て");
await test("listTestCasesはtest_suite/versionのネストパスを組み立てる", async () => {
  const { calls, fetchImpl } = captureFetch();
  await listTestCases({ apiKey: "k", testSuiteId: 2, versionId: 3 }, { fetchImpl });
  assert.ok(calls[0].url.endsWith("/test_suites/2/test_suite_versions/3/test_cases"));
});
await test("createTestCaseはtest_caseでラップしたボディを送る", async () => {
  const { calls, fetchImpl } = captureFetch();
  await createTestCase({ apiKey: "k", testSuiteId: 2, versionId: 3, testCase: { no: 1, priority: 1 } }, { fetchImpl });
  assert.strictEqual(calls[0].opts.method, "POST");
  assert.deepStrictEqual(JSON.parse(calls[0].opts.body), { test_case: { no: 1, priority: 1 } });
});

console.log("client: テスト実行フェーズのネスト");
await test("createTestSuiteAssignmentはtest_suite_version_idのみのボディ", async () => {
  const { calls, fetchImpl } = captureFetch();
  await createTestSuiteAssignment({ apiKey: "k", testPhaseId: 5, testSuiteVersionId: 9 }, { fetchImpl });
  assert.ok(calls[0].url.endsWith("/test_phases/5/test_suite_assignments"));
  assert.deepStrictEqual(JSON.parse(calls[0].opts.body), { test_suite_assignment: { test_suite_version_id: 9 } });
});
await test("submitTestResultは4段ネストのパスにPOST（入力・上書き）", async () => {
  const { calls, fetchImpl } = captureFetch();
  await submitTestResult(
    { apiKey: "k", testPhaseId: 5, assignmentId: 6, cycleId: 7, testResult: { result: 1, user_id: 1, executed_at: "2026-07-16", test_case_no: 1 } },
    { fetchImpl }
  );
  assert.ok(calls[0].url.endsWith("/test_phases/5/test_suite_assignments/6/test_cycles/7/test_results"));
  assert.strictEqual(calls[0].opts.method, "POST");
});
await test("updateTestResultはtest_case_noをパスに含めPATCH", async () => {
  const { calls, fetchImpl } = captureFetch();
  await updateTestResult({ apiKey: "k", testPhaseId: 5, assignmentId: 6, cycleId: 7, testCaseNo: 42, testResult: { result: 2 } }, { fetchImpl });
  assert.ok(calls[0].url.endsWith("/test_results/42"));
  assert.strictEqual(calls[0].opts.method, "PATCH");
});

console.log("client: バグ件数スナップショット（書き込み専用）");
await test("createBugCountSnapshotsはbulk_createへ配列をラップして送る", async () => {
  const { calls, fetchImpl } = captureFetch();
  const snapshots = [{ target_date: "2026-07-16", open_count: 3, close_count: 1 }];
  await createBugCountSnapshots({ apiKey: "k", testPhaseId: 5, snapshots }, { fetchImpl });
  assert.ok(calls[0].url.endsWith("/test_phases/5/bug_count_snapshots/bulk_create"));
  assert.deepStrictEqual(JSON.parse(calls[0].opts.body), { bug_count_snapshots: snapshots });
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
