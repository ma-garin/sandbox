# 001-qa-skills-pro — 規格エンコード済みQA Skillスイート

DOM-06「QA Skills Pro」のMVP実装。ISTQB／ISO/IEC 29119-4のテスト設計技法と
ISO/IEC 25010の品質特性観点を、コーディングエージェント向けの再現性ある
監査Skillとしてパッケージ化する。

## 設計原則

1. **Evidence-First強制** — 全指摘・全テストケースに根拠（仕様該当箇所・コード位置・再現手順）の添付を必須化する。根拠を提示できない出力は破棄する。
2. **規格準拠の技法適用** — 技法の適用手順を参照ファイルにエンコードし、AIの「我流テスト設計」を排除する。
3. **29119-4カバレッジ宣言** — 適用した技法とカバレッジ項目をレポート末尾に自動宣言し、検収・監査エビデンスとして通用する形式にする。
4. **段階的開示** — SKILL.md本体は薄いルーターに留め、技法の詳細は必要時のみ `references/` から読み込む（コンテキスト節約）。

## 構成

```
001-qa-skills-pro/
├── skills/
│   ├── qa-design/          # /qa-design — テスト設計技法の適用
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── equivalence-partitioning.md   # 同値分割
│   │       ├── boundary-value-analysis.md    # 境界値分析
│   │       ├── decision-table.md             # デシジョンテーブル
│   │       └── coverage-declaration.md       # 29119-4カバレッジ宣言の書式
│   ├── qa-review/          # /qa-review — 仕様レビュー観点
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── ambiguity-patterns.md         # 曖昧表現・未定義用語パターン
│   │       └── spec-review-checklist.md      # 仕様レビューチェックリスト
│   └── qa-nonfunc/         # /qa-nonfunc — ISO 25010 非機能観点
│       ├── SKILL.md
│       └── references/
│           └── iso25010-checklist.md         # 8特性別の監査観点
└── shared/
    ├── evidence-first-policy.md   # 全Skill共通の根拠強制ポリシー
    └── report-format.md           # 指摘フォーマット・severity分類
```

## 導入方法（Claude Code）

プロジェクトの `.claude/skills/` に各Skillフォルダをコピーする:

```bash
cp -r 001-qa-skills-pro/skills/qa-design   <project>/.claude/skills/
cp -r 001-qa-skills-pro/skills/qa-review   <project>/.claude/skills/
cp -r 001-qa-skills-pro/skills/qa-nonfunc  <project>/.claude/skills/
cp -r 001-qa-skills-pro/shared             <project>/.claude/skills/qa-shared
```

各SKILL.mdは `shared/` を `../qa-shared/` として参照する前提。配置を変える場合は
SKILL.md内の参照パスを合わせて修正する。

## 使い方

| 呼び出し | 用途 | 入力 |
|---|---|---|
| `/qa-design` | テストケース設計（技法適用＋カバレッジ宣言） | 仕様書 or 対象コード |
| `/qa-review` | 仕様書・要求のレビュー | spec.md 等の仕様文書 |
| `/qa-nonfunc` | 非機能観点の監査 | 仕様書＋実装 |

## MVPスコープ（初版）

- 技法: 同値分割・境界値分析・デシジョンテーブルの3技法＋ISO 25010観点
- コード実行不要（プロンプト構成のみで動作）
- 出力: Markdown／Gherkinのテストケース＋技法カバレッジ宣言＋根拠リンク

### 次版候補

- 状態遷移テスト・ペアワイズ法の追加（`/qa-design` の references 追加のみで拡張可能）
- 不具合データ由来の観点更新（四半期改訂の運用）
