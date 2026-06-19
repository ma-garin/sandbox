# requirements.md — UI/UX検証モジュール

## 1. 誰のための何の機能か
- **対象ユーザー**: 第三者検証エンジニア・QA担当・PMO
- **目的**: Webページ（URLまたはHTML）のUI/UX品質を、確立ツール（axe-core / Lighthouse）の客観的証拠とLLMのヒューリスティック評価で多角的に検証し、ISO 29119形式のレポートを出力する

## 2. 受け入れ基準

### 機能要件
| # | 要件 | 優先度 |
|---|---|---|
| UX-F-01 | URL入力またはHTMLアップロードで対象を指定できる | Must |
| UX-F-02 | Playwrightで対象を描画し、フルページスクリーンショットを取得できる | Must |
| UX-F-03 | axe-coreでWCAGアクセシビリティ違反を検出できる（証拠） | Must |
| UX-F-04 | LighthouseでPerformance/Accessibility/Best-Practicesスコアを取得できる | Should |
| UX-F-05 | スクショ＋axe結果をGPT-4o Visionに渡し、ISO 25010観点でUX評価できる | Must |
| UX-F-06 | 検出事項をISTQB severity付きで一覧表示できる | Must |
| UX-F-07 | ISO 29119-3形式のレポートをMarkdownでダウンロードできる | Should |

### 非機能要件（nfr-standards準拠）
| # | 要件 | 基準 |
|---|---|---|
| UX-N-01 | アクセシビリティ評価基準 | WCAG 2.1 AA |
| UX-N-02 | LLM判定はEvidence-only（証拠なしの「良さそう」判定を禁止） | 非交渉 |
| UX-N-03 | LLM出力はJSON強制（パース失敗防止） | 非交渉 |
| UX-N-04 | APIキーはコミットしない（.env管理） | 非交渉 |
| UX-N-05 | 全関数に型ヒント・日本語コメント | CLAUDE.md準拠 |

### 品質基準（qa-review-standards適用）
- ISTQB Severity: Critical / Major / Minor / Cosmetic
- ISO/IEC 25010 ユーザビリティ5サブ特性で分類
- ISO/IEC 29119-3 必須フィールドでレポート化

### 除外
- 自動修正（提案のみ。実コード修正は対象外）
- 複数ページの一括クロール（単一ページ検証に限定）
- モバイル実機検証（Lighthouseのエミュレーションのみ）

## 3. AI基盤
- OpenAI API（GPT-4o系）。streamlit-rag-app / agent-eval の業務judge方針に準拠
- 観測は Langfuse（任意・セルフホスト）、回帰は DeepEval
