"""画面遷移と状態保持（仕様 1〜4）のテスト。"""

import pytest
from django.test import override_settings

from external.models import WarikanRecord

pytestmark = pytest.mark.django_db


# --- ログイン（仕様 1.1） ---------------------------------------------------


def test_未ログインでは各画面からログイン画面へ戻される(client):
    for path in ["/calc/", "/juspay/", "/register/", "/history/"]:
        assert client.get(path).url == "/login/"


def test_ルートはログイン画面へ遷移する(client):
    assert client.get("/").url == "/login/"


def test_ログイン成功で割り勘計算画面へ遷移する(client, account):
    response = client.post(
        "/login/", {"user_id": "testuser", "password": "passw0rd"}
    )
    assert response.url == "/calc/"


def test_ID未登録はエラー通知を表示する(client, db):
    response = client.post("/login/", {"user_id": "nobody", "password": "passw0rd"})
    assert response.status_code == 200
    assert "IDが登録されていないか、パスワードが不正です" in response.content.decode()


def test_パスワード誤りはエラー通知を表示する(client, account):
    response = client.post("/login/", {"user_id": "testuser", "password": "wrong"})
    assert "IDが登録されていないか、パスワードが不正です" in response.content.decode()


def test_アカウント情報を記録するとユーザIDが復元される(client, account):
    client.post(
        "/login/",
        {"user_id": "testuser", "password": "passw0rd", "remember": "on"},
    )
    body = client.get("/login/").content.decode()
    assert 'value="testuser"' in body


def test_記録しない場合はユーザIDが復元されない(client, account):
    client.post("/login/", {"user_id": "testuser", "password": "passw0rd"})
    body = client.get("/login/").content.decode()
    assert 'value="testuser"' not in body


# --- 割り勘計算（仕様 1.2〜1.4） --------------------------------------------


def test_計算結果を表示する(logged_in_client):
    response = logged_in_client.post(
        "/calc/",
        {"own_count": 5, "other_count": 5, "total_amount": 50000, "own_ratio": 50},
    )
    body = response.content.decode()
    assert "自分側: 5,000円/人" in body
    assert "相手側: 5,000円/人" in body
    assert "お釣り: 0円" in body


def test_範囲外の入力はエラー通知を表示し計算しない(logged_in_client):
    response = logged_in_client.post(
        "/calc/",
        {"own_count": 0, "other_count": 5, "total_amount": 50000, "own_ratio": 50},
    )
    body = response.content.decode()
    assert "入力された数字が不正です" in body
    assert "円/人" not in body


def test_計算結果がないと登録画面へ入れない(logged_in_client):
    assert logged_in_client.get("/register/").url == "/calc/"


def test_ジャスPayボタンは支払いが発生するときだけ表示する(logged_in_client):
    with_payment = logged_in_client.post(
        "/calc/",
        {"own_count": 5, "other_count": 5, "total_amount": 50000, "own_ratio": 50},
    )
    assert "ジャスPay" in with_payment.content.decode()

    without_payment = logged_in_client.post(
        "/calc/",
        {"own_count": 2, "other_count": 2, "total_amount": 10000, "own_ratio": 100},
    )
    assert "ジャスPay" not in without_payment.content.decode()


def test_計算画面に戻ると入力と結果が復帰する(calculated_client):
    """仕様 2 / 3 / 4：戻るボタンでの遷移先は遷移前の状態を保つ。"""
    body = calculated_client.get("/calc/").content.decode()
    assert 'value="50000"' in body
    assert "自分側: 5,000円/人" in body


# --- ジャスPay（仕様 2） ----------------------------------------------------


def test_ジャスPay画面はQRコードを表示する(calculated_client):
    body = calculated_client.get("/juspay/").content.decode()
    assert "<svg" in body


def test_支払いが発生しない場合はジャスPay画面へ入れない(logged_in_client):
    logged_in_client.post(
        "/calc/",
        {"own_count": 2, "other_count": 2, "total_amount": 10000, "own_ratio": 100},
    )
    assert logged_in_client.get("/juspay/").url == "/calc/"


# --- 割り勘結果登録（仕様 3） -----------------------------------------------


def test_登録すると完了通知を出して計算画面へ自動遷移する(calculated_client, account):
    response = calculated_client.post(
        "/register/", {"held_on": "2026-07-27", "held_at": "18:00", "note": "早めに解散"}
    )
    body = response.content.decode()
    assert "登録が完了しました" in body
    assert 'data-popup-duration="1000"' in body
    assert 'data-popup-redirect="/calc/"' in body

    record = WarikanRecord.objects.get(account=account)
    assert record.own_per_person == 5000
    assert record.note == "早めに解散"


def test_登録画面には計算結果が表示される(calculated_client):
    body = calculated_client.get("/register/").content.decode()
    assert "自分側の人数: 5人" in body
    assert "金額: 50,000円" in body
    assert "自分側 50: 50 相手側" in body


def test_開催日が範囲外なら登録されない(calculated_client, account):
    response = calculated_client.post(
        "/register/", {"held_on": "2030-01-01", "held_at": "18:00", "note": ""}
    )
    assert "入力された数字が不正です" in response.content.decode()
    assert WarikanRecord.objects.filter(account=account).count() == 0


# --- 履歴表示（仕様 4） -----------------------------------------------------


def test_履歴に登録内容が表示される(calculated_client, account):
    calculated_client.post(
        "/register/", {"held_on": "2026-07-27", "held_at": "19:00", "note": "備考テスト"}
    )
    record = WarikanRecord.objects.get(account=account)

    body = calculated_client.get(f"/history/?record={record.id}").content.decode()
    assert "2026/7/27" in body
    assert "19:00" in body
    assert "備考: 備考テスト" in body
    assert "お釣り: 0円" in body


def test_履歴が空でも表示できる(logged_in_client):
    assert "登録された割り勘結果はありません" in logged_in_client.get(
        "/history/"
    ).content.decode()


# --- 通信エラー（仕様 3.5） -------------------------------------------------


@override_settings(EXTERNAL_SERVICE_FAILURE=True)
def test_通信できない場合はログインを中止する(client, account):
    response = client.post("/login/", {"user_id": "testuser", "password": "passw0rd"})
    assert "サービスサーバと正常に通信できません" in response.content.decode()


@override_settings(EXTERNAL_SERVICE_FAILURE=True)
def test_通信できない場合は登録を中止する(calculated_client, account):
    response = calculated_client.post(
        "/register/", {"held_on": "2026-07-27", "held_at": "18:00", "note": ""}
    )
    assert "サービスサーバと正常に通信できません" in response.content.decode()
    assert WarikanRecord.objects.count() == 0


@override_settings(EXTERNAL_SERVICE_FAILURE=True)
def test_通信できない場合は履歴表示を中止して計算画面に戻る(calculated_client):
    assert calculated_client.get("/history/").url == "/calc/"
    body = calculated_client.get("/calc/").content.decode()
    assert "サービスサーバと正常に通信できません" in body


@override_settings(EXTERNAL_SERVICE_FAILURE=True)
def test_通信できない場合はジャスPayを中止して計算画面に戻る(calculated_client):
    assert calculated_client.get("/juspay/").url == "/calc/"
    body = calculated_client.get("/calc/").content.decode()
    assert "サービスサーバと正常に通信できません" in body
