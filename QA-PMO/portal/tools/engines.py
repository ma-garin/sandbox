"""実績OSSエンジンの薄いラッパ（提案A：エンジン換装）。

方針: いずれの関数も「使えれば実績OSSを使い、使えなければ None を返す」。
呼び出し側（logic.py / views.py）は None のとき純Python実装へフォールバックする。
これにより OSS 未導入の環境でもポータルは必ず動作する（ゼロ依存の安全弁）。

採用OSS（全て無料・登録不要）:
  - textlint + preset-ja-technical-writing … 日本語技術文書の校正
  - allpairspy                              … ペアワイズ（PICT系アルゴリズム）
  - pdfplumber                              … 要件書PDF→テキスト抽出
  - weasyprint + markdown                   … テスト計画書のPDF整形出力
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

# portal/ ディレクトリ（このファイルは portal/tools/engines.py）
PORTAL_DIR = Path(__file__).resolve().parent.parent
_TEXTLINT_BIN = PORTAL_DIR / "textlint" / "node_modules" / ".bin" / "textlint"
_TEXTLINT_DIR = PORTAL_DIR / "textlint"


# ─────────────────────────────────────────────
# textlint（日本語校正）
# ─────────────────────────────────────────────
def textlint_available() -> bool:
    return _TEXTLINT_BIN.exists()


# textlint severity → ISTQB風 severity
_SEV_MAP = {2: "Major", 1: "Minor", 0: "Cosmetic"}


def textlint_findings(text: str):
    """textlint で日本語文書を校正し findings のリストを返す。

    使えない場合・失敗時は None（呼び出し側で純Python版へフォールバック）。
    """
    if not text.strip() or not textlint_available():
        return None
    try:
        proc = subprocess.run(
            [str(_TEXTLINT_BIN), "--format", "json",
             "--stdin", "--stdin-filename", "input.txt"],
            input=text, capture_output=True, text=True,
            cwd=str(_TEXTLINT_DIR), timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        return None

    out = proc.stdout.strip()
    if not out:
        return []
    try:
        results = json.loads(out)
    except json.JSONDecodeError:
        return None

    lines = text.splitlines()
    findings = []
    for fileresult in results:
        for m in fileresult.get("messages", []):
            ln = m.get("line", "-")
            rule = (m.get("ruleId") or "textlint").split("/")[-1]
            snippet = ""
            if isinstance(ln, int) and 1 <= ln <= len(lines):
                snippet = lines[ln - 1].strip()[:40]
            findings.append({
                "sev": _SEV_MAP.get(m.get("severity", 2), "Minor"),
                "line": ln,
                "term": rule,
                "msg": m.get("message", "").replace("\n", " "),
                "text": snippet,
                "engine": "textlint",
            })
    return findings


# ─────────────────────────────────────────────
# allpairspy（ペアワイズ）
# ─────────────────────────────────────────────
def pairwise_cases(params):
    """params: [{"name", "values":[...]}] → [[v1,v2,...], ...] or None。

    allpairspy が無ければ None を返す（純Python貪欲法へフォールバック）。
    """
    try:
        from allpairspy import AllPairs
    except ImportError:
        return None
    try:
        value_lists = [p["values"] for p in params]
        return [list(case) for case in AllPairs(value_lists)]
    except Exception:
        return None


# ─────────────────────────────────────────────
# pdfplumber（PDF→テキスト）
# ─────────────────────────────────────────────
def pdf_to_text(file_obj):
    """アップロードされたPDFファイルからテキストを抽出。失敗時 None。"""
    try:
        import pdfplumber
    except ImportError:
        return None
    try:
        chunks = []
        with pdfplumber.open(file_obj) as pdf:
            for page in pdf.pages:
                chunks.append(page.extract_text() or "")
        return "\n".join(chunks).strip()
    except Exception:
        return None


# ─────────────────────────────────────────────
# weasyprint + markdown（テスト計画書PDF）
# ─────────────────────────────────────────────
_PDF_CSS = """
@page { size: A4; margin: 18mm; }
body { font-family: sans-serif; font-size: 11pt; line-height: 1.7; color: #1a2b3c; }
h1 { font-size: 18pt; color: #1a3a6b; border-bottom: 3px solid #1a3a6b; padding-bottom: 6px; }
h2 { font-size: 13pt; color: #1a3a6b; margin-top: 18px; border-left: 4px solid #1a3a6b; padding-left: 8px; }
table { border-collapse: collapse; width: 100%; margin-top: 8px; }
th, td { border: 1px solid #c9d4e3; padding: 6px 10px; text-align: left; }
th { background: #eef3fa; }
code { background: #eef3fa; padding: 1px 4px; border-radius: 3px; }
"""


def markdown_to_pdf(md_text: str):
    """Markdown文字列をPDFバイト列へ。使えなければ None。"""
    try:
        import markdown as md
        from weasyprint import HTML
    except ImportError:
        return None
    try:
        html_body = md.markdown(md_text, extensions=["tables", "fenced_code"])
        html = f"<html><head><style>{_PDF_CSS}</style></head><body>{html_body}</body></html>"
        return HTML(string=html).write_pdf()
    except Exception:
        return None
