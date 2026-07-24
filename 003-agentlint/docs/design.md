# design.md — AgentLint MVP 設計

版: v1.0（2026-07-05確定）／ Sonnet実装セッションでの変更禁止。

## 技術スタック（確定）

- Python 3.10+、標準ライブラリのみ（`argparse` / `json` / `re` / `pathlib` / `dataclasses`）
- テスト: pytest（開発時のみ）
- `src/` レイアウト、`python -m agentlint <対象ディレクトリ>` で起動

## ディレクトリ構成（確定）

```
003-agentlint/
├── docs/
├── src/agentlint/
│   ├── __init__.py     # __version__ = "0.1.0"
│   ├── __main__.py
│   ├── models.py
│   ├── loader.py       # 設定ファイルの読込
│   ├── rules.py        # AL-001〜AL-010（1ルール1関数）
│   ├── report.py
│   └── cli.py
└── tests/
    ├── fixtures/       # 危険設定・安全設定のJSONサンプル
    └── test_*.py
```

## モジュール設計（確定）

### models.py

```python
SEVERITY_ORDER = ["Critical", "High", "Medium", "Low"]  # 降順ソートに使用

@dataclass(frozen=True)
class Finding:
    rule_id: str      # "AL-001"
    severity: str     # SEVERITY_ORDER のいずれか
    file: str         # 検出元ファイルの相対パス
    quote: str        # 該当設定値の引用（例: '"Bash(*)"'）
    message: str      # 1行の指摘文
    proposal: str     # 推奨対処（1〜2文）

@dataclass
class Config:
    file: str         # 相対パス
    data: dict        # パース済みJSON
    kind: str         # "settings" | "mcp"
```

### loader.py

```python
def load_configs(root: Path) -> tuple[list[Config], list[Finding]]: ...
```

- `.claude/settings.json` と `.claude/settings.local.json` → kind="settings"、`.mcp.json` → kind="mcp"
- パース失敗は AL-000（High）の `Finding` にして第2戻り値へ（REQ-102）

### rules.py — 検出条件の確定定義

```python
def check_all(configs: list[Config]) -> list[Finding]: ...
# 内部: RULES: list[Callable[[Config], list[Finding]]] を順に適用（NFR-102）
```

前提ヘルパー: `allow_entries(cfg) -> list[str]`（`data["permissions"]["allow"]`、無ければ`[]`。settings系のみ）

| ルール | 対象kind | 検出条件（確定） | severity |
|---|---|---|---|
| AL-001 | settings | allowエントリが正規表現 `^Bash$|^Bash\(\*\)$|^Bash\(\*:\*\)$` に一致 | High |
| AL-002 | settings | allowエントリに部分文字列 `sudo` | High |
| AL-003 | settings | allowエントリに次のいずれかを含む: `rm -rf` / `curl` と `| sh` の共起 / `chmod 777` / `> /dev/` / `mkfs` / `dd if=` | High |
| AL-004 | settings | allowに `Bash` で始まるエントリがあり、かつ `permissions.deny` が未定義または空リスト | Medium |
| AL-005 | settings | `permissions.defaultMode == "bypassPermissions"` | Critical |
| AL-006 | settings | `permissions.additionalDirectories` の要素が `/` `~` `~/` `$HOME` のいずれか、または `~/` `/` 単独指定（`/home` `/Users` で始まる深さ1のパスも含む） | High |
| AL-007 | mcp | `mcpServers.*` の `command` が `npx` or `uvx` で、args内のパッケージ指定に `@<数字>` で始まる版数がない（`-y` の有無は問わない。`@latest` は「版数なし」扱い） | Medium |
| AL-008 | mcp | `mcpServers.*.env` のキーが正規表現 `(?i)(key|token|secret|password|credential)` に一致し、値が空でなく `${` で始まらない | Critical |
| AL-009 | settings | allowに `WebFetch` or `WebSearch` で始まるエントリと、`^Read$` エントリが同時に存在 | Medium |
| AL-010 | settings | allowエントリが正規表現 `^(Write|Edit)\((/|~)` に一致 | High |

- 各Findingの `quote` には該当したエントリ／キーの生の値を入れる。`message` と `proposal` の文言はルール関数内で固定文字列として定義する（実装者が新規作文するのはここだけ。指摘文は「何が・なぜ危険か」、proposalは「どう直すか」を1文ずつ）。

### report.py

```python
def to_markdown(findings: list[Finding]) -> str: ...
def to_json_dict(findings: list[Finding]) -> dict: ...
```

Markdown書式（確定）:

```markdown
# AgentLint レポート

指摘: 3件（Critical: 1 / High: 1 / Medium: 1 / Low: 0）

## [Critical] AL-005 — .claude/settings.json
- 該当: `"defaultMode": "bypassPermissions"`
- 指摘: 全ツール呼び出しが確認なしで実行される。
- 対処: defaultModeを削除し、必要なコマンドのみをallowに列挙する。
```

指摘0件時は `# AgentLint レポート\n\n違反なし（検査ファイル: N件）` のみ。

JSON: `{"version": "0.1.0", "summary": {"total": n, "by_severity": {...}}, "findings": [Finding全フィールドのdict]}`

### cli.py（確定）

```
python -m agentlint <root> [--json PATH] [--fail-on {Critical,High,Medium,Low}] [--version]
```

- `<root>`: 検査対象ディレクトリ（必須・位置引数）
- 処理順: load_configs → 対象0ファイルならexit 2（REQ-103）→ check_all → Markdown標準出力 → --json出力 → ゲート判定
- ゲート: `SEVERITY_ORDER.index(f.severity) <= SEVERITY_ORDER.index(fail_on)` の指摘が1件以上 → exit 1

## テストフィクスチャ（確定）

- `fixtures/dangerous/`: AL-001〜010が全て1回ずつ発火する `.claude/settings.json`＋`.mcp.json`
- `fixtures/safe/`: 版数固定MCP・限定allow・deny定義済みの設定（指摘0件になること）
- `fixtures/broken/`: 不正JSON（AL-000のみ発火）
