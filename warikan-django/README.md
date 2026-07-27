# warikan-django

割り勘支援アプリ **Warikan** を Django で実装したもの。
テスト設計コンテスト U-30 の題材（`Warikan仕様書 Ver.1.0`）を、実際にシステムテストを
実行できる対象にすることが目的。

仕様書はスマートフォンのネイティブアプリを前提としているため、Web に写像できない箇所がある。
差分は [`docs/SPEC_MAPPING.md`](docs/SPEC_MAPPING.md) に、仕様の曖昧点・矛盾の指摘は
[`docs/SPEC_ISSUES.md`](docs/SPEC_ISSUES.md) にまとめている。

## セットアップ

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate

# 検証用アカウントを作る（パスワードはソースに含めない）
WARIKAN_SEED_PASSWORD='<任意のパスワード>' \
  .venv/bin/python manage.py seed_accounts --user-id testuser
```

## 起動

```bash
.venv/bin/python manage.py runserver 8765
# http://127.0.0.1:8765/ を開く
```

## テスト

```bash
.venv/bin/pytest          # 91 件
```

| 対象 | ファイル |
|---|---|
| 計算規則・境界値（仕様 1.3） | `warikan/tests/test_calculation.py` |
| 入力検証（仕様 1.1.2 / 1.2 / 3） | `warikan/tests/test_forms.py` |
| 画面遷移・状態保持・通信エラー | `warikan/tests/test_views.py` |
| 認証・50件上限（サーバ側責務） | `external/tests/test_nomikui.py` |

## 通信エラーの再現（仕様 3.5）

外部サービス呼び出しをすべて失敗させ、「サービスサーバと正常に通信できません」を出す。

```bash
WARIKAN_EXTERNAL_FAILURE=1 .venv/bin/python manage.py runserver 8765
```

## 画面

| 画面 | URL | 仕様 |
|---|---|---|
| ログイン | `/login/` | 1.1 |
| 割り勘計算 | `/calc/` | 1.2〜1.4 |
| ジャスPay（QR表示） | `/juspay/` | 2 |
| 割り勘結果登録 | `/register/` | 3 |
| 割り勘結果記録表示 | `/history/` | 4 |

## 構成

補足書がシステムテストの対象範囲を「ネイティブアプリ部分のみ」と定めているため、
その境界をパッケージで分けている。

```
warikan/    テスト対象：画面・入力検証・計算・画面遷移・状態保持
  domain/     計算規則（Django 非依存の純粋関数）
external/   テスト対象外：NomiKui会（認証）／サービスサーバ（結果登録）／ジャスPay（QR）
```

`warikan` から `external` へは関数呼び出しのみで到達し、逆方向の依存はない。
外部サービスの障害は `ServiceUnavailableError` として `warikan` 側に伝わる。
