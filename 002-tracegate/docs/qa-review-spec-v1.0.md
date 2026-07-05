# /qa-review 適用結果 — 002-tracegate/docs/spec.md（v1.0）

- 対象: `002-tracegate/docs/spec.md` v1.0（2026-07-05確定）
- 参照した関連文書: `docs/design.md` v1.0、`docs/tasks.md`（一貫性・トレーサビリティ確認のため）
- レビュー実施日: 2026-07-05
- レビュー主体: `/qa-review` Skill（001-qa-skills-pro）

## サマリ

| severity | 件数 |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 2 |
| Low | 0 |

**実装着手可否の所見（レビュー時点）**: 条件付き着手可。High 1件（QA-001）は
「ファイルを読む」という全機能の土台に関わり実装範囲から外せないため、
実装着手前にspec.md/design.mdへの反映を推奨する。

**対応状況**: 3件とも本レビューと同一セッションでspec.md / design.md / tasks.md に
反映し、v1.1として確定した（→ 各ファイルの変更履歴参照）。反映後の所見: **着手可**。

## 指摘一覧（severity降順）

### QA-001
```
category:   信頼性 / 異常系の沈黙（ambiguity-patterns.md 観点6）
severity:   High
title:      非UTF-8以外のファイル読込エラー（権限拒否・ディレクトリ誤マッチ等）の扱いが未定義
evidence:   spec.md:62 "NFR-003: UTF-8以外でデコードできないファイルは警告を標準エラーに出して
            スキップし、異常終了しない" は UnicodeDecodeError のみを対象にしている。
            design.md:83 の実装メモも同様に「UnicodeDecodeErrorの場合は…スキップ」とのみ記載。
            一方 design.md:119 のglob展開は `glob.glob(pattern, recursive=True)` であり、
            Pythonのglobモジュールはパターンに一致するディレクトリも返し得る
            （例: `tests/**/*.*` は `tests/fixtures/simple.old/` のような名前のディレクトリにも一致し得る）。
            この場合 open() は IsADirectoryError（OSErrorのサブクラス）を送出するが、
            spec.md・design.mdのどちらにもUnicodeDecodeError以外の例外を捕捉する記述がない。
repro:      1. `tests/`配下に権限拒否ファイル、または名前に`.`を含むディレクトリを用意
            2. NFR-003の記述どおりUnicodeDecodeErrorのみをcatchする実装で実行
            期待: 警告を出してスキップし継続 ／ 実際（spec.md記述に忠実な実装）: 未捕捉の
            OSError/IsADirectoryError/PermissionErrorでツール全体がクラッシュしうる
proposal:   NFR-003の対象を「UnicodeDecodeErrorを含むOSError全般」に拡張する
confidence: 確認済（design.mdの該当記述・globモジュールの仕様に基づく）
```

### QA-002
```
category:   トレーサビリティ / テスト可能性（checklist C1・D）
severity:   Medium
title:      NFR-002（性能要件）を検証するテスト・タスクがtasks.mdに存在しない
evidence:   spec.md:61 "NFR-002: 合計1,000ファイル・10万行の入力を10秒以内に処理する
            （ファイルは1回だけ読む）"。tasks.md T01〜T11を確認したが、性能を測定する
            タスク・テストは存在しない（T09のe2eテストはtests/fixtures/simple/の
            3行規模のみを対象とし、性能は測定しない — 不在確認）。
repro:      T01〜T11を全て完了し全テストが緑になっても、NFR-002が満たされているかは
            一度も自動検証されない。
proposal:   MVPスコープでは自動性能テストを追加しない方針を明示し、NFR-002を
            「目標値（手動計測推奨）」として自動テスト対象外と宣言する
            （スコープを偽って完了扱いにしないため）
confidence: 確認済（tasks.md全文を確認）
```

### QA-003
```
category:   完全性 / 異常系の沈黙（ambiguity-patterns.md 観点6）
severity:   Medium
title:      --output / --json のファイル書き込み失敗時の動作が未定義
evidence:   spec.md:41 "REQ-010: …`--output <path>`指定時はファイルにも書き出す。"
            spec.md:42 "REQ-011: …`--json <path>`が指定された場合…指定パスに書き出さなければ
            ならない。" いずれも書き込み失敗（権限不足・親ディレクトリ不在等）時の挙動を
            定義していない（不在確認）。REQ-015が「要件0件→終了コード2」という類似の
            設定誤りパターンを既に定義しているのに対し、書き込み失敗には対応する規定がない。
proposal:   REQ-015と同様の枠組みで、書き込み失敗時は標準エラーにメッセージを出し
            終了コード2で終了する要件を追加する
confidence: 確認済
```

## 確認すべき質問リスト

- なし（3件とも仕様策定者への質問ではなく、直接の仕様拡張で解消可能と判断したため、
  本レビューと同一セッションでspec.md v1.1に反映した）

## レビュー範囲の宣言

- 実施した観点: ambiguity-patterns.md 観点1〜8（全て走査）、spec-review-checklist.md A〜E（全項目）
- 一貫性チェック(B3)は `design.md` と突合。`tasks.md` はトレーサビリティ確認（D・C1）のために参照した
- 対象外: 実測（性能・障害注入）は本レビューの範囲外（静的レビューのみ）。QA-002はその静的レビューの中で
  「実測を行うタスクが存在しない」という構造上の不在を指摘したものであり、実測自体は実施していない
