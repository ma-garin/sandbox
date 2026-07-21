"""PDF からブロック構造・画像参照・診断用警告を抽出する Extractor。

pdfplumber のテキストレイヤーを前提とするため、スキャン PDF（画像のみ）は
本文をまったく取得できない。抽出できなかった情報は下流のどの段階でも
復元できないため、検出結果を必ず warnings として呼び出し元へ伝える。
"""

from __future__ import annotations

from collections import Counter
from typing import TYPE_CHECKING, Any, Mapping, NamedTuple, Sequence

from ..models import Block, ImageRef
from .base import ExtractionError, build, expand_merged

if TYPE_CHECKING:  # 実行時 import を避け、models 側の定義変更に巻き込まれないようにする
    from ..models import RawDocument, SourceFile

# 本文最頻サイズに対してこの倍率以上のフォントを見出しとみなす
HEADING_SIZE_RATIO = 1.15
MAX_HEADING_LEVEL = 6
# フォントサイズは PDF 生成器ごとに微小な誤差を持つため 0.5pt 単位へ丸める
SIZE_QUANTUM = 2.0

# スキャン PDF 判定: 1 ページあたりの文字数と画像占有率のしきい値
SCAN_TEXT_THRESHOLD = 32
SCAN_IMAGE_AREA_RATIO = 0.25
# ページ面積に対してこの比率以上を占める画像は図表（chart）とみなす
CHART_AREA_RATIO = 0.10

SCAN_WARNING = "テキストレイヤーがほぼ存在しない（スキャンPDFの可能性）"
EMPTY_TEXT_WARNING = "テキストを1文字も抽出できませんでした（抽出率0）"
CHART_WARNING = "図表らしき画像を検出（本文テキストとしては抽出されません）"


class _Line(NamedTuple):
    """ページ内の 1 行と、その行を代表するフォントサイズ。"""

    page: int
    text: str
    size: float


class _PageData(NamedTuple):
    """1 ページ分の抽出結果と診断情報。"""

    number: int
    lines: tuple[_Line, ...]
    tables: tuple[Block, ...]
    images: tuple[ImageRef, ...]
    char_count: int
    scanned: bool


def _import_pdfplumber() -> Any:
    """pdfplumber を遅延 import する（未インストールでもモジュール import は成功させる）。"""
    try:
        import pdfplumber
    except ImportError as exc:
        raise ExtractionError("pdfplumber がインストールされていません") from exc
    return pdfplumber


def _round_size(value: float) -> float:
    """フォントサイズを 0.5pt 単位へ丸める。"""
    return round(float(value) * SIZE_QUANTUM) / SIZE_QUANTUM


def _line_size(line: Mapping[str, Any]) -> float:
    """行を構成する文字の最頻フォントサイズを返す。"""
    chars = line.get("chars") or ()
    sizes = [_round_size(c["size"]) for c in chars if c.get("size")]
    if not sizes:
        return 0.0
    return Counter(sizes).most_common(1)[0][0]


def _page_lines(page: Any, number: int) -> tuple[_Line, ...]:
    """ページのテキスト行を抽出する。行単位 API が無い場合は改行分割で代替する。"""
    extract_lines = getattr(page, "extract_text_lines", None)
    raw: Sequence[Mapping[str, Any]] = extract_lines() or () if callable(extract_lines) else ()
    if raw:
        candidates = ((str(item.get("text", "")).strip(), _line_size(item)) for item in raw)
        return tuple(_Line(number, text, size) for text, size in candidates if text)
    text = page.extract_text() or ""
    return tuple(_Line(number, line.strip(), 0.0) for line in text.splitlines() if line.strip())


def _page_tables(page: Any, number: int) -> tuple[Block, ...]:
    """ページ内の表を矩形化した Block として返す。"""
    tables = page.extract_tables() or ()
    blocks = []
    for table in tables:
        rows = [[str(cell) if cell is not None else "" for cell in row] for row in table]
        expanded = expand_merged(rows)
        if expanded:
            blocks.append(Block(kind="table", table_rows=expanded, position=f"p{number}"))
    return tuple(blocks)


def _image_area(image: Mapping[str, Any]) -> float:
    """画像領域の面積を返す（座標系の向きに依存しないよう絶対値を取る）。"""
    width = float(image.get("x1", 0.0)) - float(image.get("x0", 0.0))
    height = float(image.get("bottom", 0.0)) - float(image.get("top", 0.0))
    return abs(width * height)


def _page_area(page: Any) -> float:
    return abs(float(getattr(page, "width", 0.0)) * float(getattr(page, "height", 0.0)))


def _image_area_ratio(page: Any, images: Sequence[Mapping[str, Any]]) -> float:
    """ページ面積に対する画像の占有率。"""
    area = _page_area(page)
    if area <= 0:
        return 0.0
    return sum(_image_area(image) for image in images) / area


def _page_images(
    page: Any,
    number: int,
    images: Sequence[Mapping[str, Any]],
    scanned: bool,
) -> tuple[ImageRef, ...]:
    """ページ内の画像を種別ごとに集約した ImageRef を返す。

    スキャンページの画像はページ全体の複写であり OCR で救済しうるため、
    図表（chart）とは区別して image のままにする。
    """
    area = _page_area(page)
    threshold = area * CHART_AREA_RATIO
    counter: Counter[str] = Counter()
    for image in images:
        large = area > 0 and _image_area(image) >= threshold
        counter["chart" if large and not scanned else "image"] += 1
    return tuple(
        ImageRef(position=f"p{number}", count=counter[kind], kind=kind)  # type: ignore[arg-type]
        for kind in ("image", "chart")
        if counter[kind]
    )


def _is_scanned(char_count: int, area_ratio: float, image_count: int) -> bool:
    """テキストレイヤーがほぼ無く画像が支配的なページかを判定する。"""
    if char_count >= SCAN_TEXT_THRESHOLD:
        return False
    return area_ratio >= SCAN_IMAGE_AREA_RATIO or (char_count == 0 and image_count > 0)


def _table_char_count(blocks: Sequence[Block]) -> int:
    return sum(len(cell) for block in blocks for row in block.table_rows for cell in row)


def _read_page(page: Any, number: int) -> _PageData:
    """1 ページを読み取り、本文・表・画像・診断情報をまとめる。"""
    lines = _page_lines(page, number)
    tables = _page_tables(page, number)
    raw_images: Sequence[Mapping[str, Any]] = getattr(page, "images", ()) or ()
    char_count = sum(len(line.text) for line in lines) + _table_char_count(tables)
    scanned = _is_scanned(char_count, _image_area_ratio(page, raw_images), len(raw_images))
    images = _page_images(page, number, raw_images, scanned)
    return _PageData(number, lines, tables, images, char_count, scanned)


def _body_size(lines: Sequence[_Line]) -> float:
    """文字数で重み付けした最頻フォントサイズ（本文サイズ）を返す。"""
    counter: Counter[float] = Counter()
    for line in lines:
        if line.size > 0:
            counter[line.size] += len(line.text)
    if not counter:
        return 0.0
    return counter.most_common(1)[0][0]


def _heading_levels(sizes: frozenset[float], body: float) -> dict[float, int]:
    """本文より有意に大きいサイズへ、大きい順に見出しレベルを割り当てる。"""
    if body <= 0:
        return {}
    larger = sorted((size for size in sizes if size >= body * HEADING_SIZE_RATIO), reverse=True)
    return {size: min(rank, MAX_HEADING_LEVEL) for rank, size in enumerate(larger, start=1)}


def _to_block(line: _Line, levels: Mapping[float, int]) -> Block:
    """行を見出し／段落の Block へ変換する。"""
    level = levels.get(line.size, 0)
    kind = "heading" if level else "paragraph"
    return Block(kind=kind, text=line.text, level=level, position=f"p{line.page}")


def _build_blocks(pages: Sequence[_PageData], levels: Mapping[float, int]) -> tuple[Block, ...]:
    """ページ順に本文ブロックと表ブロックを並べる。"""
    blocks: list[Block] = []
    for page in pages:
        blocks.extend(_to_block(line, levels) for line in page.lines)
        blocks.extend(page.tables)
    return tuple(blocks)


def _collect_warnings(pages: Sequence[_PageData], total_chars: int) -> tuple[str, ...]:
    """下流で復元不能な欠落を診断できるよう警告を組み立てる。"""
    warnings: list[str] = []
    scanned = tuple(page.number for page in pages if page.scanned)
    if scanned:
        pages_label = ", ".join(f"p{number}" for number in scanned)
        warnings.append(f"{SCAN_WARNING}: {pages_label}")
    if total_chars == 0:
        warnings.append(EMPTY_TEXT_WARNING)
    charts = sum(image.count for page in pages for image in page.images if image.kind == "chart")
    if charts:
        warnings.append(f"{CHART_WARNING}: {charts}件")
    return tuple(warnings)


class PdfExtractor:
    """pdfplumber を用いた PDF 抽出器。"""

    extensions: tuple[str, ...] = (".pdf",)

    def extract(self, source: SourceFile) -> RawDocument:
        """PDF を読み取り RawDocument を返す。失敗時は ExtractionError を送出する。"""
        pdfplumber = _import_pdfplumber()
        try:
            with pdfplumber.open(source.path) as pdf:
                pages = tuple(_read_page(page, number) for number, page in enumerate(pdf.pages, start=1))
        except ExtractionError:
            raise
        except Exception as exc:
            raise ExtractionError(f"PDFの抽出に失敗しました: {source.path}: {exc}") from exc
        return self._assemble(source, pages)

    def _assemble(self, source: SourceFile, pages: Sequence[_PageData]) -> RawDocument:
        """ページ単位の結果を文書全体の RawDocument へ統合する。"""
        lines = tuple(line for page in pages for line in page.lines)
        body = _body_size(lines)
        levels = _heading_levels(frozenset(line.size for line in lines), body)
        total_chars = sum(page.char_count for page in pages)
        # 抽出率 0 は隔離せず、空ブロック＋警告として下流に診断させる
        blocks = () if total_chars == 0 else _build_blocks(pages, levels)
        images = tuple(image for page in pages for image in page.images)
        return build(
            source,
            blocks,
            images=images,
            style_marks=(),
            warnings=_collect_warnings(pages, total_chars),
        )
