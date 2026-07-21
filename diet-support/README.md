# Diet Support — 体重管理 PWA

recstyle からの乗り換え用に作った、体重・ダイエット管理アプリ。
スマホのホーム画面に追加してオフラインで使える PWA（Progressive Web App）。
サーバ不要・ゼロランニングコスト（GitHub Pages + localStorage）。

## 特徴

- **体重／体脂肪率の記録** — 日付ごとに記録。±ボタンで 0.1kg 刻み調整、BMI 自動計算
- **推移グラフ** — 依存ライブラリなしの自作 SVG 折れ線（2週／1ヶ月／3ヶ月／6ヶ月／全期間）。7日移動平均・目標ライン付き
- **目標進捗** — 目標体重・目標日を設定すると、達成率・残り kg・残り日数を表示
- **ホームダッシュボード** — 最新体重、前回比／7日前比／開始からの増減、BMI、連続記録日数
- **recstyle からの移行** — recstyle でエクスポートした CSV を読み込み（日付・体重・体脂肪率・メモ列を自動判別）
- **バックアップ** — JSON エクスポート／インポートで機種変更時もデータ引き継ぎ
- **完全オフライン** — Service Worker（cache-first）で通信なしでも動作。データは端末内 localStorage に保存

## 構成

ビルド不要。静的ファイルのみ。

```
diet-support/
├── index.html          # UI（インライン CSS）
├── app.js              # アプリロジック（依存なしの素の JS）
├── manifest.json       # PWA マニフェスト
├── sw.js               # Service Worker（オフライン対応）
└── icons/
    ├── icon.svg
    └── icon-maskable.svg
```

## ローカルで動かす

任意の静的サーバで配信するだけ（`file://` だと Service Worker が動かないため）。

```bash
cd diet-support
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

## GitHub Pages に公開する

このフォルダをそのまま GitHub Pages で公開できる（すべて相対パス構成なので、
リポジトリ直下・サブパスどちらでも動く）。

- **方法A（推奨・自動デプロイ）**: リポジトリ設定 → Pages → Source を「GitHub Actions」にし、
  `.github/workflows/deploy-diet-support.yml`（本リポジトリ同梱）で `diet-support/` を公開する。
  公開 URL は `https://<user>.github.io/<repo>/`
- **方法B（手動）**: Settings → Pages → Source を「main / (root)」にし、
  `https://<user>.github.io/<repo>/diet-support/` を開く

公開後、スマホのブラウザでアクセスし「ホーム画面に追加」でアプリとして常用できる。

## recstyle からの移行手順

1. recstyle アプリでデータを CSV としてエクスポート
2. 本アプリの「設定 → recstyle CSV を読み込む」で選択
3. 日付・体重・体脂肪率・メモ列を自動判別して取り込み（同じ日付は上書き）

> CSV のヘッダ名（日付／体重／体脂肪率／メモ、および英語 date/weight/fat/memo）から
> 列を自動判別する。ヘッダが無い場合は「1列目=日付, 2列目=体重, 3列目=体脂肪率, 4列目=メモ」
> と推定する。日付は `2026/07/21` `2026-07-21` `2026.07.21` `20260721` の各形式に対応。

## データについて

- 保存先は端末内の `localStorage`（キー: `diet-support:records:v1` ほか）。外部に送信しない
- iOS Safari はストレージが自動削除される場合があるため、**定期的に JSON エクスポート**を推奨
- スキーマは version 付き。将来の形式変更時は `app.js` の `runMigrations()` で移行する

## メモ

- デザインは Yuki Design System（MD3 Light）準拠
- メインターゲット: Galaxy Z Fold5 / iPhone Safari。折りたたみ両状態でも崩れないレスポンシブ
