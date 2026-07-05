# AGENTS.md — 001-qa-skills-pro

> 共通規約は親フォルダの `sandbox/AGENTS.md` を参照。
> このファイルにはプロジェクト固有の情報のみ記載する。

---

## このプロジェクトの概要

ポートフォリオ資料 DOM-06「QA Skills Pro」のMVP。ISTQB／ISO 29119-4のテスト設計技法と
ISO 25010観点を、Evidence-First強制付きのAgent Skillパッケージとして実装する。

## 対象ファイル

```
001-qa-skills-pro/
├── README.md              # 概要・導入方法
├── docs/TRIAGE.md         # 全50案の実装選別結果（本プロジェクト採択の経緯）
├── skills/
│   ├── qa-design/         # SKILL.md + references/（技法4ファイル）
│   ├── qa-review/         # SKILL.md + references/（観点2ファイル）
│   └── qa-nonfunc/        # SKILL.md + references/（25010観点）
└── shared/                # evidence-first-policy.md / report-format.md
```

## 対象外ファイル

- なし（このフォルダ内で完結）

## 使用技術・制約

- Markdownのみ（コード実行なし、ビルドなし）
- SKILL.md は Claude Code Agent Skill 形式（frontmatter: name / description）
- 段階的開示: SKILL.md 本体は薄く保ち、詳細は references/ に分離する
- 全Skillの出力は `shared/` の2ポリシーに従う（変更時は3 Skill整合を確認）

## 現在のタスク

→ `CURRENT_STATE.md` を参照
