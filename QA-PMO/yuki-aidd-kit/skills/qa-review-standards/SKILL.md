---
name: qa-review-standards
description: AI生成物やツール開発において品質基準・テスト観点を適用する際に使うスキル。「QAレビュー」「品質チェック」「severity」「ISO 25010」「ISTQB」「テスト観点」の言及で使用。第三者検証エンジニアとしての標準を全AIDD成果物に非交渉で適用する。
---

# QA Review Standards（非交渉の品質基準）

第三者検証エンジニア（ISTQB認定）としての観点を、AI生成物すべてに適用する。**これらは省略してはならない**。

## ISTQB Severity分類
| Severity | 基準 |
|---|---|
| Critical | システム停止・データ損失・セキュリティ侵害 |
| Major | 主要機能が動作しない、回避策なし |
| Minor | 機能は動くが不便、回避策あり |
| Cosmetic | 見た目のみの問題 |

## ISO/IEC 25010 ユーザビリティ サブ特性（5カテゴリ）
1. 適切度認識性（Appropriateness recognizability）
2. 習得性（Learnability）
3. 運用操作性（Operability）
4. ユーザーエラー防止性（User error protection）
5. ユーザーインターフェース快美性 / アクセシビリティ

## ISO/IEC 29119-3 テストレポート必須フィールド
- テスト対象・範囲、テスト環境、実施結果概要、欠陥一覧（severity付き）、リスク評価、終了基準達成状況

## Whittakerツアーモデル（探索的テスト観点）
- Money tour（価値の高い機能を優先）
- Landmark tour（既知の重要画面を巡る）
- FedEx tour（データの一生を追う）
- Garbage Collector tour（リソース解放確認）

## 評価原則：Evidence-only
AIに品質判断をさせるプロンプトは必ず「証拠（実際のコード/画面/ログ）に基づいてのみ判定し、推測は禁止」と明記する。証拠なしの「良さそう」判定は不可。

## 適用タイミング
- 単一HTMLデモの完成時 → severity付きの簡易レビュー
- 本実装完了時 → ISO 25010 5カテゴリ+ISTQB severityのフルレビュー
- 業務提出物 → ISO 29119-3形式のレポート化
