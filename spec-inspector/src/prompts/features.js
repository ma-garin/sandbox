// prompts/features.js — ベリサーブ差別化機能用のプロンプト定義
//
// 現時点は定義とテストのみ（接続はGOALS.mdのG-08等で実施）。
// いずれも出力はJSONオブジェクトを要求（OpenAI JSONモード互換）。

// テスト設計レディネス（G-08）: ルール検出した技法適用候補をAIで精緻化する
// candidates: testdesign.jsのanalyzeTestDesignReadiness出力（予定）
export function buildTestDesignPrompt(candidates, docs) {
  const candText = (candidates || []).map((c, i) =>
    `${i + 1}. [${c.type}] ${c.doc || ""} L${c.location}: ${c.evidence}`
  ).join("\n");
  const body = (docs || []).map((d) => `=== ${d.name} ===\n${d.text}`).join("\n\n").slice(0, 12000);
  return `あなたはテスト設計技法（デシジョンテーブル・境界値分析・状態遷移テスト）の専門家です。
仕様書から機械抽出した技法適用候補を検証し、精緻化してください。

## 候補一覧
${candText || "（候補なし）"}

## タスク
各候補について: (1) 技法適用が妥当か判定 (2) 妥当なら条件・境界・状態を仕様から補完 (3) 機械抽出が見落とした適用箇所を最大3件追加。

## 出力形式（JSONオブジェクトのみ）
{"candidates":[{"type":"decision-table|boundary|state","valid":true,"doc":"文書名","evidence":"原文引用","conditions":["…"],"reason":"判定理由"}]}

## 対象仕様
${body}`;
}

// テスト設計書診断（G-03/G-04のAI強化用）
export function buildTestDocReviewPrompt(doc) {
  return `あなたは第三者検証会社のテスト設計レビュアーです。以下のテスト設計書を診断してください。

診断観点: 期待結果の具体性（合否判定可能か）、テスト技法適用の明示、カバレッジの根拠、事前条件・テストデータの再現性、要件識別子への追跡。

## 出力形式（JSONオブジェクトのみ）
{"findings":[{"viewpoint":"verifiability|depth|reliability","severity":"Critical|High|Medium|Low","doc":"${String(doc?.name || "テスト設計書")}","message":"指摘","evidence":"原文引用","suggestion":"改善案","expectedEffect":"期待効果"}]}

## 対象文書: ${String(doc?.name || "")}
${String(doc?.text || "").slice(0, 16000)}`;
}

// IV&V第三者検証（G-05〜G-07のAI強化用）
// checklistItems: ivv.jsのチェックリスト項目（予定: {id,area,label,ref}）
export function buildIVVPrompt(docs, checklistItems) {
  const items = (checklistItems || []).map((c) => `- ${c.id}: ${c.label}（${c.ref || "-"}）`).join("\n");
  const body = (docs || []).map((d) => `=== ${d.name} ===\n${d.text}`).join("\n\n").slice(0, 14000);
  return `あなたは発注者・受注者から独立した第三者検証（IV&V）の担当者です。
以下のチェックリスト項目について、対象文書群を検証し判定してください。

## チェックリスト
${items || "（項目なし）"}

## 出力形式（JSONオブジェクトのみ）
{"results":[{"id":"項目ID","status":"ok|ng|insufficient","evidence":"判定根拠の原文引用（ngとinsufficientでは必須）","note":"補足"}]}

## 対象文書
${body}`;
}
