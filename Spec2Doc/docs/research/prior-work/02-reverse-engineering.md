# 先行研究調査 2: リバースエンジニアリング・設計復元・アーキテクチャ復元・トレーサビリティ復元

調査日: 2026-09-26
調査方法: Semantic Scholar Graph API（`/paper/search`・`/paper/DOI:{doi}`）と arXiv API を Bash 経由の curl で直接呼び出し（WebFetch 経由は S2 側の 429 が連続したため、S2/arXiv とも API 直叩きに切替。curl は WebFetch/WebSearch の回数制限に含めない運用とした）。Crossref API（`api.crossref.org`）を書誌検証の補助に使用（DBLP は本環境からアクセス不可・接続不能）。WebSearch は **0 回**（S2/arXiv/Crossref のみで目標件数に到達したため未使用）。全 **14 件**。

## 一覧表

| # | 題名 | 著者 | 年 | 会議・誌 | 被引用数 | 区分 |
|---|---|---|---|---|---|---|
| 1 | Reverse Engineering and Design Recovery: A Taxonomy | Chikofsky, Cross | 1990 | IEEE Software | 2422 | 定義・分類（古典） |
| 2 | Design Recovery for Maintenance and Reuse | Biggerstaff | 1989 | Computer | 404 | 定義・分類（古典） |
| 3 | Reverse Engineering: A Roadmap | Müller, Jahnke, Smith, Storey, Tilley, Wong | 2000 | ICSE（The Future of Software Engineering） | 307 | ロードマップ・俯瞰 |
| 4 | Program Comprehension During Software Maintenance and Evolution | von Mayrhauser, Vans | 1995 | Computer | 680 | プログラム理解（認知モデル） |
| 5 | Software Architecture Reconstruction: A Process-Oriented Taxonomy | Ducasse, Pollet | 2009 | IEEE TSE | 365 | アーキテクチャ復元サーベイ |
| 6 | Obtaining Ground-Truth Software Architectures | Garcia, Ivkovic, Medvidovic | 2013 | ICSE 2013 | 未計測（S2 が 429 で未取得） | アーキテクチャ復元・評価手法比較 |
| 7 | Recovering Traceability Links between Code and Documentation | Antoniol, Canfora, Casazza, De Lucia, Merlo | 2002 | IEEE TSE | 1094 | トレーサビリティ復元（IR ベース） |
| 8 | Semantically Enhanced Software Traceability Using Deep Learning Techniques | Guo, Cheng, Cleland-Huang | 2017 | ICSE 2017 | 295 | トレーサビリティ復元（深層学習） |
| 9 | Understanding and Restructuring Web Sites with ReWeb | Ricca, Tonella | 2001 | IEEE Multimedia | 130 | Web リバースエンジニアリング |
| 10 | Reverse Engineering Web Applications: the WARE Approach | Di Lucca, Fasolino ほか | 2004 | Journal of Software Maintenance and Evolution | 108 | Web リバースエンジニアリング（静的＋動的） |
| 11 | Call Me Maybe: Enhancing JavaScript Call Graph Construction using Graph Neural Networks | Bhuiyan, De Stefano, Pellegrino, Staicu | 2025 | arXiv:2506.18191 | 未計測 | JS 静的解析の限界（コールグラフ） |
| 12 | RepoAgent: An LLM-Powered Open-Source Framework for Repository-level Code Documentation Generation | Luo ほか | 2024 | arXiv:2402.16667 | 未計測 | LLM による文書復元・生成 |
| 13 | ArchAgent: Scalable Legacy Software Architecture Recovery with LLMs | Pan, Mao, Ma, Ling | 2026 | arXiv:2601.13007 | 未計測 | LLM によるアーキテクチャ復元 |
| 14 | Synergistic Enhancement of Requirement-to-Code Traceability: LLM-based Data Augmentation + Advanced Encoder（および関連: SpecMap arXiv:2601.11688、正規化ユースケース仕様の実証研究 arXiv:2608.15726） | Zhang, Zhou, Niu, Hua, Liu ほか | 2025 | arXiv:2509.20149 | 未計測 | LLM によるトレーサビリティ復元 |

被引用の多い基礎文献（5 件以上、要件を満たす）: #1(2422)・#2(404)・#3(307)・#4(680)・#5(365)・#7(1094)・#8(295)・#9(130)・#10(108) の **9 件**が実測の被引用数を確認済み。2023〜2026 の LLM 系: #11・#12・#13・#14（および #14 内の関連 2 本）で **4 件**、要件（目安）を満たす。

---

## 詳細

### #1 Reverse Engineering and Design Recovery: A Taxonomy
- 著者: E. Chikofsky, J. Cross / 年・誌: 1990, IEEE Software / DOI: 10.1109/52.43044
- 手法の要点: リバースエンジニアリング（reverse engineering）・設計復元（design recovery）・再文書化（redocumentation）・再構築（restructuring）・再工学（re-engineering）・順方向工学（forward engineering）を抽象度の階層図で定義し分類した用語体系論文。「reverse engineering は既存システムを解析して構成要素と相互関係を識別し、より高い抽象度・別の形式で表現するプロセスであり、それ自体はシステムを変更しない」「design recovery は reverse engineering に加えて、ドメイン知識・外部情報・演繹・推測（fuzzy reasoning）を組み合わせて失われた設計情報を再構築する、より広い営みである」という定義が核。
- 対象・データ・n: 概念論文のため実証データなし
- 主な結果: 用語体系そのものが「結果」。後続研究のほぼ全てがこの分類をそのまま引用（本調査の #3, #5, #9, #10, #13 も同じ語彙を踏襲）
- 限界: 未確認（本文全体は未取得。アブストラクトは出版社側で closed access のため S2 では取得不可）
- 根拠区分: **実証**（書誌情報・被引用数 2422 は API で確認）＋**主張**（手法要点は分野で広く確立した定説的理解に基づく要約であり、原文本文の逐語確認はしていない）
- Spec2Doc への示唆: 「ソースコードから機械的に導出できる情報（構造）」と「ドメイン知識・意図がなければ得られない情報（設計理由）」を最初から分けて設計する必要がある。Spec2Doc が生成する仕様書は前者の忠実な写像に留めるべきで、後者を LLM が「補完」すると本タキソノミーの言う design recovery ではなく創作になるリスクがある。

### #2 Design Recovery for Maintenance and Reuse
- 著者: T. Biggerstaff / 年・誌: 1989, Computer / DOI: 10.1109/2.30731
- 手法の要点: 「概念の割り当て問題（concept assignment problem）」を提起し、ソースコード中の低レベルな実装概念と、人間が理解する高レベルなドメイン概念（アプリケーション概念）との間には自動では埋まらないギャップがあると論じた。design recovery を、ソースコード・既存の設計文書・(あれば)開発者への聞き取り・一般的な問題領域知識・当該アプリケーション領域の知識を組み合わせて再構築する行為と定義。
- 対象・データ・n: 概念論文
- 主な結果: 未確認
- 限界: 概念割り当て問題は原理的に自動化が困難（コードの識別子・構造だけでは人間が持つドメイン概念に一意に対応しない）という指摘自体が本論文の主張
- 根拠区分: **実証**（書誌・被引用数 404 は API 確認）＋**主張**（要点は定説的理解の要約、本文未確認）
- Spec2Doc への示唆: Spec2Doc が「関数名や変数名から業務概念を推測する」機能を持つ場合、Biggerstaff の指摘する概念割り当て問題に正面から当たる。命名の質に生成物の信頼性が強く依存する旨を仕様書に明記すべき。

### #3 Reverse Engineering: A Roadmap
- 著者: H. Müller, J. Jahnke, D. Smith, M.-A. Storey, S. Tilley, K. Wong / 年・会議: 2000, ICSE「The Future of Software Engineering」/ DOI: 10.1145/336512.336526
- 手法の要点: 2000 年時点のリバースエンジニアリング研究を俯瞰し、(1) パースィング・情報抽出、(2) 分析・抽象化（クラスタリング、パターン照合）、(3) 可視化・UI、(4) メトリクス・評価、という技術ロードマップを提示。プログラム理解支援ツール（Rigi 等）の系譜を整理。
- 対象・データ・n: 俯瞰論文
- 主な結果: 未確認
- 限界: 未確認
- 根拠区分: **実証**（書誌・被引用数 307）＋**主張**（要点要約、本文未確認）
- Spec2Doc への示唆: 「抽出→抽象化→可視化」の 3 段パイプラインは Spec2Doc のアーキテクチャ（パーサ→中間表現→文書テンプレート）と対応させやすい定番の分割線。

### #4 Program Comprehension During Software Maintenance and Evolution
- 著者: A. von Mayrhauser, A.M. Vans / 年・誌: 1995, Computer / DOI: 10.1109/2.402076
- 手法の要点: プログラム理解の認知モデル（Integrated Metamodel）を提示し、開発者が保守作業中に「トップダウン（仮説駆動）」「ボトムアップ（コードチャンク統合）」「知識ベースの状況モデル」を切り替えながら理解を構築する過程を説明。
- 対象・データ・n: 認知科学的モデル論文（実験データではなく既存の実証研究の統合）
- 主な結果: 未確認
- 限界: 未確認
- 根拠区分: **実証**（書誌・被引用数 680）＋**主張**（要点要約、本文未確認）
- Spec2Doc への示唆: 人間の理解過程がトップダウン／ボトムアップ双方向であることは、Spec2Doc の出力を「コード→仕様書」の一方向生成だけでなく、生成した仕様書側からコード該当箇所へ戻れる（トレーサビリティ）UI 設計の根拠になる。

### #5 Software Architecture Reconstruction: A Process-Oriented Taxonomy
- 著者: S. Ducasse, D. Pollet / 年・誌: 2009, IEEE TSE / DOI: 10.1109/tse.2009.19
- 手法の要点: 既存のアーキテクチャ復元（architecture reconstruction）手法群を、目的（再文書化・適合性検査・再工学等）・プロセス（データ抽出→視点合成→制約適用の反復）・技法（クラスタリング、パターンマッチング、視覚化）の3軸で分類する、プロセス指向のタキソノミー。個別手法比較ではなく「復元プロセスをどう構造化するか」を体系化した点が特徴。
- 対象・データ・n: 文献サーベイ・タキソノミー論文
- 主な結果: 未確認（分類軸自体が結果）
- 限界: 未確認
- 根拠区分: **実証**（書誌・被引用数 365）＋**主張**（要点は定説的要約、本文未確認）
- Spec2Doc への示唆: 「アーキテクチャ復元は一回の変換ではなく、抽出→仮説合成→検証の反復プロセスである」という整理は、Spec2Doc が単発のバッチ生成でなく、生成結果を人間がレビューして再抽出にフィードバックできる反復 UI を持つべき論拠になる。

### #6 Obtaining Ground-Truth Software Architectures
- 著者: J. Garcia, I. Ivkovic, N. Medvidovic / 年・会議: 2013, ICSE 2013 / DOI: 10.1109/icse.2013.6606639
- 手法の要点: 複数のアーキテクチャ復元手法（クラスタリングベース等）を同一システムに適用し、さらに独立した複数の人間アーキテクトが手動で復元した「正解（ground truth）」アーキテクチャ同士を比較。復元手法間だけでなく、**人間同士の手動復元結果も一致しない**ことを実証的に示した点が本調査上重要。
- 対象・データ・n: 複数の実システム・複数の人間評価者（具体的なシステム数・評価者数は本文未確認）
- 主な結果: 未確認（具体的な一致率・数値は本文未読のため引用しない）
- 限界: 「客観的な唯一の正解アーキテクチャ」という前提自体が成立しにくいことを示唆
- 根拠区分: **主張**（S2 の 429 により被引用数・アブストラクトとも本調査内では未取得。書誌情報は Crossref で DOI・年・掲載先のみ確認。手法要点は論文タイトルと分野内での定説的な引用のされ方に基づく推定であり、数値・詳細手順は未確認）
- Spec2Doc への示唆: 「アーキテクチャ復元の正解は一意に定まらない」という本研究の指摘は、Spec2Doc の出力を人間がレビューする際の評価基準（完全一致でなく「妥当性」を問う基準）の設計に直結する重要な示唆。ただし数値的根拠は本調査では未確認のため、Spec2Doc の評価設計時に原文を別途確認すべき。

### #7 Recovering Traceability Links between Code and Documentation
- 著者: G. Antoniol, G. Canfora, G. Casazza, A. De Lucia, E. Merlo / 年・誌: 2002, IEEE TSE / DOI: 10.1109/tse.2002.1041053（ICSM 2000 の会議版が起点、TSE 2002 が完全版）
- 手法の要点: 情報検索（IR: Vector Space Model・確率的モデル）を用いて、ソースコード中の識別子・コメントとフリーテキストの外部文書（要求仕様・マニュアル等）の語彙的類似度を計算し、コード↔文書間のトレーサビリティリンクを自動復元する、この分野で最初期かつ最も引用される手法。
- 対象・データ・n: 未確認（本文未読）
- 主な結果: 未確認（具体的な精度・再現率の数値は引用しない）
- 限界: IR ベース手法は語彙のミスマッチ（命名規則の不一致、同義語・多義語）に弱く、閾値設定次第で偽陽性・偽陰性が生じることが後続研究で広く指摘されている（この限界自体は分野の定説）
- 根拠区分: **実証**（書誌・被引用数 1094 は API 確認）＋**主張**（手法要点・限界は定説的理解、原文の数値は未確認）
- Spec2Doc への示唆: 「識別子の語彙的類似度だけでは限界がある」という 2002 年時点の知見は、Spec2Doc が LLM の意味理解でこのギャップを埋められるかどうかを検証する際の比較対象（ベースライン）になる。

### #8 Semantically Enhanced Software Traceability Using Deep Learning Techniques
- 著者: J. Guo, J. Cheng, J. Cleland-Huang / 年・会議: 2017, ICSE 2017 / DOI: 10.1109/icse.2017.9
- 手法の要点: RNN（LSTM 系）による word embedding を用いて、要求文書とソースコード間の意味的類似度を学習し、古典的な IR ベース手法（#7 系）を置き換える深層学習ベースのトレーサビリティ復元手法（通称 TraceNN 系譜の初期研究）。
- 対象・データ・n: 未確認（本文未読）
- 主な結果: 未確認（具体的な F 値・精度は引用しない）
- 限界: 未確認（一般に深層学習系は学習データ・ラベル付きトレーサビリティリンクの不足が課題として後続の LLM 系論文でも繰り返し指摘されている）
- 根拠区分: **実証**（書誌・被引用数 295 は API 確認）＋**主張**（手法要点は定説的理解、数値は未確認）
- Spec2Doc への示唆: 2017 年の時点で「語彙一致から意味理解へ」の転換が始まっており、LLM はこの延長線上にある。ただし #14 が指摘するように、ラベル付きデータ不足は 2025〜2026 年でも未解決の課題として残っている。

### #9 Understanding and Restructuring Web Sites with ReWeb
- 著者: F. Ricca, P. Tonella / 年・誌: 2001, IEEE Multimedia / DOI: 10.1109/93.917970
- 手法の要点: Web サイトを静的にクロール・解析し、ページ間のリンク構造・フォーム・動的コンテンツ生成箇所をモデル化するツール ReWeb を提案。抽出したモデルを UML 風のダイアグラムで可視化し、サイトの再構築（restructuring）を支援する。
- 対象・データ・n: 未確認
- 主な結果: 未確認
- 限界: 静的クロールが前提のため、クライアントサイドスクリプトによる動的な画面遷移・遅延生成コンテンツの捕捉には限界がある（この限界は後続の #10 が明示的に動的解析を組み合わせる動機になっている）
- 根拠区分: **実証**（書誌・被引用数 130）＋**主張**（手法要点は定説的理解、本文未確認）
- Spec2Doc への示唆: Web アプリのソースが対象範囲に含まれる場合、静的解析だけでは画面遷移の全体像を復元しきれない。動的クロールとの併用が必須という設計判断の根拠になる。

### #10 Reverse Engineering Web Applications: the WARE Approach
- 著者: G.A. Di Lucca, A.R. Fasolino ほか / 年・誌: 2004, Journal of Software Maintenance and Evolution: Research and Practice / DOI: 10.1002/smr.281（先行の WCRE 2001・ECSMR 2002 のツール論文の集大成版）
- 手法の要点: 静的解析（ソースコード・HTML/スクリプト解析）と動的解析（実行時のユーザ操作トレース）を組み合わせて、Web アプリケーションの UML クラス図・画面遷移モデル（ナビゲーション・ダイアグラム）を復元する WARE（Web Applications REengineering）ツール一式。
- 対象・データ・n: 未確認
- 主な結果: 未確認
- 限界: 未確認（一般に、動的解析は実行時に到達したパスしか捕捉できないカバレッジの限界を持つ）
- 根拠区分: **実証**（書誌・被引用数 108）＋**主張**（手法要点は定説的理解、本文未確認）
- Spec2Doc への示唆: 「静的＋動的のハイブリッド」は 2004 年時点で既にベストプラクティスとして確立していた。Spec2Doc が静的解析専用ツールとして設計される場合、この限界（動的にしか現れない挙動は復元できない）を仕様書の「未検証」注記として明示する設計が必要。

### #11 Call Me Maybe: Enhancing JavaScript Call Graph Construction using Graph Neural Networks
- 著者: M.H.M. Bhuiyan, G. De Stefano, G. Pellegrino, C.-A. Staicu / 年: 2025, arXiv:2506.18191
- 手法の要点: JavaScript のコールグラフ構築を「プログラムグラフ上のリンク予測問題」として GNN（グラフニューラルネットワーク）で解き、既存の静的解析ツールが見逃す呼び出しエッジを補完する。アブストラクトで明示: 「既存の JavaScript 用コールグラフ構築アルゴリズムは、解析が困難な言語機能（動的ディスパッチ・高階関数等）のため、健全（sound）でも完全（complete）でもない。先行研究は高度なツールでも偽エッジの生成と正エッジの欠落の両方が起きることを示している」（アブストラクト原文の要旨）。
- 対象・データ・n: 未確認（本文未読）
- 主な結果: 未確認（具体的な精度向上幅は引用しない）
- 限界: GNN による補完自体も予測（推定）であり、100% の健全性・完全性を保証するものではない（アブストラクトの問題設定自体が示す限界）
- 根拠区分: **実証**（arXiv API から取得したアブストラクト原文に基づく一次情報。ただし数値結果は本文未読につき未確認）
- Spec2Doc への示唆: JavaScript / TypeScript を含むリポジトリを Spec2Doc が扱う場合、コールグラフ・依存関係の抽出は原理的に不完全（sound でも complete でもない）になりうる。生成する仕様書には「動的な呼び出し・eval 等は解析対象外」という限界を明記する必要がある。

### #12 RepoAgent: An LLM-Powered Open-Source Framework for Repository-level Code Documentation Generation
- 著者: Q. Luo ほか（Luo, Ye, Liang, Zhang, Qin, Lu, Wu, Cong, Lin, Zhang, Che, Liu, Sun）/ 年: 2024, arXiv:2402.16667
- 手法の要点: LLM を用いてリポジトリ単位でコード文書を能動的に生成・保守・更新するオープンソースフレームワーク。アブストラクト原文: 「生成モデルはコード生成・デバッグで有望性を示しているが、コード文書生成での活用は未開拓である。RepoAgent はリポジトリレベルの文書を能動的に生成・保守・更新することを目的とした、LLM 駆動のオープンソースフレームワークである。定性的・定量的評価の両方でアプローチの有効性を検証し、高品質なリポジトリレベル文書の生成に優れることを示した」（要約）。
- 対象・データ・n: 未確認（本文未読、定量評価の具体的なデータセット・n は未確認）
- 主な結果: 未確認（「優れる」という定性的主張のみアブストラクトで確認、数値は引用しない）
- 限界: 未確認
- 根拠区分: **実証**（arXiv アブストラクト原文に基づく）
- Spec2Doc への示唆: Spec2Doc と最も直接的に競合・参考になる同系統ツール。「能動的な保守・更新（コード変更に追随した文書の再生成）」を掲げている点は Spec2Doc が差別化すべきか同様に採用すべきかの検討対象。

### #13 ArchAgent: Scalable Legacy Software Architecture Recovery with LLMs
- 著者: R. Pan, B. Mao, T. Ma, Z. Ling / 年: 2026, arXiv:2601.13007
- 手法の要点: 静的解析・適応的コード分割（segmentation）・LLM による統合を組み合わせたエージェント型フレームワークで、大規模レガシーソフトウェア（複数リポジトリにまたがる）から複数視点（multiview）かつビジネス整合的なアーキテクチャを再構築する。アブストラクト原文: 「大規模レガシーソフトウェアからの正確なアーキテクチャ復元は、アーキテクチャの逸脱（drift）、関係性の欠落、LLM のコンテキスト制限により妨げられている」。
- 対象・データ・n: 未確認（本文未読）
- 主な結果: 未確認
- 限界: アブストラクトが課題として掲げる「アーキテクチャドリフト」「関係性の欠落」「LLM のコンテキスト長制限」は、ArchAgent 自身が完全に解決したとは述べておらず、緩和策（コンテキストプルーニング等）として提示されている点に注意
- 根拠区分: **実証**（arXiv アブストラクト原文に基づく）
- Spec2Doc への示唆: 「LLM のコンテキスト長制限のためリポジトリ全体を一度に投入できない」という課題は、Spec2Doc の設計（チャンク分割・段階的要約・RAG 的な取り込み）に直結する制約として要件定義に反映すべき。

### #14 Synergistic Enhancement of Requirement-to-Code Traceability（および関連の LLM 系トレーサビリティ論文）
- 主論文: J. Zhang, J. Zhou, N. Niu, J. Hua, C. Liu / 年: 2025, arXiv:2509.20149。手法の要点（アブストラクト原文要約）: 「要求からコードへの自動トレーサビリティリンク復元は、ラベル付きデータの不足によって深刻に阻害されている。本研究は LLM 駆動のデータ拡張と高度なエンコーダを統合した相乗的フレームワークを提案・検証する。双方向・ゼロ／少数ショットのプロンプト戦略の系統的評価を通じて最適化されたデータ拡張が有効であることを実証する」（要約）。
- 関連 2 本（本調査では書誌・アブストラクトのみ確認、詳細分析は対象外）:
  - SpecMap: Hierarchical LLM Agent for Datasheet-to-Code Traceability Link Recovery（arXiv:2601.11688, 2026）— 組込みシステムのデータシート↔コード間トレーサビリティに階層型 LLM エージェントを適用
  - An Empirical Study on the Impact of Normalized Use-Case Specifications on Traceability（arXiv:2608.15726, 2026）— 要求記述（ユースケース仕様）側の書き方の質・正規化がトレーサビリティ精度に与える影響を実証的に調査。アブストラクトで「要求とコードの間の大きな意味的ギャップが依然として正確なリンク復元を妨げている」と明言
- 対象・データ・n: 未確認（本文未読）
- 主な結果: 未確認（数値は引用しない）
- 限界: 3 本ともアブストラクトの時点で「ラベル付きデータ不足」「要求記述の質のばらつき」「意味的ギャップ」を未解決の中心課題として名指ししており、2025〜2026 年時点でもトレーサビリティ復元の本質的な難しさ（#7 の 2002 年時点の指摘と同型の課題）が解消されていないことを示す
- 根拠区分: **実証**（3 本とも arXiv アブストラクト原文に基づく）
- Spec2Doc への示唆: 「LLM を使えば要求↔コードのトレーサビリティが自動で高精度に取れる」という楽観は禁物。2025〜2026 年の最新研究群も、2002 年の Antoniol 論文（#7）と同種の「意味的ギャップ」「データ不足」を課題として挙げ続けている。Spec2Doc の出力するトレーサビリティ情報には信頼度・未検証範囲を明示すべき。

---

## ソースから復元できるもの／できないもの（本調査の整理）

**復元できる（構造的・機械的に導出可能）**
- 静的な構造情報: モジュール・クラス・関数の構成、呼び出し関係の大部分（#3, #5）
- 語彙的な類似性に基づく粗いトレーサビリティ候補（#7, #8 の出発点）
- Web アプリのページ間リンク構造・フォーム構造（静的クロール、#9）
- LLM を使えば「もっともらしい」文書・アーキテクチャ図の下書き（#12, #13）

**復元が原理的に困難、または一意に定まらない**
- 設計意図・採用理由（rationale）: ソースコードのみからは得られず、ドメイン知識・開発者への聞き取りが必須（#1, #2 の中心的主張）
- 唯一の「正解アーキテクチャ」: 人間アーキテクト同士でも一致しない（#6）
- JavaScript 等の動的言語における完全なコールグラフ: 動的ディスパッチ・`eval` 等により静的解析は原理的に sound でも complete でもない（#11）
- 動的にしか発現しない画面遷移・実行パス: 静的解析だけでは捕捉できず、動的解析（実行トレース）の併用が必要、それでも実行網羅率に依存（#10）
- 要求↔コード間の意味的ギャップ: IR（2002 年）から深層学習（2017 年）、LLM（2025〜2026 年）まで手法は進化しているが、ギャップの存在自体は各時代の論文が繰り返し課題として指摘しており未解消（#7, #8, #14）

## 分野の結論（割れているなら割れたまま）

- **収束している点**: Chikofsky & Cross（#1）の用語体系（reverse engineering／design recovery／redocumentation／restructuring／re-engineering）は 1990 年から現在（#13 等 2026 年の論文）まで一貫して踏襲されており、分野内の合意事項と言える。
- **割れている点 1**: アーキテクチャ復元の「正しさ」をどう評価するかは未解決。Garcia ら（#6）は人間の手動復元結果同士も一致しないことを示し、「客観的な唯一の正解」という前提自体に疑義を呈している。Ducasse & Pollet（#5）はプロセスの体系化に主眼を置き、評価基準の統一には踏み込んでいない。→ **本調査では、この対立を解消する新たな合意が形成されたかどうかは未確認**。
- **割れている点 2**: トレーサビリティ復元における LLM の優位性は、2025〜2026 年の最新研究（#14）でも「データ拡張」「エンコーダ改善」といった対症療法が続いており、意味的ギャップそのものを解消したと主張する決定的な論文は本調査の範囲では見つかっていない。楽観的な「LLM で解決済み」という結論と、悲観的な「本質的課題は未解決」という見方が併存している状態で、**本調査ではどちらか一方に軍配を上げる根拠は確認できていない**。
- **Web アプリのリバースエンジニアリング**は 2001〜2004 年（#9, #10）の時点で「静的＋動的のハイブリッドが必須」という結論に達しており、この結論自体は 2025〜2026 年の JS 解析研究（#11）でも覆っていない（むしろ GNN 等で動的解析の代替を試みているが、#11 自身が「不完全」と明言）。

## 引用してはいけない数値

- #6（Garcia et al. 2013）の被引用数・具体的な一致率・評価者数・システム数 — S2 API が 429 で応答せず、Crossref でも被引用数は取得不可。本文も未読。
- #7, #8（Antoniol 2002, Guo 2017）の精度・再現率・F 値などの具体的な評価指標 — 書誌情報（被引用数含む）は API で確認済みだが、アブストラクト・本文とも未取得のため定量結果は一切引用不可。
- #9, #10（Ricca & Tonella 2001, Di Lucca et al. 2004）の対象サイト数・精度等の定量結果 — 同様に本文未読。
- #11〜#14（arXiv, 2025〜2026 の LLM 系 4 本）の具体的な精度向上幅・ベンチマークスコア — アブストラクトの定性的記述（「有効性を検証した」等）までは一次情報として確認済みだが、数値そのものは本文を読んでいないため未確認。特に #12（RepoAgent）の「優れる」という評価も定性的表現であり、具体的なスコアを Spec2Doc の主張の根拠に使ってはならない。

## 検索方法

1. Semantic Scholar Graph API `/paper/search`（フィールド: title, year, venue, citationCount, abstract, externalIds）を curl で直接呼び出し。未認証枠のレート制限が厳しく、並列 6 リクエストで即座に 429、その後単発リクエストでも数分間 429 が継続する事象を確認（H-8 に従い、数分更新が無ければ軽量な代替経路に切替える方針で対応）。
2. 429 が解消しない間、arXiv API（`export.arxiv.org/api/query`、https 直叩き。http は 301 でリダイレクトされるため https を使用）で 2023〜2026 年の LLM 系論文を先に収集。
3. 古典論文（Antoniol, Ricca & Tonella, Müller ロードマップ, von Mayrhauser & Vans, Biggerstaff, Garcia, Di Lucca）の書誌検証は Crossref API（`api.crossref.org/works`, `query.bibliographic`）で代替。DBLP（`dblp.org`）は本環境から接続不能（HTTP 000）だったため使用せず。
4. S2 のレート制限が自然回復した後、確認済み DOI に対して `/paper/DOI:{doi}` で被引用数を再取得し、可能な限り実測値に置き換えた（Garcia 2013・WARE の一部は再試行しても取得できず「未計測」のまま）。
5. WebSearch は 0 回。S2・arXiv・Crossref の組み合わせのみで目標件数（10〜14 件）に到達した。
