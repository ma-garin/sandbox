"""Warikan（割り勘支援アプリ）の Django 設定。

このプロジェクトはテスト設計コンテスト U-30 の仕様書に基づく検証用途であり、
本番運用を想定していない。秘密鍵は環境変数、無ければローカルファイルから読む。
"""

import os
from pathlib import Path

from django.core.management.utils import get_random_secret_key

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_secret_key() -> str:
    """秘密鍵を環境変数、無ければローカルファイルから取得する。

    ソースコードへのハードコードを避けつつ、再起動でセッションが切れないよう
    ローカルファイル（gitignore 対象）に永続化する。
    """
    env_key = os.environ.get("DJANGO_SECRET_KEY")
    if env_key:
        return env_key

    key_file = BASE_DIR / ".secret_key"
    if key_file.exists():
        return key_file.read_text(encoding="utf-8").strip()

    generated = get_random_secret_key()
    key_file.write_text(generated, encoding="utf-8")
    return generated


SECRET_KEY = _load_secret_key()

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

INSTALLED_APPS = [
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    "external.apps.ExternalConfig",
    "warikan.apps.WarikanConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# 仕様 3.4「Warikan を終了すると自動的にログアウトされ、再起動後はログイン画面」。
# Web 版ではブラウザ終了をアプリ終了とみなす。
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# --- Warikan 固有設定 -------------------------------------------------------

# 仕様 3.5「通信エラー処理」の検証用フェイルポイント。
# 1 を設定すると外部サービス（NomiKui会サービスサーバ／ジャスPay）への
# 呼び出しがすべて失敗し、「サービスサーバと正常に通信できません」が出る。
EXTERNAL_SERVICE_FAILURE = os.environ.get("WARIKAN_EXTERNAL_FAILURE", "0") == "1"

# 仕様 3「割り勘結果登録」— 1 アカウントあたりの登録上限件数。
WARIKAN_RECORD_LIMIT = 50
