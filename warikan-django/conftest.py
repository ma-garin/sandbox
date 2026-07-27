"""テスト共通のフィクスチャ。"""

import pytest

from external.models import Account

TEST_USER_ID = "testuser"
TEST_PASSWORD = "passw0rd"


@pytest.fixture
def account(db) -> Account:
    """認証に成功する NomiKui会アカウント。"""
    instance = Account(user_id=TEST_USER_ID)
    instance.set_password(TEST_PASSWORD)
    instance.save()
    return instance


@pytest.fixture
def logged_in_client(client, account):
    """ログイン済みのクライアント。"""
    response = client.post(
        "/login/", {"user_id": TEST_USER_ID, "password": TEST_PASSWORD}
    )
    assert response.status_code == 302
    return client


@pytest.fixture
def calculated_client(logged_in_client):
    """仕様 1.4 の例（5人・5人・50,000円・50%）まで計算済みのクライアント。"""
    response = logged_in_client.post(
        "/calc/",
        {
            "own_count": 5,
            "other_count": 5,
            "total_amount": 50000,
            "own_ratio": 50,
        },
    )
    assert response.status_code == 200
    return logged_in_client
