# AGENTS.md — UI/UX Knowledge Atlas

> 共通規約は親フォルダの `sandbox/AGENTS.md` を参照。
> このファイルにはプロジェクト固有の情報のみ記載する。

---

## このプロジェクトの概要

GitHub Pages で公開する大型 UI/UX 学習サイトの設計・実装フォルダ。
企画書（HTML）から静的サイト実装へ段階的に移行する。

## 対象ファイル

```
Design/
├── README.md
├── AGENTS.md
├── CURRENT_STATE.md
├── site-structure.md
├── wireframes.md
├── chapters/
│   ├── 01-foundation.md
│   ├── 02-cognitive-laws.md
│   ├── 03-ui-patterns.md
│   ├── 04-research.md
│   ├── 05-accessibility.md
│   ├── 06-design-system.md
│   ├── 07-qa-ux.md
│   └── 08-ai-ux.md
└── roadmap.md
```

## 対象外ファイル

- `_template/` 内のファイル（このプロジェクトの元テンプレート）

## 使用技術・制約

- 静的サイト: HTML / CSS / JS（フレームワーク未定: VitePress / Astro / Docusaurus / plain HTML から選択）
- 公開先: GitHub Pages（1GB 以下制限、初回ロードは軽量に保つ）
- 図表: SVG 推奨。無圧縮 PNG・GIF・一括読み込みは避ける

## 作業ルール

- 章ごとにファイルを分割する。単一巨大ファイルを作らない
- JSON データ（法則・レシピ・WCAG マップ）は `data/` に分離する
- コミットは章単位・フェーズ単位で細かく切る

## 現在のタスク

→ `CURRENT_STATE.md` を参照
