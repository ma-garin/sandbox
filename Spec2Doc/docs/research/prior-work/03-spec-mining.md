# 先行研究調査 3: 仕様マイニング・業務ルール抽出・LLM による仕様生成（軽量版）

調査方法: arXiv API・Crossref API を WebFetch で使用（Semantic Scholar は 429 のため不使用）。WebSearch は未使用（arXiv/Crossref のみで目標件数に到達）。WebFetch 9 回で完了。2026-09-26 実施。

## 一覧表

| # | 題名 | 著者 | 年 | 会議・誌 | URL/DOI | 根拠区分 |
|---|---|---|---|---|---|---|
| 1 | Mining Specifications | Ammons, Bodik, Larus | 2002 | POPL | DOI: 10.1145/503272.503275 | 実証（アブストラクトのみ確認） |
| 2 | Debugging Temporal Specifications with Concept Analysis | Ammons, Mandelin, Bodik, Larus | 2003 | PLDI | DOI: 10.1145/781131.781152 | 実証（アブストラクトのみ確認） |
| 3 | Dynamically Discovering Likely Program Invariants to Support Program Evolution（Daikon） | Ernst, Cockrell, Griswold, Notkin | 1999 / 2001（誌） | ICSE'99 / IEEE TSE 2001 | DOI: 10.1145/302405.302467（会議）/ 10.1109/32.908957（誌） | 実証（本文未確認） |
| 4 | Mining Software Specifications: Methodologies and Applications（書籍・"Specification Mining" 章を含む） | Lo, Khoo, Han, Liu（編） | 2011 | CRC Press | DOI: 10.1201/b10928（章: 10.1201/b10928-2） | 主張（本文未確認・書誌のみ） |
| 5〔参考〕 | Mining Temporal Specifications from Object Usage | Wasylkowski, Zeller | 2009 / 2011（誌） | ASE'09 / Automated Software Engineering誌 | DOI: 10.1109/ase.2009.30 / 10.1007/s10515-011-0084-1 | 実証（本文未確認）。Lo らと並ぶ有限状態機械／時相仕様マイニングの隣接研究として参考掲載 |
| 6 | A model-based approach for extracting business rules out of legacy information systems | Cosentino | 2013 | 博士論文（École des Mines de Nantes） | DOI: 10.70675/ad450fa6z8c26z48d4z8c23z00ec90968f41 | 主張（本文未確認） |
| 7〔参考〕 | Towards the Automatic Extraction of Structural Business Rules from Legacy Databases | Chaparro, Aponte, Ortega, Marcus | 2012 | WCRE 2012 | DOI: 10.1109/wcre.2012.57 | 主張（本文未確認）。レガシー業務ルール抽出の同時期研究として参考掲載（Cosentino とは別著者） |
| 8 | From COBOL to Business Rules — Extracting Business Rules from Legacy Code | Sneed, Verhoef | 2019 | 書籍章（Studies in Computational Intelligence, Springer） | DOI: 10.1007/978-3-030-26574-8_14 | 主張（本文未確認） |
| 9 | SpecGen: Automated Generation of Formal Program Specifications via Large Language Models | Ma, Liu, Li, Xie, Bu | 2024 | arXiv preprint | arXiv:2401.08807（v5） | 主張（アブストラクトより。本文未確認） |
| 10 | nl2spec: Interactively Translating Unstructured Natural Language to Temporal Logics with Large Language Models | Cosler, Hahn, Mendoza, Schmitt, Trippel | 2023 | arXiv preprint（TACAS 2023 に採録と把握しているが未確認） | arXiv:2303.04864（v1） | 主張（アブストラクトより。本文未確認） |
| 11〔留保〕 | AutoSpec: Automated Generation of Neural Network Specifications | Jin, Liao, Kalia, Foukas, Zhang, Tan, Mao, Yan | 2024 | arXiv preprint | arXiv:2409.10897（v3） | 主張（アブストラクトより。本文未確認）。**注意: 対象は「ニューラルネットワークの仕様（テストオラクル）自動生成」であり、依頼で想定された「LLM による一般プログラム仕様生成」の AutoSpec と同一かは未確認** |

---

## 各件の詳細

### 1. Mining Specifications（Ammons, Bodik, Larus, 2002, POPL）
- 手法の要点: プログラム実行トレースを観測し、時相・データ依存を持つ有限状態機械として仕様を機械学習的に合成する「仕様マイニング」を提唱した基点論文。
- データ・n: 未確認（本文未取得）。
- 主な結果: アブストラクトいわく、学習したプロトコル仕様からバグを検出できたと記述。数値指標は本文未確認。
- 限界: 未確認。
- 根拠の区分: 実証（本文の実験結果は未確認、アブストラクトの記述のみ）。
- Spec2Doc への示唆: 「実行トレースから状態遷移を推定する」という発想は Spec2Doc のコード→仕様抽出の原点。ただし境界値・条件分岐の精度に関する数値は未確認であり、事実として引用できない。

### 2. Debugging Temporal Specifications with Concept Analysis（Ammons, Mandelin, Bodik, Larus, 2003, PLDI）
- 手法の要点: マイニングした時相仕様の誤りをコンセプト分析でクラスタリングし、人手検査の手間を削減する後継研究。
- データ・n: 未確認。
- 主な結果: アブストラクトは「個別トレース確認に比べ人手検査を約3分の2削減」と主張（本文未確認）。
- 限界: 未確認。
- 根拠の区分: 主張（アブストラクトのみ、本文未確認）。
- Spec2Doc への示唆: マイニング結果は誤りを含みうるため、人間レビューの負荷削減という着眼点が Spec2Doc のドキュメント生成後レビュー工程の設計に参考になる（推測）。

### 3. Daikon（Ernst, Cockrell, Griswold, Notkin, 1999/2001）
- 手法の要点: プログラム実行時の変数値からトレース分析で「起こりそうな不変条件（likely invariants）」を動的に推定するツール。
- データ・n: 未確認。
- 主な結果: 未確認（Crossref からは書誌情報のみ取得。被引用数は Crossref 上で会議版222・誌版669だが、これはツールの影響力の目安であり実験結果ではない）。
- 限界: 未確認。
- 根拠の区分: 実証研究として広く知られるが、本調査では本文未確認。
- Spec2Doc への示唆: 「動的解析で不変条件＝事前条件・事後条件の候補を推定する」という手法は、Spec2Doc が境界条件を推測する際の一手法として参考になりうる（推測、精度数値は未確認）。

### 4. Mining Software Specifications: Methodologies and Applications（Lo, Khoo, Han, Liu 編, 2011）
- 手法の要点: 仕様マイニング分野（頻出パターンマイニング・有限状態機械推定など）の方法論を体系化した書籍。David Lo は有限状態機械推定系の代表的研究者。
- データ・n: 該当なし（書籍・サーベイ的性格）。
- 主な結果: 未確認（書誌情報のみ）。
- 限界: 未確認。
- 根拠の区分: 主張（本文未確認、書誌のみ）。
- Spec2Doc への示唆: 有限状態機械としての仕様表現は、Spec2Doc が状態遷移をドキュメント化する際の表現形式の選択肢として参考になる（不明点: 個別手法の抽出精度は未確認）。

### 5〔参考〕 Mining Temporal Specifications from Object Usage（Wasylkowski, Zeller, 2009/2011）
- 手法の要点: オブジェクトの利用パターンから時相仕様（許容される呼び出し順序）をマイニングする、Lo らと並ぶ隣接研究。
- データ・n: 未確認。
- 主な結果: 未確認。
- 限界: 未確認。
- 根拠の区分: 実証研究として知られるが本調査では本文未確認。
- Spec2Doc への示唆: API 利用順序の制約抽出は、Spec2Doc がコードから「呼び出し順序」制約を仕様化する際の関連手法（推測）。

### 6. A model-based approach for extracting business rules out of legacy information systems（Cosentino, 2013）
- 手法の要点: Java・COBOL・関係データベースなど混在するレガシー情報システムから、モデル駆動工学（MDE）の手法で業務ルールを抽出。
- データ・n: 未確認。
- 主な結果: 未確認（博士論文の書誌情報のみ取得）。
- 限界: 未確認。
- 根拠の区分: 主張（本文未確認）。
- Spec2Doc への示唆: 「複数言語混在のレガシーシステムから業務ルールを抽出する」という問題設定は Spec2Doc の対象領域と近い。モデル駆動の中間表現を挟む設計は参考になりうる（推測）。

### 7〔参考〕 Towards the Automatic Extraction of Structural Business Rules from Legacy Databases（Chaparro, Aponte, Ortega, Marcus, 2012, WCRE）
- 手法の要点: レガシーのリレーショナルデータベース設計から構造的業務ルール（制約）を自動抽出。
- データ・n: 未確認。
- 主な結果: 未確認。
- 限界: 未確認。
- 根拠の区分: 主張（本文未確認）。
- Spec2Doc への示唆: DB スキーマからの制約抽出はコードからの仕様抽出と相補的であり、Spec2Doc がデータモデル由来の制約も扱うなら参考になる（推測）。

### 8. From COBOL to Business Rules — Extracting Business Rules from Legacy Code（Sneed, Verhoef, 2019）
- 手法の要点: Harry Sneed による長年のレガシーCOBOL解析の知見をまとめ、業務ルール抽出手法を提示（静的解析ベースと推定されるが本文未確認）。
- データ・n: 未確認。
- 主な結果: 未確認。
- 限界: 未確認。
- 根拠の区分: 主張（本文未確認）。
- Spec2Doc への示唆: 実務のレガシーCOBOL資産を対象とした業務ルール抽出の系譜として、Spec2Doc が「暗黙の業務ルールをコードから言語化する」設計思想の先行例に位置づけられる（推測）。

### 9. SpecGen: Automated Generation of Formal Program Specifications via Large Language Models（Ma, Liu, Li, Xie, Bu, 2024）
- 手法の要点: LLM のコード理解力を利用し、対話的ガイダンスと変異ベースの精緻化という2段階で形式仕様（事前条件・事後条件等）を自動生成。
- データ・n: 未確認（アブストラクトからは評価対象「385プログラム」という規模が読み取れるのみ）。
- 主な結果: アブストラクトの記述では「385プログラム中279プログラムで既存ツールを上回った」と主張。**本文で数値の定義（正解基準・比較対象ツール名）は未確認**。
- 限界: 未確認。
- 根拠の区分: 主張（アブストラクトより。本文未確認）。
- Spec2Doc への示唆: LLM対話＋反復的精緻化という2段階設計は、Spec2Doc がコードから仕様文書を生成し人間確認で修正するワークフローに直接的に参考になる（境界値・条件抽出の精度自体は未検証）。

### 10. nl2spec: Interactively Translating Unstructured Natural Language to Temporal Logics with Large Language Models（Cosler, Hahn, Mendoza, Schmitt, Trippel, 2023）
- 手法の要点: 自然言語要求を時相論理（LTL等）へ変換する際、LLM出力の部分翻訳を人間が対話的に追加・削除・編集できるインタフェースで曖昧性に対処。
- データ・n: 未確認（ユーザースタディを実施したとの記述のみ）。
- 主な結果: 未確認（定量的成功率等は本調査で取得したアブストラクト要約に含まれず）。
- 限界: 未確認。
- 根拠の区分: 主張（アブストラクトより。本文未確認）。
- Spec2Doc への示唆: Spec2Doc の方向（コード→自然言語）とは逆方向（自然言語→形式仕様）だが、「LLM生成物の部分修正を人間が対話的に行う」UIパターンは、Spec2Doc の生成結果レビューUIの設計に転用できる（推測）。

### 11〔留保〕 AutoSpec: Automated Generation of Neural Network Specifications（Jin, Liao, Kalia, Foukas, Zhang, Tan, Mao, Yan, 2024）
- 手法の要点: ニューラルネットワークの入力空間を適応的に分割し、仕様（テストオラクルに相当）を自動生成・評価するフレームワーク。
- データ・n: 未確認。
- 主な結果: アブストラクトの記述では「人間定義の仕様に対しF1スコアを最大53%改善」と主張。**本文未確認**。
- 限界: 対象がニューラルネットワークの検証であり、依頼が想定した「LLMによる一般プログラム仕様生成のAutoSpec」と同一論文か不明（arXiv・Crossref・WebSearch非使用の範囲では同名の別論文が見当たらず、これが最も近い候補）。
- 根拠の区分: 主張（アブストラクトより。本文未確認）。関連性は不明。
- Spec2Doc への示唆: 該当性が不確実なため直接の示唆は保留。参考として、「仕様の自動生成結果を既存仕様と比較評価する」という評価設計自体は一般に転用できる考え方（推測）。

---

## 分野の結論

- 仕様マイニングの源流（Ammons 2002、Daikon 1999/2001、Lo らの有限状態機械マイニング系譜）は、いずれも「プログラムの動的実行トレースから形式的な振る舞いモデルを統計的・機械学習的に推定する」という共通アプローチを取る。LLM 以前の手法であり、境界値や条件分岐の意味（なぜその条件か）までは扱わず、あくまで観測されたパターンの再構成にとどまる（未検証: 各手法の再現精度）。
- レガシー業務ルール抽出（Cosentino、Chaparro ら、Sneed）は、静的解析・モデル駆動工学を用いてコード内に暗黙化した業務ロジックを可視化する系譜であり、対象言語（COBOL・Java・SQL）が Spec2Doc の想定対象と重なる可能性がある。
- LLM 時代の仕様生成（SpecGen、nl2spec、AutoSpec 候補）は、①LLM のコード理解を使った形式仕様の自動生成（SpecGen）、②自然言語↔形式仕様の双方向変換における人間対話（nl2spec）、③生成仕様の自動評価（AutoSpec 候補）という3方向に分岐しているとみられる。ただしいずれも本調査ではアブストラクトの主張のみで、本文の実験手続き・数値の妥当性は未検証。
- 全体として、Spec2Doc（コード→ドキュメント生成）に直接一致する「LLMでコードから自然言語仕様書を生成し、境界・状態遷移の抽出精度を評価した」先行研究は、本調査の範囲（arXiv・Crossrefの書誌・アブストラクトレベル）では確認できなかった。SpecGen が最も近いが、生成対象は自然言語文書ではなく形式仕様（論理式等）である点に注意（未検証: 本文で自然言語ドキュメント生成に触れているか）。

## 引用してはいけない数値

以下はアブストラクト要約または書誌データベースの付随情報から得たのみで、一次資料本文を確認していない。Spec2Doc の資料や報告に事実として転記しないこと。
- SpecGen「385プログラム中279プログラムで既存ツールを上回った」（arXiv:2401.08807 アブストラクトの要約に基づく。比較対象・評価基準未確認）
- AutoSpec（NN仕様）「F1スコアを最大53%改善」（arXiv:2409.10897 アブストラクトの要約に基づく。かつ該当論文自体が依頼の想定と一致するか不明）
- Ammons 2003（PLDI）「人手検査の手間を約3分の2削減」（アブストラクトの要約に基づく）
- Daikon の被引用数（会議版222・誌版669）はCrossrefの集計値であり、実験結果ではなく、かつ調査時点のスナップショットに過ぎない

## 検索方法

- arXiv API: `http://export.arxiv.org/api/query?search_query=...&max_results=10`（SpecGen/nl2spec/AutoSpec の合成クエリ1回、nl2specの`ti:`限定クエリ1回）
- Crossref API: `https://api.crossref.org/works?query.bibliographic=...&rows=5`（Ammons、Daikon、Lo/FSM、Cosentino、Sneed の各系統で計7回試行、うち2回は429で失敗し同一系統を別クエリで再試行）
- Semantic Scholar は使用していない（429継続のため、依頼の指示どおり不使用）。
- WebSearch は未使用（0/2回）。WebFetch のみで合計9回、10回の上限内で完了。
