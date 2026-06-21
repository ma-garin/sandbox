# 制作ロードマップ

## フェーズ概要

```
Phase 1  目次・章構成・ディレクトリ設計    ← 現在
    ↓
Phase 2  4画面の HTML 実装
    ↓
Phase 3  法則30件・レシピ50本
    ↓
Phase 4  検索・索引・タグ
    ↓
Phase 5  300MB 級へ拡張
```

---

## Phase 1: 構成設計（現在）

**目標**: 骨格を固める。ここが崩れると後続が全部崩れる。

| タスク | 状態 | 成果物 |
|--------|------|--------|
| ブループリント HTML 作成 | ✅ 完了 | `uiux_knowledge_atlas_blueprint_v2.html` |
| Design/ フォルダ作成 | ✅ 完了 | `Design/` |
| README / AGENTS / CURRENT_STATE 作成 | ✅ 完了 | 各 .md ファイル |
| 章別 .md ファイル作成（8章） | ✅ 完了 | `chapters/01〜08.md` |
| site-structure.md 作成 | ✅ 完了 | `site-structure.md` |
| wireframes.md 作成 | ✅ 完了 | `wireframes.md` |
| 静的サイトジェネレーター選定 | ⬜ 未着手 | 決定文書 |

---

## Phase 2: 4画面 HTML 実装

**目標**: 実サイトの骨格となる4画面を動く HTML で作る。

| タスク | 状態 | 成果物 |
|--------|------|--------|
| 共通 CSS / JS の設計 | ⬜ 未着手 | `assets/style.css` / `assets/nav.js` |
| サイドメニュー共通コンポーネント | ⬜ 未着手 | `assets/sidebar.html` |
| トップページ（index.html） | ⬜ 未着手 | `index.html` |
| 章トップページ（テンプレート） | ⬜ 未着手 | `chapters/template-chapter.html` |
| 法則詳細ページ（テンプレート） | ⬜ 未着手 | `chapters/template-law.html` |
| レシピ詳細ページ（テンプレート） | ⬜ 未着手 | `chapters/template-recipe.html` |

---

## Phase 3: コンテンツ量産（法則30件・レシピ50本）

**目標**: サイトとして「使える」コンテンツ量にする。

| タスク | 目標数 | 状態 |
|--------|--------|------|
| 法則ページ（Laws of UX + Nielsen） | 30件 | ⬜ 未着手 |
| レシピカード | 50本 | ⬜ 未着手 |
| SVG 図解 | 50枚 | ⬜ 未着手 |
| JSON データ化（laws.json） | 30件 | ⬜ 未着手 |
| JSON データ化（ui-patterns.json） | 50件 | ⬜ 未着手 |

---

## Phase 4: 検索・索引・タグ

**目標**: コンテンツが増えても迷わない導線を作る。

| タスク | 状態 |
|--------|------|
| 検索ライブラリ選定（Pagefind / Lunr.js） | ⬜ 未着手 |
| 検索 index 生成スクリプト | ⬜ 未着手 |
| タグシステム設計 | ⬜ 未着手 |
| 索引ページ（全法則・全レシピ一覧） | ⬜ 未着手 |

---

## Phase 5: 300MB 級へ拡張

**目標**: 「オライリー級」のボリュームにする。

| タスク | 目標数 | 状態 |
|--------|--------|------|
| 法則ページ | 100件 | ⬜ 未着手 |
| レシピカード | 300本 | ⬜ 未着手 |
| SVG 図解 | 500枚 | ⬜ 未着手 |
| 演習・クイズ | 100問 | ⬜ 未着手 |
| サンプル画面（模擬） | 100画面 | ⬜ 未着手 |
| GitHub Pages 最適化（画像圧縮・遅延読み込み） | - | ⬜ 未着手 |

---

## 技術スタック候補

| 選択肢 | メリット | デメリット | 向いている場合 |
|--------|---------|-----------|--------------|
| Plain HTML + CSS | 依存ゼロ・軽量 | 量産が大変 | 小〜中規模 |
| VitePress | Markdown → HTML 自動変換・検索内蔵 | Vue 依存 | ドキュメントサイト |
| Astro | 高速・静的生成・MDX 対応 | 学習コスト | コンテンツサイト |
| Docusaurus | 検索・バージョニング内蔵 | React 依存 | 大規模ドキュメント |

**推奨**: Phase 2 は Plain HTML で素早く骨格を固め、Phase 3 以降で Astro または VitePress への移行を検討する。

---

## 判断待ち事項

- [ ] 静的サイトジェネレーター: plain HTML / VitePress / Astro / Docusaurus
- [ ] 検索実装: Pagefind / Lunr.js / Algolia DocSearch
- [ ] GitHub Pages リポジトリ: 既存リポジトリ配下 or 専用リポジトリ（`ma-garin.github.io/uiux-atlas` 等）
