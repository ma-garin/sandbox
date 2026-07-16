# AGENTS.md — QF連携

> 共通規約は親フォルダの `sandbox/AGENTS.md` を参照。
> このファイルにはプロジェクト固有の情報のみ記載する。

---

## このプロジェクトの概要

QualityForward API（Veriserve社のテスト管理SaaS）をブラウザから使いやすく包むフロントのみのSPA。

## 対象ファイル

```
QF連携/
├── index.html                      # SPAシェル
├── css/style.css                   # スタイル
├── src/
│   ├── app.js                      # タブ切替・初期化
│   ├── providers/qualityforward.js # 低レベルAPIクライアント（never throws契約）
│   ├── client.js                   # リソース単位の薄いラッパー
│   ├── labels.js                   # category/content/result のラベル解決
│   ├── profiles.js                 # APIキープロファイル管理
│   ├── cache.js                    # ナビゲーションID記憶
│   ├── search.js                   # クライアント側検索/フィルタ/ソート
│   ├── charts.js                   # 依存なしSVG折れ線グラフ
│   ├── ui.js                       # DOM共通ヘルパー
│   └── views/*.js                  # 画面ごとの描画・イベント処理
├── tests/*.test.mjs                # node:testで直接実行するオフライン単体テスト
└── docs/API_NOTES.md               # API仕様の要点・罠のメモ
```

## 対象外ファイル

- なし

## 使用技術・制約

- Vanilla JS（ES modules）、ビルドレス。React/Vue/TypeScript等は使わない（sandbox内の既存実装 `spec-inspector/` に合わせた選定）
- テストは `node:test`/`node:assert` を直接 `node tests/x.test.mjs` で実行。package.jsonは無い
- APIキーは常にlocalStorageにのみ保存（ハードコード禁止）。QualityForward APIへの通信以外に外部送信しない

## 現在のタスク

→ `CURRENT_STATE.md` を参照
