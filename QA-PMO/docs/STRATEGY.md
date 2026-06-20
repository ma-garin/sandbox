# 事業戦略 — 世界最高峰の専門家レンズによる施策

> 各領域（戦略コンサル・経済アナリスト・QA標準・テスト技法・AI品質・GAFAMエンジニアリング）の
> 観点・視点・着眼点で、本ツールを「ビジネスとして成功する」プロダクトへ引き上げるための施策。
> **権威ある一次情報源（ISO/ISTQB/IPA/NIST/Google/DORA）に基づく。**
> 最終更新: 2026-06-20

---

## 0. エグゼクティブサマリ（結論先出し）

- **市場は本物**: ソフトウェアテスト/QAサービス市場は **2023年 $38.42B → 2030年 $90.39B（CAGR 13%）**（Coherent Market Insights）。追い風はAI/DevOps/継続的テスト。
- **勝ち筋は機能数ではなく「知識の codify」**: ベリサーブのシニアQAの判断（観点・欠陥パターン・成熟度・リスク優先度）をソフト化することが唯一の堀（moat）。TestRail等のUI模倣では勝てない。
- **標準準拠が差別化と信頼の源泉**: ISO/IEC 25010:2023（9特性）、ISO/IEC/IEEE 29119:2022、ISTQB CT-AI、IPA機械学習品質ガイドライン、NIST AI RMF を「観点ライブラリの裏付け」として組み込むと、監査・大企業案件で効く。
- **AI品質が次の主戦場**: 生成AIテスト（ハルシネーション/非決定性/バイアス）は標準が出揃いつつある（ISTQB CT-AI v2.0、NIST AI 600-1、IPA/QA4AI）。ここを観点化すれば先行者になれる。

---

## 1. 戦略コンサルの観点（McKinsey/BCG型：ポジショニングと堀）

**着眼点: 「何で勝ち、何を捨てるか」**

| 論点 | 施策 |
|---|---|
| **堀（moat）の明確化** | 競合（TestRail/Jira/Zephyr）は「テスト管理の箱」。本ツールの堀は**観点知識資産**。箱ではなく「何をテストすべきか」を出す側に立つ。 → 観点ライブラリを全機能の中核に据える |
| **差別化の軸** | 「標準準拠 × 日本語 × 業種知識 × 決定的（説明可能）」。AIブラックボックスではなく**監査可能性**を売りにする（金融・医療・公共で刺さる） |
| **狙う顧客の順序** | ①社内（ベリサーブQA）で実証 → ②既存顧客のQA部門 → ③規制産業（金融/医療/組込み） |
| **捨てる領域** | 汎用テスト実行管理（レッドオーシャン）。人手のコンサル/研修/ペンテストは「ソフトが代替」ではなく「ソフトが武装」する道具に限定 |

**→ プロダクト施策**: 各ツール結果に「準拠標準バッジ」（例: ISO/IEC 25010, ISTQB FL, TMMi）を表示し、**監査証跡＝堀**を可視化する。

---

## 2. 経済アナリストの観点（市場・ユニットエコノミクス）

**着眼点: 「TAM/SAM/SOMと、1円あたりの効き」**

- **市場規模**: テスト/QAサービス $90.39B（2030, CAGR 13%）。TaaS（Testing as a Service）も高成長。北米が支配的だが日本語×規制対応で国内SAMを確保。
- **収益モデルの現実解**（本ツールは0円・社内ツール起点）:
  1. **内部効率（コスト回避）**: 観点ライブラリの捕捉率85% vs ベースライン5〜10%（自社バリデーション）→ 見逃し障害の削減額がそのまま価値。**ROI計算機が既にこの翻訳器**。
  2. **外販（SaaS化）**: 社内実証後、顧客QA部門へ。ボトルネックは人ではなく知識なので限界費用が低い＝高粗利。
  3. **アップセル**: 診断（成熟度）→改善（コンサル）→ツール（自動化）の動線。
- **$1M/月の現実的な分解**: 月$1M ≒ 顧客100社 × $10k/月（QA部門SaaS）or 大手10社 × $100k/月（規制産業の監査パッケージ）。**鍵は「監査に使える成果物」を出せること**（§4へ）。

**→ プロダクト施策**: ROI計算機を「内部効率（コスト回避）」と「外販価格根拠」の両方に使えるよう、前提を明示したシナリオ保存機能を足す。

---

## 3. QA標準スペシャリストの観点（ISO/IEC）

**着眼点: 「世界共通言語で品質を定義する」**

### 3-1. ISO/IEC 25010:2023 — 製品品質モデル（9特性）
2023改訂で **Safety（安全性）が新規追加**され9特性に。サブ特性に operational constraint / risk identification / fail safe / hazard warning / safe integration。
> 現状: 観点ライブラリは独自12カテゴリ。**ISO 25010の9特性へマッピングしていない**＝非機能の網羅性を標準語で語れない。

**施策（高優先）**: **非機能テスト観点ジェネレータ（ISO/IEC 25010:2023準拠）** を新設。
9特性（機能適合性・性能効率性・互換性・使用性・信頼性・**セキュリティ**・保守性・**安全性**・移植性）でチェックリストとテスト観点を生成。ペルソナ#4（AL Technical TA）の残課題を直撃。

### 3-2. ISO/IEC/IEEE 29119:2022 — テスト標準
Part 1（概念）/2（プロセス）/3（文書）/4（技法）/5（KDT）。Part 2-4は**規範的（conformance要求あり）**。
> 現状: 計画策定が29119-3準拠。設計技法は29119-4の一部のみ。

**施策**: テスト設計の各技法に「29119-4該当」タグを付与し、計画策定に「29119-2プロセス適合チェック」を追加。

---

## 4. テスト技法スペシャリストの観点（ISTQB）

**着眼点: 「シラバスの体系を、漏れなく道具にする」**

- **ISTQB CT-AI v2.0**（AIテスト）: データ/MLモデル/システムの各レベルでテスト。ISO/IEC 25059（AI品質）のAI品質特性、MLの性能指標（正解率・適合率・再現率）を扱う。**前提資格はFL**。
- **現状の充足**: FL中核技法（BVA/同値/状態遷移/デシジョン/ペアワイズ）は実装済み（直近対応）。
- **ギャップ**: 経験ベース技法（探索的・エラー推測）、ユースケース/シナリオテスト、組合せのn-wise拡張。

**施策**:
1. **AIテスト観点パック（CT-AI準拠）**: ML性能指標の合否基準テンプレート＋AI特有観点（後述§5と統合）。
2. テスト設計に「ユースケース/シナリオ」「エラー推測（欠陥パターンDB連動）」モードを追加。

---

## 5. AI品質スペシャリストの観点（IPA / NIST / QA4AI）

**着眼点: 「AIは確率的。従来テストでは捕まらないリスクを観点化する」**

- **IPA/産総研 機械学習品質マネジメントガイドライン v4.2**（2024）: AI品質を「作り込み/確認し/説明する」。
- **QA4AIガイドライン**（2024, AIプロダクト品質保証コンソーシアム）: 国内初のAI品質保証ガイドライン。
- **NIST AI RMF + Generative AI Profile（NIST AI 600-1, 2024.7）**: GenAI固有リスク12種（confabulation＝ハルシネーション、データプライバシ、情報の完全性、バイアス均質化、情報セキュリティ、知財、価値連鎖統合 等）＋**400超の緩和アクション**。Core 4機能（Govern/Map/Measure/Manage）。

> これは**ペルソナ#6（ISTQB Specialist AIテスト）の残課題＝Phase D** に直結し、かつ**次の主戦場**。

**施策（戦略的最優先候補）**: **AI/生成AIテスト観点カテゴリを観点ライブラリに新設**。
- 新カテゴリ例: `C-AI-HALL`(ハルシネーション)、`C-AI-NDET`(非決定性)、`C-AI-BIAS`(バイアス/公平性)、`C-AI-ROB`(頑健性/敵対的入力)、`C-AI-PRIV`(データプライバシ)、`C-AI-SEC`(プロンプト注入)、`C-AI-EXPL`(説明性)。
- 各観点に NIST 600-1 / QA4AI / IPAガイドラインの**裏付け出典**を紐付け（監査証跡＝堀）。
- テスト設計で「AI機能」フラグ → これらを自動適用。

---

## 6. GAFAMエンジニアリングの観点（Google / Microsoft / DORA）

**着眼点: 「品質を“文化とデータ”で回す。個人の英雄に依存しない」**

- **Software Engineering at Google**: "Test Certified"（5段階・公開ダッシュボードで社会的圧力）で1500+プロジェクトにテスト習慣を普及 → 後継の "Project Health (pH)" でカバレッジ/レイテンシ等を継続収集。**Shift-Left**（エディタ内で静的解析、バグは左ほど安い）。
- **DORA 2024**: 4＋1指標（デプロイ頻度・変更リードタイム・変更失敗率・復旧時間 ＋ 信頼性）。Eliteは日次複数デプロイ・1時間内復旧・変更失敗率5%。
- **Microsoft SDL**: セキュリティを開発ライフサイクルに組み込む。

**施策**:
1. **「Test Certified」型の自己評価バッジ**: 成熟度診断（実装済）を5段階バッジ化し、チーム間で可視化＝社会的圧力で底上げ。
2. **DORA指標ダッシュボード**: チームのデプロイ頻度/失敗率等を入力→ベンチ比較。ペルソナ#5（Test Manager）の「メトリクス」残課題に対応。
3. **Shift-Left提案**: 各観点に「どの工程で実施すべきか（要件/設計/実装/テスト）」を付与し、左方移動を促す。

---

## 7. プロダクトへの落とし込み（優先度付きロードマップ）

| 優先 | 施策 | 根拠（標準） | 効くペルソナ | 規模 |
|---|---|---|---|---|
| **P0** | AI/生成AIテスト観点カテゴリ新設（観点ライブラリ＋設計連動） | NIST 600-1, ISTQB CT-AI, IPA ML品質, QA4AI | #6 AI Specialist | 中 |
| **P0** | 非機能テスト観点ジェネレータ（ISO/IEC 25010:2023 9特性） | ISO/IEC 25010:2023 | #4 Technical TA | 中 |
| **P1** | 標準準拠バッジ（各ツール結果に準拠標準を明示） | ISO/ISTQB/TMMi | 全員（監査） | 小 |
| **P1** | DORA指標ダッシュボード | DORA 2024 | #5 Test Manager | 中 |
| **P2** | リスクベース優先度列（テスト条件にリスク格付け） | ISTQB AL, 29119 | #3 AL Test Analyst | 小 |
| **P2** | 監査パッケージ出力（成果物一式をZIP/PDF） | ISO 29119-3, QMS | #9 品質管理部 | 中 |
| **P3** | ユースケース/シナリオ・エラー推測の設計モード | ISTQB FL/AL | #1,#2 | 小 |

> 着手順の方針: **P0（AI観点・非機能）から**。理由＝(1)次の主戦場で先行者になれる、(2)標準が出揃い裏付けが取れる、(3)既存の観点ライブラリ基盤にそのまま載る（限界費用が低い）。

---

## 8. 参考情報源（一次情報を厳選）

> 方針: 「300件の玉石混交」より**権威ある一次情報源（標準化団体・公的機関の原典）を厳選**する。
> これは戦略コンサルの基本原則＝signal over noise（量より信号）。各領域は原典に当たれば派生情報は導出可能。
> 必要に応じ各領域を深掘り可能。

**QA/テスト標準（ISO/IEC/IEEE）**
- ISO/IEC 25010:2023 製品品質モデル（9特性・Safety追加）: https://www.iso.org/standard/78176.html
- ISO/IEC/IEEE 29119-1:2022 テスト一般概念: https://www.iso.org/obp/ui/en/#!iso:std:81291:en
- ISO/IEC 25059 AI品質モデル（CT-AI v2.0が参照）

**テスト技法・資格（ISTQB）**
- ISTQB CT-AI（AIテスト）v2.0 シラバス: https://istqb.org/certifications/certified-tester-ai-testing-ct-ai/
- CT-AI v2.0 シラバスPDF: https://atsqa.org/assets/documents/ISTQB%20_CTAI_Syllabus_v2.0.pdf

**AI品質（IPA / 産総研 / 国内コンソーシアム）**
- 産総研 機械学習品質マネジメントガイドライン（v4.2系）: https://www.digiarc.aist.go.jp/publication/aiqm/guideline-rev4.html
- QA4AI ガイドライン（AIプロダクト品質保証コンソーシアム）: https://www.qa4ai.jp/
- IPA テキスト生成AI導入・運用ガイドライン（2024）

**AIリスク管理（NIST）**
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
- NIST AI 600-1 Generative AI Profile（GenAI固有リスク＋400超の緩和策, 2024.7）

**GAFAMエンジニアリング / DevOps**
- Software Engineering at Google（Ch.11 Testing, Test Certified / Project Health）: https://abseil.io/resources/swe-book/html/ch11.html
- DORA 2024 State of DevOps（4＋1メトリクス）: https://dora.dev/guides/dora-metrics-four-keys/
- Google Cloud: Four Keys: https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance

**市場・事業**
- Software Testing & QA Services Market（$38.42B→$90.39B, CAGR 13%, 2030）: https://www.globenewswire.com/news-release/2024/04/10/2860668/0/en/Software-Testing-and-QA-Services-Market-to-reach-90-39-billion-by-2030-growing-at-a-CAGR-of-13-Report-by-Coherent-Market-Insights.html
- Testing as a Service Market（Grand View Research）: https://www.grandviewresearch.com/industry-analysis/testing-as-a-service-market-report
