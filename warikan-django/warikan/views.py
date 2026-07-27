"""Warikan アプリケーションの画面（システムテスト対象）。

外部サービスへは external パッケージの関数経由でのみアクセスし、
ServiceUnavailableError を捕捉して仕様 3.5 のエラー通知に変換する。
"""

from __future__ import annotations

from functools import wraps

from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.safestring import mark_safe
from django.views.decorators.http import require_http_methods

from external import juspay, nomikui
from external.errors import AuthenticationFailedError, ServiceUnavailableError
from external.models import Account

from . import session
from .domain import constraints
from .domain.calculation import WarikanInput, calculate, payment_occurs
from .forms import (
    MESSAGE_AUTH_FAILED,
    MESSAGE_INVALID_NUMBER,
    MESSAGE_REGISTERED,
    MESSAGE_SERVICE_UNAVAILABLE,
    CalculationForm,
    LoginForm,
    RegisterForm,
)


def _current_account(request: HttpRequest) -> Account | None:
    account_id = session.logged_in_account_id(request)
    if account_id is None:
        return None
    return Account.objects.filter(id=account_id).first()


def login_required(view):
    """未ログインならログイン画面へ戻す（仕様 3.4）。"""

    @wraps(view)
    def wrapper(request: HttpRequest, *args, **kwargs) -> HttpResponse:
        account = _current_account(request)
        if account is None:
            return redirect("warikan:login")
        return view(request, account, *args, **kwargs)

    return wrapper


# --- ログイン画面（仕様 1.1） -----------------------------------------------


@require_http_methods(["GET", "POST"])
def login_view(request: HttpRequest) -> HttpResponse:
    remembered = request.COOKIES.get(session.REMEMBER_FLAG_COOKIE) == "1"
    popup_error = None

    if request.method == "POST":
        form = LoginForm(request.POST)
        if form.is_valid():
            try:
                account = nomikui.authenticate(
                    form.cleaned_data["user_id"], form.cleaned_data["password"]
                )
            except AuthenticationFailedError:
                popup_error = MESSAGE_AUTH_FAILED
            except ServiceUnavailableError:
                popup_error = MESSAGE_SERVICE_UNAVAILABLE
            else:
                session.login(request, account.id)
                session.clear_calculation(request)
                return _apply_remember_cookies(
                    redirect("warikan:calculation"),
                    remember=form.cleaned_data["remember"],
                    user_id=account.user_id,
                )
        else:
            popup_error = MESSAGE_AUTH_FAILED
    else:
        form = LoginForm(
            initial={
                "user_id": (
                    request.COOKIES.get(session.REMEMBER_ID_COOKIE, "")
                    if remembered
                    else ""
                ),
                "remember": remembered,
            }
        )

    return render(
        request,
        "warikan/login.html",
        {"form": form, "popup_error": popup_error},
    )


def _apply_remember_cookies(
    response: HttpResponse, *, remember: bool, user_id: str
) -> HttpResponse:
    """「アカウント情報を記録する」の状態を保存する（仕様 1.1.2 の代替実装）。

    ネイティブ版は OS のパスワードマネージャにパスワードを記録するが、
    Web 版はパスワードを保存せず、ユーザIDとチェック状態のみ保持する。
    詳細は docs/SPEC_MAPPING.md を参照。
    """
    if remember:
        response.set_cookie(
            session.REMEMBER_FLAG_COOKIE,
            "1",
            max_age=session.REMEMBER_COOKIE_MAX_AGE,
            samesite="Lax",
        )
        response.set_cookie(
            session.REMEMBER_ID_COOKIE,
            user_id,
            max_age=session.REMEMBER_COOKIE_MAX_AGE,
            samesite="Lax",
        )
    else:
        response.delete_cookie(session.REMEMBER_FLAG_COOKIE)
        response.delete_cookie(session.REMEMBER_ID_COOKIE)
    return response


# --- 割り勘計算画面（仕様 1.2〜1.4） ----------------------------------------


@require_http_methods(["GET", "POST"])
@login_required
def calculation_view(request: HttpRequest, account: Account) -> HttpResponse:
    popup_error = request.session.pop("pending_popup_error", None)
    result = session.load_result(request)

    if request.method == "POST":
        form = CalculationForm(request.POST)
        if form.is_valid():
            params = WarikanInput(**form.cleaned_data)
            result = calculate(params)
            session.save_calculation(request, params, result)
        else:
            # 入力が不正な場合は計算せず、直前の結果表示を保持したまま通知する。
            popup_error = MESSAGE_INVALID_NUMBER
    else:
        state = session.load_calculation(request)
        form = CalculationForm(
            initial=state or {"own_ratio": constraints.DEFAULT_RATIO}
        )

    return render(request, "warikan/calculation.html", _calculation_context(
        form=form, result=result, popup_error=popup_error
    ))


def _calculation_context(*, form, result, popup_error) -> dict:
    return {
        "form": form,
        "result": result,
        "show_juspay": result is not None and payment_occurs(result),
        "popup_error": popup_error,
        "ratio_default": constraints.DEFAULT_RATIO,
    }


# --- ジャスPay画面（仕様 2） ------------------------------------------------


@require_http_methods(["GET"])
@login_required
def juspay_view(request: HttpRequest, account: Account) -> HttpResponse:
    result = session.load_result(request)
    if result is None or not payment_occurs(result):
        return redirect("warikan:calculation")

    try:
        payload = nomikui.issue_payment_token(account, result.other_per_person)
    except ServiceUnavailableError:
        request.session["pending_popup_error"] = MESSAGE_SERVICE_UNAVAILABLE
        return redirect("warikan:calculation")

    return render(
        request,
        "warikan/juspay.html",
        {"qr_svg": mark_safe(juspay.build_qr_svg(payload))},
    )


# --- 割り勘結果登録画面（仕様 3） -------------------------------------------


@require_http_methods(["GET", "POST"])
@login_required
def register_view(request: HttpRequest, account: Account) -> HttpResponse:
    result = session.load_result(request)
    params = session.load_input(request)
    if result is None or params is None:
        # 計算結果が無い状態では登録画面に入れない（ボタンは無反応）。
        return redirect("warikan:calculation")

    today = timezone.localdate()
    popup_message = None
    registered = False

    if request.method == "POST":
        form = RegisterForm(request.POST, today=today)
        if form.is_valid():
            payload = nomikui.RecordPayload(
                own_count=params.own_count,
                other_count=params.other_count,
                total_amount=params.total_amount,
                own_ratio=params.own_ratio,
                own_per_person=result.own_per_person,
                other_per_person=result.other_per_person,
                change=result.change,
                held_on=form.cleaned_data["held_on"],
                held_at=form.cleaned_data["held_at"],
                note=form.cleaned_data["note"],
            )
            try:
                nomikui.save_record(account, payload)
            except ServiceUnavailableError:
                popup_message = MESSAGE_SERVICE_UNAVAILABLE
            else:
                popup_message = MESSAGE_REGISTERED
                registered = True
        else:
            popup_message = MESSAGE_INVALID_NUMBER
    else:
        form = RegisterForm(
            initial={"held_on": today, "held_at": constraints.DEFAULT_HELD_TIME},
            today=today,
        )

    return render(
        request,
        "warikan/register.html",
        {
            "form": form,
            "params": params,
            "result": result,
            "popup_message": popup_message,
            # 登録完了時のみ「1秒間だけ表示して自動遷移」する（仕様 3）。
            "auto_redirect": registered,
        },
    )


# --- 割り勘結果記録表示画面（仕様 4） ---------------------------------------


@require_http_methods(["GET"])
@login_required
def history_view(request: HttpRequest, account: Account) -> HttpResponse:
    try:
        records = nomikui.list_records(account)
    except ServiceUnavailableError:
        request.session["pending_popup_error"] = MESSAGE_SERVICE_UNAVAILABLE
        return redirect("warikan:calculation")

    selected_id = request.GET.get("record")
    selected = None
    if selected_id and selected_id.isdigit():
        selected = next(
            (record for record in records if record.id == int(selected_id)), None
        )

    return render(
        request,
        "warikan/history.html",
        {"records": records, "selected": selected},
    )
