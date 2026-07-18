# CURRENT_STATE.md — testra-next

> **更新タイミング**: 各セッション終了時に更新する。
> **次回開始**: 「CURRENT_STATE.mdを読んで再開して」の1行でコンテキスト復元。

---

## プロジェクト名

testra-next（TESTRA上位互換・一気通貫テストパイプライン）

## 最終更新

2026-07-18

## 現在のフェーズ

MVP完成（実ブラウザで動作確認済み・単体テスト13件パス）

## 直近の完了タスク

- テンプレートから `testra-next/` を作成
- 共有コア（純粋ESM）で11ステージのパイプラインを実装
  - ingest / featureAnalysis / modelAnalysis / designBasic / designDetail /
    caseHigh / caseLow / script / execution / qfSync / report
- 3ランタイム: CLI（`cli/testra.mjs`）・Web（`web/`）・ライブラリ（`runPipeline`）
- QualityForward コネクタ（dry-run既定・fetch注入可）
- LLM補強アダプタ（既定rule・openai骨組み）
- docs 一式（ARCHITECTURE / PIPELINE / RESEARCH / GOALS）
- 検証: `npm run demo` で end-to-end 出力、Chromiumで in-browser 実行確認、`npm test` 13件パス

## 次のタスク（最優先）

- `docs/GOALS.md` の **G-01（docx/pdfパーサ）** または **G-09（Playwright実行器でexecutionをlive化）** に着手

## 未解決の判断待ち事項

- QualityForward 実APIのエンドポイント/認証ヘッダ名（環境依存。実接続は別環境で検証）

## 既知の問題・技術的負債

- 日本語フィーチャー命名の粒度がぶれる（形態素未使用）→ G-04
- apk/docx/pdf のバイナリ実解析は未接続（現状メタ供給のみ）→ G-01, G-02
- execution は既定 simulated（全ケース Blocked を正直に返す）→ runner注入で live 化（G-09/G-10）

## 重要な設計決定

- コアは純粋・決定論・immutable（同一入力＝同一成果物）。I/Oはランタイム層に限定
- AIは常時ルールベースをフォールバックとする補強フック（LLM無しでフル動作）
- 秘匿情報はコードに置かず注入（web=localStorage / CLI=env）
- ビルドレス（標準ESMをブラウザ/Nodeが直接import）

## セッション開始時の指示テンプレート

```
CURRENT_STATE.mdを読んで、次のタスクから作業を再開してください。
プロジェクト: /Users/fujimagariyuki/Desktop/app/sandbox/testra-next/
```
