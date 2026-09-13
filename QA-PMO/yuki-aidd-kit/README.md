# Yuki AIDD Kit

過去のAIDD実績から抽出した、Claude Code用パーソナライズドキット。

## 構成

```
yuki-aidd-kit/
├── CLAUDE.md.template          # グローバル設定（環境・予算制約・QA観点）
├── AGENTS.md.template          # Codex用グローバル設定
├── skills/
│   ├── single-html-tool/       # 単一HTMLツール開発（デモ→本実装の起点）
│   ├── sdd-ecc-workflow/       # SDD 10ステップ + ECC + Codex対応
│   ├── qa-review-standards/    # ISO 25010・ISTQB severity・Whittakerツアー
│   ├── personal-pwa/           # GitHub Pages PWA・Gemini無料枠・Fold5対応
│   ├── streamlit-rag-app/      # PMOエージェント系（RAG・multi-agent）
│   ├── design-system/          # MD3トークン（#1976D2系/#1a3a6b系）
│   ├── nfr-standards/          # パフォーマンス予算・WCAG・タッチターゲット
│   ├── agent-eval/             # DeepEval + Langfuseセルフホスト評価基盤
│   ├── personal-codex-workflow/ # 日本語・低コスト・承認ベースのCodex作業規律
│   └── qa-pmo-context-triage/   # QA-PMO repoを小さく読んで次手を整理
├── claude-code/
│   ├── hooks/
│   │   ├── settings.json
│   │   ├── pre-write-check.sh
│   │   ├── post-write-html.sh
│   │   └── session-summary.sh
│   └── commands/
│       ├── new-pwa.md
│       ├── qa-review.md
│       ├── sdd-start.md
│       ├── token-check.md
│       ├── doc-search.md
│       ├── eval.md
│       └── retro.md
├── templates/
│   ├── CURRENT_STATE.md.template
│   ├── ADR.md.template
│   └── lessons.md.template
├── github-actions/
│   ├── deploy.yml
│   └── secret-scan.yml
└── scripts/
    ├── install.sh
    └── verify.sh
```

## 導入手順

```bash
chmod +x scripts/install.sh scripts/verify.sh
./scripts/install.sh
./scripts/verify.sh
```

Codexを使う場合は`AGENTS.md.template`を`~/.codex/AGENTS.md`にコピー。

## 設計判断の要点
- 個人プロジェクトはゼロ予算厳守（AI=Gemini無料枠、有料MCP不採用）
- 業務プロジェクトはOpenAI API可（judgeモデル等で精度優先）
- デザインは個人=`#1976D2`系/業務=`#1a3a6b`系で切替（design-system参照）
- 全成果物にISTQB severity + ISO 25010の品質観点を非交渉で適用
