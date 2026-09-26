# 先行研究調査 4: 生成文書の評価方法と、仕様からのテスト設計

調査日: 2026-09-26 ／ 対象: Spec2Doc REQ-N-006（受入評価）・REQ-N-007（7観点の再現率）
検索方法: 末尾「検索方法」参照。**Semantic Scholar API は全呼び出しで HTTP 429（レート制限）となり使用不能。arXiv API（成功）と WebSearch 3回（上限まで使用）で代替。** 予算 WebFetch+WebSearch 計18回を使い切った時点で終了。

## 一覧表

| # | 題名 | 著者（代表） | 年 | 会議・誌 | 区分 | 根拠区分 |
|---|---|---|---|---|---|---|
| 1 | Semantic Similarity Metrics for Evaluating Source Code Summarization | Haque, Eberhart, Bansal, McMillan | 2022 | ICPC | (a) 指標評価 | 実証（abstract） |
| 2 | On the Evaluation of Neural Code Summarization | Shi, Wang, Du 他 | 2022 | ICSE | (a) 指標評価 | 実証（abstract） |
| 3 | Can Large Language Models Serve as Evaluators for Code Summarization?（CODERPE） | Wu, Wan, Chu 他 | 2024 | arXiv/会議未確認 | (a) LLM-as-judge | 実証（abstract内数値） |
| 4 | Survey of Hallucination in Natural Language Generation | Ji, Lee, Frieske 他 | 2022 | ACM Computing Surveys | (a) ハルシネーション | 主張＋整理（サーベイ） |
| 5 | An Audit on the Perspectives and Challenges of Hallucinations in NLP | Venkit, Chakravorti, Gupta 他 | 2024 | arXiv | (a) ハルシネーション定義の不一致 | 実証（n=103論文+171実務者） |
| 6 | LLM-as-a-Judge for Software Engineering: Literature Review, Vision, and the Road Ahead | He, Shi, Zhuo 他 | 2025 | arXiv（SE 2030ビジョン） | (a) LLM-as-judge（SE特化） | 主張（レビュー） |
| 7 | Software Documentation Issues Unveiled | Aghajani, Nagy, Vega-Márquez 他 | 2019 | ICSE | (b) 実務者の文書利用 | 実証（n=878件マイニング） |
| 8 | Software Documentation: The Practitioners' Perspective | Aghajani, Nagy, Linares-Vásquez 他 | 2020 | ICSE | (b) 実務者の文書利用 | 実証（n=146実務者調査） |
| 9 | Requirements-Based Test Generation: A Comprehensive Survey | Yang, Huang, Cui, Niu, Towey | 2025 | arXiv | (c) 仕様→テスト | 主張＋整理（サーベイ、1994年以降） |
| 10 | AI-Driven Test Case Generation from Natural Language Requirements: A Survey of Techniques and Research Gaps | 著者未確認 | 2026(推定) | arXiv | (c) 仕様→テスト（AI/LLM） | 主張（要旨のみ確認） |
| 11 | TESTEVAL: Benchmarking Large Language Models for Test Case Generation | Wang, Yang, Wang, Huang 他 | 2024 | arXiv | (c) LLMテスト生成の評価 | 実証（16 LLM×210 Pythonプログラム） |
| 12 | TestBench: Evaluating Class-Level Test Case Generation Capability of Large Language Models | Zhang, Shang, Fang 他 | 2024 | arXiv | (c) LLMテスト生成の評価 | 実証（3 LLM×108 Javaプログラム） |
| 13 | Test Case Generation for Requirements in Natural Language ― An LLM Comparison Study | 著者未確認 | 2025 | ISEC（ACM） | (c) 要求→テスト（LLM比較） | 主張（要旨のみ確認） |

---

## 個別詳細

### 1. Semantic Similarity Metrics for Evaluating Source Code Summarization
- 著者: Sakib Haque, Zachary Eberhart, Aakash Bansal, Collin McMillan／年: 2022／会議: ICPC／URL: 未確認（arXiv API検索結果、ID未取得）
- 手法の要点: 単語重複系指標（BLEU, ROUGE）と人手評価済み類似度スコアの相関を測定。「文中の単語は重要度が均一でなく、同義語も存在する」ことを問題視し、意味的類似度指標を提案。
- データ・n: 人手評価データセット規模は abstract からは未確認。
- 主な結果: 単語重複指標が人間の類似度判断と乖離しやすいことを定性的に示す（具体的相関係数は本文未確認のため引用不可）。
- 限界: 本文未読、要旨のみ。定量値は取得できていない。
- 根拠の区別: 実証研究だが数値は未確認。
- Spec2Doc への示唆: BLEU/ROUGE 系の表層一致指標のみで生成仕様書の品質を測ると、人間の「意味が合っているか」の判断とズレる可能性が高い。REQ-N-006 の受入評価に表層指標を主指標として採用しない根拠になる。

### 2. On the Evaluation of Neural Code Summarization
- 著者: Ensheng Shi, Yanlin Wang, Lun Du 他／年: 2022／会議: ICSE／URL: 未確認
- 手法の要点: 5つの最新モデルを複数の BLEU 変種・データセット設定で横断比較。
- データ・n: モデル5種、データセット複数（件数未確認）。
- 主な結果: 「コード前処理の選び方だけで性能が -18%〜+25% 変動する」（abstract 原文）。
- 限界: 前処理・指標設定への感度が高いことのみ確認。人手評価との相関値は本調査では未確認。
- 根拠の区別: 実証（abstractの引用範囲）。
- Spec2Doc への示唆: 評価パイプライン（前処理・トークナイズ・指標選択）の些細な違いで指標値が大きく動きうる。Spec2Doc の受入評価も、評価手順自体を仕様化・固定しないと再現性が崩れる。

### 3. Can Large Language Models Serve as Evaluators for Code Summarization?（CODERPE）
- 著者: Yang Wu, Yao Wan, Zhaoyang Chu 他／年: 2024／URL: 未確認
- 手法の要点: LLM にロールプレイ形式のプロンプトを与えて評価者として機能させる CODERPE を提案。
- データ・n: 詳細未確認（abstract レベル）。
- 主な結果: 「人間評価との Spearman 相関 81.59%、BERTScore を 17.27 ポイント上回る」（abstract 原文の引用）。
- 限界: 単一ドメイン（コード要約）・単一モデル構成での結果。他ドメイン・他データセットへの一般化は未検証（本調査で未確認）。
- 根拠の区別: 実証（ただし abstract 記載の数値のみ、本文未検証）。
- Spec2Doc への示唆: LLM-as-judge は人手評価との相関を大きく改善しうるが、値はタスク・プロンプト設計に強く依存する。Spec2Doc で LLM 判定を使うなら、Spec2Doc 固有のタスク（仕様書の7観点網羅性判定）でゼロから相関検証が必要で、他分野の相関値を流用できない。

### 4. Survey of Hallucination in Natural Language Generation
- 著者: Ziwei Ji, Nayeon Lee, Rita Frieske 他／年: 2022／誌: ACM Computing Surveys／URL: 未確認
- 手法の要点: NLG 全般（要約・対話・QA・data-to-text・MT・LLM）のハルシネーション定義・指標・緩和策を整理するサーベイ。
- データ・n: 該当なし（サーベイ）。
- 主な結果: ハルシネーションを intrinsic（入力と矛盾）／extrinsic（入力から検証不能）に大別する整理を提示（分野で広く参照される枠組み）。
- 限界: サーベイであり新規実験なし。SE・要求文書ドメインは対象外。
- 根拠の区別: 主張・整理（一次データではない）。
- Spec2Doc への示唆: 生成仕様書のハルシネーションも「入力（元資料）と矛盾する記述」と「入力からは検証できない記述」に分けて計測すべき。7観点それぞれについて intrinsic/extrinsic 両方の検出基準を用意する必要がある。

### 5. An Audit on the Perspectives and Challenges of Hallucinations in NLP
- 著者: Pranav Narayanan Venkit, Tatiana Chakravorti, Vipul Gupta 他／年: 2024／URL: 未確認
- 手法の要点: 査読済み論文103件のレビュー＋実務者171名へのインタビューを実施し、「ハルシネーション」という用語の定義の一致度を監査。
- データ・n: 論文 n=103、実務者インタビュー n=171。
- 主な結果: 「NLP分野内で "hallucination" という用語について合意が欠如している」（abstract 原文）。
- 限界: 定義の不一致を明らかにしたのみで、統一的な測定手法は提示していない。
- 根拠の区別: 実証（サーベイ＋インタビュー、n明記）。
- Spec2Doc への示唆: 「ハルシネーション率」を Spec2Doc の受入基準に使う場合、業界標準の定義は存在しない前提に立ち、Spec2Doc 自身が「何を虚偽記載とみなすか」を7観点ごとに操作的定義として明文化する必要がある（既存定義の輸入では不十分）。

### 6. LLM-as-a-Judge for Software Engineering: Literature Review, Vision, and the Road Ahead
- 著者: Junda He, Jieke Shi, Terry Yue Zhuo 他／年: 2025／URL: 未確認
- 手法の要点: ソフトウェア工学領域での LLM-as-judge 応用のレビューと研究ギャップの特定。
- データ・n: レビュー対象論文数は未確認。
- 主な結果: SE 領域では「一貫した多面的な成果物評価」がまだ未達成であり、2030年時点の到達像として位置づける（ビジョン論文）。
- 限界: ビジョン・レビュー論文であり、Spec2Doc に直接転用できる定量指標は提示していない。
- 根拠の区別: 主張（レビュー、実証データなし）。
- Spec2Doc への示唆: SE 成果物（仕様書含む）の LLM 評価はまだ確立された標準がない分野。Spec2Doc の受入評価を「LLM-as-judge 単独」に委ねず、人手評価を残す設計が業界の到達点と整合する。

### 7. Software Documentation Issues Unveiled
- 著者: Emad Aghajani, Csaba Nagy 他／年: 2019／会議: ICSE／URL: https://2019.icse-conferences.org/event/icse-2019-technical-papers-software-documentation-issues-unveiled
- 手法の要点: メーリングリスト・Stack Overflow・issue・PR の4種の情報源から文書関連の投稿をマイニングし分類。
- データ・n: 878件の文書関連アーティファクト。
- 主な結果: 文書の不足・不適切な内容、陳腐化、曖昧さが主要な問題カテゴリとして抽出された（分類の詳細な件数比率は本調査では未確認）。
- 限界: マイニング対象は OSS コミュニティが中心で、業務システムの仕様書には一般化できない可能性。
- 根拠の区別: 実証（n=878、質的分類）。
- Spec2Doc への示唆: 「陳腐化」「曖昧さ」は自動生成文書でも起こりうる欠陥クラスとして、7観点の点検項目に含める根拠になる。

### 8. Software Documentation: The Practitioners' Perspective
- 著者: Emad Aghajani, Csaba Nagy, Mario Linares-Vásquez 他／年: 2020／会議: ICSE／URL: https://dl.acm.org/doi/10.1145/3377811.3380405
- 手法の要点: 実務者146名への2種のサーベイ（①感じている文書課題と対処法 ②タスク別に重要な文書種別）。
- データ・n: 実務者 n=146。
- 主な結果: インストール・デプロイ・リリース手順の記載不足を重要な課題とする回答が68%、不適切なインストール手順を課題とする回答が63%（WebSearch要約に基づく。原論文本文は未確認のため数値は二次情報扱い）。
- 限界: 数値は検索エンジンの要約経由であり、原論文 PDF 本文で照合していない。引用時は「未確認・二次情報」と明記が必要。
- 根拠の区別: 実証だが本調査では二次情報（要約）としての確認に留まる。
- Spec2Doc への示唆: 開発者が実際に困る文書欠陥は「正確性」だけでなく「手順の完全性（インストール・デプロイ）」に集中する。7観点に手順的完全性（前提条件・実行手順の網羅）が含まれているか点検すべき。

### 9. Requirements-Based Test Generation: A Comprehensive Survey
- 著者: Zhenzhen Yang, Rubing Huang, Chenhui Cui, Nan Niu, Dave Towey／年: 2025／URL: https://arxiv.org/abs/2505.02015（直接取得・確認済み）
- 手法の要点: 1994年の提唱以降の要求ベーステスト生成（RBTG）を、要求の種類・アプローチの分類・テストケース種別・ツール・実験的評価の観点で網羅的に整理するサーベイ。
- データ・n: 該当なし（文献サーベイ）。abstract に定量値の記載なし（本調査で確認済み）。
- 主な結果: RBTG の分類枠組みと今後の研究課題を提示（具体的な精度・再現率の数値は abstract に含まれず、本文未確認）。
- 限界: サーベイであり個別手法の精度比較値は今回未取得。
- 根拠の区別: 主張・整理（一次データなし、abstract 直接確認済み）。
- Spec2Doc への示唆: 「要求の種類分類」「テストケース種別」という RBTG の整理軸は、REQ-N-007 の7観点を要求分類の枠組みとして位置づけ、各観点がどのテストケース種別（機能・非機能・境界値等）に対応するかを明示する設計指針になる。

### 10. AI-Driven Test Case Generation from Natural Language Requirements: A Survey of Techniques and Research Gaps
- 著者: 未確認（検索結果のタイトルのみ確認、著者名は未取得）／年: 未確認（arXiv、2026年前後と推定・未確認）／URL: https://arxiv.org/pdf/2606.06563
- 手法の要点: 自然言語要求からのテストケース生成技術（NLP/ML/LLM）と研究ギャップの整理（WebSearch 要約より）。
- データ・n: 未確認。
- 主な結果: 「要求カバレッジが最も報告されやすく最も高い水準に達する」「精度は多くの研究で80%以上」（WebSearch要約からの引用。原文未確認のため二次情報）。
- 限界: 要旨・要約以上の検証を行っていない。数値は二次情報。
- 根拠の区別: 主張（未確認、二次情報）。
- Spec2Doc への示唆: 「要求カバレッジ」は測定が容易な指標だが「要求ごとに1件テストケースがあれば満たされる」程度の弱い基準になりがちだという指摘は重要。REQ-N-007 の「7観点の再現率」も、観点ごとに1件でも言及があれば満たすような弱い定義にしないよう設計時に注意が要る。

### 11. TESTEVAL: Benchmarking Large Language Models for Test Case Generation
- 著者: Wenhan Wang, Chenyuan Yang, Zhijie Wang, Yuheng Huang 他／年: 2024／URL: 未確認（arXiv、ID未取得）
- 手法の要点: 16種のLLMを210のPythonプログラムに対して適用し、行・分岐・パスの3種のカバレッジタスクでベンチマーク。
- データ・n: LLM 16種 × プログラム 210件。
- 主な結果: 「特定の行・分岐・パスをカバーするテストケース生成は、現行LLMにとって依然として困難」（abstract原文）。
- 限界: Python・関数/ユニットレベルに限定。仕様書からのシステム/受け入れレベルのテスト生成は対象外。
- 根拠の区別: 実証（n明記、abstract内数値）。
- Spec2Doc への示唆: LLM は行・分岐カバレッジ目標があっても達成が難しいと報告されており、Spec2Doc が「生成仕様書から機械的にテスト条件を導出する」ことを過信すべきでない。REQ-N-006 の受入評価は人手レビューを残す設計が妥当。

### 12. TestBench: Evaluating Class-Level Test Case Generation Capability of Large Language Models
- 著者: Quanjun Zhang, Ye Shang, Chunrong Fang 他／年: 2024／URL: 未確認
- 手法の要点: CodeLlama-13b・GPT-3.5・GPT-4 の3モデルを108のJavaプログラム、5つの評価観点で比較。
- データ・n: モデル3種 × プログラム108件 × 評価観点5種。
- 主な結果: 「大規模モデルほど文脈情報を効果的に活用できる」一方、小規模モデルは簡略化した文脈の方が有効（abstract原文の要約）。
- 限界: クラスレベル・Java限定。仕様書起点のテスト生成ではない。
- 根拠の区別: 実証（n明記）。
- Spec2Doc への示唆: 「5つの評価観点」でモデル出力を多面的に採点する設計は、REQ-N-007 の7観点評価をベンチマーク形式（観点別に達成/未達成をマトリクス化）で実施する際の参考形式になる。

### 13. Test Case Generation for Requirements in Natural Language ― An LLM Comparison Study
- 著者: 未確認（検索結果のタイトルのみ）／年: 2025／会議: 18th Innovations in Software Engineering Conference (ISEC), ACM／URL: https://dl.acm.org/doi/10.1145/3717383.3717389
- 手法の要点: 自然言語要求からのテストケース生成について複数LLMを比較（WebSearch要約より）。
- データ・n: 未確認。
- 主な結果: 「LLMは曖昧な自然言語要求をUML準拠のユースケース仕様に変換できるが、現状の汎用LLMはユニットレベルのテストケース生成に留まり、システム・受け入れレベルのテストケースは生成できない」（WebSearch要約からの引用、原文未確認）。
- 限界: 要約のみで原論文未確認。数値的な比較結果は未取得。
- 根拠の区別: 主張（未確認、二次情報）。
- Spec2Doc への示唆: REQ-N-007（生成仕様書だけからテスト条件を導けるか）に対する最も直接的な先行知見。現時点の文献は「ユニットレベルは可能、システム・受け入れレベルは未達」と報告しており、Spec2Doc の受入評価はユニット相当の粒度（観点ごとの局所的なテスト条件）を対象にし、システムレベルの網羅は別途人手検証が要る前提で設計すべき。

---

## Spec2Doc の受入評価の設計案（先行研究に基づく指標・手順）

1. **三点測定（表層指標＋LLM判定＋人手評価）**: BLEU等の表層一致指標は人間評価との乖離が指摘される（#1, #2）ため単独採用しない。LLM-as-judge（#3, #6）は相関が高くなり得るが分野依存のため、Spec2Doc 固有タスクで相関を実測してから採用可否を判断する。最終判定は少人数の人手評価を残す（#6 の「まだ確立された標準がない」という到達点に整合）。
2. **ハルシネーションの操作的定義を先に書く**: 統一定義が存在しない（#5）ため、Spec2Doc は7観点ごとに「元資料と矛盾（intrinsic）」「元資料から検証不能な記述の追加（extrinsic）」（#4の枠組み）を判定基準として明文化し、件数をカウントする。
3. **REQ-N-006/007 の測定は「観点×要求」のマトリクスで**: 弱い基準（観点1件で達成扱い）を避けるため（#10 の指摘）、7観点それぞれについて元仕様の要求単位で被覆率を測る（#12 のような多観点マトリクス形式）。
4. **テスト条件導出はユニット粒度に限定して評価**: 現行文献はLLMによる要求→テスト変換がユニットレベル止まりでシステム/受け入れレベル未達と報告（#13、#11 のカバレッジ達成の困難さ）。Spec2Doc の受入評価も「生成仕様書のみからユニット相当のテスト条件を導けるか」を主対象とし、システムレベルの網羅性は人手レビュー対象として切り分ける。
5. **実務者にとっての有用性チェックを別途置く**: 開発者が実際に不満を持つのは手順の完全性（インストール・デプロイ等）（#7, #8）であり、7観点の正確性チェックだけでは拾えない。小規模の実務者レビュー（n=5〜10程度）で「手順として実行可能か」を別軸で確認する。

## 分野の結論（割れているなら割れたまま）

- コード要約・生成文書評価: 表層指標は人間評価と乖離しやすいという方向では一致（#1, #2）。一方 LLM-as-judge の有効性は「有望（#3 の高相関）」と「まだ標準化されていない（#6）」で評価の成熟度に関する見解が割れている。
- ハルシネーション measurement: 「intrinsic/extrinsic の枠組み（#4）」は広く参照されるが、用語の定義自体に分野内で合意がないという監査結果（#5）がある。Spec2Doc が既存の統一測定法を前提にするのは誤り。
- 要求からのテスト生成: 「要求カバレッジは測りやすいが弱い指標になりがち（#10）」という指摘と、「ユニットレベルは可能・システム/受け入れレベルは未達（#13, #11）」という限界指摘は、複数ソースで方向が一致している（対立なし）。

## 引用してはいけない数値

- #3 CODERPE の「Spearman 相関 81.59%、BERTScore比+17.27ポイント」は abstract の記載を引用したのみで、本文・実験条件（データセット、統計的有意性検定の有無）を未確認。他タスク・他データセットへの一般化数値として引用しない。
- #8 Aghajani(2020) の「68%」「63%」は WebSearch の要約経由の二次情報であり、原論文 PDF 本文で照合していない。正確な母数・質問文言は未確認のため、そのまま断定的に引用しない。
- #10, #13 の数値的主張（「精度80%以上」「要求カバレッジが最も高水準」等）はいずれも WebSearch要約からの二次情報であり、原論文未確認。
- Roy et al. 2021 "Reassessing Automatic Evaluation Metrics for Code Summarization Tasks" は依頼文中で名指しされた重要文献だが、本調査では取得できなかった（下記「検索方法」参照）。存在は把握しているが、年・会議・数値のいずれも本調査で検証していないため、一切の数値を引用しない。

## 検索方法

- API優先の原則に従い、Semantic Scholar Graph API（`https://api.semanticscholar.org/graph/v1/paper/search`）をまず使用したが、初回の並列10クエリで即座に HTTP 429（レート制限）となり、以後の単発リトライ（2回）も含め全て 429 で失敗。Semantic Scholar からは1件も取得できなかった。
- 代替として arXiv API（`http://export.arxiv.org/api/query`）に切り替え、3クエリ成功（LLM-as-a-judge／hallucination survey／LLM test case generation、それぞれ最大8〜10件取得）。
- Roy et al. 2021 を狙った arXiv 検索（"code summarization" AND evaluation AND metrics）では該当論文がヒットせず、取得できなかった旨をツール出力で明示的に確認済み。
- WebSearch は上限3回まで使用（Aghajani文書調査、要求ベーステスト生成、以降の集計に使用）。
- 予算: WebFetch + WebSearch 合計18回を全て消費した時点で調査を終了（失敗した429応答も呼び出し回数としてカウント）。うち成功して情報を得られたのは arXiv 3回・WebSearch 2回・arXiv直接取得1回の計6回分。
- 未実施: Semantic Scholar での被引用数(citationCount)・正式な externalIds（DOI/arXiv ID）の系統的な取得。多くのエントリで URL・正確な会議略称が「未確認」のままである。
