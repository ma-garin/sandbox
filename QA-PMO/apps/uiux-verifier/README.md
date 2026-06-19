# UI/UX検証モジュール

PMOメニュー「**AIサービス › AIツール › UI/UX検証**」の実working モジュール。
Webページ（URL/HTML）のUI/UX品質を、**客観検査（axe-core / Lighthouse）** と
**AIヒューリスティック評価（GPT-4o Vision / ISO 25010）** で多角的に検証し、
**ISO 29119-3** 形式のレポートを出力する。

## 設計思想：車輪の再発明をしない

検証エンジンは一切自作せず、確立OSSをオーケストレーションする。

| 役割 | 採用技術 |
|---|---|
| ブラウザ描画・スクショ | Playwright |
| アクセシビリティ検査（WCAG） | axe-core（`axe-playwright-python`） |
| 性能/品質スコア | Lighthouse（Node CLI） |
| UXヒューリスティック評価 | OpenAI GPT-4o Vision（JSON強制 / Evidence-only） |
| 回帰評価 | DeepEval（+ Langfuse 任意） |

## セットアップ

```bash
# Python依存
pip install -r requirements.txt
playwright install chromium

# Lighthouse（任意・URL検証の客観スコア用）
npm install            # または: npm i -g lighthouse

# APIキー
cp .env.example .env   # OPENAI_API_KEY を設定（コミット厳禁）
```

## 使い方

```bash
streamlit run app.py
```

- **URLで検証**: 描画 → axe-core → Lighthouse → AI評価
- **HTMLで検証**: アップロードHTMLを描画 → axe-core → AI評価

結果はseverity別サマリ・axe違反・UX指摘・ISO 29119レポート（DL可）で表示される。

## 回帰テスト（agent-eval）

```bash
deepeval test run evals/test_ux_eval.py
# または
pytest evals/test_ux_eval.py
```

`OPENAI_API_KEY` 未設定時は自動でスキップされる。

## ディレクトリ

```
uiux-verifier/
├── app.py                    # Streamlit UI（紺系design-system）
├── core/
│   ├── schema.py             # 型定義（ISTQB severity / ISO 25010）
│   ├── capture.py            # Playwright + axe-core
│   ├── lighthouse_runner.py  # Lighthouse CLIラッパー
│   ├── ux_evaluator.py       # GPT-4o Vision評価（Evidence-only）
│   └── report.py             # ISO 29119-3レポート生成
├── prompts/ux_system_prompt.md
├── evals/                    # DeepEval回帰 + golden
├── docs/                     # SDD（requirements/design/tasks）
├── requirements.txt / package.json / .env.example
```

## 品質基準（非交渉・qa-review-standards）

- ISTQB Severity（Critical/Major/Minor/Cosmetic）
- ISO/IEC 25010 ユーザビリティ5サブ特性で分類
- ISO/IEC 29119-3 形式でレポート化
- Evidence-only：証拠（axe/Lighthouse/可視要素）に基づく判定のみ。推測禁止
