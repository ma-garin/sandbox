# ベリサーブ 品質ポータル（Django）

ベリサーブ社内の品質PMO・第三者検証・AI・セキュリティの提供メニューと、
**実際に動く実務ツール**を一元化した社内ポータル。Django製の本格Webシステム。

> 旧版（`QA-PMO/platform/` の静的HTML/JS）からの全面リプレース。
> 本ディレクトリが現行の正式システムです。

---

## 必要環境

- Python 3.11 以上
- pip（仮想環境を推奨）

外部サービス・課金・アカウント登録は一切不要。すべてローカルで完結します。

---

## localhost で起動する

```bash
cd QA-PMO/portal

# 1. 仮想環境を作成して有効化
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. 依存をインストール（Django のみ）
pip install -r requirements.txt

# 3. DBを作成して初期データを投入
python manage.py migrate
python manage.py seed_data

# 4. 開発サーバーを起動
python manage.py runserver
```

ブラウザで **http://127.0.0.1:8000/** を開く。

### 管理画面（任意）

```bash
python manage.py createsuperuser   # 管理ユーザーを作成
```

http://127.0.0.1:8000/admin/ から、サービス・観点ライブラリ・欠陥を
GUIで追加・編集できます（「育てられる」知識資産）。

---

## テスト

```bash
python manage.py test
```

23件のスモークテスト（全画面・全ツールのGET、主要ツールのPOST、
欠陥のCRUD/CSV）が走ります。

---

## ディレクトリ構成

```
portal/
├── manage.py
├── requirements.txt
├── config/                 # プロジェクト設定（settings, urls）
├── catalog/                # サービスカタログ（区分・グループ・サービス）
│   ├── models.py
│   ├── views.py            # ホーム・サービス詳細・検索
│   ├── nav.py              # サイドナビ生成
│   └── management/commands/seed_data.py   # 初期データ投入
├── knowledge/              # 観点ライブラリ・欠陥パターン
│   ├── models.py
│   └── engine.py           # 観点ベース設計エンジン
├── tools/                  # 実務ツール
│   ├── logic.py            # 計算ロジック（決定的・純粋関数）
│   ├── views.py            # tool_keyごとのディスパッチ
│   ├── models.py           # 欠陥（DB永続化）
│   └── tests.py            # スモークテスト
├── templates/              # サーバーレンダリングのHTML
└── static/css, static/js   # デザインシステム・最小JS
```

---

## 搭載内容

- **31サービス** を4区分（品質PMO / 第三者検証 / AIサービス / セキュリティ）で提供
- **9つの実務ツール**（画面で実際に動く・AIなし・決定的アルゴリズム）
  ドキュメント検証 / トレーサビリティ / 計画策定 / テスト設計（観点ベース＋ISTQB技法） /
  欠陥管理（DB永続化） / ROI計算機 / テスト自動化 / CI/CD構築 / 観点ライブラリ
- **観点ライブラリ** 63観点・12カテゴリ・12欠陥パターンをDB化（社内で育てられる資産）
- **製品連携表示**: GIHOZ / ConTrack / InsighTest / TESTRA / Vex

設計の背景・QA品質フレームワーク・WBSは [`../docs/`](../docs/) を参照。
