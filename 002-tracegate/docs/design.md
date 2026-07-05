# design.md — TraceGate MVP 設計

版: v1.1（2026-07-05確定）／ Sonnet実装セッションでの変更禁止。
設計判断はすべてここで確定済み。実装時に選択を迫られたら「要確認」に記録して中断する。

## 変更履歴

- v1.1: `/qa-review`セルフレビュー（`docs/qa-review-spec-v1.0.md`）を反映。
  extract.pyの例外捕捉を`OSError`全般に拡張（QA-001）、cli.pyにREQ-020（書込失敗時exit 2）を追加（QA-003）。

## 技術スタック（確定）

- Python 3.10+、標準ライブラリのみ（`argparse` / `re` / `pathlib` / `json` / `sys` / `dataclasses` / `glob`）
- テスト: pytest（開発時のみの依存。実行時依存はゼロ）
- パッケージ形態: `src/` レイアウト。配布は不要（`python -m tracegate` で実行できれば良い）

## ディレクトリ構成（確定）

```
002-tracegate/
├── docs/                  # spec.md / design.md / tasks.md（本ファイル群）
├── src/tracegate/
│   ├── __init__.py        # __version__ = "0.1.0"
│   ├── __main__.py        # from tracegate.cli import main; sys.exit(main())
│   ├── models.py
│   ├── extract.py
│   ├── trace.py
│   ├── report.py
│   └── cli.py
└── tests/
    ├── fixtures/simple/   # e2e用の小さな仕様＋テストの模擬リポジトリ
    ├── test_extract.py
    ├── test_trace.py
    ├── test_report.py
    └── test_cli.py
```

## モジュール設計（確定）

### models.py

```python
from dataclasses import dataclass, field

@dataclass(frozen=True)
class Requirement:
    req_id: str   # "REQ-001"
    title: str    # 定義行から記号除去したテキスト（REQ-003参照）
    file: str     # 実行ディレクトリからの相対パス（POSIX形式）
    line: int     # 1始まり

@dataclass(frozen=True)
class Coverage:
    req_id: str
    file: str
    line: int

@dataclass
class TraceResult:
    requirements: list[Requirement]
    covered: dict[str, list[Coverage]]  # req_id -> 宣言リスト（要件が存在するもののみ）
    uncovered: list[Requirement]
    orphans: list[Coverage]

    @property
    def divergence(self) -> float:
        # 呼び出し側（cli）が要件0件を先に弾く（REQ-015）ため、ここでは総数>0を前提としてよい
        return len(self.uncovered) / len(self.requirements)
```

### extract.py

```python
import re
from pathlib import Path
from collections.abc import Iterable

REQ_ID = re.compile(r"REQ-\d{3}")
COVERS_MARKER = "@covers"
TITLE_STRIP_CHARS = "#-*:| \t"

def find_requirements(files: Iterable[Path]) -> list[Requirement]: ...
def find_coverage(files: Iterable[Path]) -> list[Coverage]: ...
```

- `find_requirements`: ファイルパス昇順→行番号昇順に走査。行内の全REQ-IDについて、未登録IDなら登録（REQ-002）。タイトルは `line.replace(req_id, "").strip(TITLE_STRIP_CHARS).strip()`。同一行に複数IDがある場合は全IDを同じタイトルで登録する。
- `find_coverage`: `COVERS_MARKER` を含む行のみ対象（REQ-006）。行内の全REQ-IDを `Coverage` にする。
- 両関数とも: 1ファイルにつき `open(path, encoding="utf-8")` で読む処理全体を
  `except (OSError, UnicodeDecodeError) as exc:` で囲み、
  `print(f"warning: skipped ({type(exc).__name__}): {path}", file=sys.stderr)` してスキップし、
  次のファイルの処理を継続する（NFR-003・v1.1でOSError全般に対象拡張。
  `UnicodeDecodeError` は `ValueError` のサブクラスで `OSError` のサブクラスではないため、
  実装では両方を明示的にタプルで指定すること。`IsADirectoryError` / `PermissionError` は
  `OSError` のサブクラスなのでこのタプルで捕捉される）。

### trace.py

```python
def build_trace(requirements: list[Requirement], coverages: list[Coverage]) -> TraceResult: ...
```

- 要件ID集合に対して coverage を振り分け、存在しないIDへの宣言は `orphans` へ。
- `covered` / `uncovered` の順序は requirements の抽出順を保持する。

### report.py

```python
def to_markdown(result: TraceResult) -> str: ...
def to_json_dict(result: TraceResult) -> dict: ...   # json.dump可能なdictを返す
```

### cli.py

```python
def main(argv: list[str] | None = None) -> int: ...
```

引数（argparse・確定）:

| 引数 | 型 | 既定値 |
|---|---|---|
| `--specs` | nargs="+" | `["specs/**/*.md"]` |
| `--tests` | nargs="+" | `["tests/**/*.*"]` |
| `--output` | str | なし（省略時は標準出力のみ） |
| `--json` | str | なし |
| `--max-divergence` | float | `0.0` |
| `--allow-orphans` | flag | False |
| `--version` | flag | − |

- globは `glob.glob(pattern, recursive=True)` で展開し、テスト側は許可拡張子（REQ-018: `.py .ts .tsx .js .jsx .md`）でフィルタする。仕様側は拡張子フィルタなし。
- 処理順: 展開 → 抽出 → 要件0件チェック（exit 2）→ 突合 → Markdown出力（常時、`--output`指定時は同内容をファイルにも書込）→ `--json`出力 → ゲート判定。
- `--output` / `--json` のファイル書き込みは `try/except OSError as exc:` で囲み、
  失敗した場合は `print(f"error: failed to write {path}: {exc}", file=sys.stderr)` して
  即座に終了コード2で返す（REQ-020・v1.1で追加。ゲート判定より前に評価する）。
- ゲート判定: `fail = (divergence > max_divergence) or (orphans and not allow_orphans)` → exit 1、それ以外 exit 0。

## 出力例（確定・この書式でテストを書く）

### Markdown（to_markdown）

```markdown
# トレーサビリティマトリクス

| 要件ID | タイトル | 状態 | カバーするテスト |
|---|---|---|---|
| REQ-001 | 要件IDを抽出する | ✅ covered | tests/test_extract.py:12 |
| REQ-002 | 最初の出現を定義とする | ❌ uncovered | − |

## 孤立カバレッジ（定義のない要件IDへの@covers）

- REQ-999 ← tests/test_extract.py:30

## サマリ

- 総要件数: 2 ／ カバー済み: 1 ／ 孤立要件: 1 ／ 孤立カバレッジ: 1
- 乖離率: 50.0%
```

（孤立カバレッジ0件のときは該当セクションを出力しない。複数テストが同一要件をカバーする場合は `<br>` 区切りで列挙。）

### JSON（to_json_dict）

```json
{
  "version": "0.1.0",
  "summary": {"total": 2, "covered": 1, "uncovered": 1, "orphans": 1, "divergence": 0.5},
  "requirements": [
    {"id": "REQ-001", "title": "要件IDを抽出する", "file": "specs/spec.md", "line": 3,
     "status": "covered", "covered_by": [{"file": "tests/test_extract.py", "line": 12}]}
  ],
  "orphans": [{"id": "REQ-999", "file": "tests/test_extract.py", "line": 30}]
}
```

## e2eフィクスチャ（tests/fixtures/simple/・確定）

```
specs/spec.md      … REQ-001 / REQ-002 / REQ-003 を定義（3行、各行 "- REQ-00N: <タイトル>"）
tests/test_a.py    … "# @covers REQ-001" と "# @covers REQ-002 REQ-999" を含む
```

期待値: total=3, covered=2, uncovered=1(REQ-003), orphans=1(REQ-999), divergence=1/3。

## ドッグフーディング規約（本プロジェクト自身に適用）

- `docs/spec.md` の要件はREQ-NNN形式で書いてある（本設計の入力仕様と同一規約）
- `tests/test_*.py` の各テスト関数のdocstring先頭に `@covers REQ-NNN` を書く
- 全タスク完了後、`python -m tracegate --specs "docs/spec.md" --tests "tests/**/*.py"` が
  リポジトリ自身のマトリクスを出力し exit 0 になること（T10の完了条件）
