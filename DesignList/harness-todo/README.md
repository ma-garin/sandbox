# harness-todo — デザインモック

Harness ToDo管理システムの画面デザインモック集。

## 内容

`gallery.html` を1ページで開くと、以下のデザインを一覧できる（PNG画像を埋め込み済み、約2.9MB）。

| セクション | 画面数 | 内容 |
|---|---|---|
| ① ライトテーマ | 5 | 主要画面のライト表示 |
| ② ダークテーマ | 5 | 同一画面のダーク表示（OSダークモード連動想定・トークン切替のみ） |
| ③ 折りたたみサイドバー | 2 | シェブロンでアイコンのみ表示に切替 |
| ④ インタラクション状態 | 5 | クリック動作検証済みの各状態 |

## デザイントークン（gallery.html の `:root` より）

- primary: `#1976D2` / primary-deep: `#0D47A1`
- ground: `#F4F6F9` / surface: `#FFFFFF` / border: `#E3E8EE`
- ink: `#1A212B` / ink-2: `#56616F`
- font: system-ui 系（Hiragino Sans / Yu Gothic / Noto Sans JP など）

## 使い方

```bash
# ブラウザで開く
open gallery.html
```

## 実装

`gallery.html` のモックを、動作する静的Webアプリとして `app/` に実装済み。
素の HTML/CSS/JS 構成（ビルド不要・GitHub Pages 対応）。詳細は `app/README.md` を参照。

```bash
open app/index.html
```

## メモ

- `gallery.html` は「見た目確定用のモック」、`app/` はそれを落とし込んだ実装。
- 実装は5画面＋ライト/ダーク＋折りたたみ＋インタラクション状態（モーダル/削除/通知/空状態/エラー）を再現。
