"""検証（層3・決定的）。

再構成の結果を機械的に検証し、通らない変更は適用せず原文のまま残す（ADR-10 安全側）。
層1・層2の実装に依存しない独立した実装であること（同じ誤りを共有しないため）。
仕様: docs/SPECIFICATION.md 3-6

VF-1 情報追加なし / VF-2 情報欠落なし / VF-3 数値の同一性
VF-4 否定の反転なし / VF-5 主体・格関係の保存

VF-1〜3 は「原文に無い語・数値」しか見ないため、原文にある語だけを並べ替えた
意味の反転（否定の削除・主語と目的語の入替・範囲語の差し替え・行順の入替）を
素通しする。VF-4/VF-5 はその穴を塞ぐための検証である。
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter

from .models import Operation, VerifyResult

COVERAGE_THRESHOLD = 0.95
SIMILARITY_THRESHOLD = 0.7

NEGATIONS = ("ありません", "ません", "ない", "なし", "不可", "禁止", "除く", "以外", "未", "非", "無")
PARTICLES = ("より", "から", "まで", "が", "を", "に", "へ")
RANGE_WORDS = ("以内", "以上", "以下", "未満", "以前", "以降", "超", "前", "後", "中", "まで")

_NUMBER = re.compile(r"[0-9]+(?:\.[0-9]+)?")
_TOKEN = re.compile(r"[0-9]+(?:[.,][0-9]+)*|[A-Za-z][A-Za-z0-9_-]*|[ァ-ヴー]{2,}|[一-龥]{2,}")
_SENTENCE = re.compile(r"[^。．！？\n]+[。．！？]?")
_PAREN = re.compile(r"[（(]([^（()）]*)[）)]")
_NEGATION = re.compile("|".join(NEGATIONS))
_PARTICLE = re.compile("|".join(PARTICLES))
_RANGE = re.compile("|".join(RANGE_WORDS))
_BREAK = "。．、，！？\n\t 　「」『』（）()[]{}|:：#*-—/,."


def _canon(text: str) -> str:
    """比較用の正規化。全半角・長音・大小文字・空白の差を無視する。"""
    normalized = unicodedata.normalize("NFKC", text).lower()
    return re.sub(r"[\sー・]", "", normalized)


# ---------------------------------------------------------------- 特徴抽出


def _numbers(text: str) -> Counter[str]:
    return Counter(_NUMBER.findall(unicodedata.normalize("NFKC", text)))


def _tokens(text: str) -> tuple[str, ...]:
    return tuple(_TOKEN.findall(unicodedata.normalize("NFKC", text)))


def _preceding(text: str, end: int, width: int = 8) -> str:
    """直前の文節候補。区切り文字と助詞で切る（格関係の識別のため）。"""
    chunk: list[str] = []
    index = end - 1
    while index >= 0 and len(chunk) < width:
        char = text[index]
        if char in _BREAK:
            break
        chunk.append(char)
        index -= 1
    return _canon("".join(reversed(chunk)))


def _negation_marks(text: str) -> Counter[tuple[str, str]]:
    """(係り先候補, 否定表現) の多重集合。VF-4 の比較対象。"""
    marks: Counter[tuple[str, str]] = Counter()
    for match in _NEGATION.finditer(unicodedata.normalize("NFKC", text)):
        marks[(_preceding(text, match.start(), 4), match.group(0))] += 1
    return marks


def _case_pairs(text: str) -> Counter[tuple[str, str]]:
    """(直前語, 助詞) の多重集合。VF-5 の比較対象。

    括弧内は本体から切り離して別々に数える。挿入語（略語定義など）で
    直前語が壊れるのを防ぎつつ、括弧内の入替も見逃さないための制約。
    """
    normalized = unicodedata.normalize("NFKC", text)
    outside = _PAREN.sub("", normalized)
    segments = [outside] + [m.group(1) for m in _PAREN.finditer(normalized)]
    pairs: Counter[tuple[str, str]] = Counter()
    for segment in segments:
        for match in _PARTICLE.finditer(segment):
            word = _preceding(segment, match.start())
            if word:
                pairs[(word, match.group(0))] += 1
    return pairs


def _range_words(text: str) -> Counter[str]:
    return Counter(_RANGE.findall(unicodedata.normalize("NFKC", text)))


def _rows(text: str) -> list[str]:
    return [_canon(line) for line in text.split("\n") if _canon(line)]


def _order_changed(before: str, after: str) -> bool:
    """行の集合が同じで順序だけ違う（表の行入替など）か。"""
    old, new = _rows(before), _rows(after)
    return len(old) > 1 and Counter(old) == Counter(new) and old != new


def _sentences(text: str) -> tuple[str, ...]:
    found = (_canon(s) for s in _SENTENCE.findall(text))
    return tuple(s for s in found if s)


def _bigrams(text: str) -> set[str]:
    return {text[i : i + 2] for i in range(len(text) - 1)} or {text}


def _similarity(source: str, target: str) -> float:
    grams = _bigrams(source)
    return len(grams & _bigrams(target)) / len(grams)


def coverage(original: str, revised: str) -> tuple[float, tuple[str, ...]]:
    """原文の文がどれだけ再構成後に対応を持つか（VF-2）。"""
    sentences = _sentences(original)
    if not sentences:
        return 1.0, ()
    targets = _sentences(revised)
    uncovered = tuple(
        s
        for s in sentences
        if max((_similarity(s, t) for t in targets), default=0.0) < SIMILARITY_THRESHOLD
    )
    return 1 - len(uncovered) / len(sentences), uncovered


# ---------------------------------------------------------------- 個別検証


def _check_vf1(original: str, op: Operation) -> str:
    canon_original = _canon(original)
    added = [t for t in _tokens(op.after) if _canon(t) not in canon_original]
    return f"VF-1 原文に無い語を追加: {'、'.join(added)}" if added else ""


def _check_vf3(original: str, op: Operation) -> str:
    before, after = _numbers(op.before), _numbers(op.after)
    lost = before - after
    if lost:
        return f"VF-3 数値の欠落: {'、'.join(sorted(lost))}"
    unknown = sorted(set(after - before) - set(_numbers(original)))
    return f"VF-3 原文に無い数値: {'、'.join(unknown)}" if unknown else ""


def _check_vf4(op: Operation) -> str:
    before, after = _negation_marks(op.before), _negation_marks(op.after)
    if before == after:
        return ""
    lost = before - after
    gained = after - before
    detail = "、".join(f"{w}{n}" for w, n in sorted(lost) + sorted(gained))
    return f"VF-4 否定表現の変化: {detail}"


def _check_vf5(op: Operation) -> str:
    if _case_pairs(op.before) != _case_pairs(op.after):
        lost = _case_pairs(op.before) - _case_pairs(op.after)
        gained = _case_pairs(op.after) - _case_pairs(op.before)
        detail = "、".join(f"{w}{p}" for w, p in sorted(lost) + sorted(gained))
        return f"VF-5 格関係の変化: {detail}"
    if _range_words(op.before) != _range_words(op.after):
        return "VF-5 範囲・時制語の変化"
    if _order_changed(op.before, op.after):
        return "VF-5 行順の入替"
    return ""


def check_operation(original: str, op: Operation) -> tuple[str, ...]:
    """1操作が層3の検証を満たすか調べ、違反理由を返す。"""
    results = (
        _check_vf1(original, op),
        _check_vf3(original, op),
        _check_vf4(op),
        _check_vf5(op),
    )
    return tuple(r for r in results if r)


# ---------------------------------------------------------------- ロールバック


def _line_index(location: str) -> tuple[int, int]:
    match = re.match(r"L(\d+)(?::(\d+))?", location or "")
    if not match:
        return (-1, -1)
    return int(match.group(1)), int(match.group(2) or -1)


def _rollback_line(line: str, op: Operation, column: int) -> str | None:
    if column >= 0 and line[column : column + len(op.after)] == op.after:
        return line[:column] + op.before + line[column + len(op.after) :]
    if op.after and op.after in line:
        return line.replace(op.after, op.before, 1)
    return None


def rollback(text: str, op: Operation) -> str:
    """1操作を原文の姿へ戻す。戻せない場合は本文を変えない。"""
    if op.after == op.before:
        return text
    row, column = _line_index(op.location)
    lines = text.split("\n")
    if 0 <= row < len(lines):
        restored = _rollback_line(lines[row], op, column)
        if restored is not None:
            return "\n".join(lines[:row] + [restored] + lines[row + 1 :])
    if op.after in text:
        return text.replace(op.after, op.before, 1)
    return text


# ---------------------------------------------------------------- 入口


def verify(
    original: str, revised: str, ops: list[Operation]
) -> tuple[str, VerifyResult]:
    """検証を通らない変更を巻き戻した本文と検証結果を返す純粋関数。

    ロールバックは後の操作から順に行う（先の操作の位置情報を壊さないため）。
    """
    applied = [op for op in ops if op.applied]
    text = revised
    violations: list[str] = []
    rolled: set[str] = set()
    for op in reversed(applied):
        reasons = check_operation(original, op)
        if not reasons:
            continue
        text = rollback(text, op)
        rolled.add(op.op_id)
        violations += [f"{op.op_id}: {reason}" for reason in reasons]
    text, extra_violations, extra_rolled = _enforce_coverage(
        original, text, applied, rolled
    )
    rolled |= extra_rolled
    violations += extra_violations
    order = [op.op_id for op in applied if op.op_id in rolled]
    return text, VerifyResult(tuple(violations), tuple(order))


def _enforce_coverage(
    original: str, text: str, applied: list[Operation], rolled: set[str]
) -> tuple[str, list[str], set[str]]:
    """VF-2。欠落に関与した操作だけを戻す。

    カバー率を改善しない操作は戻さない（無関係な変更まで巻き戻さないため）。
    それでも閾値に届かない欠落は、原文側にしか存在しない情報として警告に留める。
    """
    rate, uncovered = coverage(original, text)
    if rate >= COVERAGE_THRESHOLD:
        return text, [], set()
    joined = "".join(uncovered)
    extra: set[str] = set()
    ordered = [op for op in reversed(applied) if op.op_id not in rolled]
    suspects = [op for op in ordered if op.before and _canon(op.before) in joined]
    for op in suspects + [op for op in ordered if op not in suspects]:
        if rate >= COVERAGE_THRESHOLD:
            break
        candidate = rollback(text, op)
        new_rate, _ = coverage(original, candidate)
        if new_rate > rate:
            text, rate = candidate, new_rate
            extra.add(op.op_id)
    return text, [f"VF-2 情報欠落: カバー率 {rate:.2f} < {COVERAGE_THRESHOLD}"], extra
