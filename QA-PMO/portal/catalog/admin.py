from django.contrib import admin

from .models import Category, ServiceGroup, Service


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("order", "name", "slug", "icon")
    ordering = ("order",)


@admin.register(ServiceGroup)
class ServiceGroupAdmin(admin.ModelAdmin):
    list_display = ("category", "name", "order")
    list_filter = ("category",)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "group", "kind", "product", "order")
    list_filter = ("category", "kind", "group")
    search_fields = ("title", "summary", "product")
    prepopulated_fields = {"slug": ("title",)}
