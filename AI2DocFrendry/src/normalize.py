"""正規化段（SPECIFICATION.md 3-3 / FR-14〜FR-21）。

反復ノイズ・ページ番号・目次を除去し、表記ゆれは「検出のみ」行う。
除去は必ず removed_noise に記録し、後から監査できる状態を保つ。
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict

from .models import Block, NormalizedDoc, RawDocument, TermVariant

# ヘッダ・フッタは短い定型行に限られる。長文を誤って消すと本文が欠落する
_NOISE_MAX_LEN = 40

_PAGE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^[-‐‑–—ー－]\s*\d+\s*[-‐‑–—ー－]$"),
    re.compile(r"^\d+\s*[/／]\s*\d+$"),
    re.compile(r"^page\s*\d+(\s*of\s*\d+)?$", re.IGNORECASE),
    re.compile(r"^第\s*\d+\s*[頁章]?[ページ]*$"),
    re.compile(r"^\d+\s*[頁ページ]$"),
)

_TOC_TITLE = re.compile(r"^(目\s*次|contents|table\s+of\s+contents)$", re.IGNORECASE)
# 「1. はじめに .... 3」のように行末がページ番号で終わる目次項目
_TOC_ENTRY = re.compile(r"^.+?[\.．・…\s　]{2,}\s*\d+$")

_KATAKANA = re.compile(r"(?=[ァ-ヶー]*[ァ-ヶ])[ァ-ヶー]{2,}")
_KANJI_WORD = re.compile(r"(?:[一-龥々][ぁ-ん]*)+")
# 送り仮名と助詞は字面で区別できないため、助詞になりうる仮名で語を切る
_PARTICLE = re.compile(r"[をはがにへともやので]")
_FULLWIDTH = re.compile(r"[Ａ-Ｚａ-ｚ０-９！-／：-＠［-｀｛-～]+")


def normalize(doc: RawDocument, repeated_ratio: float = 0.8) -> NormalizedDoc:
    """RawDocument を正規化して NormalizedDoc を返す（純粋関数）。

    repeated_ratio は「全ページ／全シートの何割に出現したら反復ノイズか」の閾値。
    表記ゆれは検出するだけで修正しない（修正は restructure の責務 / FR-21）。
    """
    repeated = _repeated_lines(doc.blocks, repeated_ratio)
    cleaned, removed_lines = _clean_blocks(doc.blocks, repeated)
    without_toc, removed_toc = _drop_toc(cleaned)
    return NormalizedDoc(
        source=doc.source,
        blocks=without_toc,
        images=doc.images,
        style_marks=doc.style_marks,
        removed_noise=removed_lines + removed_toc,
        encoding="utf-8",
        variants=_detect_variants(without_toc),
        warnings=doc.warnings,
    )


# ---------------------------------------------------------------- 反復ノイズ


def _page_key(position: str) -> str:
    """position からページ／シートの識別子を取り出す（"Sheet1!A1" → "Sheet1"）。"""
    return position.split("!")[0] if position else ""


def _repeated_lines(blocks: tuple[Block, ...], ratio: float) -> frozenset[str]:
    """指定割合以上のページ／シートに出現する短い行を返す。"""
    pages: dict[str, set[str]] = defaultdict(set)
    for block in blocks:
        # 表と脚注はページ単位の要素ではないため、母数にも分子にも数えない
        if block.is_table or block.kind == "footnote":
            continue
        for line in block.text.splitlines():
            stripped = line.strip()
            if stripped and len(stripped) < _NOISE_MAX_LEN:
                pages[_page_key(block.position)].add(stripped)
    # ページが1つしかない文書では「全ページに出現」が意味を持たない
    if len(pages) < 2:
        return frozenset()
    counts = Counter(line for lines in pages.values() for line in lines)
    threshold = ratio * len(pages)
    return frozenset(line for line, n in counts.items() if n >= threshold)


def _is_page_number(line: str) -> bool:
    return any(pattern.match(line) for pattern in _PAGE_PATTERNS)


# ---------------------------------------------------------------- 行の掃除


def _clean_text(text: str, repeated: frozenset[str], position: str) -> tuple[str, tuple[str, ...]]:
    """1ブロックのテキストからノイズ行を除き、空白を正規化する。"""
    kept: list[str] = []
    removed: list[str] = []
    for line in text.splitlines():
        stripped = line.rstrip()
        key = stripped.strip()
        if key and key in repeated:
            removed.append(f"反復ノイズ: {key!r} @{position}")
            continue
        if key and _is_page_number(key):
            removed.append(f"ページ番号: {key!r} @{position}")
            continue
        kept.append(stripped)
    return _collapse_blank(kept), tuple(removed)


def _collapse_blank(lines: list[str]) -> str:
    """連続する空行を1つにまとめ、前後の空行を落とす。"""
    out: list[str] = []
    for line in lines:
        if not line and (not out or not out[-1]):
            continue
        out.append(line)
    while out and not out[-1]:
        out.pop()
    return "\n".join(out)


def _clean_cell(cell: str) -> str:
    return re.sub(r"[ \t　]+", " ", cell).strip()


def _clean_blocks(
    blocks: tuple[Block, ...], repeated: frozenset[str]
) -> tuple[tuple[Block, ...], tuple[str, ...]]:
    """全ブロックを掃除する。中身が空になったブロックは落とす。"""
    kept: list[Block] = []
    removed: list[str] = []
    for block in blocks:
        if block.is_table:
            rows = tuple(tuple(_clean_cell(c) for c in row) for row in block.table_rows)
            if any(any(cell for cell in row) for row in rows):
                kept.append(Block(kind=block.kind, table_rows=rows, position=block.position))
            continue
        text, dropped = _clean_text(block.text, repeated, block.position)
        removed.extend(dropped)
        if text:
            kept.append(
                Block(kind=block.kind, text=text, level=block.level, position=block.position)
            )
    return tuple(kept), tuple(removed)


# ---------------------------------------------------------------- 目次


def _is_toc_entry_block(block: Block) -> bool:
    lines = [line.strip() for line in block.text.splitlines() if line.strip()]
    return bool(lines) and all(_TOC_ENTRY.match(line) for line in lines)


def _drop_toc(blocks: tuple[Block, ...]) -> tuple[tuple[Block, ...], tuple[str, ...]]:
    """目次見出しと、その直後に連続するページ番号付きブロックを除去する。"""
    kept: list[Block] = []
    removed: list[str] = []
    index = 0
    while index < len(blocks):
        block = blocks[index]
        if block.is_table or not _TOC_TITLE.match(block.text.strip()):
            kept.append(block)
            index += 1
            continue
        end = index + 1
        while end < len(blocks) and not blocks[end].is_table and _is_toc_entry_block(blocks[end]):
            end += 1
        # 直後に目次項目が続かない場合は「目次」という語の本文利用とみなし残す
        if end == index + 1:
            kept.append(block)
            index += 1
            continue
        for dropped in blocks[index:end]:
            removed.append(f"目次: {dropped.text.splitlines()[0]!r} @{dropped.position}")
        index = end
    return tuple(kept), tuple(removed)


# ---------------------------------------------------------------- 表記ゆれ


def _iter_texts(blocks: tuple[Block, ...]) -> tuple[tuple[str, str], ...]:
    """(テキスト, position) の列を返す。表のセルも対象にする。"""
    out: list[tuple[str, str]] = []
    for block in blocks:
        if block.is_table:
            out.extend((cell, block.position) for row in block.table_rows for cell in row if cell)
        elif block.text:
            out.append((block.text, block.position))
    return tuple(out)


def _collect(
    texts: tuple[tuple[str, str], ...], pattern: re.Pattern[str]
) -> tuple[Counter[str], dict[str, str]]:
    """語の出現回数と初出 position を集める。"""
    counts: Counter[str] = Counter()
    where: dict[str, str] = {}
    for text, position in texts:
        for token in pattern.findall(text):
            counts[token] += 1
            where.setdefault(token, position)
    return counts, where


def _width_variants(texts: tuple[tuple[str, str], ...]) -> list[TermVariant]:
    """全角英数字・記号を半角形と対にして記録する。"""
    counts, where = _collect(texts, _FULLWIDTH)
    out: list[TermVariant] = []
    for token in sorted(counts):
        canonical = unicodedata.normalize("NFKC", token)
        if canonical != token:
            out.append(TermVariant(canonical=canonical, found=token, position=where[token]))
    return out


def _macron_variants(texts: tuple[tuple[str, str], ...]) -> list[TermVariant]:
    """長音の有無ゆれ（ユーザ／ユーザー）を記録する。"""
    counts, where = _collect(texts, _KATAKANA)
    out: list[TermVariant] = []
    for token in sorted(counts):
        if not token.endswith("ー") and token + "ー" in counts:
            out.append(TermVariant(canonical=token + "ー", found=token, position=where[token]))
    return out


def _kanji_words(text: str) -> tuple[str, ...]:
    """漢字を含む語を切り出す。助詞を吸い込まないよう分割する。"""
    out: list[str] = []
    for token in _KANJI_WORD.findall(text):
        out.extend(
            w for w in _PARTICLE.split(token) if any("一" <= c <= "龥" or c == "々" for c in w)
        )
    return tuple(out)


def _okurigana_variants(texts: tuple[tuple[str, str], ...]) -> list[TermVariant]:
    """送り仮名ゆれ（申込／申し込み、行う／行なう）を記録する。"""
    counts: Counter[str] = Counter()
    where: dict[str, str] = {}
    for text, position in texts:
        for token in _kanji_words(text):
            counts[token] += 1
            where.setdefault(token, position)
    groups: dict[str, list[str]] = defaultdict(list)
    for token in counts:
        groups["".join(c for c in token if not ("ぁ" <= c <= "ん"))].append(token)
    out: list[TermVariant] = []
    for skeleton, tokens in sorted(groups.items()):
        # 漢字1字の語は活用形（見る／見た）を拾ってしまうため語尾一致を条件に加える
        if len(tokens) < 2 or (len(skeleton) < 2 and len({t[-1] for t in tokens}) > 1):
            continue
        canonical = max(sorted(tokens), key=lambda t: (counts[t], len(t)))
        out.extend(
            TermVariant(canonical=canonical, found=t, position=where[t])
            for t in sorted(tokens)
            if t != canonical
        )
    return out


def _detect_variants(blocks: tuple[Block, ...]) -> tuple[TermVariant, ...]:
    """表記ゆれを検出する。ここでは修正しない（FR-21 は restructure の責務）。"""
    texts = _iter_texts(blocks)
    return tuple(_width_variants(texts) + _macron_variants(texts) + _okurigana_variants(texts))
