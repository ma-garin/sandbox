"""各画面の入力検証（仕様 1.1.2 / 1.2 / 3）。"""

from __future__ import annotations

import datetime

from django import forms
from django.core.validators import RegexValidator

from .domain import constraints

ALPHANUMERIC = RegexValidator(
    r"^[A-Za-z0-9]*$", "半角英数字のみ入力できます", code="alphanumeric"
)

# 仕様 1.2.4 / 3.5 のエラー通知文言。
MESSAGE_INVALID_NUMBER = "入力された数字が不正です"
MESSAGE_AUTH_FAILED = "IDが登録されていないか、パスワードが不正です"
MESSAGE_SERVICE_UNAVAILABLE = "サービスサーバと正常に通信できません"
MESSAGE_REGISTERED = "登録が完了しました"


def earliest_selectable_date(today: datetime.date) -> datetime.date:
    """選択できる最も古い開催日（今日の3年前）。

    3年前の同日が存在しない場合（閏日）は同月の末日に丸める。
    """
    try:
        return today.replace(year=today.year - constraints.DATE_RANGE_YEARS)
    except ValueError:
        return today.replace(
            year=today.year - constraints.DATE_RANGE_YEARS, day=28
        )


def time_choices() -> list[tuple[str, str]]:
    """開催時刻の選択肢（0:00〜23:30 の30分刻み、48件）。"""
    step = constraints.TIME_STEP_MINUTES
    return [
        (f"{minutes // 60:02d}:{minutes % 60:02d}", f"{minutes // 60}:{minutes % 60:02d}")
        for minutes in range(0, 24 * 60, step)
    ]


class LoginForm(forms.Form):
    """ログイン画面（仕様 1.1.2）。"""

    user_id = forms.CharField(
        max_length=constraints.USER_ID_MAX_LENGTH,
        validators=[ALPHANUMERIC],
        widget=forms.TextInput(
            attrs={
                "placeholder": "ユーザIDを入力",
                "maxlength": constraints.USER_ID_MAX_LENGTH,
                "pattern": "[A-Za-z0-9]*",
                "autocomplete": "username",
            }
        ),
    )
    password = forms.CharField(
        max_length=constraints.PASSWORD_MAX_LENGTH,
        validators=[ALPHANUMERIC],
        widget=forms.PasswordInput(
            render_value=False,
            attrs={
                "placeholder": "パスワードを入力",
                "maxlength": constraints.PASSWORD_MAX_LENGTH,
                "pattern": "[A-Za-z0-9]*",
                "autocomplete": "current-password",
            },
        ),
    )
    remember = forms.BooleanField(required=False, label="アカウント情報を記録する")


class CalculationForm(forms.Form):
    """割り勘計算画面（仕様 1.2）。

    人数・金額のいずれかが範囲外なら、項目別ではなく単一の
    「入力された数字が不正です」を返す（仕様 1.2.4）。
    """

    own_count = forms.IntegerField(
        min_value=constraints.MIN_PEOPLE,
        max_value=constraints.MAX_PEOPLE,
        widget=forms.NumberInput(
            attrs={"placeholder": "1〜99の数値を入力", "inputmode": "numeric"}
        ),
    )
    other_count = forms.IntegerField(
        min_value=constraints.MIN_PEOPLE,
        max_value=constraints.MAX_PEOPLE,
        widget=forms.NumberInput(
            attrs={"placeholder": "1〜99の数値を入力", "inputmode": "numeric"}
        ),
    )
    total_amount = forms.IntegerField(
        min_value=constraints.MIN_AMOUNT,
        max_value=constraints.MAX_AMOUNT,
        widget=forms.NumberInput(
            attrs={"placeholder": "1〜999999の数値を入力", "inputmode": "numeric"}
        ),
    )
    own_ratio = forms.IntegerField(
        min_value=constraints.MIN_RATIO,
        max_value=constraints.MAX_RATIO,
        initial=constraints.DEFAULT_RATIO,
        widget=forms.NumberInput(
            attrs={
                "type": "range",
                "min": constraints.MIN_RATIO,
                "max": constraints.MAX_RATIO,
                "step": constraints.RATIO_STEP,
            }
        ),
    )

    def clean_own_ratio(self) -> int:
        ratio = self.cleaned_data["own_ratio"]
        if ratio % constraints.RATIO_STEP != 0:
            raise forms.ValidationError(MESSAGE_INVALID_NUMBER)
        return ratio

    @property
    def popup_error(self) -> str | None:
        """画面中央に出すエラー通知の文言（仕様 3.1）。"""
        return MESSAGE_INVALID_NUMBER if self.errors else None


class RegisterForm(forms.Form):
    """割り勘結果登録画面の追加入力項目（仕様 3）。"""

    held_on = forms.DateField(
        widget=forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d")
    )
    held_at = forms.ChoiceField(choices=time_choices)
    note = forms.CharField(
        required=False,
        max_length=constraints.NOTE_MAX_LENGTH,
        widget=forms.TextInput(
            attrs={
                "placeholder": "備考を入力",
                "maxlength": constraints.NOTE_MAX_LENGTH,
            }
        ),
    )

    def __init__(self, *args, today: datetime.date | None = None, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.today = today or datetime.date.today()
        self.earliest = earliest_selectable_date(self.today)
        self.fields["held_on"].widget.attrs.update(
            {"min": self.earliest.isoformat(), "max": self.today.isoformat()}
        )

    def clean_held_on(self) -> datetime.date:
        held_on = self.cleaned_data["held_on"]
        if not self.earliest <= held_on <= self.today:
            raise forms.ValidationError(
                f"開催日は {self.earliest.isoformat()} 〜 {self.today.isoformat()} "
                "の範囲で選択してください"
            )
        return held_on

    def clean_held_at(self) -> datetime.time:
        raw = self.cleaned_data["held_at"]
        hour, minute = (int(part) for part in raw.split(":"))
        return datetime.time(hour=hour, minute=minute)
