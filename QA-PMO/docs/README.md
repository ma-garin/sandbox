# 設計ドキュメント — ベリサーブ 品質ポータル

現行システム（`QA-PMO/portal/` の Django 版）の設計・計画ドキュメント一式。

| ドキュメント | 内容 | 対応する指摘 |
|---|---|---|
| [CONCEPT.md](CONCEPT.md) | コンセプト・背景・誰のための何か・中核ロジック | 6, 9, 10 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | システム構成図・ER図・画面遷移図（Mermaid） | 7 |
| [QA_FRAMEWORK.md](QA_FRAMEWORK.md) | ISO 29119 / ISO 25010 / 狩野モデルでのQA評価 | 8 |
| [WBS.md](WBS.md) | 開発WBS・フェーズ計画・11指摘の対応表 | 11 |
| [USER_GUIDE.md](USER_GUIDE.md) | 利用手引き（画面の見方・各ツールの使い方） | 9 |
| [PERSONAS.md](PERSONAS.md) | 12ペルソナ対応マトリクス（実機検証・残課題） | — |

起動手順は [`../portal/README.md`](../portal/README.md) を参照。

---

## 読む順番（おすすめ）

1. **CONCEPT** — なぜ・誰のために作るのか
2. **ARCHITECTURE** — どう作られているか（図解）
3. **QA_FRAMEWORK** — QA観点でどう評価できるか
4. **WBS** — 何を・どの順で作るか（進捗管理）
5. **USER_GUIDE** — 実際にどう使うか

---

## archive/

`archive/` 配下は初期プロトタイプ（`pmo-menu.html`）時代の旧ドキュメント。
現行システムの正は本ディレクトリ直下のファイル。
