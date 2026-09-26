# 市場調査の統合と Spec2Doc 改修候補

- 作成日: 2026-09-26
- 入力: 同じフォルダの `jp-a-sier.md`（A: 日本の大手 SIer）・`jp-b-tools.md`（B: 日本のパッケージ）・`jp-c-genai.md`（C: 日本の生成 AI サービス）・`us-d-modernization.md`（D: 米国のモダナイゼーション）・`us-e-codedocs.md`（E: 米国のコード文書・Q&A）・`jp-d-supplement.md`（F-01〜F-03: 日本の追加 3 件。2026-09-26 補充）・`jp-e-replace.md`（G: 日本の入れ替え 5 件）・`us-f-replace.md`（H: 米国の入れ替え 5 件）・`jp-f-fill.md`（F-04〜F-08: 日本の最終補充 5 件。2026-09-26 三回に分けて調査）・`us-g-fill.md`（I-01〜I-02: 米国の最終補充 2 件。README の ID 体系との衝突を避けるため G ではなく I を付与）
- Spec2Doc の現状: `README.md`・`PLAN.md`・`docs/lifecycle/01-requirements.md`（生成ドキュメントの種類・スコープ / 対象外・REQ-F）と `src/` の grep
- 方法: A・B・C・D・E は追加の Web 検索をしていない（各ファイルの記載をそのまま使い、ファイルに無いことは「未確認」とした。根拠の強さは各ファイルの判定を写した）。F・G・H・jp-f-fill・us-g-fill は各ファイルの調査時に WebSearch・WebFetch の上限内で新規に調査済み。本統合では F-04〜F-07／I-01〜I-02 を全件表に追記する作業以外は Web 検索を行わず、既存記載の統合・関連度判定・件数の再集計のみを行った
- **国の数え方（2026-09-26 F-04〜/I 系追加分から適用）**: 国は販売元でなく開発元で数える。Imagix 4D＝開発元 米 Imagix（日本は東陽テクニカが販売）／C/C++test＝開発元 米 Parasoft（日本はテクマトリックスが販売）／Understand＝開発元 米 SciTools（日本はテクマトリックスが販売、既存の G-04/H-02 統合と同じ扱い）／astah*＝開発元 日本 チェンジビジョン

---

## 1. 統合一覧

### 1-1. 件数（製品の重複だけを除いた件数。関連度は問わない）

| 区分 | 掲載件数 | 重複・除外 | 重複除外後 | 目標 | 判定 |
|---|---|---|---|---|---|
| 日本（A・B・C・F・G） | 47 | 6 件（C-01=A-02、C-03=A-06、C-08=B-09、B-04=A-12、**G-04=H-02（同一製品のためアメリカ側で計上）**、**G-05=A-04（同一事業部で独立性未確認のため除外）**） | **41** | 30 以上 | 満たす（+11） |
| アメリカ（D・E・H・I） | 33 | 0 件 | **33** | 20 以上 | 満たす（+13） |

**この表は製品の重複だけを除いた件数で、水増ししない基準にはならない。関連度で絞った厳密な件数は 1-1a。**

F-04〜F-07（`jp-f-fill.md`）・I-01〜I-02（`us-g-fill.md`、2026-09-26 最終補充）は国を開発元で数える。F-04（astah*、開発元チェンジビジョン＝日本）・F-07（PGRelief、開発元富士通ソフトウェアテクノロジーズ＝日本）は日本の件数に加算。F-05（Imagix 4D、開発元 Imagix＝米国）・F-06（C/C++test、開発元 Parasoft＝米国）・I-01（IBM ELM）・I-02（Coverity）は「日本の追加補充ファイル（jp-f-fill.md）または独立ファイル（us-g-fill.md）」由来でも米国の件数に加算する。日本 44→46（+2: F-04・F-07）、米国 29→33（+4: F-05・F-06・I-01・I-02）。F-08（LaKeel Blu、提供元・開発元とも日本のラキール）を追加し、日本 46→47

G（`jp-e-replace.md`、2026-09-26 入れ替え追加）・H（`us-f-replace.md`、同日追加）:
- G-01 ドキュメント再構築サービス（エイムネクスト）・G-02 仕様書再生（ソフトロード）・G-03 SysClinic（新日本システック）は既存 39 件と重複無し、日本に追加
- G-04 Understand（テクマトリックス販売・開発元は米 SciTools）は H-02 Understand（SciTools 本体、`us-f-replace.md`）と同一製品のため、アメリカに 1 件（H-02）として計上し、日本の重複除外後の件数には含めない
- G-05 プログラム仕様可視化サービス（日立製作所）は A-04 マイグレーションサービスと同じ事業部（URL パス `appsvdiv`）で、独立した別製品か否かが未確認のため重複扱いとし、除外する
- H-01 DocuWriter.ai・H-02 Understand・H-03 Kodesage・H-04 Mutable.ai（Auto Wiki）・H-05 GitLoop は既存 24 件と重複無し、アメリカに追加

### 1-1a. 関連度別件数（重複除外後。水増ししない基準）

判定基準: **直接**＝ソースを入力に仕様書・設計書・業務ルール等の文書を出力する商用製品／**周辺**＝解析・影響分析・可視化・文書保守・テスト設計支援／**薄い**＝コード変換だけの SI サービス、汎用コーディング支援・補完・レビュー／**対象外**＝販売終了・研究・事例・商用未確認（G-05 の重複除外分も対象外に含めた）

| 国 | 直接 | 周辺 | 薄い | 対象外 | 合計 | 調査件数（直接＋周辺） | 目標 | 判定 |
|---|---|---|---|---|---|---|---|---|
| 日本 | 20 | 10 | 8 | 3 | 41 | **30** | 30 以上 | **満たす（+0）** |
| アメリカ | 10 | 13 | 10 | 0 | 33 | **23** | 20 以上 | **満たす（+3）** |

F-04〜F-07・I-01〜I-02（2026-09-26 最終補充、国は開発元で数える）を反映: 日本は周辺 +2（F-04 astah*・F-07 PGRelief）で調査件数 27→29（目標未達 -3→-1 に縮小）。アメリカは直接 +1（F-05 Imagix 4D）・周辺 +3（F-06 C/C++test・I-01 IBM ELM・I-02 Coverity）で調査件数 19→23（未達 -1 から目標達成 +3 に転じた）。F-08（LaKeel Blu、直接）を追加し、日本は直接 +1 で調査件数 29→30（目標ちょうど達成）。

**関連度で絞る（1-1a）と、F-08 の追加で日本・アメリカとも目標を満たす（日本は最低ラインの 30 ちょうど）。** 1-1 の「満たす」は製品の重複を除いただけで、モダナイゼーション支援の周辺ツール（資産分析・可視化のみ等）やコーディング支援ツールを多く含むための見かけ上の充足であり、実態の不足を隠さないためにこの表を残す。日本は 30 という最低ラインちょうどで、内訳の半分が周辺・薄い・対象外である点は変わらない。

判定に迷った項目（1 行ずつ）:
- B-06（ウェイン）・B-10（バルテス）・B-12（ノーススターマネジメント）: 出力が図・分析中心で仕様書生成と言い切れる記述が無いため「周辺」とした
- E-01（DeepWiki）: 開発者向け Wiki の自動生成で、業務仕様書とは性質が異なるが「ソースから文書を生成する」点を優先し「直接」とした
- G-04／H-02（Understand）: 依存関係図・メトリクス等の静的解析結果が中心で、仕様書・設計書そのものの生成ではないため「周辺」とした
- E-04（Sourcegraph Cody）・E-09（Glean）: 根拠付きの回答だが Q&A・チャット止まりで文書を出力しないため「薄い」とした

重複かどうかの判定:
- **同一製品として 1 件に数えた**: 富士通 Application Transform（A-02 と C-01）、NTT データ tsuzumi for COBOL（A-06 と C-03）、SHIFT DQS for リバースエンジニアリング（B-09 と C-08）、VSSD（A-12 と B-04。URL が同じ `dcr.co.jp/verasym`。提供元の表記が A は「データクレーション」、B は「第一コンピュータリソース（DCR）」で食い違っており、どちらが正しいかは未確認）、**Understand（G-04 と H-02。テクマトリックスは日本国内の販売代理で、開発元 SciTools 本体はアメリカのため、アメリカ側の H-02 に 1 件として計上）**
- **同一事業部内で独立性未確認のため重複扱い**: **日立製作所の A-04（マイグレーションサービス）と G-05（プログラム仕様可視化サービス）。URL パスの事業部（`appsvdiv`）が同一で、別製品と扱ってよいかは未確認**
- **提供元は同じだが別製品として数えた**: 富士通の 5 製品（A-01 資産分析・可視化／設計書リバース、A-02 Application Transform、A-03 PROGRESSION、B-11 SIMPLIA DF-COBDOC、C-02 CSCA）、日立の 2 件（A-04 マイグレーションサービス、C-04 生成 AI 適用支援。C-04 は本文を取得できておらず、A-04 と同じものかどうかは未確認）、TIS/TISI の 2 件（A-08 Xenlon 神龍、C-05 生成 AI 仕様書作成オプション。A-08 の調査で tis.jp→tisi.jp の転送を確認）、IBM・AWS・CAST の各 2 製品、Microsoft の Azure Migrate（D-11）と GitHub Copilot（E-05）
- **買収**: Windsurf（E-06）と DeepWiki（E-01）はどちらも Cognition の製品だが、IDE と Wiki で製品が違うので別件とした（Cognition による買収は転送の観測から推測しただけで、一次資料は未確認）。Tabnine（E-07）は Tricentis に買収されたが 1 製品のままなので 1 件
- 国: アメリカの件数は、各ファイルが「米国企業」として集めたものをそのまま数えた。CAST（ファイルでは「米国ニューヨーク拠点」）と Tabnine（買収元の Tricentis）の本社所在国は、このフォルダのファイルでは確認できない

### 1-2. 全件表

根拠: 強＝公式の一次情報／中＝報道・スニペットのみ・一次情報でも概要だけ／弱＝タイトルだけ、または存在の確認だけ。判定欄: 独立＝1 件として数えた／重複→No＝そちらに合算した。

| No | 名称 | 提供元 | 国 | 分野 | 対象言語 | 出力の要点 | 根拠 | 出典 | 判定 | 関連度 |
|---|---|---|---|---|---|---|---|---|---|---|
| A-01 | 資産分析・可視化サービス／設計書リバースサービス for アプリケーション資産 | 富士通 | 日本 | 資産分析・設計書生成（サービス） | COBOL 等（一覧は未確認） | 静的解析の結果を知識グラフにし、RAG で LLM に渡して設計書を生成 | 強 | [impress](https://it.impress.co.jp/articles/-/27424) | 独立 | 直接 |
| A-02 | Fujitsu Application Transform powered by Kozuchi | 富士通 | 日本 | 設計書生成（SaaS） | COBOL 等 | ソースを解析して設計書を自動生成 | 強 | [公式](https://global.fujitsu/ja-jp/pr/news/2026/03/30-01) | 独立 | 直接 |
| A-03 | Fujitsu PROGRESSION | 富士通 | 日本 | 変換（移行 SI） | COBOL | アセスメント・ビジネスロジック抽出・自動変換・テストを一括で提供 | 強 | [公式](https://info.archives.global.fujitsu/jp/news/2024/05/7.html) | 独立 | 薄い |
| A-04 | マイグレーションサービス（ALM 含む） | 日立製作所 | 日本 | 資産分析・変換サービス | COBOL85/2002・NATURAL・C・Java | 移行性分析レポート・移行方式設計書・棚卸・可視化 | 強 | [公式](https://www.hitachi.co.jp/products/it/appsvdiv/service/migration/index.html) | 独立 | 薄い |
| A-05 | 設計書リカバリーサービス | NTT データ | 日本 | 設計書生成（サービス） | COBOL・JCL・PL/I | 顧客の既存様式に合わせた設計書 | 強 | [公式](https://www.nttdata.com/global/ja/news/release/2013/042402/) | 独立 | 直接 |
| A-06 | tsuzumi for COBOL（t4C） | NTT データ | 日本 | 設計書生成（独自 LLM） | COBOL | 設計仕様の復元・テストコードの作成と実行 | 中 | [日経 xTECH](https://xtech.nikkei.com/atcl/nxt/column/18/02905/080100005/) | 独立 | 直接 |
| A-07 | 現行可視化・影響分析サービス | 野村総合研究所 | 日本 | 資産分析・影響分析 | 未確認 | 既存の設計書・コード・マニュアルから再文書化、結合度・変更影響範囲の可視化 | 強 | [公式](https://www.nri.com/jp/news/newsrelease/20250311_1.html) | 独立 | 周辺 |
| A-08 | Xenlon 神龍 モダナイゼーション（Migrator C2J） | TIS | 日本 | 変換 | COBOL | 現状分析による資産削減、COBOL→Java 変換、仕様書作成 | 中〜強 | [公式](https://www.tis.co.jp/seminar/seminar/20230127_XMS.html) | 独立 | 薄い |
| A-09 | COBOL PARK | SCSK | 日本 | サービス（刷新支援の拠点） | COBOL | 資産分析ツールの詳細は未確認 | 中 | [日経](https://www.nikkei.com/article/DGXZQOUC167CO0W5A211C2000000/) | 独立 | 薄い |
| A-10 | ClearPath Portal | BIPROGY | 日本 | 変換（Web 化） | メインフレームのアプリ | ソースを変えずに Web 化。設計書生成は未確認 | 中 | [公式](https://www.biprogy.com/solution/service/clearpathportal.html) | 独立 | 薄い |
| A-11 | モダナイゼーション支援（MAJALIS・AMO） | アクセンチュア日本法人 | 日本 | 変換・サービス | COBOL・JCL・PL/I・EASY・アセンブラ・RPG | 棚卸による可視化と不要プログラムの削除、自動変換 | 中 | [公式](https://newsroom.accenture.jp/jp/news/2019/release-20190329-2) | 独立 | 薄い |
| A-12 | VSSD リバースエンジニアリング機能 | データクレーション（表記は B-04 と食い違い） | 日本 | 資産分析・設計書生成 | PL/SQL・VB6・VB.NET・C#・Delphi・Oracle Forms/Reports・Java・ASP.NET | 画面定義書・テーブル定義書・CRUD 表・オブジェクト関連図（自動）、画面遷移図・クラス図（半自動） | 強 | [公式](https://www.dcr.co.jp/verasym/mieruka/reverseengineering/) | 独立 | 直接 |
| B-01 | Trinity | ゼロディバイド | 日本 | 設計書生成 | RPG・CL・DDS・COBOL（オプション） | 約 30 種の設計書（プログラム関連図・CRUD 図・処理フロー等）、スケジューラで自動更新 | 強 | [公式](https://www.zerodivide.co.jp/trinity/trinity16.html) | 独立 | 直接 |
| B-02 | CasePlayer2 | ガイオ・テクノロジー | 日本 | 資産分析（リバース CASE） | C・組込み C・アセンブラ | フローチャート等の仕様書、ソースと並べて見る仕様書ブラウザ | 強 | [公式](https://www.gaio.co.jp/products/caseplayer2/) | 独立 | 直接 |
| B-03 | Re:Zolver | DTS インサイト | 日本 | 影響分析 | 未確認 | 影響範囲・構造の分析（**販売終了**） | 中 | [公式](https://www.dts-insight.co.jp/product/analysis_tool/rezolver/) | 独立（販売終了） | 対象外 |
| B-04 | VSSD（Verasym System Designer） | 第一コンピュータリソース | 日本 | 設計書生成・資産分析 | 未確認 | 設計書のリポジトリ管理、項目変更時の影響アラート | 強 | [公式](https://www.dcr.co.jp/verasym/) | 重複→A-12 | 直接 |
| B-05 | AppDocOne | オン・デマンド・ワン | 日本 | 設計書生成（クラウド） | 未確認 | 稼働中のアプリから画面設計書を生成、Excel 出力、ソース更新に追随 | 強 | [公式](https://ondemandone.com/solutions/appdocone-2/) | 独立 | 直接 |
| B-06 | 資産分析ツール（製品名未確認） | ウェイン | 日本 | 資産分析 | Delphi・C・VB・Java・COBOL・.NET・PL/I・Ada・JCL・ASM・ASP | フローチャート・シーケンス図・クラス図・CRUD 図・影響分析・テストケース生成・版の比較 | 強 | [公式](https://www.wain.co.jp/technology/technology_ana.html) | 独立 | 周辺 |
| B-07 | リバースエンジニアリング（サービス名未確認） | 日新システムズ | 日本 | サービス | C・C++・C#・VB・VC・Java・ラダー | 設計ドキュメント（種別は未確認） | 中 | [公式](https://www.co-nss.co.jp/engineering/eng-doc/) | 独立 | 直接 |
| B-08 | システム資産可視化（マイグレーション 2.0） | システムズ | 日本 | サービス | 未確認 | レガシーの構成・資産の可視化 | 中 | [公式](https://www.migration.jp/menu/re_doc/) | 独立 | 周辺 |
| B-09 | SHIFT DQS for リバースエンジニアリング | SHIFT | 日本 | 設計書生成（AI） | VB.NET・COBOL（PHP・Java は予定） | 46 種（業務・画面・ビジネスロジック仕様書、コールグラフ等）をダッシュボードで管理 | 強 | [PR TIMES](https://prtimes.jp/main/html/rd/p/000000128.000018724.html) | 独立 | 直接 |
| B-10 | リバースエンジニアリングサービス | バルテス | 日本 | サービス | 未確認 | 未確認（テスト会社の付随サービス） | 弱 | [公式](https://service.valtes.co.jp/s-test/service/reverse/) | 独立 | 周辺 |
| B-11 | SIMPLIA DF-COBDOC | 富士通 | 日本 | 設計書生成 | COBOL（NetCOBOL） | 対象資産と出力文書を選んで設計書を出力 | 強 | [公式](https://www.fujitsu.com/jp/products/software/applications/applications/simplia/introduction/windows/df-cobdoc/) | 独立 | 直接 |
| B-12 | COBOL ソース自動分析サービス | ノーススターマネジメント | 日本 | サービス | COBOL | 未確認 | 中 | [IT Leaders](https://it.impress.co.jp/articles/-/27115) | 独立 | 周辺 |
| C-01 | Fujitsu Application Transform | 富士通 | 日本 | 設計書生成 | 未確認 | ソース解析→設計書生成 | 中 | [公式](https://global.fujitsu/ja-jp/pr/news/2026/03/30-01) | 重複→A-02 | 直接 |
| C-02 | Code Specification Consistency Analysis（CSCA） | 富士通研究所 | 日本 | 整合性検証 | 未確認 | 設計書とソースの不整合の検出（商用提供は未確認） | 中 | [技術ブログ](https://blog.fltech.dev/entry/2025/10/14/csca-ja) | 独立（商用未確認） | 対象外 |
| C-03 | tsuzumi for COBOL | NTT データ | 日本 | 設計書生成 | COBOL | 設計書の復元・テストコード | 中 | [日経 xTECH](https://xtech.nikkei.com/atcl/nxt/column/18/02905/080100005/) | 重複→A-06 | 直接 |
| C-04 | モダナイゼーション powered by Lumada／生成 AI 適用支援 | 日立製作所 | 日本 | 移行支援 | 未確認 | コード生成・レビュー・単体テスト（本文は未取得） | 中 | [公式](https://www.hitachi.co.jp/products/it/appsvdiv/service/genai/index.html) | 独立 | 薄い |
| C-05 | 生成 AI 仕様書作成オプション | TISI | 日本 | 設計書生成 | Java | 6 項目の仕様を Markdown／Excel で出力、技術者が確認 | 強 | [公式](https://www.tisi.jp/service_solution/finance_modernization/genai_spec/) | 独立 | 直接 |
| C-06 | 生成 AI リバースエンジニアリングサービス | クレスコ | 日本 | 設計書生成 | 未確認 | 設計書の初版を生成し、残りをエンジニアが仕上げる | 中 | [公式](https://www.cresco.co.jp/ja/news/news-7931549844289912211.html) | 独立 | 直接 |
| C-07 | AI-no-te リバースエンジニアリング | 東芝デジタルエンジニアリング | 日本 | 設計書生成 | PL/SQL・Python・VBA・HTML・JavaScript・Java・C#・COBOL・.NET・VB.NET | 設計書・仕様書・運用手順書・テストケース資料を顧客様式で、生成 AI＋技術者の検証 | 強 | [公式](https://www.toshiba-tden.co.jp/system/ai-reverse-engineering-service/index_j.htm) | 独立 | 直接 |
| C-08 | SHIFT DQS for リバースエンジニアリング | SHIFT | 日本 | 設計書生成 | 未確認 | 未確認 | 弱 | [公式](https://service.shiftinc.jp/service/ai-reverse-engineering/) | 重複→B-09 | 直接 |
| C-09 | Jitera（設計書自動生成） | Jitera | 日本 | 設計書生成・Q&A | 未確認 | 設計書生成と改善提案、VSCode 内チャットで影響範囲調査・テストケース作成 | 中〜強 | [PR TIMES](https://prtimes.jp/main/html/rd/p/000000020.000110428.html) | 独立 | 直接 |
| C-10 | Codeledge | DigKnow | 日本 | 文書の自動生成 | 未確認 | コミットを検知して文書（文章・フローチャート・シーケンス図）を生成・更新、更新履歴 | 強 | [公式](https://codeledge.co/) | 独立 | 直接 |
| C-11 | Autify Genesis 2.0／Nexus | Autify | 日本 | テスト設計支援 | 未確認（Web アプリ） | コード→仕様書、仕様書→テストシナリオ・Playwright コード | 中〜強 | [Publickey](https://www.publickey1.jp/blog/25/aiautify_nexusautify.html) | 独立 | 周辺 |
| C-12 | COBOL 設計書生成の事例 | アルゴマティック | 日本 | 設計書生成（事例） | COBOL | 設計書・仕様書の生成事例（商用サービスかは未確認） | 弱 | [記事](https://magazine.algomatic.jp/ai-modernization-cobol-spec-generation) | 独立（商用未確認） | 対象外 |
| F-01 | SystemDirector Enterprise for Modernization | NEC | 日本 | 資産分析・可視化／設計書生成 | 未確認 | 資産可視化・資産診断から分析レポート・設計書を生成、ソース資産をブラウザで閲覧 | 中 | [NEC 公式 PDF](https://jpn.nec.com/SystemDirectorEnterprise/document/sde4mintrodetail.pdf) | 独立 | 直接 |
| F-02 | re:Modern | 伊藤忠テクノソリューションズ（CTC） | 日本 | 変換・モダナイゼーション支援（生成 AI） | COBOL→Java | 生成 AI が既存設計書と COBOL を解析し、変換後 Java にコメントとして反映 | 中 | [日本経済新聞](https://www.nikkei.com/article/DGXZRSP698666_Y5A021C2000000/) | 独立 | 薄い |
| F-03 | SI Object Browser シリーズ | システムインテグレータ | 日本 | 資産分析（DB オブジェクトのソース解析・可視化） | PL/SQL 等 DB オブジェクト | ストアド等のソース表示・SQL フォーマット・性能改善。5 製品横断の包括ライセンス（有償） | 中〜強 | [公式マニュアル](https://www.sint.co.jp/products/siob/online18/ob18vol3.html) | 独立（設計書生成との関連は薄い） | 周辺 |
| F-04 | astah* コードリバース（コードリバースプラグイン） | チェンジビジョン | 日本 | 資産分析（UML可視化プラグイン） | Java | ソース取り込みからクラス図を中心としたUMLモデルを自動生成、astah* UML/professionalに統合 | 中 | [公式](https://astah.change-vision.com/ja/feature/code-reverse-plugin.html) | 独立 | 周辺 |
| F-05 | Imagix 4D | Imagix Corporation（開発元・米国。日本は東陽テクニカが販売） | アメリカ（開発元。日本は販売代理） | 資産分析・設計書生成 | C/C++/Java | ソースコードを解析し設計ドキュメントを HTML・RTF・プレーンテキストで自動出力 | 強 | [東陽テクニカ](https://www.toyo.co.jp/ss/products/detail/imagix4d) | 独立（国は開発元で計上） | 直接 |
| F-06 | C/C++test（メトリクス計測機能） | Parasoft（開発元・米国。日本はテクマトリックスが販売） | アメリカ（開発元。日本は販売代理） | 資産分析（メトリクス計測） | C/C++ | 複雑度・結合度等のメトリクスレポート生成（設計書そのものではない） | 中 | [テクマトリックス](https://www.techmatrix.co.jp/product/ctest/staticanalysis/metrics.html) | 独立（国は開発元で計上） | 周辺 |
| F-07 | PGRelief（現 FUJITSU Software Agile+ Relief） | 富士通ソフトウェアテクノロジーズ | 日本 | 資産分析（静的解析＋品質可視化） | C/C++・Java | 静的解析によるプログラム欠陥検出と品質データの可視化（設計書そのものではない） | 中 | [公式FAQ](https://www.fujitsu.com/jp/about/faq/sfw-agilerelief/cpp/20290.html) | 独立 | 周辺 |
| F-08 | LaKeel Blu（現行解析エージェント） | ラキール | 日本 | 設計書生成（サービス／プラットフォーム） | COBOL・RPG・PL/SQL 等（完全な一覧は未確認） | 設計書の新規生成・最新化、構造図・依存関係図、システム要約ドキュメント、コードに基づく質問応答 | 中 | [公式](https://dx.lakeel.com/column/ai_code_to_design) | 独立 | 直接 |
| G-01 | ドキュメント再構築サービス | エイムネクスト | 日本 | 設計書生成（サービス） | 未確認 | 詳細設計書・機能仕様書・アーキテクチャ設計書・テスト文書 | 強 | [公式](https://www.aimnext.co.jp/service/reverse-engineering.html) | 独立 | 直接 |
| G-02 | 仕様書再生 | ソフトロード | 日本 | 設計書生成（ツール＋技術者併用） | 未確認 | システム概要図・画面遷移図・処理フロー図・ER 図・IF 仕様書・詳細設計書・画面/バッチ/帳票一覧 | 強 | [公式](https://www.softroad.co.jp/modernization/specification-recovery/) | 独立 | 直接 |
| G-03 | SysClinic | 新日本システック | 日本 | 資産分析・可視化（製品） | Java・C・C++・C#（JS・Python・PHP・VB は対応予定） | プログラム構成図・関数/変数関連図・フローチャート・シーケンス図・CRUD マトリクス・複雑度分析表 | 強 | [公式](https://www.snsystec.co.jp/products/sysclinic/) | 独立 | 周辺 |
| G-04 | Understand | テクマトリックス（開発元は米 SciTools） | 日本（開発元は米国） | 資産分析（静的解析製品） | C/C++・Java・VB.NET・C#・Python・JavaScript・TypeScript | クラス/ファイル/関数単位ドキュメント・依存関係図・Control Flow グラフ・クロスリファレンス・メトリクス | 強 | [公式](https://www.techmatrix.co.jp/product/understand/usecases/usecase_documentation.html) | 重複→H-02（同一製品のためアメリカに 1 件で計上） | 周辺 |
| G-05 | プログラム仕様可視化サービス | 日立製作所（アプリケーションサービス事業部） | 日本 | 資産分析・可視化（サービス） | COBOL・Java・ABAP | プログラム一覧表・画面一覧表・呼び出し関連図・CRUD 図・テーブル定義書・画面遷移図・ジョブフロー図 | 強 | [公式](https://www.hitachi.co.jp/products/it/appsvdiv/service/alm/program_visualization/index.html) | 重複→A-04（同一事業部で独立性未確認のため除外） | 対象外（重複相当） |
| D-01 | watsonx Code Assistant for Z | IBM | アメリカ | 業務ルール抽出 | COBOL・PL/I・REXX・Assembler・JCL | 変数の使われ方を遡って業務ルールを自然言語化、コード説明 | 強 | [IBM Docs](https://www.ibm.com/docs/en/watsonx/watsonx-code-assistant-4z) | 独立 | 直接 |
| D-02 | ADDI | IBM | アメリカ | 資産分析・業務ルール抽出 | COBOL・PL/I・Assembler 等 | 依存関係の図、影響分析、業務ルールの検索 | 強 | [IBM Docs](https://www.ibm.com/docs/en/addi/6.1.4?topic=guide-product-overview) | 独立 | 周辺 |
| D-03 | AWS Transform for mainframe | AWS | アメリカ | 資産分析・設計書・業務ルール・変換 | COBOL・PL/I・JCL・CICS・Assembler 等 | 依存グラフ、技術文書・機能文書、業務ロジック抽出、追跡可能な刷新ワークフロー | 強 | [AWS Docs](https://docs.aws.amazon.com/transform/latest/userguide/transform-app-mainframe.html) | 独立 | 直接 |
| D-04 | AWS Mainframe Modernization（Blu Age） | AWS | アメリカ | 変換・資産分析 | COBOL・PL/1・NATURAL・RPG/400・COBOL/400 | 依存分析（Blu Insights）、Java への変換、テストシナリオ管理 | 強 | [AWS Docs](https://docs.aws.amazon.com/m2/latest/userguide/refactoring-m2.html) | 独立 | 薄い |
| D-05 | Enterprise Analyzer | OpenText | アメリカ | 資産分析 | COBOL・PL/I・Natural・JCL・CICS BMS | コールグラフ・データフロー図・影響分析・コードスライシング | 強 | [製品ページ](https://10252761.microfocus.com/products/enterprise-suite/enterprise-analyzer/) | 独立 | 周辺 |
| D-06 | CAST Imaging | CAST Software | アメリカ | 資産分析 | 450 以上（自己申告） | ナレッジグラフ・アーキテクチャ図・データアクセス／API コールグラフ | 強（価格は中） | [公式](https://www.castsoftware.com/imaging/capabilities) | 独立 | 周辺 |
| D-07 | CAST Highlight | CAST Software | アメリカ | ポートフォリオ診断 | 60 以上 | クラウド適合度・技術的負債・OSS リスクの横断診断 | 強（価格は中） | [公式](https://www.castsoftware.com/highlight) | 独立 | 周辺 |
| D-08 | vFunction | vFunction | アメリカ | 資産分析・分解 | Java・.NET | ドメインマップ・依存グラフ・ドリフト検知（静的＋動的） | 強（価格は中） | [公式](https://vfunction.com/platform/) | 独立 | 周辺 |
| D-09 | Imogen | Mechanical Orchard | アメリカ | 変換（挙動ベース） | メインフレーム言語 | 入出力から導いた挙動仕様、依存マップ、検証ループ | 強 | [公式](https://www.mechanical-orchard.com/platform) | 独立 | 薄い |
| D-10 | Mainframe Assessment Tool＋Gemini Code Assist／Dual Run | Google Cloud | アメリカ | 資産分析・業務ルール・変換 | COBOL 等 | アセスメント、業務ルール抽出、Java 変換、新旧並行実行の比較 | 強 | [Google Cloud Docs](https://docs.cloud.google.com/mainframe-assessment-tool/docs/mainframe-modernization-overview) | 独立 | 直接 |
| D-11 | Azure Migrate: Application and Code Assessment | Microsoft | アメリカ | 資産分析（無料） | .NET・Java | 依存関係ダッシュボード、移行課題レポート | 強 | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/migrate/appcat/overview?view=migrate) | 独立 | 周辺 |
| D-12 | AI-powered mainframe modernization（Bridge／AI Assistant for Z） | Kyndryl | アメリカ | 設計書生成・変換（サービス） | z/OS の言語 | 生成 AI の文書を専門家が補強、Java 等への変換 | 強 | [公式](https://www.kyndryl.com/us/en/services/mainframe/modernization/ai-powered) | 独立 | 直接 |
| E-01 | DeepWiki | Cognition | アメリカ | コード Wiki 生成 | 言語非依存 | トピック別 Wiki・アーキテクチャ図・ソースリンク・Q&A | 中 | [公式](https://cognition.com/blog/deepwiki) | 独立 | 直接 |
| E-02 | Swimm | Swimm | アメリカ | 文書の保守 | 多言語（一覧は未確認） | コード片に紐づく文書・依存／フロー図・陳腐化の検知 | 中 | [公式](https://swimm.io/pricing) | 独立 | 周辺 |
| E-03 | Mintlify | Mintlify | アメリカ | 文書の保守 | API・コードベース | 文書サイト・API プレイグラウンド・PR での自動更新 | 強 | [公式](https://mintlify.com/pricing) | 独立 | 周辺 |
| E-04 | Sourcegraph Cody | Sourcegraph | アメリカ | コード Q&A | 主要言語 | 根拠（ファイル・シンボル）付きのチャット回答 | 強 | [公式](https://sourcegraph.com/docs/cody) | 独立 | 薄い |
| E-05 | GitHub Copilot（レビュー・文書機能） | GitHub（Microsoft） | アメリカ | Q&A・レビュー | GitHub 対応の全言語 | PR レビュー・コミットメッセージ・リポジトリ横断チャット | 強 | [Changelog](https://github.blog/changelog/2026-09-18-copilot-code-review-an-improved-review-experience/) | 独立 | 薄い |
| E-06 | Windsurf（旧 Codeium） | Cognition | アメリカ | エージェント型 IDE | 主要言語 | 複数ファイルの編集・コードベースの理解 | 中 | [cloudzero](https://www.cloudzero.com/blog/windsurf-pricing/) | 独立 | 薄い |
| E-07 | Tabnine | Tabnine（Tricentis 傘下） | アメリカ | 補完・Q&A | 80 以上 | コード・文書・チケットを跨ぐナレッジグラフ | 強 | [Tricentis](https://www.tricentis.com/news/tricentis-acquires-tabnine) | 独立 | 薄い |
| E-08 | Greptile | Greptile | アメリカ | コードレビュー | 未確認 | リポジトリ全体のグラフに基づく PR レビュー | 強（性能値は弱） | [公式](https://www.greptile.com/pricing) | 独立 | 薄い |
| E-09 | Glean（for code） | Glean Technologies | アメリカ | Q&A・企業検索 | GitHub/GitLab/Bitbucket の全言語 | ファイル・diff・参照箇所を示す回答、ドラフト PR | 強 | [Glean Docs](https://docs.glean.com/user-guide/assistant/code-search) | 独立 | 薄い |
| E-10 | Qodo（旧 CodiumAI） | Qodo | アメリカ | テスト生成・レビュー | 複数（一覧は未確認） | 振る舞い仕様に基づくテスト生成、PR レビュー | 強 | [公式](https://www.qodo.ai/pricing/) | 独立 | 薄い |
| E-11 | Augment Code | Augment Computing | アメリカ | Q&A・コンテキストエンジン | 主要言語 | リポジトリ全体の索引・チャット・PR レビュー | 強 | [公式](https://www.augmentcode.com/pricing) | 独立 | 薄い |
| E-12 | Driver AI | Driver | アメリカ | 文書の保守 | 複数（一覧は未確認） | テンプレート型の技術文書、GitHub との同期 | 中 | [TechCrunch](https://techcrunch.com/2024/10/08/driver-launches-an-ai-powered-platform-for-creating-technical-documentation/) | 独立 | 周辺 |
| H-01 | DocuWriter.ai | DocuWriter.ai | アメリカ | 設計書生成（SaaS） | TypeScript・JavaScript・Python・Go・Java・PHP・Ruby・C#・Rust・Swift・Kotlin 等 | API リファレンス・README・アーキテクチャ文書・UML 図・ドキュメントツリー | 中 | [公式](https://www.docuwriter.ai/ai-code-documentation-generator) | 独立 | 直接 |
| H-02 | Understand | SciTools（日本はテクマトリックスが販売） | アメリカ | 静的解析・設計文書生成 | C/C++・Java・Python・Ada・Fortran 等 | 依存関係図・呼び出しグラフ・コントロールフロー図・データディクショナリ・メトリクス・コンプライアンスレポート | 強 | [公式](https://scitools.com/static-code-analysis) | 独立（jp-e の G-04 と同一製品として統合） | 周辺 |
| H-03 | Kodesage | Kodesage, Inc. | アメリカ | レガシー資産理解・設計文書生成 | COBOL・PL/SQL・Oracle Forms・PowerBuilder・RPG 等 | 自動生成ドキュメント・システム/依存関係の可視化図・チケット/タスク分解資料 | 強（商用性）／中（詳細） | [公式](https://kodesage.ai/) | 独立 | 直接 |
| H-04 | Mutable.ai（Auto Wiki） | Mutable AI, Inc. | アメリカ | コード Wiki 生成 | 言語非依存（React 等 JS/TS 実例あり） | Wikipedia 形式の Wiki 記事・Mermaid 図・行単位の出典リンク | 中 | [公式ブログ](https://blog.mutable.ai/p/auto-wiki-v2) | 独立 | 直接 |
| H-05 | GitLoop | GitLoop | アメリカ | コードベースアシスタント＋設計文書生成 | 言語非依存（Web/JS 系の利用例あり） | 機能単位のドキュメント・PR レビューコメント・単体テスト | 中 | [公式](https://www.gitloop.com/feature/generate-documentation) | 独立 | 直接 |
| I-01 | IBM Engineering Lifecycle Management（ELM／Rational 系譜） | IBM | アメリカ | トレーサビリティ・影響分析 | 言語非依存（OSLC でリンク） | 要件⇔設計⇔コード⇔テストのトレーサビリティリンク集・影響分析ビュー（仕様書そのものの自動生成ではない） | 強 | [公式](https://www.ibm.com/products/engineering-lifecycle-management) | 独立 | 周辺 |
| I-02 | Coverity | Black Duck, Inc.（2024年に Synopsys のソフトウェアインテグリティ事業が独立） | アメリカ | 静的解析（欠陥・脆弱性検出） | C/C++・Java・C#・JavaScript/TypeScript・Python 等 | 静的解析による欠陥・脆弱性検出レポート、MISRA 等のコンプライアンスレポート | 中 | [Synopsys→Black Duck](https://www.synopsys.com/software-integrity/security-testing/static-analysis-sast.html) | 独立 | 周辺 |

### 1-3. 補充（F: 2026-09-26、`jp-d-supplement.md`）

- 追加 3 件（重複無し）: F-01 SystemDirector Enterprise for Modernization（NEC）／F-02 re:Modern（伊藤忠テクノソリューションズ）／F-03 SI Object Browser シリーズ（システムインテグレータ）。詳細は `jp-d-supplement.md`
- 日本の合計は 39 件（重複除外後 35 件）に更新。「重複・販売終了・未確認を除いた厳密な数」は **29 件→32 件**（30 件の目標を満たす側に転じた）
- 3 件とも WebFetch による官式ページの直接確認は 403 またはリダイレクトで失敗し、Web 検索が索引した公式ドメインの内容で代替した（根拠は中〜強。詳細と限界は `jp-d-supplement.md` の「未検証・要判断の注記」）。F-03 は DB オブジェクトのソース解析が中心で、アプリケーション設計書生成との関連は薄い

### 1-4. 入れ替え追加（G: `jp-e-replace.md`、H: `us-f-replace.md`、2026-09-26）

- 日本に G-01〜G-03（3 件、重複無し）を追加。G-04（Understand）は H-02 と同一製品のためアメリカ側に統合、G-05（日立）は A-04 と重複扱いで除外
- アメリカに H-01〜H-05（5 件、重複無し）を追加
- 日本の合計は 44 件（重複除外後 38 件）、アメリカの合計は 29 件（重複除外後 29 件）に更新（1-1）
- 関連度で絞ると（1-1a）日本 27 件・アメリカ 19 件で、目標（日本 30・アメリカ 20）にどちらも届かない

### 1-5. 最終補充（F-04〜F-07: `jp-f-fill.md`、I-01〜I-02: `us-g-fill.md`、2026-09-26）

- 日本に F-04 astah* コードリバース（チェンジビジョン）・F-07 PGRelief（現 Agile+ Relief、富士通ソフトウェアテクノロジーズ）を追加（いずれも周辺、開発元が日本）
- F-05 Imagix 4D・F-06 C/C++test（メトリクス計測機能）は `jp-f-fill.md` で調査した製品だが、**国は開発元で数える**方針により、開発元が米国（Imagix Corporation／Parasoft）のためアメリカの件数に計上した
- アメリカに IBM Engineering Lifecycle Management・Coverity を追加。`us-g-fill.md` はファイル内で ID を付けていないが、README の統合表では G が `jp-e-replace.md` に既存のため、新規に I-01・I-02 を付与した

### 1-6. 市場調査最後の1件（F-08: `jp-f-fill.md` 追加ラウンド、2026-09-26）

- 日本に F-08 LaKeel Blu（現行解析エージェント、株式会社ラキール）を追加（直接、重複無し）。ソースコード・既存設計書を入力に設計書の新規生成・最新化、構造図・依存関係図、要約ドキュメントを出力する有償のエンタープライズ向けサービス
- 日本の合計は 46 件→47 件（重複除外後 40 件→41 件）に更新（1-1）。関連度で絞ると（1-1a）直接 19→20 件、調査件数（直接＋周辺）は 29 件→30 件で、目標 30 件以上をちょうど満たす側に転じた
- 出典は公式ドメイン（dx.lakeel.com）の一次ページを WebFetch で直接確認（根拠: 中。価格・対応言語の完全なリストは未確認）
- 日本の合計は 46 件（重複除外後 40 件）、アメリカの合計は 33 件（重複除外後 33 件）に更新（1-1）
- 関連度で絞ると（1-1a）日本 29 件（未達 -1）・アメリカ 23 件（達成 +3）。アメリカは今回の補充で目標達成に転じたが、日本は依然未達
- 見送った候補: Web Performer（キヤノンITソリューションズ）はフォワード生成（設計情報→コード・仕様書）が中心と判断し却下（詳細は `jp-f-fill.md` 5節）。米側は Structure101・Lattix・Code Climate・NDepend（仏）・CodeScene（スウェーデン）・Sonar（スイス）・Moderne が未確認または対象外（詳細は `us-g-fill.md`）

---

## 2. 機能マトリクス（Spec2Doc と代表 16 製品）

凡例: ○＝調査ファイルに記載あり／△＝一部だけ（注記）／×＝無い（Spec2Doc は要件・コードで確認、他製品はファイルに「対象外」「無い」と明記がある場合だけ）／未確認＝調査ファイルに記載が無い。**未確認は「無い」ではない**。

列の略号: S2D＝Spec2Doc、富士通＝A-01、NRI＝A-07、VSSD＝A-12、Trinity＝B-01、CP2＝CasePlayer2（B-02）、ウェイン＝B-06、SHIFT＝B-09、東芝＝C-07、Codeledge＝C-10、Autify＝C-11、ADDI＝D-02、AWS-T＝D-03、CAST＝D-06、DeepWiki＝E-01、Swimm＝E-02、Cody＝E-04

| 観点 | S2D | 富士通 | NRI | VSSD | Trinity | CP2 | ウェイン | SHIFT | 東芝 | Codeledge | Autify | ADDI | AWS-T | CAST | DeepWiki | Swimm | Cody |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 業務ルール抽出 | △¹ | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | ○ | 未確認 | 未確認 | 未確認 | ○ | ○ | 未確認 | 未確認 | ○ | 未確認 |
| CRUD 図・データ系譜 | ×² | 未確認 | 未確認 | ○ | ○ | 未確認 | ○ | △（データ項目辞書・DB 仕様） | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | ○ | 未確認 | 未確認 | 未確認 |
| 画面遷移図 | △³ | 未確認 | 未確認 | △（半自動） | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 |
| 依存・呼び出しグラフ図 | △⁴ | 未確認 | ○ | ○ | ○ | 未確認 | ○ | ○ | 未確認 | △（シーケンス図） | 未確認 | ○ | ○ | ○ | ○ | ○ | 未確認 |
| 影響分析 | ×⁵ | 未確認 | ○ | ○ | 未確認 | 未確認 | ○ | 未確認 | 未確認 | 未確認 | 未確認 | ○ | 未確認 | 未確認 | 未確認 | △（変更検知） | 未確認 |
| トレーサビリティ（記述→ソース行） | ○⁶ | 未確認 | 未確認 | 未確認 | 未確認 | ○ | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | △（要求→生成物） | 未確認 | ○ | ○ | ○ |
| 差分・再生成時の変更表示 | △⁷ | 未確認 | 未確認 | △（影響アラート） | △（自動更新） | 未確認 | ○（版の比較） | 未確認 | 未確認 | △（更新履歴） | 未確認 | △ | 未確認 | 未確認 | 未確認 | ○ | 未確認 |
| Q&A・チャット | × | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | △（検索） | 未確認 | 未確認 | ○ | ○ | ○ |
| テスト観点・テストケース生成 | △⁸ | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | ○ | 未確認 | ○ | 未確認 | ○ | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 |
| 既存文書（README・コメント）の取り込み | ×⁹ | 未確認 | ○ | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | △（仕様書を入力） | 未確認 | 未確認 | △（文書の追記） | 未確認 | 未確認 | 未確認 |
| 自動度の明示（自動・半自動） | △¹⁰ | 未確認 | 未確認 | ○ | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 |
| 人のレビュー組み込み | △¹¹ | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | ○ | △（編集） | 未確認 | 未確認 | ○ | △（追記・共有） | 未確認 | ○ | 未確認 |
| 根拠提示・ハルシネーション対策 | ○¹² | △（知識グラフ＋RAG） | 未確認 | 未確認 | 未確認 | ○（ソース相互参照） | 未確認 | 未確認 | △（技術者の検証） | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | ○ | ○ | ○ |
| 閲覧 UI（ソース並置・Wiki 型ナビ） | △¹³ | 未確認 | 未確認 | △（ツール内） | △（ツリー表示） | ○（並置） | 未確認 | △（ダッシュボード） | 未確認 | 未確認 | 未確認 | △（ダッシュボード） | 未確認 | △（グラフ探索） | ○（Wiki） | ○（IDE で並置） | △（チャット） |
| 出力形式 | MD・HTML・docx・xlsx | 設計書（形式は未確認） | 資料（未確認） | ツール内の設計書 | 約 30 種の設計書 | 仕様書ブラウザ | 図・レポート | 46 種・ダッシュボード | 顧客指定の様式 | Web 文書・図 | シナリオ・Playwright コード | ダッシュボード・レポート | コンソール上の文書・図 | Web UI | Web Wiki | IDE 内の文書 | チャット |
| 言語数 | 4 | 未確認 | 未確認 | 9 | 4（COBOL はオプション） | 2 | 11 | 2（2 言語予定） | 10 | 未確認 | 未確認 | 未確認 | 5 以上 | 450 以上（自己申告） | 非依存 | 未確認 | 未確認 |

Spec2Doc の判定根拠:
1. 構文パターン（if/switch・代入・classList）止まり（`PLAN.md` 割り切り、REQ-F-009・010・036）
2. D04 の「DB スキーマ・CRUD 図」は第 2 リリース（要件の生成ドキュメント表）
3. D03 は画面遷移表だけで、図は出していない（`src/generate/d03.ts` は表だけ。`src/` に mermaid・svg 図の生成は無い）。要件の D03 の内容には「画面遷移（遷移表と図）」とある
4. 呼び出し関係は抽出している（REQ-F-006）。D11・D12 は表で出しており、図は無い
5. 記述→ソース・ソース→記述の対応表（REQ-F-023）はあるが、変更の波及を求める機能は無い
6. REQ-F-017（事実・推測・不明のラベル）、REQ-F-023・D08（対応表）
7. 改版履歴は生成日時とコミットだけ。「前回から変わった章」は後回し（`PLAN.md`、REQ-F-035 は Could）
8. 観点は ○（REQ-F-031 の 7 観点、REQ-F-033 の境界の具体例）、テストケースは生成しない
9. `src/analyze`・`src/generate`・`src/ir` に JSDoc・コメント・README を読む処理が無い（grep で 0 件）
10. 記述ごとの事実・推測・不明はあるが、文書・節ごとの自動度は出していない
11. D09 確認事項一覧（質問票）はあるが、回答を記録して次回に反映する仕組みは無い
12. REQ-F-017 のラベル、LLM は既定で無効（REQ-F-029）
13. HTML 出力は目次と本文の 2 ペイン（`src/render/html.ts`）。ソースは並べて表示しない

---

## 3. 改修候補

効果の欄: 【テ】＝テスト設計者、【移】＝移行担当。手間: S＝既存の IR だけで出せる（数日）／M＝IR の拡張か新しい描画が要る／L＝新しい解析・LLM・UI の組み合わせが要る（どれも目安で、実測ではない）。

| ID | 候補 | 参考にした製品（件数: 名称） | 効果 | 手間 | 要件との整合 | 対象外・禁止との衝突 |
|---|---|---|---|---|---|---|
| K-01 | **画面遷移図**: D03 の遷移表から図を描く（MD は Mermaid のテキスト、HTML は依存を増やさずインラインの SVG。docx・xlsx は表のまま） | 1: VSSD（半自動）。近縁の自動図: DeepWiki・Swimm | 【テ】状態遷移テスト・画面遷移を網羅する起点が一目で分かる【移】画面数と導線の全体をつかめる | M | REQ-F-007・D03 を強化。**要件の D03 の内容は「遷移表と図」で、図が未達**。この未達を埋める | なし |
| K-02 | **依存・呼び出しグラフ図**: モジュールの依存（D11）と関数の呼び出し（D12）を図にする。K-01 と同じ描画部品を使う | 15: NRI・VSSD・Trinity・ウェイン・SHIFT・ADDI・AWS Transform・Blu Age・Enterprise Analyzer・CAST Imaging・vFunction・Azure Migrate・DeepWiki・Swimm・Codeledge | 【テ】結合テストの組み合わせを決めやすい【移】移行単位の切り出し、密結合の把握 | M | REQ-F-006（抽出済み）、REQ-F-038・039（D11・D12）を強化 | なし |
| K-03 | **変更影響分析**: 関数・ファイル・画面部品を指定すると、呼び出し元をたどって影響を受ける関数・画面・連携と D0x の記述を一覧にする（静的解析だけ） | 7: NRI・VSSD・ウェイン・ADDI・Enterprise Analyzer・Jitera・Re:Zolver（販売終了） | 【テ】回帰テストの範囲に根拠が付く【移】改修・移行したときの波及を見積もれる | M | 新規。REQ-F-023 の逆引き表と REQ-F-006 の呼び出し関係を使う | なし（コードを実行しない） |
| K-04 | **前回との差分表示（手動実行）**: 利用者が前回の実行結果を指定して生成すると、前回の `ir.json` と比べて、変わった章・記述・追加・削除を改版履歴と各文書に示す | 10: ウェイン（版の比較）・Swimm・AppDocOne・Codeledge・Trinity・Mintlify・Driver・ADDI・vFunction・CSCA。自動で起動する方式は採らず、「変更を見せる」点だけを参考にする | 【テ】変わった箇所だけを再レビュー・再テストできる【移】並行して改修が続く現行システムを追える | M | REQ-F-035（Could）の未実装部分「前回の生成から変わった章」を実装 | 定時実行・コード変更での自動更新は禁止。**利用者が手で実行したときだけ比較する**ので衝突しない |
| K-05 | **ソース並置ビュー**: HTML 出力と Web 画面で、記述の根拠位置を押すと該当するソース断片を横に表示する | 5: CasePlayer2・Swimm・DeepWiki・Cody・Glean | 【テ】「事実」の記述をその場で確かめられ、D09 に送る判断が速い【移】同じ | M | REQ-F-017・023・027 を強化 | 出力にソース断片を埋め込むので、REQ-F-018 の秘密情報のマスクを同じく通すこと |
| K-06 | **CRUD 図**: 関数・画面 × データ（ブラウザ保存域のキー・API エンドポイント・型）の作成・参照・更新・削除の表 | 3: VSSD・Trinity・ウェイン。近縁: CAST Imaging（データアクセス）・SHIFT（データ項目辞書） | 【テ】データ観点のテスト（CRUD の網羅）を作れる【移】データ移行の影響範囲 | M | D04 の後続（第 2 リリース）「CRUD 図」の前倒し。REQ-F-013・014 を強化 | なし（リリース計画の変更なので要判断） |
| K-07 | **テストケースの雛形**: REQ-F-031 の 7 観点と REQ-F-033・034 の境界の具体例から、テストケース表（ID・前提・入力・期待結果・根拠）を xlsx で出す。実行はしない | 7: 東芝 AI-no-te・ウェイン・Autify Nexus・tsuzumi・Jitera・Qodo・Blu Age | 【テ】観点からケースにする手間が減る【移】現新比較テストの入力になる | M | REQ-F-031・033・034 を強化（新しい出力） | テストの実行は動的解析に当たるので行わない。表を生成するだけ |
| K-08 | **自動度・確度のサマリ**: 各文書・各節の冒頭に、事実・推測・不明の件数と比率、D09 の件数を出す | 3: VSSD（自動／半自動を分ける）。指標の立て方の参考: クレスコ・富士通 Application Transform（どちらも数値は引用しない） | 【テ】人が確かめるべき節の優先順位が分かる【移】見積もりの確度を説明できる | S | REQ-F-017・025、D08 を強化 | なし |
| K-09 | **既存文書・コメントの取り込み**: JSDoc・コメント・リポジトリ内の README を「既存の記述」として根拠位置付きで併記し、実装と食い違う点を D09 に送る | 6: NRI・CAST Imaging・Tabnine・Driver・Glean・CSCA | 【テ】意図と実装のずれが確認事項になる【移】暗黙知を回収できる | M | 新規。REQ-F-017 のラベル（事実・推測・不明）に種類を足すかどうかは要件の変更で、要判断 | 取り込むのは解析対象のリポジトリにある文書で、生成文書ではない。「生成文書を手で直した内容の再取り込み」とは別物だと明記する。README に秘密が含まれうるので REQ-F-018 を通す |
| K-10 | **Q&A**: 生成済みの IR と文書に質問すると、根拠位置を必ず付けて答える | 10: DeepWiki・Swimm・Mintlify・Cody・Glean・Jitera・Augment・Windsurf・Copilot・ADDI（検索） | 【テ】仕様の問い合わせに答えを得られる【移】同じ | L | 新規。REQ-F-016（LLM）の上に作る | LLM は既定で無効、ソースを外部に送る（REQ-F-029・030）。1 人利用なら複数人の対象外には当たらない |
| K-11 | **業務ルール抽出の深化**: 変数の使われ方を遡り、条件・計算・代入を業務ルール候補として束ねる | 8: watsonx Code Assistant for Z・ADDI・AWS Transform・Google MAT・Swimm・SHIFT・Enterprise Analyzer・PROGRESSION | 【テ】デシジョンテーブルの入力になる【移】移行後に同じ動きかを確かめる基準 | L | REQ-F-009・010・034・036 を強化 | なし（静的解析だけ） |
| K-12 | **出力様式のカスタマイズ**: 章立て・列名・文書の組み合わせを利用者の様式に合わせる | 5: NTT データ設計書リカバリー・東芝 AI-no-te・TISI・Driver・SIMPLIA DF-COBDOC | 【移】顧客の既存様式で納められる【テ】既存のテスト設計書の書式に合う | L | REQ-F-020・021 を強化（新規の設定） | なし |
| K-13 | **重複・不要資産の検出**: 重複した関数・コンポーネント、使われていないファイルを移行論点に加える | 5: AWS Transform（重複・欠落の検出）・アクセンチュア（不要プログラムの削除）・vFunction（重複クラス・デッドコード）・日立（棚卸）・CAST Highlight | 【移】移行対象を減らせる【テ】テスト対象から外す根拠 | M | REQ-F-024（Should）・D07 を強化 | なし |
| K-14 | **D09 の回答記録**: 確認事項への回答を別ファイルに記録し、次に生成するとき「確認済み」と表示する（生成文書の本文は書き換えない） | 5: 東芝・TISI・クレスコ・Kyndryl・AWS Transform | 【テ】質問票の回収状況を追える【移】確認済みの範囲を示せる | M | REQ-F-025 を強化 | 「生成文書を手で直した内容の再取り込み（対象外）」に近い。回答を別ファイルで持つ方式なら当たらないと整理できるかは要判断 |
| K-15 | **複数リポジトリの簡易診断**: 複数のリポジトリを軽く走査し、規模・依存・移行論点を 1 表にする | 3: CAST Highlight・Azure Migrate・Blu Insights | 【移】移行の優先順位を決められる | L | 新規（スコープの拡大） | なし（範囲が広がるので要判断） |
| K-16 | **IR の MCP 提供**: `ir.json` と生成文書を MCP で AI ツールから引けるようにする | 5: DeepWiki・Mintlify・Driver・Augment・watsonx Code Assistant for Z | 【テ】AI ツールで仕様を引ける | M | 新規 | 自端末（127.0.0.1）だけで使うなら衝突しない |

### 3-1. 除外した候補

| 除外した機能 | 見られた製品 | 除外の理由 | 代わりに採るもの |
|---|---|---|---|
| 動的解析による挙動仕様の生成 | Imogen・Google Dual Run・vFunction（動的データの収集）・AppDocOne（稼働中のアプリから生成） | 要件の対象外（動的解析。解析対象のコードは実行しない） | なし |
| 本番データを使った検証 | Google Dual Run・Imogen（本番のデータフロー） | 要件の対象外（本番データベースへの接続・実データの参照） | なし |
| コード変換・移行先コードの生成 | PROGRESSION・Migrator C2J・MAJALIS・Blu Age・Google（Gemini での変換）・Kyndryl・ClearPath Portal・東芝（言語変換）・tsuzumi（脱 COBOL） | 要件の対象外（移行そのもの） | なし |
| テストの自動実行・自己修復 | Autify Nexus・tsuzumi（テストの実行） | 実行を伴うので動的解析に当たる | K-07（表の生成だけ） |
| 定時実行による再生成 | Trinity（スケジューラ） | 保守者の規約で禁止（定時実行） | K-04（手動実行の差分表示） |
| コミット・PR の検知による文書の自動更新 | Codeledge・Mintlify・Driver・Swimm（PR で更新を強制） | 保守者の規約で禁止（イベント購読・コード変更をきっかけにした自動更新） | K-04 |
| CI 連携での自動実行 | 日立（CI を使ったマイグレーション開発） | 保守者の規約で禁止（CI の自動起動）。要件の対象外（CI からの自動起動） | K-04 |
| PR の自動レビュー | Copilot・Greptile・Qodo Merge・Augment Code Review | 保守者の規約で禁止（PR のイベント購読）。分野も違う（コードレビュー） | なし |
| アーキテクチャのずれの常時監視 | vFunction（Architectural Observability Manager） | 保守者の規約で禁止（定時実行に当たる） | K-04 |
| 複数人の利用・認証・チームでの共有 | VSSD（チームで同じリポジトリ）・Codeledge（誰がいつ更新）・Glean・Swimm・Mintlify（SSO） | 要件の対象外（複数人の同時利用・利用者認証） | なし |

---

## 4. 推奨（第 1 弾で入れる）

効果（テスト設計者・移行担当に直接効くか、参考製品の数）と手間（S・M）を並べ、L は外した。

| 順 | 候補 | 手間 | 選んだ理由 |
|---|---|---|---|
| 1 | K-01 画面遷移図 | M | 要件の D03 の内容（遷移表と図）に対して図が未達で、新機能ではなく未達を埋めるもの。K-02 と描画部品を共有できる |
| 2 | K-04 前回との差分表示（手動実行） | M | REQ-F-035 の未実装部分を埋める。禁止されている自動更新の、規約上許される代わりで、参考製品が 10 件と多い |
| 3 | K-03 変更影響分析 | M | 回帰テストの範囲を決める根拠になり、テスト設計者への効果が最も直接的。既存の呼び出し関係と逆引き表で作れる |
| 4 | K-02 依存・呼び出しグラフ図 | M | 参考製品が 15 件と最も多く、市場の標準機能。K-01 の描画部品を使うので、追加の手間は小さい |
| 5 | K-05 ソース並置ビュー | M | Spec2Doc の強み（記述ごとの根拠）を閲覧の場で使えるようにする。事実ラベルの検証が速くなる |
| 6 | K-07 テストケースの雛形 | M | 既にある 7 観点と境界の具体例を、そのままテストケースの形にするだけ。実行はしないので要件に触れない |
| 7 | K-08 自動度・確度のサマリ | S | 手間が最も小さく、人が確かめる順番を示せる。既存のラベルを数えるだけ |

外したもの（1 行ずつ）:
- K-06 CRUD 図: 要件で第 2 リリースと決まっている。前倒しするかは保守者の判断
- K-09 既存文書の取り込みと K-14 D09 の回答記録: ラベル体系の変更と、ラウンドトリップとの境界の判断が要る
- K-10 Q&A・K-11 業務ルール抽出の深化・K-12 様式カスタマイズ・K-15 複数リポジトリの診断: 手間が L
- K-13 重複の検出・K-16 MCP 提供: 効果が移行担当に偏るか、効果の根拠が弱い

---

## 5. 引用してはいけない数値

ベンダーの自己申告、スニペット経由、または第三者検証の無い数値。訴求・見積もり・比較表に使わない。使うなら、一次資料と測定条件を確かめてから。

| 数値 | 対象 | 引用してはいけない理由 |
|---|---|---|
| 網羅性 +95%・可読性 +60%（生成 AI だけの場合との比較）、作業時間 1/30 | 富士通 Application Transform（A-02） | ベンダーの自己申告。比較条件・測り方が不明。C 側は公式ページを取得できず（429）、スニペットだけ |
| システムの全体像の把握が数か月→数日 | 富士通 Application Transform（C-01） | 検索スニペットだけで、本文は未取得 |
| 人手比で約 50% 効率化、品質が約 40% 改善（ソースだけから生成した場合との比較） | 富士通 資産分析・可視化（A-01） | ベンダーの自己申告。測り方が不明 |
| ソースの 100% 自動解析 | NTT データ 設計書リカバリー（A-05） | 標榜の文言。範囲・条件が不明 |
| 初版の完成度 90% | クレスコ（C-06） | 自社実績で、外部の検証が無い |
| コスト・期間を約 50% 削減 | 東芝 AI-no-te（C-07） | 自社の主張で、外部の検証が無い |
| 数十メガステップの COBOL で学習 | NTT データ tsuzumi（C-03） | 報道だけ（2024 年時点）。商用化の状況は未確認 |
| 数万行を数秒でチャート化、1 ファイル約 0.8 秒の転送 | CasePlayer2（B-02）・Trinity（B-01） | ベンダーの性能値。測定環境が不明 |
| バグ検出率 82% | Greptile（E-08） | 比較記事（アグリゲータ）の第三者ベンチマーク。公式・再現検証は無い |
| 新しいコードベースを理解する速度が 50% 向上 | Driver AI（E-12） | ベンダーの主張 |
| 5,000 社超・年間 2,000 万人の開発者 | Mintlify（E-03） | ベンダーの規模訴求 |
| 5 万以上のリポジトリを索引済み | DeepWiki（E-01） | ベンダーの主張。根拠は中〜弱のアグリゲータ |
| 行数無制限（数百万行）、40 万ファイル規模 | Swimm（E-02）・Augment Code（E-11） | ベンダーの主張 |
| 450 以上の言語・FW・DB | CAST Imaging（D-06） | ベンダーの自己申告（対応の深さは不明） |
| 価格（CAST Imaging $10,200〜/年、CAST Highlight $6,800〜/年、vFunction $28,000〜 等） | D-06・D-07・D-08 | 検索スニペット経由の中程度の確度。公式の価格ページで確かめるまでは使わない |
| Windsurf Pro の $15→$20 改定 | E-06 | アグリゲータ記事だけ |

数値ではないが、断定して引用しないもの:
- **Cognition による Windsurf の買収**: `windsurf.com/pricing` が `devin.ai/pricing` に転送されることから推測しただけで、一次資料は未確認
- **Tabnine が Tricentis の傘下に入った時期**: E ファイルの中で「2026 年 8 月より」（表）と「2026 年 7 月 30 日買収」（本文）が食い違う。買収そのものは公式ニュースで確認済み
- **VSSD の提供元**: A は「データクレーション」、B は「第一コンピュータリソース」と食い違う（URL は同じ）
- **DigKnow は DNP のカーブアウト**: 伝聞で、未検証
- **富士通 CSCA・アルゴマティックの事例**: 商用で提供されているかは未確認。「競合製品」として数えるときは注記する

---

## 6. 入れ替え調査で追加された示唆

- JS/TS/Web 対応を明記する国内製品は無く（SysClinic は対応予定止まり）、米国 Understand のみ明記。Spec2Doc の JS/TS/HTML 正式対応は市場で希少な優位点（G-03・G-04）
- 「使われている範囲だけを文書化する」（ソフトロード 仕様書再生）は、Spec2Doc の出力を絞るオプションの設計根拠になる（G-02）
- MCP サーバで AI ツールから文書を引かせる方式（DocuWriter.ai）は、K-16（IR の MCP 提供）の実例として使える（H-01）
- 「継続更新される知識レイヤー」（Kodesage）と行単位の出典リンク付き Wiki（Mutable.ai）は、K-04 の差分表示・K-05 のソース並置ビューの参考になる（H-03・H-04）
- Understand のローカル LLM（Ollama/Llama3）実行対応は、Spec2Doc のデプロイ形態（ローカル vs SaaS）検討の比較対象になる（G-04）
