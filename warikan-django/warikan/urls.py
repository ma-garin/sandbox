from django.urls import path
from django.views.generic import RedirectView

from . import views

app_name = "warikan"

urlpatterns = [
    # 仕様 3.4「再起動後は初期画面であるログイン画面が表示される」。
    path("", RedirectView.as_view(pattern_name="warikan:login"), name="root"),
    path("login/", views.login_view, name="login"),
    path("calc/", views.calculation_view, name="calculation"),
    path("juspay/", views.juspay_view, name="juspay"),
    path("register/", views.register_view, name="register"),
    path("history/", views.history_view, name="history"),
]
