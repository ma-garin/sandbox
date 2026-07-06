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

## 直近の完了タスク（第2弾: UX審査→業務品質化）

- UX審査で検出した5問題を全解消（詳細: Artifact「spec-inspector UX審査レポート」）
  - エクスポート3種（HTMLレポート/CSV/コメント付きMD）→ `src/report.js`
  - Claude API 実接続（Sonnet 5 / Haiku 4.5、graceful degradation）→ `src/llm.js`
  - レーダーラベル欠け修正 → `src/charts.js`
  - severity/観点/文書フィルタ＋文書別スコア表 → `src/app.js`
  - タブ件数バッジ＋空状態CTA＋サンプル3文書一括投入
- 単体テスト25件パス（engine 13 + report/llm 12）、Chromium E2Eで全機能自動検証

## 直近の完了タスク（第3弾: OpenAI移行＋プロンプト基盤＋/goal整備）

- AIプロバイダをOpenAI APIへ移行（org/project/key設定、既定gpt-5-mini、JSONモード、
  fetchモックで全経路オフライン検証。実API実行は別環境で後日）
- 内部プロンプトパック `src/prompts/`（観点別指示・few-shot 8例・JSON契約・チャンク分割。
  few-shot自己整合の機械検証付き）
- `/goal` コマンド（`yuki-aidd-kit/claude-code/commands/goal.md`）と
  受入基準付きバックログ `docs/GOALS.md`（G-01〜G-13）を整備
- テスト56件パス（engine 13 / report 7 / prompts 20 / llm 16）＋route stubブラウザE2E

## 次のタスク（最優先）

- `/goal` で GOALS.md を順次実行（推奨順: G-01→G-02→G-03→…。実行者: Sonnet）
- 別環境でorg/project/keyを設定し、G-13手順書に沿って実APIのE2E＋プロンプト実測チューニング

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
