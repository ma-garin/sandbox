# 市場調査 領域E: 米国 — コードベース理解／ドキュメント・Wiki・図生成・コードQ&A

- 調査日: 2026-09-26
- 対象: 米国企業。コードWiki生成・ドキュメント保守・コードQ&A・静的解析/可視化の方向で12件収集
- 除外: 純粋なメインフレーム・モダナイゼーション専業ベンダー（別エージェント担当）
- ツール制約: WebSearch + WebFetch 合計20回（実績: WebSearch 13回 + WebFetch 7回 = 20回）

## サマリー表

| No | 名称 | 提供元 | 分類 | 対象言語 | 出力の要点 | 出典 |
|---|---|---|---|---|---|---|
| 1 | DeepWiki | Cognition | コードWiki生成 | 言語非依存（GitHub全般） | 構造化Wiki＋アーキテクチャ図＋Q&A | [cognition.com](https://cognition.com/blog/deepwiki) |
| 2 | Swimm | Swimm | ドキュメント保守 | 多言語（レガシー含む） | コード紐付きドキュメント＋依存/フロー図＋変更検知 | [swimm.io/pricing](https://swimm.io/pricing) |
| 3 | Mintlify | Mintlify | ドキュメント保守 | API/コードベース全般 | ドキュメントサイト＋APIプレイグラウンド＋PR自動更新 | [mintlify.com/pricing](https://mintlify.com/pricing) |
| 4 | Sourcegraph Cody | Sourcegraph | コードQ&A | 主要言語全般 | チャット回答＋コード編集提案＋根拠付き検索 | [sourcegraph.com/docs/cody](https://sourcegraph.com/docs/cody) |
| 5 | GitHub Copilot（コードレビュー/ドキュメント機能） | GitHub (Microsoft) | コードQ&A／コードレビュー | GitHub対応全言語 | PRレビューコメント＋自動コミットメッセージ＋リポジトリ横断チャット | [github.blog/changelog](https://github.blog/changelog/2026-09-18-copilot-code-review-an-improved-review-experience/) |
| 6 | Windsurf（旧Codeium） | Cognition | コードQ&A／エージェント型IDE | 主要言語全般 | マルチファイル編集＋コードベース理解＋自動修正 | [cloudzero.com](https://www.cloudzero.com/blog/windsurf-pricing/)（価格リダイレクト観測は本文参照） |
| 7 | Tabnine | Tabnine（2026年8月よりTricentis傘下） | コードQ&A／コード補完 | 80以上の言語 | Enterprise Context Engineによるナレッジグラフ化 | [tricentis.com/news](https://www.tricentis.com/news/tricentis-acquires-tabnine) |
| 8 | Greptile | Greptile | コードレビュー（コードQ&A寄り） | 未確認（GitHub/GitLab対応） | セマンティックコードグラフに基づくPRレビュー | [greptile.com/pricing](https://www.greptile.com/pricing) |
| 9 | Glean（for code） | Glean Technologies | コードQ&A／企業検索 | GitHub/GitLab/Bitbucket全言語 | コード横断検索＋根拠提示付きQ&A＋ドラフトPR生成 | [docs.glean.com](https://docs.glean.com/user-guide/assistant/code-search) |
| 10 | Qodo（旧CodiumAI） | Qodo | コード品質保証（テスト生成／レビュー） | 複数言語・フレームワーク | 振る舞い仕様に基づくテスト生成＋PRレビュー | [qodo.ai/pricing](https://www.qodo.ai/pricing/) |
| 11 | Augment Code | Augment Computing | コードQ&A／コンテキストエンジン | 主要言語全般（40万ファイル規模） | リポジトリ全体インデックス＋チャット＋PRレビュー | [augmentcode.com/pricing](https://www.augmentcode.com/pricing) |
| 12 | Driver AI | Driver | ドキュメント保守 | 複数言語・フレームワーク（詳細未確認） | テンプレート型技術文書＋GitHub同期更新 | [driver.ai](https://www.driver.ai/)／[techcrunch.com](https://techcrunch.com/2024/10/08/driver-launches-an-ai-powered-platform-for-creating-technical-documentation/) |

---

## 1. DeepWiki（Cognition）

- **分類**: コードWiki生成
- **対象言語（入力）**: 言語非依存。GitHub上の公開リポジトリ全般（5万以上を索引済み）。プライベートはDevinアカウント経由。
- **出力する文書・成果物**: トピック別に構成された対話型Wiki、アーキテクチャ図、ソースリンク付き解説ページ。
- **特徴的な機能**: ソースへのリンクあり／図の自動生成あり（アーキテクチャ図）／Q&A あり（自然言語で質問しリポジトリに根拠づけた回答）／検索（無認証MCPサーバー経由でWiki構造・内容を取得可能）／変更追従は未確認（自動更新の明記なし）。
- **画面・使い方の特徴**: リポジトリURLを与えるだけで即座にWikiが生成される摩擦の低さ。GitHub風のサイドナビゲーションでモジュール単位に閲覧でき、Devin（AIソフトウェアエンジニア）本体の検索・Wiki機能の無料公開版という位置付け。
- **価格形態**: 公開リポジトリは無料。プライベートリポジトリはDevin Core（ACU従量課金、最低$20、約$2.25/ACU）。チーム/エンタープライズはDevin API・VPC・SSO付き（応相談）。
- **出典URLと根拠の強さ**: 公式 [cognition.com/blog/deepwiki](https://cognition.com/blog/deepwiki)（機能詳細は薄い＝根拠中）＋アグリゲータ [techreviewer.co](https://techreviewer.co/products/deepwiki)、[aipure.ai](https://aipure.ai/products/deepwiki-by-congnition)（根拠弱〜中）。
- **Spec2Docへの示唆**: 「URLを渡すだけで即座に構造化Wiki＋図＋Q&Aが立ち上がる」低摩擦UXは、D01〜D12生成後の閲覧体験（トピック別ナビ＋チャットで深掘り）に直接応用できる。

## 2. Swimm

- **分類**: ドキュメント保守
- **対象言語（入力）**: 明記なし。レガシーコードベース含む多言語対応、行数無制限（数百万行対応）を謳う。
- **出力する文書・成果物**: コードスニペットに紐付いたドキュメント、依存関係図・フロー図、平易な言葉での業務ルール解説。
- **特徴的な機能**: 変更追従が最大の特徴（エディタがコード変更を検知し、対応ドキュメントの更新を著者に促す＝ドキュメントの陳腐化検知）／図の自動生成（依存・フロー図）／Q&A（AIアシスタントがコード片の文脈を解説）／PRベースでドキュメント更新を強制するワークフロー。
- **画面・使い方の特徴**: VS Code／JetBrains内でコードとドキュメントを並置表示し、参照コードがズレると警告する「スニペット同期」UIが特徴的。
- **価格形態**: Free（5ユーザーまで、機能制限あり）、Team $29/ユーザー/月、Enterprise応相談（SSO・オンプレ）。別途「理解対象の行数ベース」の価格説明もあり（公式pricingページに具体数字なし＝要確認）。
- **出典URLと根拠の強さ**: 公式 [swimm.io/pricing](https://swimm.io/pricing)（価格の具体詳細は薄い＝根拠中）＋アグリゲータ [capterra.com](https://www.capterra.com/p/227606/Swimm/)、[thectoclub.com](https://thectoclub.com/tools/swimm-review/)（根拠中）。
- **Spec2Docへの示唆**: 「コード変更を検知してドキュメント更新を促す」仕組みは、D01〜D12がソース変更後に陳腐化していないかを警告する再生成トリガー機能の着想元になる。

## 3. Mintlify

- **分類**: ドキュメント保守（公開ドキュメントサイト生成・AI検索）
- **対象言語（入力）**: 主にOpenAPI／コードベース全般からのAPIドキュメント生成。
- **出力する文書・成果物**: インタラクティブなドキュメントサイト、OpenAPIベースのAPIプレイグラウンド、PRベースの自動更新ドキュメント。
- **特徴的な機能**: 変更追従（GitHub AppがPR内のコード変更を検知し対応ドキュメントを自動更新）／Q&A（DocChat/Assistantが根拠引用付きで回答）／検索（セマンティック検索）／MCP経由でAIツールがドキュメントにアクセス可能。
- **画面・使い方の特徴**: Webエディタ＋プレビューデプロイ＋分析ダッシュボードが一体化。5,000社超・年間2,000万人の開発者が利用と規模訴求。
- **価格形態**: Starter無料（カスタムドメイン、AIチャット検索、月5,000クレジット）、Pro $450/月（AIエージェント・アシスタント込み、月1万クレジット、超過$0.01/クレジット）、Enterprise応相談（SSO・SCIM・SLA）。
- **出典URLと根拠の強さ**: 公式 [mintlify.com/pricing](https://mintlify.com/pricing)（根拠強）。
- **Spec2Docへの示唆**: 「PRでコード変更を検知し対応ドキュメントを自動更新」は、Spec2DocがGit連携する場合のD0x再生成トリガーとして参考になる。

## 4. Sourcegraph Cody

- **分類**: コードQ&A（コード検索基盤付きAIアシスタント）
- **対象言語（入力）**: 主要言語全般。VS Code、JetBrains、Visual Studio、Web app、CLIに対応。
- **出力する文書・成果物**: チャット形式の回答、コード生成・編集提案、自動編集（Auto-edit）。ドキュメント成果物としての出力は薄い。
- **特徴的な機能**: 根拠提示（Sourcegraph検索APIでローカル/リモートコードベース横断のコンテキストを取得し回答に反映）／Q&A／Context Filters（機密コードを第三者LLMに送らない企業向け制御）。
- **画面・使い方の特徴**: IDE内チャットに加えWeb appでも同一コンテキストを利用可能。個人データはモデル学習に使わない方針を明記。
- **価格形態**: 2025年7月にFree/Proプランを完全廃止し、Enterprise一本化（$59/ユーザー/月）へ転換。
- **出典URLと根拠の強さ**: 公式 [sourcegraph.com/docs/cody](https://sourcegraph.com/docs/cody)（根拠強、価格詳細は薄い）＋アグリゲータ [costbench.com](https://costbench.com/software/ai-coding-assistants/sourcegraph-cody/)（根拠中）。
- **Spec2Docへの示唆**: 「回答の根拠として検索結果（ファイル・シンボル）を明示する」設計は、D01〜D12の各記述にソース行への根拠リンクを必須で添える仕様の裏付けになる。

## 5. GitHub Copilot（コードレビュー／ドキュメント機能）

- **分類**: コードQ&A／コードレビュー（GitHub本体機能の一部）
- **対象言語（入力）**: GitHub対応全言語。
- **出力する文書・成果物**: PRレビューコメント、コミットメッセージの自動生成、リポジトリ横断のチャット回答。単体のドキュメント成果物は生成しない。
- **特徴的な機能**: 変更追従（PR差分単位の自動レビュー、自己解決＝Won't Fix等の理由付きでコメントを自動クローズ）／根拠提示（提案理由コメント）／カスタム指示をPRのheadブランチから読み込み／2026年時点で100万トークンのコンテキストウィンドウと推論レベル調整に対応。
- **画面・使い方の特徴**: PR画面にネイティブ統合。レビュー提案をバッチ承認すると自動でコミットメッセージ（タイトル＋説明）を生成する導線が特徴的。
- **価格形態**: Copilot Business/Enterpriseサブスクリプションに包含（具体的な追加費用は未確認）。
- **出典URLと根拠の強さ**: 公式GitHub Changelog [2026-09-18](https://github.blog/changelog/2026-09-18-copilot-code-review-an-improved-review-experience/)、[2026-09-23](https://github.blog/changelog/2026-09-23-copilot-code-review-more-ways-to-request-and-configure-reviews/)（根拠強）。
- **Spec2Docへの示唆**: 「バッチ承認時にコミットメッセージを自動生成する」ような、生成物確定時の副産物自動生成パターンはD0x確定時の変更履歴サマリ自動生成に転用できる。

## 6. Windsurf（旧Codeium／Cognition傘下）

- **分類**: コードQ&A／エージェント型IDE
- **対象言語（入力）**: 主要言語全般。
- **出力する文書・成果物**: マルチファイルにわたるコード編集、コード生成。ドキュメント生成機能は主眼ではない。
- **特徴的な機能**: 検索（Fast Contextによるコードベース索引）／Q&A（Cascadeエージェントによる自然言語操作）／自動修正・セッション横断の記憶保持。
- **画面・使い方の特徴**: VS Codeベースの専用エディタ上でCascadeが一連のアクション（複数ファイル編集・ターミナル実行）を代行するエージェント型フロー。
- **価格形態**: Free tier（Cascade制限付き利用）、Pro $20/月（2026年3月に$15→$20へ改定、月500クレジット、追加$10/250クレジット）。
- **出典URLと根拠の強さ**: アグリゲータ [cloudzero.com](https://www.cloudzero.com/blog/windsurf-pricing/)（根拠中）。**特記**: `windsurf.com/pricing` へのWebFetchが `devin.ai/pricing`（Cognition運営）へ308リダイレクトすることを実機で確認（一次情報の動的挙動として根拠強）。CognitionはDeepWiki（本表No.1）の運営元でもあり、2025年に買収されたとされる統合の傍証だが、買収契約の詳細自体は未確認。
- **Spec2Docへの示唆**: 直接の類似性は薄いが、「エージェントが複数ファイルを横断して変更を伝播させる」設計は、ソース変更がD01〜D12の複数文書に波及する際の整合更新ロジックの参考になる。

## 7. Tabnine（2026年8月よりTricentis傘下）

- **分類**: コードQ&A／コード補完（Enterprise Context Engine）
- **対象言語（入力）**: 80以上の言語・フレームワーク。
- **出力する文書・成果物**: コード補完提案、コードレビューエージェントの指摘。ドキュメント生成は主機能ではない。
- **特徴的な機能**: Enterprise Context Engineがリポジトリ・ドキュメント・チケット・API・インフラメタデータから継続更新のナレッジグラフ（構造化された関係・依存・アーキテクチャパターン）を構築（類似度検索ではなく構造化グラフである点が特徴）／エアギャップ・ゼロコード保持でのプライバシー対応。
- **画面・使い方の特徴**: 詳細な画面説明は未確認。IDE統合が中心。
- **価格形態**: Code Assistant $39/ユーザー/月、Agentic Platform $59/ユーザー/月、Enterprise応相談。無料／個人プランは廃止済み。**2026年7月30日、TricentisがTabnineを買収**し、Tabnineのナレッジグラフ技術をTricentis Agentic Quality Engineering Platformへ統合する方針。
- **出典URLと根拠の強さ**: 公式 [tricentis.com/news/tricentis-acquires-tabnine](https://www.tricentis.com/news/tricentis-acquires-tabnine)、[tabnine.com/blog](https://www.tabnine.com/blog/a-new-chapter-for-tabnine/)（根拠強、買収の事実）＋アグリゲータ [weavai.app](https://weavai.app/blog/en/2026/04/24/tabnine-2026-review-privacy-first-enterprise-ai-guide/)（価格詳細、根拠中）。**特記**: `tabnine.com/pricing` へのWebFetchが `tricentis.com/contact-us` へ301リダイレクトすることを実機で確認し、買収統合が既に進行中であることを直接裏付けた。
- **Spec2Docへの示唆**: 「コード＋ドキュメント＋チケット＋インフラメタデータを跨いだ構造化ナレッジグラフ」という発想は、D01〜D12を単なる文書群でなく相互参照可能なグラフとして持たせる設計の参考になる（Spec2Docの規模では過剰仕様の可能性が高い点に留意）。

## 8. Greptile

- **分類**: コードレビュー（コードQ&A寄り）
- **対象言語（入力）**: 未確認（プログラミング言語の明記なし）。GitHub／GitLab対応、Bitbucket・Azure DevOps非対応。
- **出力する文書・成果物**: PRレビューコメント、バグ検出結果。
- **特徴的な機能**: リポジトリ全体を「セマンティックコードグラフ」として索引し、diffだけでなく全体文脈からレビューする点が特徴／根拠提示（第三者ベンチマークでバグ検出率82%との報道、未検証の数値）／カスタムルール設定。
- **画面・使い方の特徴**: GitHub／GitLabのPR画面にネイティブ統合。詳細なUI画面説明は未確認。
- **価格形態**: Starter無料（月50レビュー、無制限ユーザー）、Pro $30/シート/月（月50クレジット込み、超過は種類別1〜10クレジット/レビュー）、Enterprise応相談（セルフホスト対応）。
- **出典URLと根拠の強さ**: 公式 [greptile.com/pricing](https://www.greptile.com/pricing)（根拠強）＋アグリゲータ [getoptimal.ai](https://getoptimal.ai/blog/best-ai-code-review-tools)（バグ検出率などの数値、根拠弱〜中、未検証）。
- **Spec2Docへの示唆**: 「diffだけでなくリポジトリ全体をグラフ化してレビューする」思想は、D01〜D12生成時に単一ファイルでなくプロジェクト全体の依存関係を踏まえて文書化する設計の裏付けになる。

## 9. Glean（for code）

- **分類**: コードQ&A／企業検索
- **対象言語（入力）**: GitHub／GitHub Enterprise／GitLab（クラウド・オンプレ）／Bitbucket上の全言語。
- **出力する文書・成果物**: コードスニペット・diff・参照箇所を含む検索結果、チャットでのコード生成、ドラフトPR。
- **特徴的な機能**: Q&A（コードとドキュメント・チケット・議論を横断して回答）／根拠提示（ファイル・diff・参照箇所を明示するグラウンディング）／検索（Enterprise Graphによる企業横断検索、数秒で応答）／小規模な変更提案をドラフトPRとして自動生成。
- **画面・使い方の特徴**: 単体のコード検索ツールではなく企業横断検索アシスタントの一部としてコードが統合され、設計ドキュメント・ランブック・チケットと同一画面で回答する点が特徴。
- **価格形態**: 企業向け応相談（具体額は未確認）。
- **出典URLと根拠の強さ**: 公式 [docs.glean.com/user-guide/assistant/code-search](https://docs.glean.com/user-guide/assistant/code-search)、[glean.com/blog](https://www.glean.com/blog/code-search-code-writer-jan-drop-2026)（根拠強）。
- **Spec2Docへの示唆**: 「コードの回答に必ずファイル・diff・参照箇所を明示する」根拠提示の型は、D01〜D12の各記述に出典（ファイルパス＋行番号）を必須で付す仕様の直接的な参考になる。

## 10. Qodo（旧CodiumAI）

- **分類**: コード品質保証（テスト生成／コードレビュー、静的解析寄り）
- **対象言語（入力）**: 複数言語・フレームワーク対応（詳細リストは未確認）。
- **出力する文書・成果物**: 振る舞い仕様に基づくテストスイート、PRレビューコメント（Qodo Merge）。
- **特徴的な機能**: コードの振る舞い仕様を特定した上でテストを生成する「意味のあるテスト生成」／PRレビューでの正確性検証。ドキュメントQ&A・図生成は対象外。
- **画面・使い方の特徴**: VS Code／JetBrains統合、GitHub／GitLab連携。詳細な画面説明は未確認。
- **価格形態**: 無料Developerティア、Pro Teamはクレジット制プール（2,500／5,000／20,000パック、約$0.012/クレジット、14日間無料トライアル）、Enterprise（30ユーザー以上、SSO/SAML・BYOK・オンプレ）。
- **出典URLと根拠の強さ**: 公式 [qodo.ai/pricing](https://www.qodo.ai/pricing/)（根拠強）＋[Wikipedia](https://en.wikipedia.org/wiki/Qodo)（社名変更経緯、根拠中）。
- **Spec2Docへの示唆**: 「クレジット従量制＋無料枠」という価格モデルは、Spec2DocをSaaS化する場合の課金設計（D0x生成本数課金）の比較対象になる。

## 11. Augment Code

- **分類**: コードQ&A／コンテキストエンジン型コーディングエージェント
- **対象言語（入力）**: 主要言語全般。40万ファイル規模の同時インデックスを謳う。
- **出力する文書・成果物**: チャット回答、マルチファイル編集提案、PRレビュー（Augment Code Review）。
- **特徴的な機能**: Context Engineがリポジトリ全体を索引しIDE・CLI・非同期クラウドエージェント（Cosmos）が同一コンテキストで動作／検索／MCPサーバー対応。
- **画面・使い方の特徴**: VS Code／JetBrains／Vim・Neovim／CLI／GitHub PR上のレビュー機能に統合。クラウドサンドボックス（Cosmos）でエージェントセッションを実行できる点が特徴的。
- **価格形態**: 2025年10月に個人向けIndie/Standard/Max従量プランを廃止し、Standard（月$20付与）／Business $100/月（最大50席、月$100付与）に統一。LLM実費＋40%サービス料、Cosmos計算は$0.19/時間。
- **出典URLと根拠の強さ**: 公式 [augmentcode.com/pricing](https://www.augmentcode.com/pricing)、[augmentcode.com/blog](https://www.augmentcode.com/blog/augment-codes-pricing-is-changing)、[augmentcode.com/context-engine](https://www.augmentcode.com/context-engine)（根拠強）。
- **Spec2Docへの示唆**: 「LLM実費＋サービス料％」という透明な従量課金の開示方法は、Spec2DocがAPI従量課金を利用者に説明する際の情報開示の型として参考になる。

## 12. Driver AI

- **分類**: ドキュメント保守（コードベース文脈レイヤー）
- **対象言語（入力）**: 複数言語・フレームワーク対応（具体的な対応言語リストは未確認）。
- **出力する文書・成果物**: 簡易化された技術ドキュメント、統一検索結果、定義済みセクション・記入指示付きのテンプレート文書。
- **特徴的な機能**: 変更追従（GitHub上のドキュメント更新を検知し即座に簡易版へ反映）／検索（統一検索）／Content Registration（カスタムドキュメントを文脈レイヤーに注入しMCP経由でAIエージェントへ提供）／マルチブランチ対応・サブエージェント（2026年changelog）。
- **画面・使い方の特徴**: 詳細な画面説明は未確認。「新規コードベースの理解速度を50%高速化」を謳う。
- **価格形態**: 未確認（具体的なプラン・金額の記載を確認できず）。2024年に$800万のシード資金調達（GV主導）。
- **出典URLと根拠の強さ**: 報道 [techcrunch.com](https://techcrunch.com/2024/10/08/driver-launches-an-ai-powered-platform-for-creating-technical-documentation/)、[siliconangle.com](https://siliconangle.com/2024/10/08/ai-startup-driver-raises-8m-drive-productivity-gains-simplifying-technical-documentation/)（根拠中）＋公式 [driver.ai/changelog](https://www.driver.ai/changelog/)（根拠強、機能アップデートのみ）。
- **Spec2Docへの示唆**: 「定義済みセクション＋記入指示付きテンプレート」でドキュメント種別を管理する設計は、D01〜D12というテンプレート型文書体系そのものと最も構造が近く、テンプレート管理UI（種別ごとの雛形＋記入ガイド）の直接的な参考になる。

---

## 確かめられなかったこと

- Swimm・Greptile・Glean・Qodo・Driver AIの「対象言語」の具体的な公式リストは、参照したページに明記がなく未確認。
- GitHub Copilotの追加費用（Business/Enterprise内での追加コスト有無）は未確認。
- Glean for codeの具体的な価格（企業向け応相談のため未掲載）は未確認。
- Driver AIの価格プラン・金額は一切確認できず（未確認）。
- Windsurf（Codeium）とCognitionの買収契約の詳細（時期・金額・統合範囲）は、`windsurf.com/pricing`が`devin.ai/pricing`へリダイレクトする事実からの推測であり、一次資料（プレスリリース等）は未確認。
- Greptileの「バグ検出率82%」はアグリゲータ記事の第三者ベンチマークに基づく数値であり、Greptile公式または独立した再現検証は確認できていない（引用してはいけない数値として扱う）。
- Swimmの「行数ベース価格」の具体的な単価・しきい値は公式pricingページに記載がなく未確認。
- Sourcegraph Cody・Tabnine（買収後）・Augment Codeの日本語UI対応有無は未確認。
