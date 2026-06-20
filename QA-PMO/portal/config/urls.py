"""ルートURL設定。"""
from django.contrib import admin
from django.urls import path

from catalog import views as catalog_views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", catalog_views.home, name="home"),
    path("search/", catalog_views.search, name="search"),
    path("s/<slug:slug>/", catalog_views.service_detail, name="service_detail"),
]
