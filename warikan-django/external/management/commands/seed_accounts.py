"""検証用の NomiKui会アカウントを投入する。

パスワードはソースに埋め込まず、引数または環境変数 WARIKAN_SEED_PASSWORD で渡す。

    python manage.py seed_accounts --user-id testuser --password '<任意>'
"""

import os
import re

from django.core.management.base import BaseCommand, CommandError

from external.models import Account
from warikan.domain import constraints

USER_ID_PATTERN = re.compile(rf"^[A-Za-z0-9]{{1,{constraints.USER_ID_MAX_LENGTH}}}$")
PASSWORD_PATTERN = re.compile(rf"^[A-Za-z0-9]{{1,{constraints.PASSWORD_MAX_LENGTH}}}$")


class Command(BaseCommand):
    help = "検証用の NomiKui会アカウントを作成または更新する"

    def add_arguments(self, parser) -> None:
        parser.add_argument("--user-id", required=True, help="ユーザID（半角英数15文字以内）")
        parser.add_argument(
            "--password",
            default=None,
            help="パスワード（半角英数20文字以内）。省略時は環境変数 WARIKAN_SEED_PASSWORD を使う",
        )

    def handle(self, *args, **options) -> None:
        user_id = options["user_id"]
        password = options["password"] or os.environ.get("WARIKAN_SEED_PASSWORD")

        if not password:
            raise CommandError(
                "パスワードが指定されていません。--password か環境変数 "
                "WARIKAN_SEED_PASSWORD で渡してください。"
            )
        if not USER_ID_PATTERN.match(user_id):
            raise CommandError(
                f"ユーザIDは半角英数 {constraints.USER_ID_MAX_LENGTH} 文字以内にしてください。"
            )
        if not PASSWORD_PATTERN.match(password):
            raise CommandError(
                f"パスワードは半角英数 {constraints.PASSWORD_MAX_LENGTH} 文字以内にしてください。"
            )

        account, created = Account.objects.get_or_create(user_id=user_id)
        account.set_password(password)
        account.save(update_fields=["password_hash"])

        action = "作成" if created else "更新"
        self.stdout.write(self.style.SUCCESS(f"アカウント {user_id} を{action}しました。"))
