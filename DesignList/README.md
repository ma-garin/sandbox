# DesignList

Webシステムのデザインを作り込むための **デザインシステム・カタログ**。
Material / Carbon などのデザイン言語ごとに「同じ部品セット」を並べ、見比べ・使い回せるようにする。
新しい案件は、まずここでスタイルを選ぶところから始める。

## 使い方

```bash
# カタログトップをブラウザで開く（ビルド不要・GitHub Pages 対応）
open index.html
```

`index.html`（カタログ）→ 各スタイルのショーケース → 部品をコピーして各案件へ、という流れ。

## 構成

```
DesignList/
├── index.html            カタログトップ（各スタイルのプレビュー＋リンク）
├── assets/catalog.css    カタログの見た目
├── systems/
│   ├── _shared/          全スタイル共通の土台
│   │   ├── showcase.css    デザイン中立のレイアウト骨組み
│   │   └── showcase.js     共通操作（テーマ切替・タブ・モーダル・コピー）
│   ├── material/         Material Design 3 風
│   ├── carbon/           IBM Carbon 風
│   ├── apple/            Apple 風（HIG / iOS・macOS）
│   ├── atlassian/        Atlassian 風（Jira / Confluence）
│   └── salesforce/       Salesforce 風（Lightning）
│       （各フォルダ = index.html + <style>.css）
└── harness-todo/         適用サンプル（特定スタイルを実画面まで作り込んだ実例）
    ├── gallery.html        デザインモック集
    └── app/                動作する実装（詳細は app/README.md）
```

## デザイン言語（現在 5 スタイル）

| スタイル | 特徴 | 主な用途 | 象徴的な部品 |
|---|---|---|---|
| **Material Design 3** | 大きな角丸・トーナルカラー・状態レイヤー・エレベーション | 親しみやすく動きのあるUI | FAB |
| **IBM Carbon 風** | 角ばった形状・機能的グレー・Blue 60・高い情報密度 | 業務／エンタープライズ系 | インライン通知 |
| **Apple 風（HIG）** | SFフォント・systemBlue・繊細な角丸・広い余白 | 洗練された一般向けアプリ | セグメント／iOSスイッチ |
| **Atlassian 風** | ブルー #0052CC・ニュートラル階調・控えめボタン | チケット管理／ドキュメント | ロゼンジ |
| **Salesforce 風** | ブランドブルー・境界線ボタン・高密度テーブル | CRM／業務アプリ | パス（ステージ） |

各ショーケースが共通で持つ部品セット:
カラートークン / タイポグラフィ / ボタン / フォーム（入力・選択・トグル）/ タグ・バッジ・ステータス /
カード / データテーブル / フィードバック / タブ / プログレス / モーダル。
いずれもライト・ダーク両対応（右上のトグルで切替）。

## 新しいスタイルの追加手順

1. `systems/<style>/` フォルダを作る
2. `<style>.css` にトークン（`:root` / `[data-theme="dark"]`）と各コンポーネント class を定義
3. `_shared/showcase.css` と `showcase.js` を読み込んだ `index.html` に部品を並べる
   （既存の material / carbon の `index.html` をひな形にすると速い）
4. `DesignList/index.html`（カタログ）にカードを1枚追加

## 設計メモ

- 見た目（色・角丸・タイポ）は各 `<style>.css` の `--sc-*` トークン＋コンポーネント class に集約。
- レイアウト骨組み（`_shared/showcase.css`）はデザイン中立で、全スタイルが共有する。
- 同じ class 名（`.btn`, `.field`, `.tag` など）を各スタイルが自分の言語で解釈するため、部品が比較しやすい。
- 検証: Chromium で全ページのライト/ダークをスクショ確認・JSエラーゼロ。
