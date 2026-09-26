# アメリカ市場調査 差し替え分（F、5件）

条件: 商用提供中のアメリカ製品で、ソースコードを入力し仕様書・設計文書・ビジネスルール・構造化ドキュメントを出力するもの（純粋なコード変換・汎用コーディングアシスタント/補完は除外）。JS/TS・Webアプリ対応を優先。
既存の統合一覧（README.md の A〜E、42件）との重複は無し（`grep` で名称照合済み）。

## 調査の制約

- WebSearch + WebFetch 合計 12 回の上限内で実施（使い切り）。
- 検討したが不採用: CodeSee（個別ページが404、公式サイトでの商用継続を直接確認できず根拠不足）、Stenography（一次情報が古いAIツール紹介サイトのみで現行の商用継続を確認できず）、Phase Change Software / Blaze（検索で製品の実在を確認できず）、Mutable.ai は `mutable.ai` への直接WebFetchがDNS不達だったため公式ブログ・YC Launch・`wiki.mutable.ai` の検索結果を根拠とした（本文中に明記）。

## 1. 要約表

| No | 名称 | 提供元 | 分類 | 対象言語 | 出力する文書 | 根拠の強さ |
|---|---|---|---|---|---|---|
| F-01 | DocuWriter.ai | DocuWriter.ai | 設計書生成（SaaS） | TypeScript・JavaScript・Python・Go・Java・PHP・Ruby・C#・Rust・Swift・Kotlin 等 | API リファレンス・README・アーキテクチャ文書・UML図・ドキュメントツリー | 中 |
| F-02 | Understand（by SciTools） | SciTools | 静的解析・設計文書生成 | C/C++・Java・Python・Ada・Fortran 等（JS/TS 記載なし） | 依存関係図・呼び出しグラフ・コントロールフロー図・データディクショナリ・メトリクスレポート・コンプライアンスレポート | 強 |
| F-03 | Kodesage | Kodesage, Inc. | レガシー資産理解・設計文書生成（オンプレ/VPC） | COBOL・PL/SQL・Oracle Forms・PowerBuilder・RPG 等（JS/TS 非対応） | 自動生成ドキュメント（テンプレート化）・システム/依存関係の可視化図・チケット/タスク分解資料 | 強（商用性）／中（対象言語・出力詳細） |
| F-04 | Mutable.ai（Auto Wiki） | Mutable AI, Inc.（YC） | コードWiki生成 | 言語非依存（React・Kubernetes・D3 等の実例あり＝JS/TS含む） | Wikipedia形式のWiki記事・Mermaid図・行単位の出典リンク付き解説 | 中 |
| F-05 | GitLoop | GitLoop | コードベースアシスタント＋設計文書生成 | 言語非依存（Web/JS系リポジトリでの利用例あり） | 機能単位のドキュメント（関数・モジュール・クラスの説明）・PRレビューコメント・単体テスト | 中 |

## 2. 各項目の詳細

### F-01 DocuWriter.ai
- **提供元**: DocuWriter.ai（GitHub組織 `DocuWriter-ai` を保有する独立SaaS事業者）
- **分類**: AIコードドキュメント生成SaaS
- **対象言語**: TypeScript / JavaScript / Python / Go / Java / PHP / Ruby / C# / Rust / Swift / Kotlin 等、主要言語を横断
- **出力する文書**: Gitリポジトリ接続またはソースアップロードから、API仕様・README・アーキテクチャ文書・クラス/関数のドキュメントツリー・UML図を生成
- **特徴的な機能**: MCPサーバを提供し、Cursor/Claude/ChatGPT等のAIツールから直接ドキュメントを引ける。差分更新（既存ドキュメントの追従更新）に対応
- **出典URLと根拠の強さ**: [公式](https://www.docuwriter.ai/ai-code-documentation-generator)・[技術文書ページ](https://www.docuwriter.ai/technical-documentation-software) — 根拠: 中（WebSearchのAI要約が公式ドメインの記述を引用。個別ページを直接WebFetchでは未確認）
- **Spec2Doc に取り入れられる点**: MCP経由でIR/生成文書を外部AIツールに提供する構想（README K-16）の実例として、DocuWriter.aiのMCPサーバ設計を参照できる。既存ドキュメントとの差分更新方式も、Spec2Docの再生成時の差分表示に応用可能

### F-02 Understand（by SciTools）
- **提供元**: SciTools（老舗の静的解析ベンダー、1996年創業）
- **分類**: 静的コード解析IDE／設計文書・メトリクス生成ツール（商用ライセンス）
- **対象言語**: C/C++・Java・Python・Ada・Fortran 等。公式ページに JavaScript/TypeScript の明記は無し（未確認・非対応の可能性）
- **出力する文書**: 依存関係図・呼び出しグラフ（Butterfly図・Call Graph）・コントロールフロー図・データディクショナリ・カスタムメトリクスレポート・コーディング標準への準拠検証レポート
- **特徴的な機能**: Python APIで解析結果を自動取得しCI（Jenkinsプラグイン）に組み込み可能。ファイル/クラス/エンティティ単位でサイクロマティック複雑度等を計測
- **出典URLと根拠の強さ**: [公式（静的解析）](https://scitools.com/static-code-analysis)・[公式トップ](https://scitools.com/) — 根拠: 強（公式ページを直接WebFetchし、商用提供・出力物・言語一覧を確認）
- **Spec2Doc に取り入れられる点**: README K-02（依存・呼び出しグラフ図）の描画対象として、Butterfly図・コントロールフロー図の見せ方が参考になる。ただしJS/TS非対応の可能性が高く、Spec2Doc（JS/TS/Web想定）への直接適用は限定的

### F-03 Kodesage
- **提供元**: Kodesage, Inc.（2024年創業、シード6.6M USD調達済み、規制業界向け）
- **分類**: レガシーコードベース理解・自動ドキュメント生成プラットフォーム（オンプレミス/VPC/エアギャップ対応）
- **対象言語**: COBOL・PL/SQL・Oracle Forms・PowerBuilder・RPG 等のレガシー言語（公式ページでJS/TS/Webアプリの対応記載は無し）
- **出力する文書**: テンプレートを用いた自動ドキュメント生成（数分単位）、システム・依存関係の可視化図。既存ドキュメント・DB・チケット管理システムを取り込み、継続更新される「知識レイヤー」を構築
- **特徴的な機能**: 「Ask Kodesage」でチャット形式の質問応答（ベテランのテックリードとの対話を模擬）。ドキュメント生成だけでなく、コード変換・テスト作成・本番支援まで一気通貫
- **出典URLと根拠の強さ**: [公式トップ](https://kodesage.ai/)（直接WebFetchで商用性＝顧客ロゴ・デモ請求導線・ドキュメント自動更新機能を確認）、[製品ドキュメント](https://docs.kodesage.ai/)・[ブログでの対象言語言及](https://kodesage.ai/blog/ai-documentation-tools-for-legacy-code)（WebSearch要約） — 根拠: 強（商用性）／中（対象言語・出力の詳細はWebSearch経由）
- **Spec2Doc に取り入れられる点**: 「継続更新される知識レイヤー」の発想は、Spec2Docの `ir.json` をソース変更ごとに差分更新する設計（K-16のMCP提供と組み合わせ）の参考になる。既存ドキュメント・チケットの取り込みによる文脈補強は、Spec2DocのD09（LLMによる意味付け）の入力強化に応用できる

### F-04 Mutable.ai（Auto Wiki）
- **提供元**: Mutable AI, Inc.（Y Combinator出身）
- **分類**: コードベース→Wiki自動生成SaaS
- **対象言語**: 言語非依存を謳う。実例としてReact・Kubernetes・D3・Bitcoin・Terraform等（JS/TSプロジェクトを含む）を自動ドキュメント化
- **出力する文書**: Wikipedia形式の記事（Auto Wiki v2）。Mermaid記法のコード図、行単位でソースへリンクする出典付き解説。コードプッシュのたびに自動更新
- **特徴的な機能**: AIによるWikiの指示ベース改訂（自然言語で修正指示）と手動編集の両立。基本料金は $2/リポジトリ/月
- **出典URLと根拠の強さ**: [Y Combinator Launch（Auto Wiki v2）](https://www.ycombinator.com/launches/KrT-auto-wiki-v2-by-mutable-ai-convert-your-codebase-into-a-wiki-style-article-now-with-diagrams)・[公式ブログ](https://blog.mutable.ai/p/auto-wiki-v2)・[Wiki実例](https://wiki.mutable.ai/) — 根拠: 中（`mutable.ai` への直接WebFetchはDNS不達で失敗。公式ブログ・YC公式Launchページ・Wiki実例ページの検索結果を根拠とした。一次情報だが直接取得はできていない旨を明記）
- **Spec2Doc に取り入れられる点**: 既存README案 K-05（ソース並置ビュー）と同種の「行単位で出典リンク」をWiki形式の文書全体に適用している点が、生成文書の閲覧UI設計（K-05・K-10）の実例として参照できる

### F-05 GitLoop
- **提供元**: GitLoop
- **分類**: AIコードベースアシスタント（ドキュメント生成機能を明示的な製品機能として保有）
- **対象言語**: 言語非依存。公式ユースケースページでWeb/JS系リポジトリでの利用を想定した記述あり
- **出力する文書**: 機能単位（例:「チャット機能のドキュメントを生成して」等の自然言語指示）で、関数・モジュール・クラス単位の説明ドキュメントを自動生成。加えてPRレビューコメント・単体テストも生成
- **特徴的な機能**: 自然言語検索でコードベース内の関連ファイルを特定してからドキュメント化する2段階方式。ドキュメント生成専用のユースケースページ・機能ページを公式に用意
- **出典URLと根拠の強さ**: [公式（ドキュメント生成機能）](https://www.gitloop.com/feature/generate-documentation)・[ユースケースページ](https://www.gitloop.com/usecase/documentation-generator)・[公式トップ](https://www.gitloop.com/) — 根拠: 中（WebSearchのAI要約が公式ドメインの記述を引用。個別ページを直接WebFetchでは未確認）
- **Spec2Doc に取り入れられる点**: 「対象範囲を自然言語で指定 → 該当ファイルを特定 → ドキュメント生成」という絞り込みフローは、Spec2Docで大規模リポジトリの一部だけを再生成したい場合のCLI/UI設計に応用できる

## 3. 引用してはいけない数値

- Kodesageの調達額「6.6M USD」はプレスリリース系の報道（aiworld.eu）のみが根拠で、Kodesage公式ページでは確認していない（中〜弱）
- Mutable.aiの価格「$2/リポジトリ/月」はWebSearchの要約経由で、公式サイトへの直接アクセスでは確認できていない（中）
