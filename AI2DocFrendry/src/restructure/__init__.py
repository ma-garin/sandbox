"""再構成（層1・ルールベースのみ）。

層2（LLM）は未導入のため、本パッケージは決定的な規則だけで再構成する（FR-28）。
情報を追加しない・削除しない・要約しないことが不変条件で、
判定できない箇所は本文を変えず applied=False の Operation として残す。
仕様: docs/SPECIFICATION.md 3-5
"""

from __future__ import annotations

import os

from ..models import Operation, StructuredDoc
from . import abbrev, meta, refs, variants

__all__ = ["restructure", "source_text", "abbrev", "meta", "refs", "variants"]


def restructure(doc: StructuredDoc) -> tuple[str, list[Operation]]:
    """再構成後の Markdown と全操作を返す純粋関数。

    meta を最初に適用するのは、先頭挿入で他操作の行番号がずれないようにするため。
    """
    text, meta_ops = meta.apply(doc.markdown, doc.front_matter, doc.source.path)
    text, variant_ops = variants.apply(text)
    text, ref_ops = refs.apply(text)
    text, abbrev_ops = abbrev.apply(text)
    return text, [*meta_ops, *variant_ops, *ref_ops, *abbrev_ops]


def source_text(doc: StructuredDoc) -> str:
    """検証（verify）の基準となる原文テキスト。

    front matter とファイル名を含めるのは、メタ情報補完で使う値が
    「原文に存在する情報」であることを層3が確認できるようにするため。
    """
    head = [f"source: {os.path.basename(doc.source.path)}"]
    head += [f"{key}: {value}" for key, value in doc.front_matter.items()]
    return "---\n" + "\n".join(head) + "\n---\n" + doc.markdown
