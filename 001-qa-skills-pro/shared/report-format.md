# 報告フォーマット（全QA Skill共通）

## 指摘の構造

指摘1件は必ず以下のフラット構造で出力する（Jira CSV / GitHub Issuesエクスポート想定）:

```
{
  id:        "QA-001",              // Skill内で連番
  category:  "機能適合性",           // ISO/IEC 25010 の品質特性名 or 技法名
  severity:  "High",                // ISTQB準拠（下記）
  title:     "会員割引が非会員にも適用される",
  evidence:  "src/discount.ts:42 …", // evidence-first-policy.md 準拠。空は禁止
  repro:     "1. 非会員でログイン …", // 再現手順（該当する場合）
  proposal:  "isMember 判定を …",    // 改善案（任意だが推奨）
  confidence: "確認済 | 推定"        // 推定の場合は確認方法を evidence に併記
}
```

## ISTQB severity 分類

全指摘に必ず付与する。severityとpriority（ビジネス判断）を混同しない。

- **Critical**: データ損失・セキュリティ侵害・主要機能停止
- **High**: 主要ユースケースの阻害、回避策が困難
- **Medium**: 回避策あり、限定的影響
- **Low**: 軽微な不整合・改善提案レベル

## テストケースの構造

テストケース1件は以下を必須とする:

```
### TC-001: <ケース名>
- 技法: 境界値分析（3値）
- 対象パーティション/境界/規則: <技法上の位置づけ>
- 根拠: spec.md「3.2」:「1〜100個まで注文可能」
- 前提条件: <状態>
- 入力: <値>
- 期待結果: <仕様から導出した期待値。根拠と矛盾しないこと>
```

Gherkin形式で求められた場合は `Given/When/Then` に写像し、
`# 技法:` `# 根拠:` をコメント行として各Scenario直上に残す。

## レポート全体の構成

1. **サマリ** — 対象・適用技法・指摘件数（severity別）
2. **指摘一覧 / テストケース一覧** — 上記構造
3. **カバレッジ宣言** — qa-designでは必須（`qa-design/references/coverage-declaration.md` 準拠）
4. **要人間確認リスト** — `confidence: 推定` の項目を集約
