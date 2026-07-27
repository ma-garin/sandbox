"""外部サービスが保持するデータ（システムテスト対象外）。

NomiKui会のアカウントと、Warikan サービスサーバに記録される割り勘結果。
実システムではアプリの外側にあるため、warikan パッケージからは
external.nomikui / external.juspay の関数経由でのみ触れる。
"""

from django.contrib.auth.hashers import check_password, make_password
from django.db import models

from warikan.domain import constraints


class Account(models.Model):
    """NomiKui会アカウント（仕様 1.1）。"""

    user_id = models.CharField(max_length=constraints.USER_ID_MAX_LENGTH, unique=True)
    password_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["user_id"]

    def __str__(self) -> str:
        return self.user_id

    def set_password(self, raw_password: str) -> None:
        self.password_hash = make_password(raw_password)

    def verify_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.password_hash)


class WarikanRecord(models.Model):
    """Warikan サービスサーバに登録された割り勘結果（仕様 3）。"""

    account = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="records"
    )
    own_count = models.PositiveSmallIntegerField()
    other_count = models.PositiveSmallIntegerField()
    total_amount = models.PositiveIntegerField()
    own_ratio = models.PositiveSmallIntegerField()
    own_per_person = models.IntegerField()
    other_per_person = models.IntegerField()
    change = models.IntegerField()
    held_on = models.DateField()
    held_at = models.TimeField()
    note = models.CharField(max_length=constraints.NOTE_MAX_LENGTH, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # 仕様 4「開催日と時刻を登録順に従って表示する」。
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return f"{self.account.user_id} {self.held_on} {self.held_at}"

    @property
    def other_ratio(self) -> int:
        return 100 - self.own_ratio
