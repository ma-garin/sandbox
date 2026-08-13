# CURRENT_STATE.md — DesignList

> **更新タイミング**: 各セッション終了時に更新する。
> **次回開始**: 「CURRENT_STATE.mdを読んで再開して」の1行でコンテキスト復元。

---

## プロジェクト名

DesignList

## 最終更新

2026-07-21

## 現在のフェーズ

拡張中（デザインシステム・カタログ化。現在 5 スタイル）

## 直近の完了タスク

<!-- 完了したタスクを一言で -->
- `_template/` をコピーして DesignList フォルダを作成・初期化
- `harness-todo/`（モック集＋動作アプリ）を「適用サンプル」として整備
- DesignList を **デザインシステム・カタログ**化（`index.html` ＋ `systems/`）
- スタイル別コンポーネント集を5種実装:
  material（Material 3）/ carbon（Carbon）/ apple（HIG）/ atlassian（Jira・Confluence）/ salesforce（Lightning）
- 各スタイルに象徴的部品を実装（FAB / インライン通知 / セグメント・iOSスイッチ / ロゼンジ / パス）
- 共通土台 `systems/_shared/`（showcase.css/js）＋全スタイルのライト/ダーク対応
- Chromium で全ページ・ライト/ダークをスクショ確認・JSエラーゼロ

## 次のタスク（最優先）

<!-- 次にやること（対象ファイルを明記） -->
- 必要に応じて更にスタイル追加（例: ミニマル/モノクロ、グラス）— `systems/<style>/` を1つ増やす
- 各スタイルに「適用サンプル画面（ダッシュボード等）」を1枚ずつ用意して差を完成形で体感できるように

## 既知の問題・技術的負債

<!-- 後で直す前提で放置しているもの -->
- harness-todo アプリのカレンダー・プロジェクト画面はプレースホルダのみ
- 各ショーケースは部品カタログ中心（完成画面サンプルは未整備）
- フォント（Roboto / IBM Plex）は Web フォント未読込でシステムフォント代替

## 重要な設計決定

<!-- なぜその選択をしたかを1行で -->
- 拡張方式は「スタイル別コンポーネント集」（Material/Carbon 型のカタログに最も近い）
- 見た目は各 `<style>.css` の `--sc-*` トークン＋コンポーネント class に集約、骨組みは `_shared` で共有
- 同じ class 名を各スタイルが自言語で解釈 → 部品を横並びで比較できる
- 技術はビルド不要の素HTML/CSS/JS（GitHub Pages 直デプロイ・自己完結を優先）

## セッション開始時の指示テンプレート

```
CURRENT_STATE.mdを読んで、次のタスクから作業を再開してください。
プロジェクト: /Users/fujimagariyuki/Desktop/app/sandbox/DesignList/
```
