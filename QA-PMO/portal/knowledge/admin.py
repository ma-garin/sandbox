from django.contrib import admin

from .models import ViewpointCategory, Viewpoint, DefectPattern


@admin.register(ViewpointCategory)
class ViewpointCategoryAdmin(admin.ModelAdmin):
    list_display = ("order", "code", "name")
    ordering = ("order",)


@admin.register(Viewpoint)
class ViewpointAdmin(admin.ModelAdmin):
    list_display = ("viewpoint", "technique", "category", "source_type", "source_key")
    list_filter = ("source_type", "category")
    search_fields = ("viewpoint", "technique")


@admin.register(DefectPattern)
class DefectPatternAdmin(admin.ModelAdmin):
    list_display = ("pattern_id", "pattern", "category")
    list_filter = ("category",)
    search_fields = ("pattern", "example", "prevention")
