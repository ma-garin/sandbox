# CURRENT_STATE.md — UI/UX Knowledge Atlas

> **更新タイミング**: 各セッション終了時に更新する。
> **次回開始**: 「CURRENT_STATE.mdを読んで再開して」の1行でコンテキスト復元。

---

## プロジェクト名

UI/UX Knowledge Atlas

## 最終更新

2026-06-21

## 現在のフェーズ

設計中（Phase 1: 目次・章構成・ディレクトリ設計）

## 直近の完了タスク

- ブループリント HTML（`uiux_knowledge_atlas_blueprint_v2.html`）作成
- `Design/` フォルダ作成（`_template` からコピー）
- 各種 `.md` ファイル作成（README / AGENTS / CURRENT_STATE / site-structure / wireframes / chapters / roadmap）

## 次のタスク（最優先）

- `site-structure.md` を確定し、実際のディレクトリを切る
- `index.html` のスケルトンを作成（左サイドメニュー + ヒーロー + 章グリッド）
- `chapters/01-foundation.html` を最初の実ページとして作成

## 未解決の判断待ち事項

- 静的サイトジェネレーター選定: plain HTML / VitePress / Astro / Docusaurus
- 検索実装方法: Pagefind / Lunr.js / Algolia DocSearch
- GitHub Pages リポジトリ: 既存リポジトリ配下 or 専用リポジトリ

## 既知の問題・技術的負債

- なし（設計フェーズのため）

## 重要な設計決定

- 左固定サイドメニューを採用（章数が多くても全体像を把握しやすいため）
- 単一巨大 HTML ではなく章分割方式（GitHub Pages 運用・将来 300MB 超を見越して）
- 図表は SVG 中心（軽量・スケーラブル・ダークモード対応しやすい）

## セッション開始時の指示テンプレート

```
CURRENT_STATE.mdを読んで、次のタスクから作業を再開してください。
プロジェクト: /sandbox/Design/
```
