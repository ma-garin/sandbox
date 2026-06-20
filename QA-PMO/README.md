# QA-PMO — ベリサーブ 品質ポータル

ベリサーブ社内のQAエンジニア・PMO向けに、品質支援サービスのメニューと
**実際に動く実務ツール**を一元化した社内ポータル。

> **現行システムは `portal/`（Django版）です。**
> `platform/`（静的HTML/JS版）と `pmo-menu.html` は旧版・参考用です。

---

## クイックスタート（localhost）

```bash
cd QA-PMO/portal
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate && python manage.py seed_data
python manage.py runserver
# → http://127.0.0.1:8000/
```

詳細は [`portal/README.md`](portal/README.md)。

---

## リポジトリ構成

```
QA-PMO/
├── portal/            ★ 現行システム（Django）— 社内品質ポータル
│   ├── catalog/       サービスカタログ（区分・サービス）
│   ├── knowledge/     観点ライブラリ・欠陥パターン・観点エンジン
│   ├── tools/         実務ツール（logic.py / views / tests）
│   ├── templates/     サーバーレンダリングHTML
│   └── static/        デザインシステム
│
├── docs/              ★ 設計ドキュメント（コンセプト/アーキ図/QA枠組/WBS/ガイド）
├── validation/        観点ライブラリのバリデーション研究（捕捉率85%の実証）
│
├── platform/          旧版：ゼロ依存の静的HTML/JS（参考）
├── pmo-menu.html      初期プロトタイプ（参考）
└── apps/              AI連携版の個別実装（uiux-verifier 等）
```

---

## システム概要

| 項目 | 内容 |
|---|---|
| 技術スタック | Django 5.1 + SQLite（将来 PostgreSQL）／HTMX・Chart.js（UX） |
| 利用者 | 社内のQAエンジニア・PMO・テストマネージャー |
| サービス | 31サービス／4区分（品質PMO・第三者検証・AIサービス・セキュリティ） |
| 実務ツール | 9種（画面で実際に動く・AIなし・決定的） |
| 計算エンジン | 実績OSSへ換装（textlint／allpairspy／pdfplumber／WeasyPrint）＋純Pythonフォールバック |
| 知識資産 | 観点ライブラリ 63観点・12カテゴリ・12欠陥パターン（DB管理） |
| 製品連携 | GIHOZ / ConTrack / InsighTest / TESTRA / Vex |
| テスト | Django スモークテスト 35件 全PASS |
| コスト | 0円（全てローカル・無料OSS・外部登録なし） |

---

## 9つの実務ツール

| ツール | 内容 |
|---|---|
| ドキュメント検証 | textlint で文章校正＋必須節欠落を検出＋品質スコア。PDFアップロード対応 |
| トレーサビリティ | 要件↔テストのRTM・カバレッジ算出（HTMX部分更新） |
| 計画策定 | ISO 29119-3準拠のテスト計画書を生成（Markdown／PDF出力） |
| テスト設計 | 観点ベース設計（観点カバレッジ付）＋境界値/同値/状態遷移/デシジョンテーブル/ペアワイズ（ISTQB技法）。全モードCSV出力 |
| 欠陥管理 | ISTQB severity・DB永続化・CSV出力 |
| ROI計算機 | 捕捉率85%を年間削減額・3年ROIに翻訳（Chart.jsグラフ表示） |
| テスト自動化 | Playwright/pytest/bats scaffold生成 |
| CI/CD構築 | GitHub Actions YAML生成 |
| 観点ライブラリ | 観点・欠陥パターン・カバレッジマップ閲覧 |

---

## ドキュメント

- 設計の背景・図解・QA枠組み・WBS → [`docs/`](docs/)
- 起動・運用手順 → [`portal/README.md`](portal/README.md)
- 観点ライブラリの有効性検証 → [`validation/`](validation/)
