# 米国市場調査 追加補充（2 件）

- 作成日: 2026-09-26
- 判定基準: `README.md` と同一。**直接**＝ソースコードを入力に仕様書・設計書・業務ルール等の文書を出力する商用製品／**周辺**＝解析・影響分析・可視化・文書保守・テスト設計支援／**薄い**＝コード変換のみ・汎用コーディング支援／**対象外**＝販売終了・研究・事例・商用未確認・非米国
- 事前に `README.md` の統合表（A〜H）を grep 済み。Sourcegraph Cody（E-04・薄い）、Understand/SciTools（H-02・周辺）は既出のため対象外とし重複させていない
- WebSearch + WebFetch は合計 6 回（上限厳守）で使い切った。調査対象のうち Structure101・NDepend（フランス企業のため対象外）・CodeScene（スウェーデン企業のため対象外）・Sonar（スイス企業のため対象外）・Code Climate・Lattix は確認未了（Lattix は WebFetch が 403 で拒否）。Moderne は確認したが基準を満たさず不採用（理由は末尾）

## 一覧表

| 名称 | 提供元 | 国 | 関連度 | 対象言語 | 出力する文書 | 出典 URL・根拠の強さ |
|---|---|---|---|---|---|---|
| IBM Engineering Lifecycle Management（ELM／Rational 系譜） | IBM | アメリカ | 周辺 | 言語非依存（要件・設計・コード・テストの成果物を OSLC でリンク） | 要件⇔設計⇔コード⇔テストのトレーサビリティリンク集・影響分析ビュー（生成 AI による仕様書そのものの自動生成ではない） | [公式製品ページ](https://www.ibm.com/products/engineering-lifecycle-management)・[DOORS Next トレーサビリティ](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.0.3?topic=requirements-traceability) — 強（公式ドキュメント複数で確認） |
| Coverity（旧 Synopsys、現 Black Duck） | Black Duck, Inc.（2024年に Synopsys Software Integrity Group から独立。旧 Synopsys は Mountain View, CA） | アメリカ | 周辺 | C/C++・Java・C#・JavaScript/TypeScript・Python 等主要言語（静的解析製品として業界公知。今回の再取得ページでは個別列挙未確認） | 静的解析による欠陥・脆弱性検出レポート、コンプライアンス（MISRA 等）レポート | [Synopsys SAST ページ](https://www.synopsys.com/software-integrity/security-testing/static-analysis-sast.html) が [blackduck.com](https://www.blackduck.com/) へ 301 リダイレクト（事業譲渡を裏付け） — 中（ブランド移管の事実は確認したが、Black Duck 側の Coverity 個別ページ・対象言語一覧までは未取得。追加 WebFetch が必要） |

## 名称／提供元／関連度／対象言語／出力する文書／特徴／出典 URL と根拠の強さ

### 1. IBM Engineering Lifecycle Management（ELM）

- **名称**: IBM Engineering Lifecycle Management（旧 Rational DOORS Next 等の後継スイート）
- **提供元**: IBM Corporation（Armonk, NY, USA）
- **関連度**: 周辺（トレーサビリティ・影響分析支援。ソースコードから仕様書・設計書を自動生成する製品ではない）
- **対象言語**: 言語非依存。開発成果物（要件・モデル・ワークフロー・テスト・コード関連の work item）を OSLC（Open Services for Lifecycle Collaboration）でリンクする方式
- **出力する文書**: 要件↔設計↔コード↔テストの「デジタルスレッド」トレーサビリティリンク、変更の影響分析ビュー。DOORS Next・DOORS では要件間・要件⇔開発成果物⇔テストのリンク集を管理・可視化する
- **特徴**: バージョン管理されたナレッジグラフとして要件・設計・コード・テスト・work item を横断リンクし、「この変更が何に影響するか」を追跡できる。Engineering AI Hub が work item と要件の OSLC リンクを自動生成する機能も持つ（AI 支援は「リンク生成」であり文書生成ではない）
- **出典 URL と根拠の強さ**: [IBM 公式製品ページ](https://www.ibm.com/products/engineering-lifecycle-management)（強・一次資料）、[DOORS Next トレーサビリティ公式ドキュメント](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.0.3?topic=requirements-traceability)（強）。ソースコード（リポジトリ）と要件の直接リンクの詳細仕様までは今回のページ内容では未確認（**未検証**: IBM Engineering Workflow Management 等の個別モジュール仕様まで踏み込めば具体化する可能性あり）
- **Spec2Doc に取り入れられる点**: Spec2Doc は「コード→文書」の一方向生成だが、ELM の発想（要件⇔コード⇔テストを相互リンクし変更影響を可視化する）は、Spec2Doc が将来「生成済み仕様書とソースの差分を検知して再生成範囲を絞る」機能（影響分析）を持つ際の参考になる。ただし ELM 自体は自動生成でなく人手・ツール連携でリンクを張る運用のため、Spec2Doc の自動生成という強みとは競合しない

### 2. Coverity（旧 Synopsys、現 Black Duck）

- **名称**: Coverity（静的アプリケーションセキュリティテスト／静的解析製品）
- **提供元**: Black Duck, Inc.（2024年に Synopsys のソフトウェアインテグリティ事業が Clearlake Capital・Francisco Partners 傘下で独立し Black Duck ブランドに統合。前身の Synopsys は Mountain View, CA, USA。Coverity はもともと Stanford 発のスタートアップ Coverity Inc.（San Francisco）が起源で、2014年に Synopsys が買収した経緯）
- **関連度**: 周辺（ソースコードの静的解析による欠陥・脆弱性検出が中心で、仕様書・設計書そのものは出力しない）
- **対象言語**: C/C++・Java・C#・JavaScript/TypeScript・Python など主要言語に対応（業界公知の情報。今回のリダイレクト先ページでは個別の対象言語一覧を再取得できていないため**未検証**）
- **出力する文書**: 静的解析による欠陥検出レポート、セキュリティ脆弱性レポート、MISRA 等のコーディング規約コンプライアンスレポート
- **特徴**: ソースコードを解析対象として脆弱性・欠陥を検出する周辺的（解析系）ツールで、Spec2Doc が目指す「仕様書・設計書の直接生成」ではなく「品質・セキュリティ観点の解析結果出力」に特化
- **出典 URL と根拠の強さ**: 中。[Synopsys の静的解析ページ](https://www.synopsys.com/software-integrity/security-testing/static-analysis-sast.html) が [blackduck.com](https://www.blackduck.com/) へ 301 リダイレクトすることを確認し、事業譲渡の事実自体は裏付けたが、WebSearch/WebFetch の上限（合計6回）に達したため、Black Duck 側の Coverity 単独ページ・現行の対象言語一覧・価格体系の一次確認は**未検証**のまま
- **Spec2Doc に取り入れられる点**: 直接の機能重複は無いが、「MISRA 等の規約準拠レポート」という定型化された出力形式は、Spec2Doc が業務ルール・非機能要件を文書化する際のレポートテンプレート（違反件数・該当箇所一覧の集計表示）の参考になり得る

## 不採用・未確認の候補（根拠つき）

| 候補 | 判定 | 理由 |
|---|---|---|
| Moderne（OpenRewrite） | 不採用 | 公式サイト（moderne.ai）を確認したが、中核機能は "estate-wide code changes" と明記された自動コード変換（OpenRewrite レシピ実行）であり、解析レポート・可視化・文書出力を裏付ける記述が見つからなかった。基準の「コード変換のみを除外」に該当するため不採用。米国拠点かどうかも当該ページには明記が無く**未確認** |
| Structure101 / Lattix | 未確認 | Lattix 公式サイトは WebFetch が HTTP 403 で拒否。呼び出し上限（6回）に達したため再試行・代替経路（WebSearch）を実施できず。次回調査が必要 |
| Code Climate | 未確認 | 呼び出し上限のため着手できず |
| NDepend | 対象外 | フランス企業（Patrick Smacchia／NDepend SASU）のため米国基準の対象外 |
| CodeScene | 対象外 | スウェーデン企業のため対象外（指示どおり） |
| Sonar | 対象外 | スイス企業のため対象外（指示どおり） |
| Sourcegraph Cody | 重複 | README.md E-04 に既出（薄い判定）。重複させていない |
| Understand（SciTools） | 重複 | README.md H-02 に既出（周辺判定）。重複させていない |

## 残課題

- Coverity/Black Duck の対象言語一覧・価格・現行ページの一次確認が未了（WebFetch 上限のため）
- Structure101・Lattix・Code Climate は今回の呼び出し上限内で確認できず、次回枠での調査が必要
