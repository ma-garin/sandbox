# ROADMAP — QAポートフォリオ実装計画

対象: 「AI駆動開発時代の品質保証 新規事業ポートフォリオ（全50案）」のうち、
実装選別（`001-qa-skills-pro/docs/TRIAGE.md`）でA判定になった案の実装計画。

## 実装体制の前提

- **仕様・設計・タスク分割**: 上位モデル（Opus/Fable）のセッションで確定させる
- **実装**: すべて **Sonnet** のセッションで行う
- したがって各プロジェクトは、実装着手前に以下3点が揃っていることを必須とする:
  1. `docs/spec.md` — EARS形式・REQ-ID付きの要件（判断の余地を残さない）
  2. `docs/design.md` — モジュール構成・関数シグネチャ・入出力例まで確定
  3. `docs/tasks.md` — 1セッションで完了する粒度のタスク列（完了条件＋検証コマンド付き）

## Sonnet実装セッションの運用ルール（全プロジェクト共通）

1. セッション開始時に `CURRENT_STATE.md` → `docs/tasks.md` の順に読む
2. **1セッション＝1タスク**（tasks.mdのT番号）。先のタスクに手を出さない
3. `spec.md` / `design.md` の変更は禁止。矛盾・不明点を見つけたら実装で埋めず、
   `CURRENT_STATE.md` の「要確認」に記録してタスクを中断する
4. 依存パッケージの追加は禁止（Python標準ライブラリ＋pytestのみ。例外はdesign.mdに明記されたもの）
5. タスクごとに検証コマンドを実行し、通ってからコミット（Conventional Commits・1タスク1コミット）
6. セッション終了時に `CURRENT_STATE.md` を更新する

## フェーズ計画

| フェーズ | 内容 | 実装 | 状態 |
|---|---|---|---|
| P0 | 全50案選別＋DOM-06 QA Skills Pro 初版（PR #27） | 完了 | ✅ |
| P1 | `002-tracegate` の仕様を `/qa-review` でセルフレビュー（DOM-06の試用を兼ねる） | Sonnet 1セッション | 準備完了 |
| P2 | **INF-01 TraceGate** MVP実装（`002-tracegate/docs/tasks.md` T01〜T11） | Sonnet 4〜6セッション | 仕様・設計・タスク確定済み |
| P3 | **GT-15 AgentLint** MVP実装（`003-agentlint/docs/tasks.md` T01〜T08） | Sonnet 3〜4セッション | 仕様・設計・タスク確定済み |
| P4 | DOM-06 v2（状態遷移・ペアワイズのreferences追加）＋実プロジェクト試用結果の反映 | Sonnet 2セッション | P1の結果待ち |
| P5 | 次案の仕様策定（GT-11 PromptReg / INF-02 MutaJudge のどちらか） | 上位モデル | 未着手 |

### フェーズ間の依存

- P1はP2の前に行う（仕様の欠陥を実装前に検出する。DOM-06のドッグフーディングを兼ねる）
- P2完了後、TraceGateを本リポジトリ自身に適用する（002のspec.md/testsは@covers規約で書かれている）
- P3はP2と独立（並行可）

## 各案のMVP要点（A判定・未着手分の覚え書き）

- **GT-11 PromptReg**: プロンプト資産の回帰テスト。LLM判定が必要なため、仕様策定時に判定プロンプトと合格基準の固定が必須（Sonnet実装の前提）
- **INF-02 MutaJudge**: mutmut/Strykerのラッパー。外部OSS依存の版固定と差分限定実行の設計が必要
- **GT-13 LLM Pact / GT-20 EnvDrift / EV-28 ChangeVerify**: 小粒。P5以降に随時仕様化
