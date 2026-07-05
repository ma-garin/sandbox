# tasks.md — AgentLint MVP 実装タスク

運用: 1セッション＝1タスク。各タスクは「完了条件」を満たし検証コマンドが通ってから
`feat(agentlint): T0N <内容>` でコミット。spec/designとの矛盾は「要確認」に記録して中断。
検証コマンドは `003-agentlint/` をカレントディレクトリとして実行する。

---

## T01: スキャフォールド＋models＋loader

- `src/agentlint/` 一式（design.mdの構成）、`pytest.ini`（`pythonpath = src`）
- `models.py`（Finding / Config / SEVERITY_ORDER）と `loader.py`（load_configs、AL-000生成含む）を実装
- テスト（`tests/test_loader.py`）: 3種のファイル読込・kind判定・不正JSON→AL-000・対象なし→空リスト。フィクスチャ `fixtures/broken/` もここで作成
- 検証: `python -m pytest tests/test_loader.py -q`

## T02: rules.py 前半（settings系: AL-001〜AL-006）

- design.mdの表の検出条件どおりに1ルール1関数で実装。message/proposalは固定文字列
- テスト（`tests/test_rules_settings.py`）: 各ルールについて「発火する最小設定」と「発火しない近傍設定」（例: AL-001に対する `Bash(npm test:*)`）を1組ずつ
- 検証: `python -m pytest tests/test_rules_settings.py -q`

## T03: rules.py 後半（AL-007〜AL-010＋check_all）

- mcp系ルールとAL-009/010、`check_all`（RULESリスト適用）を実装
- テスト（`tests/test_rules_mcp.py`）: AL-007は「`npx pkg@1.2.3`（非発火）/`npx -y pkg`（発火）/`npx pkg@latest`（発火）」、AL-008は「平文値（発火）/`${ENV_VAR}`（非発火）/空文字（非発火）」を必ず含む
- 検証: `python -m pytest tests/ -q`

## T04: report.py

- to_markdown（design.mdの書式と一致、severity降順、0件時の短縮出力）と to_json_dict
- テスト（`tests/test_report.py`）: 書式一致・ソート順・0件時
- 検証: `python -m pytest tests/test_report.py -q`

## T05: cli.py＋ゲート判定

- REQ-103 / REQ-116 / REQ-117 / --version を実装
- テスト（`tests/test_cli.py`）: exit 0（safe）/ 1（dangerous, fail-on既定High）/ 0（dangerousでも `--fail-on Critical` かつCritical 0件の場合）/ 2（対象なし）
- 検証: `python -m pytest tests/test_cli.py -q`

## T06: e2eフィクスチャ完成

- `fixtures/dangerous/`（AL-001〜010が各1回発火）と `fixtures/safe/`（指摘0件）を完成させ、発火ルールIDの集合を検証するe2eテストを追加
- 検証: `python -m pytest tests/ -q`

## T07: ドッグフーディング

- 本sandboxリポジトリのルートに対して `PYTHONPATH=src python -m agentlint ../..` を実行し、結果を `docs/dogfood-result.md` に貼る（指摘が出た場合、設定変更はせず記録のみ）
- 検証: コマンドが exit 0/1 のいずれかで正常完了すること（2は不可）。ただし対象ファイルが無い場合はその旨を記録してスキップ可

## T08: README＋状態更新

- `README.md`: 概要・使い方・ルール一覧表（AL-000〜010、severity付き）・終了コード表・CI組込例（YAMLコードブロック）
- `CURRENT_STATE.md` を「MVP完了」に更新
- 検証: `python -m pytest tests/ -q` 全緑
