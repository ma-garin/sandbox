// labels.js — QualityForwardの汎用フィールド（category1..25 / content1..10 / result 1-7）を
// 実際の表示ラベルに解決する。これがこのアプリの主目的（レスポンス構造の複雑さの解消）。
//
// - テスト結果(PASS/FAIL/...)のラベルはプロジェクト単位（GET /current_project の label_pass 等）
// - カテゴリ/コンテントのラベルと使用可否はテストスイート単位（label_categoryN / use_categoryN 等）
// - 元オブジェクトは変更せず、常に新しいオブジェクトを返す（immutableパターン）

// 注意: QualityForward APIは書込み(POST/PATCH)と読込み(GET)で result の型が異なる（仕様上の非対称性）。
//   書込み: 数値コード 1-7 (TestResultCreateRequestのenum)
//   読込み: 小文字文字列 "pass"|"fail"|"skip"|"cut"|"block"|"na"|"qa" (TestResultsのenum)
// この違いを利用者に意識させないよう、両方向のラベルマップを用意する。
const RESULT_CODE_TO_STRING = { 1: "pass", 2: "fail", 3: "skip", 4: "cut", 5: "block", 6: "na", 7: "qa" };
const RESULT_STRING_FIELD = {
  pass: "label_pass",
  fail: "label_fail",
  skip: "label_skip",
  cut: "label_cut",
  block: "label_block",
  na: "label_na",
  qa: "label_qa",
};
const RESULT_STRING_FALLBACK = {
  pass: "PASS",
  fail: "FAIL",
  skip: "SKIP",
  cut: "CUT",
  block: "BLOCK",
  na: "N/A",
  qa: "Q&A",
};

// 登録フォーム用（POST/PATCHのenumに合わせ数値コード1-7をキーにする）→ {1:"PASS", ..., 7:"Q&A"}
export function buildResultLabelMap(project = {}) {
  const map = {};
  for (const [code, str] of Object.entries(RESULT_CODE_TO_STRING)) {
    map[code] = project[RESULT_STRING_FIELD[str]] || RESULT_STRING_FALLBACK[str];
  }
  return map;
}

// 表示用（GETレスポンスの文字列enumをキーにする）→ {pass:"PASS", ..., qa:"Q&A"}
export function buildResultStringLabelMap(project = {}) {
  const map = {};
  for (const str of Object.keys(RESULT_STRING_FIELD)) {
    map[str] = project[RESULT_STRING_FIELD[str]] || RESULT_STRING_FALLBACK[str];
  }
  return map;
}

function buildIndexedLabelMap(suite, { prefix, count }) {
  const map = {};
  for (let i = 1; i <= count; i++) {
    const key = `${prefix}${i}`;
    const used = suite[`use_${key}`] !== false; // 明示的にfalseの時のみ未使用扱い
    const label = suite[`label_${key}`];
    map[key] = { key, label: label || key, used };
  }
  return map;
}

// testSuite: test_suites配列内の1件 → {category1:{key,label,used}, ...}
export function buildCategoryLabelMap(testSuite = {}) {
  return buildIndexedLabelMap(testSuite, { prefix: "category", count: 25 });
}

// testSuite: test_suites配列内の1件 → {content1:{key,label,used}, ...}
export function buildContentLabelMap(testSuite = {}) {
  return buildIndexedLabelMap(testSuite, { prefix: "content", count: 10 });
}

// テストケースを「実際に値が入っているラベル済みフィールド一覧」付きの新オブジェクトにする
export function humanizeTestCase(testCase, categoryLabelMap = {}) {
  const fields = [];
  for (const [key, meta] of Object.entries(categoryLabelMap)) {
    if (!meta.used) continue;
    const value = testCase[key];
    if (value === undefined || value === null || value === "") continue;
    fields.push({ key, label: meta.label, value });
  }
  return { ...testCase, labeledFields: fields };
}

// テスト結果を「resultの人間可読ラベル」＋「実際に値が入っているcontentフィールド」付きにする。
// resultStringLabelMapは buildResultStringLabelMap の戻り値（GETのresultは文字列enumのため）。
export function humanizeTestResult(testResult, resultStringLabelMap = {}, contentLabelMap = {}) {
  const resultLabel = resultStringLabelMap[testResult.result] ?? String(testResult.result ?? "");
  const fields = [];
  for (const [key, meta] of Object.entries(contentLabelMap)) {
    if (!meta.used) continue;
    const value = testResult[key];
    if (value === undefined || value === null || value === "") continue;
    fields.push({ key, label: meta.label, value });
  }
  return { ...testResult, resultLabel, labeledFields: fields };
}
