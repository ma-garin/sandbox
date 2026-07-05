# AGENTS.md — 002-tracegate

> 共通規約は親フォルダの `sandbox/AGENTS.md`、実装体制は `sandbox/ROADMAP.md` を参照。

---

## このプロジェクトの概要

INF-01「TraceGate」MVP。仕様のREQ-IDとテストの `@covers` アノテーションを突合し、
トレーサビリティマトリクス生成と乖離率CIゲートを行うCLI（規約ベース・LLM不使用）。

## 実装セッションへの指示（Sonnet向け・必読）

1. `CURRENT_STATE.md` → `docs/tasks.md` の順に読み、**次の未完了タスク1つだけ**を実施する
2. `docs/spec.md`（要件）と `docs/design.md`（設計）は確定済み・変更禁止。
   矛盾や不明点は `CURRENT_STATE.md` の「要確認」に記録して中断する
3. 依存追加禁止: Python 3.10+ 標準ライブラリのみ（pytestは開発時のみ）
4. 設計判断をしない: シグネチャ・書式・終了コードはすべてdesign.mdに書いてある。
   書いていないことを決める必要が生じたら、それは中断のサイン
5. テストのdocstringには必ず `@covers REQ-NNN` を書く（ドッグフーディング規約）
6. 検証コマンドが通ってから `feat(tracegate): T0N <内容>` でコミット

## 対象ファイル

```
002-tracegate/
├── docs/       # spec.md / design.md / tasks.md（読み取り専用）
├── src/tracegate/
└── tests/
```

## 対象外ファイル

- このフォルダの外（他プロジェクトへの依存・参照は禁止）

## 使用技術・制約

- Python 3.10+ / 標準ライブラリのみ / pytest（開発時）
- src レイアウト、`python -m tracegate` で起動

## 現在のタスク

→ `CURRENT_STATE.md` を参照
