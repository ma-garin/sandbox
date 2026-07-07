// testdoc.js — テスト設計書診断（ベリサーブ「テスト設計書診断サービス」のツール化）
//
// role=test のドキュメントに専用の品質ルールを適用する。engine.jsと同形のfindingsを返し
// category:"testdoc" を付与する。viewpointは既存6観点にマップして指摘一覧に合流できる。
//
// ルール5種:
//   1. 期待結果の欠落 → verifiability
//   2. テスト技法の明示なし → depth
//   3. カバレッジ根拠なし → depth
//   4. 事前条件・テストデータの再現性なし → verifiability
//   5. 要件トレース（ID）なし → reliability
//
// evidence-only: 各指摘は evidence（原文引用 or 明示的な「（記述なし）」）を持つ。

import { ID_PATTERN } from "./engine.js";

const EXPECTED_RESULT = ["こと", "されること", "表示される", "出力される", "返却される", "期待結果", "期待値", "確認する", "検証する"];
const TECHNIQUES = ["境界値", "同値", "同値分割", "デシジョンテーブル", "決定表", "状態遷移", "ペアワイズ", "組み合わせ", "エラー推測", "網羅"];
const COVERAGE = ["カバレッジ", "網羅", "観点", "被覆", "カバー率", "C0", "C1"];
const PRECONDITION = ["事前条件", "前提条件", "前提", "テストデータ", "初期状態", "準備", "セットアップ"];

function mk(severity, message, evidence, location, suggestion, expectedEffect, viewpoint) {
  return Object.freeze({
    viewpoint, severity, message, evidence, location,
    suggestion, expectedEffect, category: "testdoc",
  });
}
function has(text, words) {
  return words.some((w) => text.includes(w));
}
function firstLine(text) {
  return (text.split("\n").find((l) => l.trim()) || "").trim().slice(0, 60);
}

// テスト設計書1件を診断 → findings[]
export function analyzeTestDocQuality(text, name = "テスト設計書") {
  const src = String(text ?? "");
  const findings = [];

  // 1. 期待結果の欠落
  if (!has(src, EXPECTED_RESULT)) {
    findings.push(mk("Critical", "テストの期待結果が記述されていない（合否判定できない）",
      "（期待結果の記述なし）", 0,
      "各テストケースに観測可能な期待結果（〜が表示されること 等）を明記する",
      "テスト実行時の合否判定の明確化", "verifiability"));
  }

  // 2. テスト技法の明示なし
  if (!has(src, TECHNIQUES)) {
    findings.push(mk("High", "適用したテスト技法が明示されていない",
      "（技法の記述なし）", 0,
      "境界値分析・同値分割・デシジョンテーブル等、採用した技法を明記する",
      "テストケース導出の妥当性・再現性の担保", "depth"));
  }

  // 3. カバレッジ根拠なし
  if (!has(src, COVERAGE)) {
    findings.push(mk("Medium", "網羅性（カバレッジ）の根拠が示されていない",
      "（カバレッジの記述なし）", 0,
      "テスト観点一覧やカバレッジ基準（C0/C1・観点網羅等）を記載する",
      "抜け漏れの説明可能性の向上", "depth"));
  }

  // 4. 事前条件・テストデータの再現性
  if (!has(src, PRECONDITION)) {
    findings.push(mk("High", "事前条件・テストデータが定義されておらず再現性が乏しい",
      "（事前条件・データの記述なし）", 0,
      "各ケースの事前条件・初期状態・テストデータを明記する",
      "テストの再現性・第三者実行可能性の確保", "verifiability"));
  }

  // 5. 要件トレース（ID）なし
  if (!src.match(ID_PATTERN)) {
    findings.push(mk("High", "要件識別子（REQ-/FR- 等）への追跡が無く、要件との対応が確認できない",
      "（要件IDの記述なし）", 0,
      "各テストケースに対応する要件IDを付し、要件↔テストの追跡を可能にする",
      "要件カバレッジの検証可能化", "reliability"));
  }

  // 参考: 文書全体の1行目をevidence補助にできるよう、記述ありのケースでも先頭行を持たせない
  //（記述なしを明示するのが本診断の主眼のため、evidenceは「（…なし）」で確定させる）
  void firstLine;
  return findings.map((f) => ({ ...f, doc: name }));
}
