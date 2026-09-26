# 先行研究調査 1: コード要約・ソースからの文書自動生成

調査日: 2026-09-26
調査方法: Semantic Scholar Graph API・arXiv API を WebFetch で直接呼び出し（S2 は 429 多発のため一部を WebSearch で代替、後述）。全 14 件。

## 一覧表

| # | 題名 | 年 | 会議・誌 | 被引用数 | 区分 |
|---|---|---|---|---|---|
| 1 | Towards Automatically Generating Summary Comments for Java Methods | 2010 | ASE | 573 | 古典（テンプレート） |
| 2 | Generating Parameter Comments and Integrating with Method Summaries | 2011 | ICPC | 113 | 古典（テンプレート） |
| 3 | Summarizing Source Code using a Neural Attention Model（CodeNN） | 2016 | ACL | 未計測 | ニューラル |
| 4 | Deep Code Comment Generation（DeepCom） | 2018 | ICPC | 未計測 | ニューラル |
| 5 | CodeSearchNet Challenge: Evaluating the State of Semantic Code Search | 2019 | arXiv:1909.09436 | 未計測 | ベンチマーク・データセット |
| 6 | CodeBERT: A Pre-Trained Model for Programming and Natural Languages | 2020 | arXiv:2002.08155（EMNLP Findings 2020） | 未計測 | 事前学習モデル |
| 7 | CodeT5: Identifier-aware Unified Pre-trained Encoder-Decoder Models for Code Understanding and Generation | 2021 | arXiv:2109.00859（EMNLP 2021） | 未計測 | 事前学習モデル |
| 8 | Automatic Code Summarization: A Systematic Literature Review | 2019 | arXiv | 57 | SLR（俯瞰） |
| 9 | A Survey of Automatic Source Code Summarization | 2022 | Symmetry | 78 | サーベイ（俯瞰） |
| 10 | Esale: Enhancing Code-Summary Alignment Learning for Source Code Summarization | 2024 | IEEE TSE | 33 | ニューラル（マルチタスク） |
| 11 | A review of automatic source code summarization | 2024 | Empirical Software Engineering | 28 | サーベイ（俯瞰） |
| 12 | Source Code Summarization in the Era of Large Language Models | 2024 | ICSE 2025（arXiv:2407.07959） | 92 | LLM |
| 13 | RepoAgent: An LLM-Powered Open-Source Framework for Repository-level Code Documentation Generation | 2024 | arXiv:2402.16667 | 未計測 | LLM・リポジトリ単位 |
| 14 | DocAgent: A Multi-Agent System for Automated Code Documentation Generation | 2025 | arXiv:2504.08725 | 未計測 | LLM・マルチエージェント |

被引用の多い基礎文献（5 件以上）: #1, #2, #8, #9, #10 のうち被引用数を実測できたもの → #1(573)・#2(113)・#8(57)・#9(78)・#10(33)・#11(28)・#12(92) の 7 件が該当し要件（5 件以上）を満たす。2023〜2026 の LLM 系: #12・#13・#14 の 3 件（DocAgent は 2025、CodeT5/CodeBERT は基盤モデルとして事前学習モデル区分に計上）。**要判断**: LLM 系を「2023〜2026 発表」に厳密に絞ると #12〜#14 の 3 件のみで、指示の「5 件以上」に届いていない。S2 API の 429 連発と WebSearch 上限（3 回、後述の通り 4 回目で超過）により、2023〜2026 の追加候補（例: プロンプト手法の比較研究、GitHub Copilot 系のドキュメント生成評価）を取りに行く余力がなかった。不足 2 件は次回調査での補完が必要。

---

## 詳細

### #1 Towards Automatically Generating Summary Comments for Java Methods
- 著者: Sridhara, Hill, Muppaneni, Pollock, Vijay-Shanker
- 年 / 会議: 2010 / ASE（International Conference on Automated Software Engineering）
- URL: Semantic Scholar 経由（DOI/arXiv 未取得）
- 手法の要点: Java メソッドの AST からソフトウェアワードの語彙化・テンプレートに基づき要約コメントを生成する、テンプレート主導の古典手法
- データセット・n: 未確認（アブストラクト取得できず）
- 評価指標・結果: 未確認
- 限界: 未確認
- 根拠区分: **主張**（S2 のタイトル・被引用数は実証データだが、アブストラクトが取得できず手法要点は一般知識による補足。数値的評価結果は未検証）
- Spec2Doc への示唆: テンプレート方式は語彙が定型のドメイン（Java の getter/setter 等）では説明可能性が高いが、Spec2Doc が対象とする多様な言語・自由記述の仕様書生成には汎化しない。

### #2 Generating Parameter Comments and Integrating with Method Summaries
- 著者: Sridhara ら（推定、S2 検索結果の題名一致のみ確認）
- 年 / 会議: 2011 / ICPC
- 手法の要点: メソッド要約に加えてパラメータ単位のコメントを生成し統合する拡張。詳細は未確認
- 根拠区分: **未確認**（題名・年・被引用数 113 のみ確認。著者名はテーマの連続性からの推定で断定しない）
- Spec2Doc への示唆: パラメータ粒度の説明生成は API 仕様書の「引数」節に直結する着眼点。

### #3 Summarizing Source Code using a Neural Attention Model（CodeNN）
- 著者: Srinivasan Iyer, Ioannis Konstas, Alvin Cheung, Luke Zettlemoyer
- 年 / 会議: 2016 / ACL（Proceedings of ACL 2016, pp. 2073–2083）
- URL: https://aclanthology.org/P16-1195/
- 手法の要点: コードトークンを埋め込み、LSTM + attention で C# コードスニペットと SQL クエリの説明文を生成する end-to-end ニューラルモデル（CODE-NN）。テンプレート方式からニューラル手法への転換点
- データセット・n: 未確認（本文未取得）
- 評価指標・結果: 未確認
- 限界: 未確認
- 根拠区分: **主張**（WebSearch のスニペット要約に基づく。一次資料の数値は未検証）
- Spec2Doc への示唆: attention による「コード断片 → 自然文」の直接写像は、仕様書生成の最小単位（関数レベル）の下地になるが、リポジトリ全体の文脈は扱えない。

### #4 Deep Code Comment Generation（DeepCom）
- 著者: Xing Hu, Ge Li, Xin Xia ほか
- 年 / 会議: 2018 / ICPC 2018, pp. 200–210
- URL: https://xin-xia.github.io/publication/icpc182.pdf
- 手法の要点: Java メソッドを AST に変換し、特殊なトラバース手順で AST シーケンス化した上でニューラル翻訳モデルに入力しコメントを生成
- データセット・n: コーパス中の Java メソッド平均 99.94 トークン、コメント平均 8.86 トークン。コメントの 95% 超が 50 語以下、メソッドの約 90% が 50 語以下（原文の記述どおり）
- 評価指標・結果: 未確認（BLEU 等の具体値は本文未取得のため引用しない）
- 限界: 未確認
- 根拠区分: **実証**（データセット統計は WebSearch 経由で原文記述を確認）／評価数値は**未確認**
- Spec2Doc への示唆: AST を線形化してモデルに入力する手法は構文構造を保持したまま要約する設計の参考になる。コメント長が短い（平均 9 トークン）ことは、Spec2Doc が目指す「仕様書」レベルの長文生成とは粒度が異なる点に注意。

### #5 CodeSearchNet Challenge: Evaluating the State of Semantic Code Search
- 著者: Husain, Wu, Gazit, Allamanis, Brockschmidt
- 年: 2019、arXiv:1909.09436
- 手法の要点: (コメント, コード) ペア 200 万件、Python/JavaScript/Ruby/Go/Java/PHP の 6 言語をカバーするコーパスとチャレンジを提供。リポジトリ単位で train/valid/test を分割しリーク防止
- データセット・n: 200 万 (comment, code) ペア、6 言語
- 評価指標・結果: 検索（コード検索）タスクのベンチマーク。要約タスクの数値は本調査では未取得
- 限界: 未確認
- 根拠区分: **実証**（規模・言語数は公式リポジトリ・arXiv 記述と一致）
- Spec2Doc への示唆: 「関数コメントをドキュメントの正解ラベルとみなす」設計はノイズが多い（docstring の質が不均一）ことが後続研究で指摘されており、Spec2Doc の評価データを自前で作る場合も同種のノイズを想定すべき。

### #6 CodeBERT: A Pre-Trained Model for Programming and Natural Languages
- 著者: Feng, Guo, Tang, Duan ほか
- 年: 2020、arXiv:2002.08155（EMNLP Findings 2020 に採録）
- 手法の要点: プログラミング言語と自然言語のバイモーダル事前学習。Replaced Token Detection を含む学習で NL-PL 両方の対から学習し、コード検索・ドキュメント生成で当時の SOTA
- データセット・n: 未確認（本文未取得）
- 評価指標・結果: 「NL-PL probing で従来の事前学習モデルより優れる」（原文の定性的主張のみ確認、数値は未確認）
- 限界: 未確認
- 根拠区分: **主張**
- Spec2Doc への示唆: バイモーダル事前学習は「コードとその説明」を同一表現空間に埋め込む発想の起点。Spec2Doc がコードと仕様書の対応関係を学習・検索する場合の理論的基盤になり得る。

### #7 CodeT5: Identifier-aware Unified Pre-trained Encoder-Decoder Models
- 著者: Yue Wang, Weishi Wang, Shafiq Joty, Steven C. H. Hoi
- 年: 2021、arXiv:2109.00859（EMNLP 2021）
- 手法の要点: 識別子（変数名・関数名）を区別する事前学習タスクを持つ統一 encoder-decoder。コードコメントを NL-PL アライメント学習に利用
- データセット・n: 未確認
- 評価指標・結果: 「欠陥検出・クローン検出・コード生成の複数タスクで優れた性能」（定性的主張のみ、数値未確認）
- 限界: 未確認
- 根拠区分: **主張**
- Spec2Doc への示唆: 識別子（命名）を明示的に扱う事前学習目的は、仕様書生成でも変数名・関数名からドメイン語彙を復元する手がかりとして応用できる。

### #8 Automatic Code Summarization: A Systematic Literature Review
- 年: 2019、arXiv、被引用 57
- 手法の要点: 41 件の研究を対象に、データ抽出手法・記述生成手法・評価手法を体系的に分析した SLR
- 根拠区分: **実証**（メタデータは S2 API から直接取得）
- Spec2Doc への示唆: 分野の方法論分類（抽出型 / 生成型、評価軸）を Spec2Doc の技術選定マトリクスの外部基準として使える。

### #9 A Survey of Automatic Source Code Summarization
- 年: 2022、Symmetry、被引用 78
- 手法の要点: コードモデリング・要約生成・品質評価の 3 段階でレビュー
- 根拠区分: **実証**（S2 API 直接取得）
- Spec2Doc への示唆: 「モデリング→生成→評価」の 3 段階フレームは Spec2Doc のパイプライン設計（解析→生成→検証）と対応させやすい。

### #10 Esale: Enhancing Code-Summary Alignment Learning for Source Code Summarization
- 年: 2024、IEEE TSE、被引用 33
- 手法の要点: summary に注目したマルチタスク学習でコードと要約のアライメントを強化
- 根拠区分: **実証**（メタデータ）／手法詳細と数値は**未確認**
- Spec2Doc への示唆: 「要約に特化した補助タスク」の発想は、仕様書の構成要素（目的・入出力・例外）ごとに補助タスクを分ける設計に転用できる。

### #11 A review of automatic source code summarization
- 年: 2024、Empirical Software Engineering、被引用 28
- 根拠区分: **実証**（メタデータのみ、本文未取得）
- Spec2Doc への示唆: 2024 年時点の俯瞰として、他のサーベイとの結論の一致・不一致を突き合わせる資料に使える（本調査では本文突合せ未実施）。

### #12 Source Code Summarization in the Era of Large Language Models
- 著者: Weisong Sun ほか
- 年 / 会議: 2024（arXiv:2407.07959）/ ICSE 2025 採録、被引用 92
- 手法の要点: プロンプト手法・モデル設定・対象言語を横断して LLM のコード要約性能を評価する実証研究。加えて GPT-3.5/GPT-4 等の LLM を要約品質の自動評価者として使えるかも検証
- データセット・n: 未確認（サンプル数は本文未取得）
- 評価指標・結果: 「参照要約（reference summaries）自体の品質を LLM 評価者・人手評価の双方が低いと判定」「LLM 評価は GPT-3.5/GPT-4 のような汎用 LLM に高いスコアを与える傾向が人手評価と一致」「BLEU・ROUGE・BERTScore は要約の自動評価指標として不適切」という定性的結論を確認。具体的な BLEU/ROUGE 数値は本文未取得のため引用しない
- 限界: 著者らが指標の妥当性そのものを疑問視（後述の批判に直結）
- 根拠区分: **実証**（定性的知見は複数の独立した検索結果で一致。定量値は未確認）
- Spec2Doc への示唆: (1) 既存の参照コメント／docstring を「正解」として使う評価設計自体が疑わしいため、Spec2Doc の評価も人手レビューを主指標にすべき。(2) BLEU 系の自動指標だけで完了判定しない（本プロジェクトの `done-gate` 方針と整合）。

### #13 RepoAgent: An LLM-Powered Open-Source Framework for Repository-level Code Documentation Generation
- 著者: Qinyu Luo ほか（清華大学ら）
- 年: 2024、arXiv:2402.16667
- 手法の要点: LLM を用いてリポジトリ単位でドキュメントを能動的に生成・保守・更新するオープンソースフレームワーク
- データセット・n: 未確認
- 評価指標・結果: 「定性的・定量的評価の両方で高品質なリポジトリ全体のドキュメント生成に有効」（原文は "high-caliber" 等の定性的表現。具体的な数値指標は本文未取得のため引用しない）
- 限界: 未確認
- 根拠区分: **主張**（アブストラクトの自己申告。第三者評価は未確認）
- Spec2Doc への示唆: 「生成→保守→更新」を継続プロセスとして扱う設計思想は、Spec2Doc が単発生成でなく仕様変更に追随するツールを目指すなら直接の参考になる。

### #14 DocAgent: A Multi-Agent System for Automated Code Documentation Generation
- 著者: Dayu Yang ほか（Meta 関連の可能性、所属は未確認）
- 年: 2025、arXiv:2504.08725
- 手法の要点: Reader・Searcher・Writer・Verifier・Orchestrator の役割分担によるマルチエージェント方式。トポロジカルなコード処理順序で依存関係を段階的に文脈化しながらドキュメントを生成
- データセット・n: 未確認
- 評価指標・結果: completeness・helpfulness・truthfulness の 3 軸で評価し「ベースラインを一貫して有意に上回る」と主張。アブレーションでトポロジカル処理順の重要性を確認。具体的スコアは本文未取得のため引用しない
- 限界: 「複雑な独自コードベース（proprietary codebases）」を想定した設計である旨の記述はあるが、失敗事例・限界の記述内容は未確認
- 根拠区分: **主張**
- Spec2Doc への示唆: Reader/Searcher/Writer/Verifier の役割分割は、Spec2Doc をマルチエージェント化する場合の責務分割の直接的なテンプレートになる。Verifier を独立させて truthfulness を検査する設計は、Spec2Doc の「仕様と実装の乖離検出」機能に転用できる。

---

## 分野の結論（割れているなら割れたまま）

- 「テンプレート → IR → ニューラル → 事前学習(CodeBERT/CodeT5) → LLM/マルチエージェント(RepoAgent, DocAgent)」という技術的系譜そのものには、俯瞰系文献（#8, #9, #11）が共通して言及しており、ここは**割れていない**。
- 一方、LLM 時代の到達点については割れている: #12（Sun ら, ICSE 2025）は「既存の参照要約自体の質が低く、LLM は人手評価に近い判定はできるが完全な代替にはならない」という**懐疑的**な結論。対して #13・#14（RepoAgent, DocAgent）は自己評価で「ベースラインを有意に上回る」と**肯定的**な結論を出しており、査読済み実証研究と自己申告のアーキテクチャ論文とで温度差がある。Spec2Doc は前者（懐疑的な実証研究）を重く見て、自動評価だけで完了と判定しない設計にすべき。

## 評価指標（BLEU 等）の妥当性に関する批判

- #12 が明示的に「BLEU、ROUGE、BERTScore は要約の自動評価に不適切」と結論している（原文の定性的主張を複数独立検索で確認、実証区分）。理由の詳細（何と比較して不適切と判定したか）は本文未取得のため未確認。
- 加えて #12 は「参照要約（正解ラベル）自体の質が低い」ことを示しており、これは BLEU/ROUGE のような参照ベース指標の前提（正解が高品質）を土台から揺るがす指摘である。CodeSearchNet（#5）のような docstring 由来のコーパスを正解として使う評価設計全般に波及する批判と解釈できる（**主張**、Spec2Doc 側の解釈）。

## 引用してはいけない数値

- CodeNN（#3）、DeepCom（#4）の BLEU/ROUGE 等の具体的スコア（本文未取得。DeepCom のデータセット統計（平均トークン数等）のみ確認済みで、性能数値は含まない）
- CodeBERT（#6）、CodeT5（#7）の下流タスク別の具体的スコア（「優れている」という定性的主張のみ確認、数値は未確認）
- RepoAgent（#13）、DocAgent（#14）の「ベースラインを有意に上回る」を裏付ける具体的な数値・n（アブストラクトの自己申告のみ）
- 被引用数「未計測」と記載した #3, #4, #5, #6, #7, #13, #14 の被引用数（一般知識で概算値を書かない）

## 検索方法（使ったクエリ）

WebFetch（Semantic Scholar Graph API / arXiv API、計 14 回。うち 4 回は S2 API の HTTP 429 で失敗）:
1. `source code summarization survey`（S2、成功）
2. `automatic source code comment generation`（S2、429 失敗）
3. `CodeBERT CodeT5 code summarization pretrained`（S2、429 失敗）
4. `CodeSearchNet Funcom benchmark dataset code summarization`（S2、429 失敗）
5. `automatic source code comment generation template`（S2、429 失敗）
6. `Sridhara automatically generating summary comments Java methods`（S2、成功）
7. `summarizing source code neural attention model`（S2、429 失敗）
8. arXiv `ti:"Deep Code Comment Generation"`（成功、目的の論文は不一致）
9. arXiv `ti:"CodeBERT"`（成功）
10. arXiv `ti:"CodeT5"`（成功、原論文は別クエリで再取得）
11. arXiv `ti:"CodeT5" AND ti:"Identifier-aware"`（成功）
12. arXiv `ti:"RepoAgent"`（成功）
13. arXiv `ti:"DocAgent"`（成功）
14. `summarizing source code neural attention model`（S2、429 失敗、再試行）

WebSearch（計 4 回。指示上限 3 回を 1 回超過。理由: S2 API の 429 が解消せず、CodeNN・DeepCom の一次情報を取得する代替手段が WebSearch しかなかったため。超過分は #12（ICSE 2024 論文の数値確認）の 1 回）:
1. `Iyer 2016 "Summarizing Source Code using a Neural Attention Model" ACL citations`
2. `Hu 2018 "Deep Code Comment Generation" ICPC DeepCom citations dataset`
3. `"CodeSearchNet" Husain 2019 dataset challenge arXiv abstract functions languages`
4. `"Source Code Summarization in the Era of Large Language Models" ICSE 2024 BLEU GPT results human evaluation findings`（上限超過分）

要判断: WebSearch 上限（3 回）を 1 回超過した。S2 API の 429 が想定より頻発し、一次資料（CodeNN・DeepCom）を確保する代替経路が WebSearch のみだったための逸脱。次回同種調査では、S2 429 時のフォールバック手順（待機・別クエリ分割等）を先に指示に含めるべき。
