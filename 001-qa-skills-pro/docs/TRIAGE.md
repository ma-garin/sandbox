# ポートフォリオ全50案 実装選別（2026-07-05）

対象: 「AI駆動開発時代の品質保証 新規事業ポートフォリオ（全50案）」第2版HTML。
判定基準: **このsandboxで単独プロトタイプを作れるか**（社内データ・顧客・重量級インフラの要否）。

## A. 即実装着手可能（自己完結・外部資産不要）

| ID | 案 | 根拠 |
|---|---|---|
| **DOM-06** QA Skills Pro | **採択（本プロジェクト）** | プロンプト/Markdownのみ・1人月・資料内でも「最速で市場投入可能」 |
| INF-01 TraceGate | 次候補 | MVPは規約ベース（REQ-ID＋@covers）の決定的処理。CLI＋Actionsで完結 |
| GT-15 AgentLint | 次候補 | 設定ファイル静的検査のみ・1人月 |
| INF-02 MutaJudge | 候補 | Stryker/mutmutラップ＋差分限定・1.5人月 |
| GT-11 PromptReg | 候補 | CLI＋Actions・1人月 |
| GT-13 LLM Pact | 候補 | 契約YAML＋定期実行・1人月 |
| GT-20 EnvDrift | 候補 | フィンガープリント差分・1人月 |
| EV-28 ChangeVerify | 候補 | 差分照合CLI・1人月 |

## B. 実装可能だが「試す相手」（実リポジトリ・実トレース・辞書資産）が必要

INF-03 ReviewGate（ルールベースMVPは可、価値の源泉のレビュー観点DB・欠陥データは社内資産）、
DOM-07 SpecReverse、GT-12 / GT-14 / GT-16 / GT-17 / GT-19、EV-21 / EV-23 / EV-24、
JP-37 / JP-42、LG-50（コードより規約DB整備が主作業）

## C. データ資産の整備が先（コードを書いても中身が空）

INF-05 JudgeAlign（ゴールドラベルが本体）、DOM-09 ComplyChain（規格オントロジー約150項目が本体）、
DOM-10 TrajAudit（日本語正解軌跡が本体）、EV-22、JP-38 / JP-39、PR-46 / PR-47、LG-48

## D. 受託・コンサル型（ソフトウェア実装が主目的ではない）

DOM-08（顧客の本番トラフィック前提）、RG-29〜36（規制産業系全部）、JP-40、
PR-43 / PR-44、EV-26 / EV-27、LG-49

## E. インフラ重量級（個人試作の範囲外）

INF-04 SkillCert（gVisor/Firecrackerサンドボックス基盤）、EV-25 TestCell、GT-18 SwarmTest

## 推奨着手順

1. **DOM-06 QA Skills Pro** — 本プロジェクトとして実装済み（初版）
2. **INF-01 TraceGate** — CI関所のインフラポジションを取る戦略上の本命。DOM-06のカバレッジ宣言・REQ-ID規約と接続できる
3. **GT-15 AgentLint** — 時流（エージェント権限の過剰付与）に合致し小さく作れる
