# 市場調査（US・領域D）レガシーアプリ・モダナイゼーション（ソース逆生成系）

- 調査日: 2026-09-26
- 対象: ソースコードを文書・仕様書・業務ルール・アーキテクチャビューへ逆生成する米国企業の製品・サービス
- 手法: WebSearch のみ（WebFetch は不使用、公式サイト・ドキュメント・データシートの検索結果スニペットで確認）。WebSearch/WebFetch 合計 19 回使用（上限 20 回）
- 数値・仕様は一次情報（公式サイト・公式ドキュメント・データシート）を優先。二次情報（比較記事・レビューサイト）のみの場合は根拠を「報道・記事」と明記
- 不明点は「未確認」と記載し、推測で埋めていない

## サマリー表

| No | 名称 | 提供元 | 分類 | 対象言語 | 出力の要点 | 出典 |
|---|---|---|---|---|---|---|
| 1 | watsonx Code Assistant for Z | IBM | 業務ルール抽出／設計書生成（部分） | COBOL, PL/I, REXX, Assembler, JCL | 業務ルールの自然言語記述、コード説明 | [IBM Docs](https://www.ibm.com/docs/en/watsonx/watsonx-code-assistant-4z) |
| 2 | Application Discovery and Delivery Intelligence (ADDI) | IBM | 資産分析・可視化／業務ルール抽出 | COBOL, PL/I, Assembler 等メインフレーム言語 | 依存関係の可視化、影響分析、業務ルール検索 | [IBM Docs](https://www.ibm.com/docs/en/addi/6.1.4?topic=guide-product-overview) |
| 3 | AWS Transform for mainframe | AWS | 資産分析・可視化／設計書生成／業務ルール抽出／変換 | COBOL, PL/I, JCL, CICS, Assembler 等 | 依存グラフ、技術文書・機能文書の自動生成、業務ロジック抽出、コード変換 | [AWS Docs](https://docs.aws.amazon.com/transform/latest/userguide/transform-app-mainframe.html) |
| 4 | AWS Mainframe Modernization（Blu Age Analyzer／Refactor） | AWS | 変換（自動リファクタリング）／資産分析 | COBOL, PL/1, NATURAL, RPG/400, COBOL/400 | 依存分析（Blu Insights）、Java への自動変換 | [AWS Docs](https://docs.aws.amazon.com/m2/latest/userguide/refactoring-m2.html) |
| 5 | Enterprise Analyzer | OpenText（旧 Micro Focus） | 資産分析・可視化 | COBOL, PL/I, Natural, JCL, CICS BMS | コールグラフ、データフロー図、影響分析レポート、コードスライシング | [OpenText 製品ページ](https://10252761.microfocus.com/products/enterprise-suite/enterprise-analyzer/) |
| 6 | CAST Imaging | CAST Software | 資産分析・可視化 | 450以上の言語・FW・DB（多言語対応） | ナレッジグラフ、アーキテクチャブループリント、データアクセス／API コールグラフ | [CAST 公式](https://www.castsoftware.com/imaging/capabilities) |
| 7 | CAST Highlight | CAST Software | 資産分析・可視化（ポートフォリオ） | 60以上の技術（多言語） | クラウド適合度、技術的負債、OSSリスクのポートフォリオ診断 | [CAST 公式](https://www.castsoftware.com/highlight) |
| 8 | vFunction（Architectural Observability Platform） | vFunction | 資産分析・可視化／変換（マイクロサービス分解） | Java, .NET | ドメインマップ、依存関係、アーキテクチャドリフト検知、分解プラン | [vFunction 公式](https://vfunction.com/platform/) |
| 9 | Imogen | Mechanical Orchard | 変換（振る舞いベース書き換え）／資産分析 | メインフレーム言語（COBOL 等、詳細未確認） | 挙動仕様（データ入出力ベース）、依存関係の可視化、検証ループ | [Mechanical Orchard 公式](https://www.mechanical-orchard.com/platform) |
| 10 | Mainframe Assessment Tool ＋ Gemini Code Assist（Dual Run） | Google Cloud | 資産分析・可視化／業務ルール抽出／変換 | COBOL 等メインフレーム言語 | アセスメント、業務ルール抽出、Java へのコード変換、並行実行検証 | [Google Cloud Docs](https://docs.cloud.google.com/mainframe-assessment-tool/docs/mainframe-modernization-overview) |
| 11 | Azure Migrate: Application and Code Assessment | Microsoft | 資産分析・可視化 | .NET, Java | 依存関係ダッシュボード、静的解析による移行課題レポート | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/migrate/appcat/overview?view=migrate) |
| 12 | AI-powered mainframe modernization（Kyndryl Bridge／AI Assistant for Z） | Kyndryl | 設計書生成／変換（サービス提供） | z/OS メインフレーム言語（COBOL 等、詳細未確認） | 生成AIによるアプリケーション文書化、Java 等への自動変換支援 | [Kyndryl 公式](https://www.kyndryl.com/us/en/services/mainframe/modernization/ai-powered) |

---

## 1. watsonx Code Assistant for Z（IBM）

- **名称／提供元／分類**: watsonx Code Assistant for Z（WCA4Z）／IBM／業務ルール抽出・コード説明（設計書生成の一部）
- **対象言語（入力）**: COBOL, PL/I, REXX, Assembler, JCL
- **出力する文書・成果物**: 自然言語での業務ルール記述（"Z Understand" 機能）、コードの自然言語説明（"Code Explanation"）
- **特徴的な機能**: 変数の使われ方をコード内でトレースして業務ルールを特定する Z Understand。2.8 リリースでエージェント型ワークフロー（MCP対応ツール群、Metadata Retrieval）に統合。生成AI（Granite系モデル）を利用
- **画面・使い方の特徴**: IDE（Eclipse ベースの mainframe 開発環境）に統合。デモ動画で個別ステップのUIが確認できる（未確認: 画面の詳細な操作フロー）
- **価格形態**: サブスクリプション型。Authorized User / Resource Unit / Virtual Server の複数ライセンス形態があり、正確な金額は個別見積もり（未確認: 具体的単価）
- **出典 URL と根拠の強さ**: [IBM 公式ドキュメント](https://www.ibm.com/docs/en/watsonx/watsonx-code-assistant-4z/2.x?topic=welcome-about-watsonx-code-assistant-z)（公式・強）、[IBM 発表記事](https://www.ibm.com/new/announcements/agentic-ai-for-smarter-mainframe-modernization-with-ibm-watsonx-code-assistant-for-z)（公式・強）
- **Spec2Doc への示唆**: 「変数の使用箇所をコード内で遡って業務ルールを言語化する」トレース手法は、Spec2Doc の D01〜D12 のうち業務ルール系仕様書の生成ロジック（事実＝コード上の参照関係、推測＝意味付け）の切り分けに応用できる。

## 2. Application Discovery and Delivery Intelligence（IBM ADDI）

- **名称／提供元／分類**: IBM Application Discovery and Delivery Intelligence（ADDI）／IBM／資産分析・可視化、業務ルール抽出
- **対象言語（入力）**: COBOL, PL/I, Assembler 等メインフレーム系言語（未確認: 対応言語の完全なリスト）
- **出力する文書・成果物**: 依存関係の可視化図、影響分析レポート、業務ルール・コードスニペット・API の検索結果、最新化されたドキュメント
- **特徴的な機能**: コグニティブ技術によるプログラム間の相互依存の発見、変更影響分析、Wazi Analyze / ADDI Extension によるIDE連携
- **画面・使い方の特徴**: Webベースの分析ダッシュボード＋ IDE 拡張（未確認: 具体的な画面遷移）
- **価格形態**: 未確認（エンタープライズ向け個別見積もりが一般的）
- **出典 URL と根拠の強さ**: [IBM 公式ドキュメント](https://www.ibm.com/docs/en/addi/6.1.4?topic=guide-product-overview)（公式・強）、[mainframemodernization.org](https://mainframemodernization.org/products/application-discovery-and-delivery-intelligence/)（第三者ポータル・中）
- **Spec2Doc への示唆**: 「依存関係を1クリックで発見し、ドキュメントを最新に保つ」という位置づけは、Spec2Doc が差分検知時にどの仕様書（D01〜D12）を再生成すべきか判定するロジックの参考になる。

## 3. AWS Transform for mainframe（AWS）

- **名称／提供元／分類**: AWS Transform for mainframe／AWS／資産分析・可視化、設計書生成、業務ルール抽出、変換（複合型）
- **対象言語（入力）**: COBOL, PL/I, JCL, CICS, Assembler 等（未確認: 完全な対応言語リスト）
- **出力する文書・成果物**: 依存グラフ、複雑度メトリクス、技術文書（プログラムロジック・フロー・統合・依存関係の記述）、業務ロジック抽出結果
- **特徴的な機能**: エージェント型でコード分類・依存マッピング・欠落アーティファクト検出・重複コンポーネント検出を自動実行。2026年6月に「traceable reimagine workflow（トレーサブルな刷新ワークフロー）」を追加し、要求から生成物への追跡可能性を強化
- **画面・使い方の特徴**: AWS マネジメントコンソール上のエージェント型UI。人間の入力（レビュー）を挟むワークフロー設計（未確認: 画面の詳細）
- **価格形態**: マインフレーム移行・アセスメント・モダナイゼーションのエージェント自体は無償。カスタムコード変換・継続的モダナイゼーションのみ従量課金（$0.035/エージェント分）
- **出典 URL と根拠の強さ**: [AWS 公式ドキュメント](https://docs.aws.amazon.com/transform/latest/userguide/transform-app-mainframe.html)（公式・強）、[AWS Transform Pricing](https://aws.amazon.com/transform/pricing/)（公式・強）、[AWS What's New](https://aws.amazon.com/about-aws/whats-new/2026/06/aws-transform-mainframe-traceable-reimagine-workflow/)（公式・強）
- **Spec2Doc への示唆**: 「トレーサブルな刷新ワークフロー」は、Spec2Doc が仕様書と元ソースの対応関係（行番号・シンボル単位のトレーサビリティ）を明示する設計の直接的な参考になる。また技術文書生成の前提として依存解析を先に完了させる順序は、D01〜D12 の生成順序設計にも応用できる。

## 4. AWS Mainframe Modernization（Blu Age Analyzer／Refactor）

- **名称／提供元／分類**: AWS Mainframe Modernization（AWS Blu Age）／AWS／変換（自動リファクタリング）、資産分析
- **対象言語（入力）**: COBOL, PL/1, NATURAL, RPG/400, COBOL/400
- **出力する文書・成果物**: Blu Insights によるインベントリ分析・依存分析結果、変換ロードマップ、Java ベースの変換済みアプリケーション（EC2／EKS／Lambda 向け）
- **特徴的な機能**: Analyzer による変換アプローチ・グルーピング・作業パッケージの特定、ルールベースの自動コード変換エンジン、テストシナリオの捕捉・管理
- **画面・使い方の特徴**: Blu Insights のWebベース分析画面（アセスメント）＋ 変換エンジンの実行（未確認: 詳細な画面構成）
- **価格形態**: 未確認（AWS サービス利用料＋Blu Age ライセンスの組み合わせと推測されるが一次情報での単価は未確認）
- **出典 URL と根拠の強さ**: [AWS 公式ドキュメント](https://docs.aws.amazon.com/m2/latest/userguide/refactoring-m2.html)（公式・強）、[AWS Partner Blog](https://aws.amazon.com/blogs/apn/automated-refactoring-from-mainframe-to-serverless-functions-and-containers-with-blu-age/)（公式ブログ・強）
- **Spec2Doc への示唆**: AWS Transform と役割分担（分析＝Transform、変換＝Blu Age）している点は、Spec2Doc が「仕様書生成」と「コード変換提案」を機能的に分離する設計の妥当性を裏付ける傍証になる。

## 5. Enterprise Analyzer（OpenText／旧 Micro Focus）

- **名称／提供元／分類**: OpenText Enterprise Analyzer／OpenText（旧 Micro Focus）／資産分析・可視化
- **対象言語（入力）**: COBOL, PL/I, Natural, JCL, CICS BMS マップ
- **出力する文書・成果物**: インタラクティブなコールグラフ、データフロー図、影響分析レポート、複雑度アセスメント、移行工数見積もり
- **特徴的な機能**: コードスライシング機能（ビジネスロジック・計算処理を再利用可能な新コンポーネントとして分離。テスト・ドキュメント化・新API作成に利用可能）。中央集権的リポジトリでのメタデータ管理
- **画面・使い方の特徴**: デスクトップ／リポジトリ型分析ツール（未確認: 具体的なUI画面構成）
- **価格形態**: 未確認（データシートに具体的な価格記載なし。個別見積もりが一般的）
- **出典 URL と根拠の強さ**: [OpenText データシート(PDF)](https://cabs.microfocus.com/media/data-sheet/enterprise_analyzer_ds.pdf)（公式・強）、[OpenText 製品ページ](https://10252761.microfocus.com/products/enterprise-suite/enterprise-analyzer/)（公式・強）
- **Spec2Doc への示唆**: 「ビジネスロジックを新規コンポーネントとして切り出し、ドキュメント化・API化に使う」コードスライシングの発想は、Spec2Doc が特定関数・モジュール単位で D01〜D12 のうちどの仕様書に対応させるかの粒度設計に応用できる。ただし業務ルール抽出自体は自動化されておらず、解析結果の解釈は人手に依存する点は要注意（比較記事情報・中）。

## 6. CAST Imaging（CAST Software）

- **名称／提供元／分類**: CAST Imaging／CAST Software（米国ニューヨーク拠点で米国展開）／資産分析・可視化
- **対象言語（入力）**: 450以上の言語・フレームワーク・データベース（多言語対応。JS/TS/HTML/CSS 含む）
- **出力する文書・成果物**: アプリケーション全体のナレッジグラフ（オブジェクト・依存関係・データフロー・アーキテクチャ関係）、アーキテクチャブループリント、データアクセス／API コールグラフ、トランザクションパス図
- **特徴的な機能**: ソースコードを解析し Neo4j グラフDBに格納。フロントエンド〜ミドルウェア〜バックエンドを横断した逆生成。カスタムドキュメントの追記・チーム共有が可能
- **画面・使い方の特徴**: ブラウザベースの軽量Web UI。インタラクティブなグラフ探索画面
- **価格形態**: オンプレミス年額 — Small（〜25万行）: $10,200/年、Medium（〜50万行）: $20,400/年、Large（〜100万行）: $36,000/年（ボリュームディスカウントあり）。クラウド版は単一アプリで年額 約$7,700〜。拡張機能追加で+10〜20%、CAST Gatekeeper 同梱で+40%（二次情報・中〜強、公式価格ページのスニペットに基づく）
- **出典 URL と根拠の強さ**: [CAST 公式 Capabilities](https://www.castsoftware.com/imaging/capabilities)（公式・強）、[CAST 公式 Pricing](https://www.castsoftware.com/imaging/pricing)（公式・強、金額は検索結果スニペット経由のため中程度の確度）
- **Spec2Doc への示唆**: 「全依存関係をグラフDBに格納し、ドキュメントを追記して共有する」設計は、Spec2Doc が JS/TS/HTML/CSS の解析結果をグラフ構造で保持し、事実（コード上の関係）と人による補足（推測・注釈）を分離して重ね書きする仕組みの参考になる。

## 7. CAST Highlight（CAST Software）

- **名称／提供元／分類**: CAST Highlight／CAST Software／資産分析・可視化（ポートフォリオレベルのSaaS診断）
- **対象言語（入力）**: 60以上の技術（多言語、ポートフォリオ横断）
- **出力する文書・成果物**: クラウド成熟度・AI/エージェント対応度・ソフトウェア健全性・OSSリスク・レジリエンス・サステナビリティのスコアレポート、技術的負債の優先順位付け（Portfolio Advisor）
- **特徴的な機能**: 数百〜数千アプリケーションを軽量スキャンで数日以内に横断診断。単なるSCA（脆弱性検出）ではなく、ビジネス価値との整合性も評価
- **画面・使い方の特徴**: SaaSダッシュボード（Microsoft/AWS マーケットプレイスからも提供）
- **価格形態**: Single App: $6,800/年、Small（〜25アプリ）: $44,000/年、Medium（〜100アプリ）: $121,000/年、Large（〜250アプリ）: $195,000/年、XL（〜500）: $295,000/年、XXL（〜1000）: $475,000/年（二次情報スニペット経由・中）
- **出典 URL と根拠の強さ**: [CAST 公式](https://www.castsoftware.com/highlight)（公式・強）、価格詳細は検索結果スニペット（GetApp/Capterra 経由・中）
- **Spec2Doc への示唆**: Spec2Doc は単一アプリの詳細仕様書生成が主目的だが、CAST Highlight の「軽量スキャンでポートフォリオ横断診断」という発想は、将来複数リポジトリを一括処理する際のスコープ設計（詳細版と簡易版の二段構え）の参考になる。

## 8. vFunction（Architectural Observability Platform）

- **名称／提供元／分類**: vFunction／vFunction, Inc.（米国拠点）／資産分析・可視化、変換（マイクロサービス分解）
- **対象言語（入力）**: Java, .NET
- **出力する文書・成果物**: ドメインマップ、依存関係グラフ、複雑度指標、マイクロサービス分解プラン、アーキテクチャドリフト検知アラート
- **特徴的な機能**: 静的・動的データ（フロー・コールツリー・リソースアクセス）を収集してアーキテクチャを学習。データサイエンス／生成AIで機能ドメインを特定し分解を提案。Architectural Observability Manager がアーキテクチャドリフト（新サービス・重複クラス・デッドコード等）を継続監視
- **画面・使い方の特徴**: ローカル設置サーバでのデータ収集＋Webダッシュボードでの可視化・監視
- **価格形態**: AWS Marketplace 12ヶ月契約でクラス数に応じた段階制（例: 〜2,000クラス $28,000、〜5,000クラス $48,000、〜100,000クラス $333,000、以降個別見積もり）。アプリ数・サービス数ベースの課金でユーザー数課金ではない
- **出典 URL と根拠の強さ**: [vFunction 公式](https://vfunction.com/platform/)（公式・強）、[vFunction Pricing](https://vfunction.com/pricing/)（公式・強、金額は検索結果スニペット経由のため中程度の確度）
- **Spec2Doc への示唆**: 静的解析だけでなく動的データ（実行時のコールツリー）も併用してアーキテクチャを学習する点、およびアーキテクチャドリフト（仕様と実装の乖離）を継続監視する設計思想は、Spec2Doc が「生成した仕様書とソースの差分」を継続的に検知する機能を将来追加する際の参考になる。

## 9. Imogen（Mechanical Orchard）

- **名称／提供元／分類**: Imogen／Mechanical Orchard（米国、Pivotal Labs 創業者らによる設立）／変換（振る舞いベースの書き換え）、資産分析
- **対象言語（入力）**: メインフレーム言語全般（具体的な対応言語一覧は未確認）
- **出力する文書・成果物**: 挙動仕様（実際のデータ入出力から導出した振る舞い仕様）、依存関係マップ（バッチジョブの挙動・相互依存を可視化）
- **特徴的な機能**: 「Behavior-First」アプローチ — 実データの入出力を仕様として扱い、決定論的（非確率的）にソースを読んでシステムの動作・依存関係を特定。生成コードを実システムの挙動に対して継続的に検証するクローズドループ。2026年夏リリースで AWS Transform と連携し、本番データフローに基づく検証を自動化
- **画面・使い方の特徴**: 未確認（コンサルティング型のプラットフォーム提供で、画面の詳細情報は公開情報からは確認できず）
- **価格形態**: 未確認（サービス型・個別契約と推測されるが一次情報なし）
- **出典 URL と根拠の強さ**: [Mechanical Orchard 公式](https://www.mechanical-orchard.com/platform)（公式・強）、[Network World 記事](https://www.networkworld.com/article/3953659/mechanical-orchard-taps-gen-ai-for-mainframe-to-cloud-modernization.html)（報道・中）
- **Spec2Doc への示唆**: 「決定論的にソースを読んで依存関係を特定し、それを仕様として固定してから変換する」順序（仕様確定→検証→書き換え）は、Spec2Doc が「事実（コード由来）」を仕様書の確定情報として先に固め、そこに人のレビューを挟んでから次の仕様書生成へ進む段階設計の裏付けになる。

## 10. Mainframe Assessment Tool ＋ Gemini Code Assist／Dual Run（Google Cloud）

- **名称／提供元／分類**: Google Cloud Mainframe Modernization（Mainframe Assessment Tool、Gemini CLI／Code Assist、Dual Run 等の複合サービス）／Google／資産分析・可視化、業務ルール抽出、変換
- **対象言語（入力）**: COBOL 等メインフレーム言語（未確認: 完全な対応言語リスト）
- **出力する文書・成果物**: アセスメント結果、抽出された業務ルール、Java 等への変換コード、Dual Run による並行実行の比較検証結果
- **特徴的な機能**: Mainframe Assessment Tool でアセスメント・業務ルール抽出後、Gemini CLI（Gemini モデル＋メインフレーム特化コンテキスト）でコード変換。Dual Run で本番稼働中の既存メインフレームとGoogle Cloud上の新システムを同時実行し、本番イベントをキャプチャ・リプレイして出力の正確性・完全性・性能を比較検証
- **画面・使い方の特徴**: Visual Studio Code 統合（Gemini Code Assist 拡張）、コンソールベースのアセスメント／Dual Run管理画面
- **価格形態**: 未確認（Google Cloud の従量課金体系に準ずると推測されるが具体的単価は一次情報で確認できず）
- **出典 URL と根拠の強さ**: [Google Cloud 公式ドキュメント](https://docs.cloud.google.com/mainframe-assessment-tool/docs/mainframe-modernization-overview)（公式・強）、[Google Cloud Blog](https://cloud.google.com/blog/products/infrastructure-modernization/mainframe-migration-and-modernization-with-ai)（公式・強）
- **Spec2Doc への示唆**: Dual Run の「新旧を並行実行し出力を突き合わせて正しさを検証する」発想は直接は転用しづらいが、「生成した仕様書の記述内容を実際のコード実行結果と突き合わせて検証する」という将来的な自己検証機構の設計ヒントになる。

## 11. Azure Migrate: Application and Code Assessment（Microsoft）

- **名称／提供元／分類**: Azure Migrate application and code assessment／Microsoft／資産分析・可視化
- **対象言語（入力）**: .NET, Java
- **出力する文書・成果物**: 依存関係ダッシュボード、ソースコード・設定・バイナリレベルの静的解析レポート、Azure移行時の課題・モダナイゼーション推奨事項
- **特徴的な機能**: ソースコードレベルの完全スキャンとアプリケーションスキャンを組み合わせ、Azure App Service/Spring Apps/Container Apps/AKS 等への移行可否・工数見積もりを提示。カスタムルールセット対応
- **画面・使い方の特徴**: 無料ツールとして提供され、Visual Studio 拡張やCLIから実行（未確認: 詳細なUI画面構成）
- **価格形態**: 無料（Microsoft公式に「free tool」と明記）
- **出典 URL と根拠の強さ**: [Microsoft Learn 公式](https://learn.microsoft.com/en-us/azure/migrate/appcat/overview?view=migrate)（公式・強）、[.NET Blog](https://devblogs.microsoft.com/dotnet/azure-migrate-app-and-code-assessment-tool-release/)（公式・強）
- **Spec2Doc への示唆**: 対象がメインフレームではなく Java/.NET のモダンスタックへの移行アセスメントである点は Spec2Doc（JS/TS/HTML/CSS）と対象領域が近い。無料ツールとして「まず依存関係と課題を可視化してから移行判断する」という段階設計は、Spec2Doc が仕様書生成の前段で軽量な依存関係サマリーを先に出す設計の参考になる。

## 12. AI-powered mainframe modernization（Kyndryl Bridge／AI Assistant for Z）

- **名称／提供元／分類**: Kyndryl の AI 駆動メインフレームモダナイゼーションサービス（Kyndryl Bridge 基盤、Kyndryl AI Assistant for Z）／Kyndryl／設計書生成、変換（サービス提供型）
- **対象言語（入力）**: z/OS メインフレーム言語（COBOL 等と推定されるが一次情報での明記は未確認）
- **出力する文書・成果物**: 生成AIによって作成されクリンドリルが強化したアプリケーションドキュメント、Java 等モダン言語への変換コード
- **特徴的な機能**: Kyndryl Bridge（監視・自動化ツールを統合しAI/MLで解析するプラットフォーム）を基盤に、2025年11月に発表したエージェント型AIフレームワークで z/OS 向けサービスを提供。Kyndryl AI Assistant for Z は同社の数十年のメインフレーム運用知見をナレッジベース化
- **画面・使い方の特徴**: Kyndryl Bridge のダッシュボード経由（未確認: 具体的な画面構成。サービス提供型のためツール単体の画面は非公開の可能性）
- **価格形態**: 未確認（マネージドサービス型のため個別契約と推測されるが一次情報での金額記載なし）
- **出典 URL と根拠の強さ**: [Kyndryl 公式](https://www.kyndryl.com/us/en/services/mainframe/modernization/ai-powered)（公式・強）、[Kyndryl 公式ニュース](https://www.kyndryl.com/us/en/about-us/news/2025/11/agentic-ai-framework-services-mainframe)（公式・強）
- **Spec2Doc への示唆**: 「生成AIが作った文書を専門家（Kyndryl）が強化する」ハイブリッド運用モデルは、Spec2Doc の「事実／推測／不明を行ごとに区別し、人がレビューして確定させる」設計思想と方向性が一致しており、レビューUIの参考になる余地がある（詳細な画面設計は未確認）。

---

## 確かめられなかったこと

- WebSearch/WebFetch 合計20回の上限内で調査したため、全項目とも一次情報の検索結果スニペットに基づく確認にとどまり、WebFetch による公式ページ本文の直接確認は実施していない（数値・機能の細部はスニペット経由のため、価格等は「中程度の確度」に留まる項目がある）
- Mechanical Orchard（Imogen）・Kyndryl（AI Assistant for Z）・Google Cloud（Mainframe Assessment Tool 一式）の価格形態は一次情報で確認できず、いずれも「未確認」
- OpenText Enterprise Analyzer の価格、および CAST Imaging／CAST Highlight の最新の正確な価格改定有無は未確認（検索結果に基づく参考値）
- 各製品の「画面・使い方」については、公式サイトのデモ動画・スクリーンショットを実際に閲覧したわけではなく、テキスト情報からの記述にとどまる（未確認）
- Accenture（myNav 等）は今回の12件には含めず、IBM・AWS・OpenText・CAST・vFunction・Mechanical Orchard・Google Cloud・Microsoft・Kyndryl の9社12製品で構成した（予算内で確度を優先したため）
