from django.contrib import admin

from .models import Defect


@admin.register(Defect)
class DefectAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "severity", "phase", "root_cause", "status", "created_at")
    list_filter = ("severity", "status", "phase", "root_cause")
    search_fields = ("title", "description")
