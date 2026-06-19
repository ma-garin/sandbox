# tasks.md — UI/UX検証モジュール

| # | タスク | 対応ファイル | ステータス |
|---|---|---|---|
| UX-01 | pydantic型定義（Severity/Finding/Result） | core/schema.py | ✅ |
| UX-02 | Playwright描画・スクショ・axe実行 | core/capture.py | ✅ |
| UX-03 | Lighthouse起動・パース（グレースフル） | core/lighthouse_runner.py | ✅ |
| UX-04 | GPT-4o Vision UX評価（JSON強制/Evidence-only） | core/ux_evaluator.py | ✅ |
| UX-05 | ISO 29119レポート生成 | core/report.py | ✅ |
| UX-06 | Streamlit UI（紺系・severityバッジ・DL） | app.py | ✅ |
| UX-07 | UX評価systemプロンプト | prompts/ux_system_prompt.md | ✅ |
| UX-08 | DeepEval回帰テスト + golden | evals/test_ux_eval.py | ✅ |
| UX-09 | 依存定義・セットアップ手順 | requirements.txt / package.json / README | ✅ |
| UX-10 | 実環境での結合確認（OpenAIキー要） | — | 🔲 ユーザー環境で実施 |
