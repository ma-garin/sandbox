# spec.md — AgentLint MVP（GT-15）

版: v1.0（2026-07-05確定）／ Sonnet実装セッションでの変更禁止。

## 目的

Claude Code のエージェント設定（`.claude/settings.json` 等）とMCP設定（`.mcp.json`）を
静的検査し、最小権限原則違反・危険設定をCIで検出するCLI。LLM不使用・ルールベースのみ。

## 検査対象ファイル

対象リポジトリのルートを入力とし、存在するものだけを読む（存在しないのはエラーではない）:

- `.claude/settings.json`
- `.claude/settings.local.json`
- `.mcp.json`

## 機能要件（EARS）

### 入力

- REQ-101: システムは、指定ディレクトリ直下の検査対象ファイルのうち存在するものを読み込み、JSONとしてパースしなければならない。
- REQ-102: システムは、JSONとしてパースできないファイルがあった場合、そのファイルに対する指摘（ルールAL-000・severity: High「設定ファイルが不正なJSON」）を生成し、処理を継続しなければならない。
- REQ-103: システムは、検査対象ファイルが1つも存在しない場合、標準エラーにメッセージを出力し終了コード2で終了しなければならない。

### ルール検査（初版10ルール・確定）

各ルールの検出条件はdesign.mdに確定記述がある。severityは ISTQB 4段階。

- REQ-104: AL-001 — `permissions.allow` に無制限Bash（`Bash` / `Bash(*)` / `Bash(*:*)`）がある場合、Highの指摘を生成しなければならない。
- REQ-105: AL-002 — `permissions.allow` のエントリに `sudo` が含まれる場合、Highの指摘を生成しなければならない。
- REQ-106: AL-003 — `permissions.allow` のエントリに破壊的パターン（design.mdの固定リスト）が含まれる場合、Highの指摘を生成しなければならない。
- REQ-107: AL-004 — Bash系のallowが存在し、かつ `permissions.deny` が空または未定義の場合、Mediumの指摘を生成しなければならない。
- REQ-108: AL-005 — `permissions.defaultMode` が `bypassPermissions` の場合、Criticalの指摘を生成しなければならない。
- REQ-109: AL-006 — `permissions.additionalDirectories` にルート・ホーム（`/` `~` `~/` `$HOME`）が含まれる場合、Highの指摘を生成しなければならない。
- REQ-110: AL-007 — MCPサーバー定義の `command`/`args` が `npx`（または `uvx`）でパッケージ版数を固定していない場合、Mediumの指摘を生成しなければならない。
- REQ-111: AL-008 — MCPサーバー定義の `env` に、秘密情報らしきキー名（design.mdの正規表現）で環境変数参照でない平文値が設定されている場合、Criticalの指摘を生成しなければならない。
- REQ-112: AL-009 — `permissions.allow` にネットワーク送信系（`WebFetch` `WebSearch`）と広範な読み取り（`Read` 無引数）が同時に含まれる場合、Mediumの指摘を生成しなければならない。
- REQ-113: AL-010 — `permissions.allow` の `Write(...)` / `Edit(...)` の引数がプロジェクト外（`/` または `~` で始まる絶対パス）を指す場合、Highの指摘を生成しなければならない。

### 出力・ゲート判定

- REQ-114: システムは、指摘を severity降順（Critical→Low）でMarkdownレポートとして標準出力に出力しなければならない。各指摘は ルールID・severity・対象ファイル・該当設定値の引用・推奨対処 を含む。
- REQ-115: システムは、`--json <path>` 指定時、design.mdのスキーマでJSONレポートを書き出さなければならない。
- REQ-116: システムは、`--fail-on <severity>`（既定値 `High`）以上の指摘が1件以上ある場合は終了コード1、それ以外は0で終了しなければならない。
- REQ-117: システムは、指摘0件の場合「違反なし」を出力し終了コード0で終了しなければならない。

## 非機能要件

- NFR-101: Python 3.10+・標準ライブラリのみ（テストはpytest）
- NFR-102: ルールは1ルール1関数で実装し、ルール追加が既存関数の変更なしにできる構造とする

## MVP対象外（明示）

- Skill frontmatter（allowed-tools）の検査、hooksの検査 → v2
- 実効権限グラフの構築、MCPサーバーコード自体の解析（それはINF-04の領域）
- 自動修正（fix提案はテキストのみ）
