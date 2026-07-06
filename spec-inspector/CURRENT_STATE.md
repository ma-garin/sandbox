# CURRENT_STATE.md — spec-inspector

> **更新タイミング**: 各セッション終了時に更新する。
> **次回開始**: 「CURRENT_STATE.mdを読んで再開して」の1行でコンテキスト復元。

---

## プロジェクト名

spec-inspector（QuintSpectレベルアップ版）

## 最終更新

2026-07-06

## 現在のフェーズ

実装済みMVP完成（レビュー・拡張フェーズ）

## 直近の完了タスク

- ディレクトリ作成＋元QuintSpectの調査（`docs/RESEARCH.md`）
- 6観点ルールベース解析エンジン（`src/engine.js`）
- 文書間矛盾検知（`src/consistency.js`）／トレーサビリティ矩阵（`src/traceability.js`）
- 入力パーサ text/md/docx/pdf（`src/parsers.js`、docxはネイティブAPIのみ）
- 履歴・スコア比較（`src/history.js`）／LLMアダプタ骨組み（`src/llm.js`）
- 依存なしSVGレーダー/スコアバー（`src/charts.js`）／UI（`index.html`/`src/app.js`/`css/style.css`）
- Node単体テスト13件パス（`tests/engine.test.mjs`）
- 実ブラウザ(Chromium)でE2E検証済み（解析/トレース/履歴/設定、JSエラーなし）

## 次のタスク（最優先）

- LLM（Claude API）補足解析の実接続（`src/llm.js` の enrichWithAI）
- コメント付きファイル出力（問題箇所アノテーション）
- 矛盾検知UIの複数ファイル導線強化（textareaだけでは2文書にならない）

## 未解決の判断待ち事項

- 決定済み: MVPフル構成／ルールベース先行／Word・PDF対応

## 既知の問題・技術的負債

- 公式サイトが403でbot遮断のため、UI詳細は一次情報未確認（RESEARCH.mdに明記済）

## 重要な設計決定

- ブラウザ完結＋localStorageでAPIキー管理（sandbox規約・GitHub Pages配信に整合）
- 元5観点に「検証可能性」を追加してレベルアップの軸とする

## セッション開始時の指示テンプレート

```
CURRENT_STATE.mdを読んで、次のタスクから作業を再開してください。
プロジェクト: sandbox/spec-inspector/
```
