# tasks.md — TraceGate MVP 実装タスク

運用: 1セッション＝1タスク。上から順に実施。各タスクは「完了条件」を満たし
「検証コマンド」が通ってから `feat(tracegate): T0N <内容>` でコミットする。
spec.md / design.md と矛盾を見つけたら実装で埋めず、CURRENT_STATE.md の「要確認」に記録して中断。

検証コマンドはすべて `002-tracegate/` をカレントディレクトリとして実行する。

---

## T01: パッケージスキャフォールド

- 作成: `src/tracegate/__init__.py`（`__version__ = "0.1.0"`）、`__main__.py`、空の `models.py` / `extract.py` / `trace.py` / `report.py` / `cli.py`（cli.pyは `main(argv=None) -> int` が0を返すだけ）、`tests/` 空ディレクトリ、`pytest.ini`（`[pytest]` `pythonpath = src`）
- 完了条件: `python -m tracegate` が終了コード0
- 検証: `PYTHONPATH=src python -m tracegate; echo $?` → `0`

## T02: models.py

- design.mdの3つのdataclassと `divergence` プロパティを実装
- テスト: `tests/test_trace.py` に `TraceResult.divergence` の算出テスト（docstringに `@covers REQ-009`）
- 検証: `python -m pytest tests/test_trace.py -q`

## T03: extract.find_requirements

- REQ-001 / REQ-002 / REQ-003 / NFR-003 を実装
- テスト（`tests/test_extract.py`、各docstringに@covers）: 基本抽出・重複IDは初出優先・タイトルの記号除去・同一行複数ID・非UTF-8スキップ（`tmp_path` にバイナリを書いて検証）
- 検証: `python -m pytest tests/test_extract.py -q`

## T04: extract.find_coverage

- REQ-004 / REQ-005 / REQ-006 を実装
- テスト: `@covers` 行から複数ID抽出・行番号記録・`@covers` なし行のREQ-IDが無視されること
- 検証: `python -m pytest tests/test_extract.py -q`

## T05: trace.build_trace

- REQ-007 / REQ-008 を実装（covered/uncovered/orphansへの分類、抽出順の保持）
- テスト: covered・uncovered・orphanが混在するケース、coverage 0件のケース
- 検証: `python -m pytest tests/test_trace.py -q`

## T06: report.to_markdown

- REQ-010 / REQ-012 を実装。design.md「出力例」と文字単位で一致する書式（孤立0件時のセクション省略、複数カバレッジの `<br>` 区切りを含む）
- テスト（`tests/test_report.py`）: 出力例と同一入力→同一出力の一致テスト、孤立0件時の省略
- 検証: `python -m pytest tests/test_report.py -q`

## T07: report.to_json_dict

- REQ-011 のdict構築を実装（design.mdのJSONスキーマどおり。`version` は `__version__` を使用）
- テスト: スキーマのキー・値の型・divergence値の検証
- 検証: `python -m pytest tests/test_report.py -q`

## T08: cli.main

- REQ-013〜REQ-019 を実装（引数定義・glob展開・拡張子フィルタ・処理順・終了コードはdesign.mdの表と記述どおり）
- テスト（`tests/test_cli.py`）: `main([...])` の戻り値で exit 0 / 1（乖離超過）/ 1（orphan）/ 0（--allow-orphans）/ 2（要件0件）/ 0（--version）を検証。`capsys` で標準出力にマトリクスが出ることを確認
- 検証: `python -m pytest tests/test_cli.py -q`

## T09: e2eフィクスチャテスト

- `tests/fixtures/simple/` をdesign.mdの定義どおり作成し、`main()` をフィクスチャに対して実行して期待値（total=3, covered=2, orphans=1, divergence=1/3, exit 1）を検証。`--json` 出力ファイルの内容も検証
- 検証: `python -m pytest tests/ -q`（全テスト）

## T10: ドッグフーディング

- 全テスト関数のdocstringに `@covers REQ-NNN` が付いていることを確認（漏れは追記）
- `PYTHONPATH=src python -m tracegate --specs "docs/spec.md" --tests "tests/**/*.py" --allow-orphans` を実行し、出力マトリクスで孤立要件が0件であることを確認。孤立要件が出た場合、そのREQ-IDのテストを追加する（仕様変更はしない）
- 完了条件: 上記コマンドが exit 0、全REQがcovered
- 検証: 上記コマンド → `echo $?` が `0`

## T11: README＋GitHub Actions例＋状態更新

- `README.md` に: 概要・使い方（コマンド例と出力例）・終了コード表・Actionsジョブ例（`python -m tracegate` を実行しexit codeでゲートする最小YAMLをコードブロックで掲載。ワークフローファイル自体は作らない）
- `CURRENT_STATE.md` を「MVP完了」に更新
- 検証: `python -m pytest tests/ -q` が全緑のまま
