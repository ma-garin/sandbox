from __future__ import annotations

import csv
from io import BytesIO, StringIO
from zipfile import ZIP_DEFLATED, ZipFile

from .models import GeneratedDocument, SystemAnalysis


def build_zip(documents: list[GeneratedDocument], csv_exports: dict[str, str] | None = None) -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        for document in documents:
            archive.writestr(f"{document.slug}.md", document.markdown)
        for filename, content in (csv_exports or {}).items():
            archive.writestr(filename, content)
    return buffer.getvalue()


def build_reviewed_markdown(documents: list[GeneratedDocument]) -> str:
    reviewed = [document for document in documents if document.review_status == "確認済み"]
    if not reviewed:
        reviewed = documents
    return "\n\n---\n\n".join(document.markdown for document in reviewed)


def build_csv(rows: list[dict[str, str]]) -> str:
    if not rows:
        return ""
    buffer = StringIO()
    fieldnames = list(rows[0].keys())
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def build_csv_exports(system: SystemAnalysis) -> dict[str, str]:
    return {
        "csv/screen-list.csv": build_csv(system.screens),
        "csv/feature-list.csv": build_csv(system.features),
        "csv/data-dictionary.csv": build_csv(system.data_items),
        "csv/external-interfaces.csv": build_csv(system.external_interfaces),
        "csv/unanswered-questions.csv": build_csv(system.unanswered_questions),
        "csv/traceability.csv": build_csv(system.traceability),
        "csv/handoff-risks.csv": build_csv(system.handoff_risks),
        "csv/kano-ux-review.csv": build_csv(system.kano_ux_review),
    }
