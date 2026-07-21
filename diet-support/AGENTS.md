# AGENTS.md — diet-support

> 共通規約は親フォルダの `sandbox/AGENTS.md` を参照。
> このファイルにはプロジェクト固有の情報のみ記載する。

---

## このプロジェクトの概要

体重・ダイエット管理 PWA。recstyle（体重記録アプリ）からの乗り換え先。
スマホのホーム画面に追加してオフラインで使う。GitHub Pages（ma-garin）へ公開。

## 対象ファイル

```
diet-support/
├── index.html          # UI + インライン CSS（Yuki Design System / MD3 Light）
├── app.js              # 全ロジック（storage / render / chart / CSV import）
├── manifest.json       # PWA マニフェスト
├── sw.js               # Service Worker（cache-first、CACHE 名でバージョン管理）
├── icons/icon.svg           # 通常アイコン
└── icons/icon-maskable.svg  # maskable アイコン
```

## 対象外ファイル

- なし（自己完結。外部依存・ビルドツールなし）

## 使用技術・制約

- **依存ゼロ**: 素の HTML/CSS/JS のみ。npm/ビルド/フレームワーク不使用
- **オフライン必須**: 外部 CDN に依存しない（Google Fonts は取得不可時 system font にフォールバック）
- **データ**: localStorage。キー `diet-support:{records|profile|meta}:v1`、スキーマ version 付き
- **immutable 更新**: 記録変更時は `normalize([...])` で新配列を生成
- **相対パス厳守**: GitHub Pages のサブパスでも動くよう `./` 始まりで統一（manifest / sw / 資産）

## 変更時の注意

- アプリ資産（index.html / app.js 等）を更新したら `sw.js` の `CACHE` バージョン文字列を必ず上げる
- localStorage スキーマを変える時は `app.js` の `runMigrations()` に移行処理を追記し `SCHEMA_VERSION` を上げる
- チャートは自作 SVG（`drawChart()`）。ライブラリ追加はオフライン要件に反するため避ける

## 現在のタスク

→ `CURRENT_STATE.md` を参照
