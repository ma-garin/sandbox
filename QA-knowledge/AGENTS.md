# AGENTS.md — QA Knowledge Reverse Docs

> 共通規約は親フォルダの `sandbox/AGENTS.md` を参照。
> このファイルにはプロジェクト固有の情報のみ記載する。

---

## このプロジェクトの概要

公開WebシステムのURLから画面要素を解析し、上流工程で用いる人間向けドキュメントを生成するPython製Webシステム。

## 最上位規約

`yuki-aidd-kit/` はこのプロジェクトの憲法である。参考資料ではなく、設計・実装・UI・品質判定の上位規約として扱う。

作業前に、依頼内容に対応する `yuki-aidd-kit/skills/*/SKILL.md` を必ず読む。読んでいないスキルの領域について、独自判断で実装・デザイン・品質判定を進めない。

### 必須参照ルール

- UI/UX、配色、レイアウト、コンポーネント変更: `yuki-aidd-kit/skills/design-system/SKILL.md`
- Streamlitアプリ構造、session_state、業務アプリUI: `yuki-aidd-kit/skills/streamlit-rag-app/SKILL.md`
- 要件定義、spec/plan/tasks、開発進行: `yuki-aidd-kit/skills/sdd-ecc-workflow/SKILL.md`
- QA、レビュー、テスト観点、severity分類: `yuki-aidd-kit/skills/qa-review-standards/SKILL.md`
- 非機能要件: `yuki-aidd-kit/skills/nfr-standards/SKILL.md`
- テスト実装・実行: `yuki-aidd-kit/skills/test-automation/SKILL.md`
- 完了判定: `yuki-aidd-kit/skills/done-gate/SKILL.md`

### 作業時の順序

1. 対象タスクに該当するkitスキルを読む
2. kitの判断軸・値・出力形式を確認する
3. 既存実装との差分だけを最小修正する
4. pytest等で検証する
5. `CURRENT_STATE.md` に判断と残課題を更新する

## 対象ファイル

```
QA-knowledge/
├── app.py
├── src/
├── tests/
├── .streamlit/
├── README.md
├── CURRENT_STATE.md
├── AGENTS.md
└── yuki-aidd-kit/
```

## 対象外ファイル

<!-- 読まない・触らないファイルがあれば明記 -->
- 親ディレクトリ配下の他プロジェクト
- `yuki-aidd-kit/` の既存資産そのものは、明示依頼なしに改変しない

## 使用技術・制約

- Python 3
- Streamlit
- requests
- BeautifulSoup
- pytest
- 初期MVPはLLM/APIキー不要
- 起点URLから同一ドメイン内リンクを上限ページ数まで自動探索する
- URLから断定できない情報は、推定・根拠・確信度・人間レビュー要否として扱う

## 現在のタスク

→ `CURRENT_STATE.md` を参照
