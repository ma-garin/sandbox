// client.js — QualityForward各リソースの薄いラッパー。
// 各関数は buildQFRequest + callQF の1呼び出しで、パスのネスト（プロジェクト/使いにくさの根本原因）を隠す。
// 複数コールが必要な操作は各画面(views/*.js)側で明示的に合成する（if (!res.ok) return res; で短絡する規約）。

import { buildQFRequest, callQF } from "./providers/qualityforward.js";

function call(apiKey, method, path, extra, opts) {
  return callQF(buildQFRequest({ apiKey, method, path, ...extra }), opts);
}

export const getCurrentProject = ({ apiKey }, opts) => call(apiKey, "GET", "/current_project", {}, opts);
export const listUsers = ({ apiKey }, opts) => call(apiKey, "GET", "/users", {}, opts);

export const listTestSuites = ({ apiKey }, opts) => call(apiKey, "GET", "/test_suites", {}, opts);
export const createTestSuite = ({ apiKey, testSuite }, opts) =>
  call(apiKey, "POST", "/test_suites", { body: { test_suite: testSuite } }, opts);
export const updateTestSuite = ({ apiKey, testSuiteId, testSuite }, opts) =>
  call(apiKey, "PATCH", `/test_suites/${testSuiteId}`, { body: { test_suite: testSuite } }, opts);
export const deleteTestSuite = ({ apiKey, testSuiteId }, opts) =>
  call(apiKey, "DELETE", `/test_suites/${testSuiteId}`, {}, opts);

export const listTestSuiteVersions = ({ apiKey, testSuiteId }, opts) =>
  call(apiKey, "GET", `/test_suites/${testSuiteId}/test_suite_versions`, {}, opts);
export const createTestSuiteVersion = ({ apiKey, testSuiteId, testSuiteVersion }, opts) =>
  call(apiKey, "POST", `/test_suites/${testSuiteId}/test_suite_versions`, { body: { test_suite_version: testSuiteVersion } }, opts);
export const updateTestSuiteVersion = ({ apiKey, testSuiteId, versionId, testSuiteVersion }, opts) =>
  call(apiKey, "PATCH", `/test_suites/${testSuiteId}/test_suite_versions/${versionId}`, { body: { test_suite_version: testSuiteVersion } }, opts);
export const deleteTestSuiteVersion = ({ apiKey, testSuiteId, versionId }, opts) =>
  call(apiKey, "DELETE", `/test_suites/${testSuiteId}/test_suite_versions/${versionId}`, {}, opts);

export const listTestCases = ({ apiKey, testSuiteId, versionId }, opts) =>
  call(apiKey, "GET", `/test_suites/${testSuiteId}/test_suite_versions/${versionId}/test_cases`, {}, opts);
export const createTestCase = ({ apiKey, testSuiteId, versionId, testCase }, opts) =>
  call(apiKey, "POST", `/test_suites/${testSuiteId}/test_suite_versions/${versionId}/test_cases`, { body: { test_case: testCase } }, opts);
export const updateTestCase = ({ apiKey, testSuiteId, versionId, testCaseId, testCase }, opts) =>
  call(apiKey, "PATCH", `/test_suites/${testSuiteId}/test_suite_versions/${versionId}/test_cases/${testCaseId}`, { body: { test_case: testCase } }, opts);
export const deleteTestCase = ({ apiKey, testSuiteId, versionId, testCaseId }, opts) =>
  call(apiKey, "DELETE", `/test_suites/${testSuiteId}/test_suite_versions/${versionId}/test_cases/${testCaseId}`, {}, opts);

export const listTestPhases = ({ apiKey }, opts) => call(apiKey, "GET", "/test_phases", {}, opts);
export const createTestPhase = ({ apiKey, testPhase }, opts) =>
  call(apiKey, "POST", "/test_phases", { body: { test_phase: testPhase } }, opts);
export const updateTestPhase = ({ apiKey, testPhaseId, testPhase }, opts) =>
  call(apiKey, "PATCH", `/test_phases/${testPhaseId}`, { body: { test_phase: testPhase } }, opts);
export const deleteTestPhase = ({ apiKey, testPhaseId }, opts) =>
  call(apiKey, "DELETE", `/test_phases/${testPhaseId}`, {}, opts);

export const createTestSuiteAssignment = ({ apiKey, testPhaseId, testSuiteVersionId }, opts) =>
  call(
    apiKey,
    "POST",
    `/test_phases/${testPhaseId}/test_suite_assignments`,
    { body: { test_suite_assignment: { test_suite_version_id: testSuiteVersionId } } },
    opts
  );

export const listTestCycles = ({ apiKey, testPhaseId, assignmentId }, opts) =>
  call(apiKey, "GET", `/test_phases/${testPhaseId}/test_suite_assignments/${assignmentId}/test_cycles`, {}, opts);
export const createTestCycle = ({ apiKey, testPhaseId, assignmentId, testCycle }, opts) =>
  call(apiKey, "POST", `/test_phases/${testPhaseId}/test_suite_assignments/${assignmentId}/test_cycles`, { body: { test_cycle: testCycle } }, opts);
export const updateTestCycle = ({ apiKey, testPhaseId, assignmentId, cycleId, testCycle }, opts) =>
  call(
    apiKey,
    "PATCH",
    `/test_phases/${testPhaseId}/test_suite_assignments/${assignmentId}/test_cycles/${cycleId}`,
    { body: { test_cycle: testCycle } },
    opts
  );
export const deleteTestCycle = ({ apiKey, testPhaseId, assignmentId, cycleId }, opts) =>
  call(apiKey, "DELETE", `/test_phases/${testPhaseId}/test_suite_assignments/${assignmentId}/test_cycles/${cycleId}`, {}, opts);

export const listTestResults = ({ apiKey, testPhaseId, assignmentId, cycleId }, opts) =>
  call(apiKey, "GET", `/test_phases/${testPhaseId}/test_suite_assignments/${assignmentId}/test_cycles/${cycleId}/test_results`, {}, opts);
// POSTは仕様上「入力・上書き」(upsert)。新規登録と再登録の両方をこれ1回で行える。
export const submitTestResult = ({ apiKey, testPhaseId, assignmentId, cycleId, testResult }, opts) =>
  call(
    apiKey,
    "POST",
    `/test_phases/${testPhaseId}/test_suite_assignments/${assignmentId}/test_cycles/${cycleId}/test_results`,
    { body: { test_result: testResult } },
    opts
  );
export const updateTestResult = ({ apiKey, testPhaseId, assignmentId, cycleId, testCaseNo, testResult }, opts) =>
  call(
    apiKey,
    "PATCH",
    `/test_phases/${testPhaseId}/test_suite_assignments/${assignmentId}/test_cycles/${cycleId}/test_results/${testCaseNo}`,
    { body: { test_result: testResult } },
    opts
  );
export const deleteTestResult = ({ apiKey, testPhaseId, assignmentId, cycleId, testCaseNo }, opts) =>
  call(
    apiKey,
    "DELETE",
    `/test_phases/${testPhaseId}/test_suite_assignments/${assignmentId}/test_cycles/${cycleId}/test_results/${testCaseNo}`,
    {},
    opts
  );

// bug_count_snapshotsにはGET/一覧が存在しない（書き込み専用API）。履歴はローカルにのみ保持する。
export const createBugCountSnapshots = ({ apiKey, testPhaseId, snapshots }, opts) =>
  call(apiKey, "POST", `/test_phases/${testPhaseId}/bug_count_snapshots/bulk_create`, { body: { bug_count_snapshots: snapshots } }, opts);
