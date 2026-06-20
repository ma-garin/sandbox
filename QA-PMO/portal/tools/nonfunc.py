"""非機能テスト観点ジェネレータ — ISO/IEC 25010:2023 準拠。

9つの品質特性 × サブ特性ごとに観点・技法・合否基準・根拠標準を生成する。
2023年改定の最大の変更点である Safety 特性（§4.2.8）を完全収録。
ISTQB PT 2019 / ISO/IEC 25019 / IEC 61508 / NIST SP 800-63B も参照。
"""

SYSTEM_TYPES = [
    ("web", "Webアプリケーション"),
    ("api", "API / マイクロサービス"),
    ("mobile", "スマートフォンアプリ"),
    ("embedded", "組込み / IoTデバイス"),
    ("ml", "ML / AI システム"),
    ("saas", "SaaS / クラウドサービス"),
]

# ── ISO/IEC 25010:2023 全9特性の定義 ──
CHARS = [
    {
        "code": "PERF",
        "name": "性能効率性",
        "name_en": "Performance Efficiency",
        "icon": "⚡",
        "sub": [
            {
                "code": "PERF-TIME",
                "name": "時間効率性",
                "desc": "応答時間・スループット・処理時間",
                "viewpoints": [
                    {
                        "viewpoint": "想定同時ユーザー数での平均・95パーセンタイル応答時間計測",
                        "technique": "負荷テスト（JMeter/Locust）",
                        "expected": "平均≤1秒、95ptile≤SLA_RESP（Webコンテンツ基準）",
                        "authority": "ISO/IEC 25010:2023 §4.2.2.1 / ISTQB PT 2019 / Google RAIL",
                    },
                    {
                        "viewpoint": "ピーク負荷（想定×150%）でのスループット低下率・エラー率計測",
                        "technique": "ストレステスト",
                        "expected": "スループット低下≤20%、エラー率≤0.1%（HTTP 5xx系）",
                        "authority": "ISO/IEC 25010:2023 §4.2.2.1 / ISTQB PT 2019",
                    },
                    {
                        "viewpoint": "主要トランザクション（DB読取・書込・外部API呼出）の処理時間分布",
                        "technique": "コンポーネント性能テスト",
                        "expected": "DBクエリP95≤100ms、外部API呼出P95≤500ms",
                        "authority": "ISO/IEC 25010:2023 §4.2.2.1",
                    },
                ],
            },
            {
                "code": "PERF-RES",
                "name": "資源効率性",
                "desc": "CPU・メモリ・ネットワーク・ストレージ消費",
                "viewpoints": [
                    {
                        "viewpoint": "負荷試験中のサーバーCPU・メモリ使用率の上限検証",
                        "technique": "リソース監視テスト",
                        "expected": "CPU平均≤70%、メモリ使用率≤80%（GCスパイクなし）",
                        "authority": "ISO/IEC 25010:2023 §4.2.2.2",
                    },
                    {
                        "viewpoint": "長時間稼働（24h+）でのメモリリーク有無（メモリ増加率）",
                        "technique": "耐久テスト（Soak Test）",
                        "expected": "24時間後のメモリ増加≤5%（定期GC後に収束）",
                        "authority": "ISO/IEC 25010:2023 §4.2.2.2 / ISTQB PT 2019",
                    },
                    {
                        "viewpoint": "ネットワーク帯域消費量（通常時・ピーク時）計測",
                        "technique": "帯域測定テスト",
                        "expected": "規定帯域の80%以内で正常動作",
                        "authority": "ISO/IEC 25010:2023 §4.2.2.2",
                    },
                ],
            },
            {
                "code": "PERF-CAP",
                "name": "収容性",
                "desc": "ユーザー数・データ量・トランザクション数の限界",
                "viewpoints": [
                    {
                        "viewpoint": "同時接続ユーザー数の限界（ブレークポイント）特定とグレースフルデグラデーション確認",
                        "technique": "スパイクテスト / ボリュームテスト",
                        "expected": "設計上限まで正常動作。超過時にグレースフルな縮退（503+Retry-After）",
                        "authority": "ISO/IEC 25010:2023 §4.2.2.3 / ISTQB PT 2019",
                    },
                    {
                        "viewpoint": "大容量データ（1千万件・1億件）での検索・集計レスポンス劣化率",
                        "technique": "大容量データテスト",
                        "expected": "1億件時でもP95応答時間がSLA_RESP内",
                        "authority": "ISO/IEC 25010:2023 §4.2.2.3",
                    },
                    {
                        "viewpoint": "ストレージ上限到達時の新規書込みの安全な拒否とアラート",
                        "technique": "容量計画テスト",
                        "expected": "上限の80%でアラート、100%到達時に書込みを安全に拒否しデータ破壊なし",
                        "authority": "ISO/IEC 25010:2023 §4.2.2.3",
                    },
                ],
            },
        ],
    },
    {
        "code": "REL",
        "name": "信頼性",
        "name_en": "Reliability",
        "icon": "🛡️",
        "sub": [
            {
                "code": "REL-MAT",
                "name": "成熟性",
                "desc": "通常運用での欠陥発生率・MTTF",
                "viewpoints": [
                    {
                        "viewpoint": "正常系シナリオ連続実行時の欠陥発生率（MTTF計測）",
                        "technique": "信頼性テスト / 反復試験",
                        "expected": "MTTF≥規定値。主要シナリオ100回連続でエラー率0%",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.1 / ISO/IEC 25019",
                    },
                    {
                        "viewpoint": "既知の欠陥修正後の再発有無の確認（リグレッション）",
                        "technique": "リグレッションテスト",
                        "expected": "修正済み欠陥の全件で再発なし",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.1",
                    },
                ],
            },
            {
                "code": "REL-AVAIL",
                "name": "可用性",
                "desc": "稼働率・計画停止・SLA達成",
                "viewpoints": [
                    {
                        "viewpoint": "稼働率SLA達成確認（計画外停止時間の計測・記録）",
                        "technique": "稼働率モニタリング",
                        "expected": "月間稼働率≥SLA_UPTIME%（ダウンタイム許容値内）",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.2",
                    },
                    {
                        "viewpoint": "ヘルスチェックエンドポイントの応答と監視システム連携確認",
                        "technique": "ヘルスチェックテスト",
                        "expected": "全監視間隔で200 OKを返し、障害時に即時アラート（≤1分）",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.2",
                    },
                    {
                        "viewpoint": "ローリングアップデート・Blue-Green デプロイ時のゼロダウンタイム確認",
                        "technique": "デプロイ可用性テスト",
                        "expected": "デプロイ中のサービス断なし（またはメンテナンス窓口内）",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.2 / DORA 2024",
                    },
                ],
            },
            {
                "code": "REL-FT",
                "name": "障害許容性",
                "desc": "コンポーネント障害時のグレースフルデグラデーション",
                "viewpoints": [
                    {
                        "viewpoint": "依存コンポーネント（DB/キャッシュ/外部API）障害時のフォールバック動作",
                        "technique": "障害注入テスト（カオスエンジニアリング）",
                        "expected": "障害コンポーネントを切り離し、縮退モードで最低限機能を継続",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.3",
                    },
                    {
                        "viewpoint": "サーキットブレーカー（Circuit Breaker）のトリップ・回復動作",
                        "technique": "フォールトトレランステスト",
                        "expected": "閾値超過でOpen→半開→Closed の遷移が仕様通りに動作",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.3",
                    },
                    {
                        "viewpoint": "ノード障害時のオートスケーリング・自動フェイルオーバー動作",
                        "technique": "クラスタ耐障害テスト",
                        "expected": "ノード障害後SLA_UPTIME稼働率を維持。トラフィックが生存ノードへ自動再配布",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.3",
                    },
                ],
            },
            {
                "code": "REL-REC",
                "name": "回復性",
                "desc": "障害後の復旧時間（RTO/RPO）とデータ整合",
                "viewpoints": [
                    {
                        "viewpoint": "障害発生から自動復旧完了までの時間（RTO）計測",
                        "technique": "回復テスト",
                        "expected": "RTO≤規定値（例：15分）。自動フェイルオーバーが正常動作",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.4",
                    },
                    {
                        "viewpoint": "バックアップからのリストア完了時間・データ損失量（RPO）検証",
                        "technique": "バックアップ/リストアテスト",
                        "expected": "RPO以内のデータ損失でリストア完了（バックアップ整合性確認含む）",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.4",
                    },
                    {
                        "viewpoint": "DBフェイルオーバー後のデータ整合性（コミット/ロールバック）確認",
                        "technique": "フェイルオーバーテスト",
                        "expected": "フェイルオーバー後も書込み途中データが正確にコミット/ロールバック済み",
                        "authority": "ISO/IEC 25010:2023 §4.2.5.4",
                    },
                ],
            },
        ],
    },
    {
        "code": "SEC",
        "name": "セキュリティ",
        "name_en": "Security",
        "icon": "🔒",
        "sub": [
            {
                "code": "SEC-CONF",
                "name": "機密性",
                "desc": "暗号化・アクセス制御・データ保護",
                "viewpoints": [
                    {
                        "viewpoint": "通信経路のTLS 1.2以上強制・旧バージョン（1.0/1.1）拒否確認",
                        "technique": "暗号化テスト（testssl.sh等）",
                        "expected": "TLS 1.0/1.1での接続が拒否され、TLS 1.3で正常接続",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.1 / NIST SP 800-52r2",
                    },
                    {
                        "viewpoint": "保存PII・機密情報の暗号化確認（AES-256相当）",
                        "technique": "データ保護テスト",
                        "expected": "DBダンプ・バックアップに平文PII/機密が存在しない",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.1 / NIST SP 800-111",
                    },
                    {
                        "viewpoint": "ロールベースアクセス制御（RBAC）の最小権限原則確認",
                        "technique": "認可テスト（OWASP ASVS 4.0）",
                        "expected": "各ロールが規定リソースのみアクセス可能。越境アクセスは403で拒否",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.1 / OWASP ASVS 4.0 V4",
                    },
                ],
            },
            {
                "code": "SEC-INT",
                "name": "インテグリティ",
                "desc": "データ改ざん防止・完全性保証",
                "viewpoints": [
                    {
                        "viewpoint": "SQLインジェクション・XSS・CSRF の攻撃耐性（OWASP Top 10準拠）",
                        "technique": "侵入テスト / DAST",
                        "expected": "OWASP Top 10 2021の全攻撃ベクターが無効化される",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.2 / OWASP Top 10 2021",
                    },
                    {
                        "viewpoint": "APIリクエスト署名・HMACによるデータ改ざん検知",
                        "technique": "インテグリティテスト",
                        "expected": "署名不一致・改ざんデータは400/401で拒否され処理されない",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.2",
                    },
                ],
            },
            {
                "code": "SEC-NR",
                "name": "否認防止性",
                "desc": "操作の否認不可・電子証跡",
                "viewpoints": [
                    {
                        "viewpoint": "重要操作（削除・承認・決済）の監査ログ記録と改ざん不可確認",
                        "technique": "監査ログテスト",
                        "expected": "全重要操作がユーザー・タイムスタンプ・内容付きで記録、ログ削除不可",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.3 / PCI-DSS v4.0 Req.10",
                    },
                ],
            },
            {
                "code": "SEC-ACC",
                "name": "責任追跡性",
                "desc": "ユーザー行動の追跡・ログ管理",
                "viewpoints": [
                    {
                        "viewpoint": "認証・認可イベント（ログイン成功/失敗・権限昇格）の完全ログ記録",
                        "technique": "アクセスログテスト",
                        "expected": "全認証イベントがSIEM連携可能な形式で記録（IP・UA・リクエストID含む）",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.4 / ISO/IEC 27002:2022",
                    },
                ],
            },
            {
                "code": "SEC-AUTH",
                "name": "真正性",
                "desc": "本人確認・多要素認証・トークン検証",
                "viewpoints": [
                    {
                        "viewpoint": "JWTの署名検証・有効期限・アルゴリズム強制（alg=none拒否）",
                        "technique": "認証テスト",
                        "expected": "改ざん/期限切れ/alg=noneのJWTは全て401で拒否",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.5 / RFC 8725",
                    },
                    {
                        "viewpoint": "多要素認証（MFA）フローとバイパス試行への耐性確認",
                        "technique": "MFA耐性テスト",
                        "expected": "TOTP/SMS認証なしでのログインが全バイパス手段で拒否",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.5 / NIST SP 800-63B AAL2",
                    },
                ],
            },
            {
                "code": "SEC-RES",
                "name": "耐脆弱性",
                "desc": "攻撃耐性・依存コンポーネントのCVE状況",
                "viewpoints": [
                    {
                        "viewpoint": "依存ライブラリの既知CVEスキャン（SCA）と高リスク脆弱性の不存在確認",
                        "technique": "ソフトウェア構成分析（SCA / SBOM）",
                        "expected": "CVSS≥7.0の既知CVEがゼロ（対応中は緩和策の実施を確認）",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.6 / NIST NVD",
                    },
                    {
                        "viewpoint": "レートリミット・アカウントロックによるブルートフォース攻撃耐性",
                        "technique": "ブルートフォーステスト",
                        "expected": "一定回数失敗後にアカウントロック/CAPTCHAが作動し攻撃を阻止",
                        "authority": "ISO/IEC 25010:2023 §4.2.6.6 / OWASP ASVS 4.0 V2.2",
                    },
                ],
            },
        ],
    },
    {
        "code": "USAB",
        "name": "使用性",
        "name_en": "Usability",
        "icon": "🖥️",
        "sub": [
            {
                "code": "USAB-REC",
                "name": "適切認識性",
                "desc": "機能・目的の理解容易性",
                "viewpoints": [
                    {
                        "viewpoint": "初見ユーザーがヘルプなしで主要タスクを完了できるか（ユーザビリティテスト）",
                        "technique": "タスク達成テスト",
                        "expected": "ターゲットユーザーの80%以上がガイドなしで主タスクを完了",
                        "authority": "ISO/IEC 25010:2023 §4.2.4.1 / ISO 9241-11:2018",
                    },
                ],
            },
            {
                "code": "USAB-LEARN",
                "name": "学習性",
                "desc": "新規ユーザーの習熟容易性",
                "viewpoints": [
                    {
                        "viewpoint": "オンボーディング完了時間（初回ログイン→主要機能使用開始まで）計測",
                        "technique": "学習効率測定",
                        "expected": "オンボーディング完了まで≤10分（90%のターゲットユーザー）",
                        "authority": "ISO/IEC 25010:2023 §4.2.4.2",
                    },
                ],
            },
            {
                "code": "USAB-OPE",
                "name": "運用操作性",
                "desc": "日常操作の効率・制御容易性",
                "viewpoints": [
                    {
                        "viewpoint": "繰り返し業務タスクのキーボードショートカット・バルク操作の存在",
                        "technique": "操作効率評価",
                        "expected": "主要繰り返し操作がキーボードのみで完結できる",
                        "authority": "ISO/IEC 25010:2023 §4.2.4.3 / WCAG 2.2 SC 2.1",
                    },
                ],
            },
            {
                "code": "USAB-ERR",
                "name": "ユーザエラー防止性",
                "desc": "誤操作防止・回復容易性",
                "viewpoints": [
                    {
                        "viewpoint": "破壊的操作（削除・退会・本番切替）での確認ダイアログ・アンドゥ機能",
                        "technique": "エラー防止テスト",
                        "expected": "全破壊的操作に確認ステップあり（アンドゥ可能な操作は30秒以内）",
                        "authority": "ISO/IEC 25010:2023 §4.2.4.4 / WCAG 2.2 SC 3.3",
                    },
                    {
                        "viewpoint": "入力エラー時の具体的・修正可能なエラーメッセージ表示",
                        "technique": "エラーメッセージ評価",
                        "expected": "エラー箇所と修正方法がユーザーに明確に提示される（エラーコードのみはNG）",
                        "authority": "ISO/IEC 25010:2023 §4.2.4.4 / WCAG 2.2 SC 3.3.1",
                    },
                ],
            },
            {
                "code": "USAB-ACCESS",
                "name": "アクセシビリティ",
                "desc": "WCAG 2.2準拠・支援技術対応",
                "viewpoints": [
                    {
                        "viewpoint": "WCAG 2.2 レベルAA 達成確認（コントラスト比・キーボード操作・スクリーンリーダー）",
                        "technique": "アクセシビリティ自動/手動テスト（axe-core）",
                        "expected": "axe-core自動テストでゼロ違反。スクリーンリーダーで主要フロー完走",
                        "authority": "ISO/IEC 25010:2023 §4.2.4.6 / WCAG 2.2 / JIS X 8341-3:2016",
                    },
                    {
                        "viewpoint": "色のみによる情報伝達がなく、代替的な識別手段（形・テキスト）が存在する",
                        "technique": "カラーブラインドネステスト",
                        "expected": "モノクロ表示でも全情報・状態が判別可能",
                        "authority": "ISO/IEC 25010:2023 §4.2.4.6 / WCAG 2.2 SC 1.4.1",
                    },
                ],
            },
        ],
    },
    {
        "code": "COMPAT",
        "name": "互換性",
        "name_en": "Compatibility",
        "icon": "🔗",
        "sub": [
            {
                "code": "COMPAT-COEX",
                "name": "共存性",
                "desc": "他システム・リソースとの共存",
                "viewpoints": [
                    {
                        "viewpoint": "同一サーバー上の他アプリへのリソース（ポート・メモリ）干渉がないことを確認",
                        "technique": "共存テスト",
                        "expected": "対象アプリ稼働中に他アプリの性能変動が±10%以内",
                        "authority": "ISO/IEC 25010:2023 §4.2.3.1",
                    },
                ],
            },
            {
                "code": "COMPAT-INTER",
                "name": "相互運用性",
                "desc": "外部システムとのデータ交換・API互換",
                "viewpoints": [
                    {
                        "viewpoint": "公開API仕様（OpenAPI/Swagger）との実装の一致確認（Contract Testing）",
                        "technique": "コントラクトテスト（Pact等）",
                        "expected": "全エンドポイントがOpenAPI仕様と100%一致。Breakingな変更なし",
                        "authority": "ISO/IEC 25010:2023 §4.2.3.2",
                    },
                    {
                        "viewpoint": "主要ブラウザ（Chrome・Firefox・Safari・Edge）最新版での動作確認",
                        "technique": "クロスブラウザテスト",
                        "expected": "全主要ブラウザで機能・表示の差異なし（許容範囲内）",
                        "authority": "ISO/IEC 25010:2023 §4.2.3.2",
                    },
                    {
                        "viewpoint": "APIバージョンアップ時の後方互換性確認（旧クライアント動作）",
                        "technique": "後方互換テスト",
                        "expected": "1世代前のAPIクライアントが引き続き正常動作",
                        "authority": "ISO/IEC 25010:2023 §4.2.3.2",
                    },
                ],
            },
        ],
    },
    {
        "code": "MAINT",
        "name": "保守性",
        "name_en": "Maintainability",
        "icon": "🔧",
        "sub": [
            {
                "code": "MAINT-MOD",
                "name": "モジュール性",
                "desc": "コンポーネント分離度・凝集性・結合度",
                "viewpoints": [
                    {
                        "viewpoint": "モジュール結合度（循環的複雑度・パッケージ依存数）の計測と閾値確認",
                        "technique": "静的解析（SonarQube / Pylint）",
                        "expected": "循環的複雑度≤15/関数、パッケージ結合度が設計上限内",
                        "authority": "ISO/IEC 25010:2023 §4.2.7.1",
                    },
                ],
            },
            {
                "code": "MAINT-REUSE",
                "name": "再利用性",
                "desc": "コンポーネントの再利用可能性",
                "viewpoints": [
                    {
                        "viewpoint": "共通処理のライブラリ化率・DRY原則の遵守確認",
                        "technique": "コード重複解析（clone detection）",
                        "expected": "重複コード率≤5%（SonarQube Duplications指標）",
                        "authority": "ISO/IEC 25010:2023 §4.2.7.2",
                    },
                ],
            },
            {
                "code": "MAINT-ANAL",
                "name": "解析性",
                "desc": "障害原因の特定容易性・可観測性",
                "viewpoints": [
                    {
                        "viewpoint": "エラー発生時の根本原因特定に必要な構造化ログの存在確認",
                        "technique": "ログ品質レビュー",
                        "expected": "全エラーにリクエストID・タイムスタンプ・スタックトレースが記録",
                        "authority": "ISO/IEC 25010:2023 §4.2.7.3",
                    },
                    {
                        "viewpoint": "分散トレーシング（OpenTelemetry等）でのリクエスト全体追跡確認",
                        "technique": "可観測性テスト",
                        "expected": "全マイクロサービス間でトレースIDが伝播し、一連処理を追跡可能",
                        "authority": "ISO/IEC 25010:2023 §4.2.7.3",
                    },
                ],
            },
            {
                "code": "MAINT-CHANGE",
                "name": "変更性",
                "desc": "機能追加・修正容易性・テストによる安全網",
                "viewpoints": [
                    {
                        "viewpoint": "リグレッションテストスイートのカバレッジとCIでの自動実行確認",
                        "technique": "テストカバレッジ計測",
                        "expected": "コードカバレッジ≥80%のテストがCIで全コミット時に自動実行",
                        "authority": "ISO/IEC 25010:2023 §4.2.7.4 / DORA 2024",
                    },
                ],
            },
            {
                "code": "MAINT-TEST",
                "name": "テスト容易性",
                "desc": "テスタビリティ・テストダブル利用可能性",
                "viewpoints": [
                    {
                        "viewpoint": "外部依存のモック可能な設計（DI・インターフェース境界）確認",
                        "technique": "テスタビリティレビュー",
                        "expected": "全外部依存がインターフェース経由で注入可能（テストダブル置換可）",
                        "authority": "ISO/IEC 25010:2023 §4.2.7.5",
                    },
                ],
            },
        ],
    },
    {
        "code": "SAFETY",
        "name": "安全性",
        "name_en": "Safety",
        "icon": "⚠️",
        "sub": [
            {
                "code": "SAFE-OC",
                "name": "運用上の制約",
                "desc": "安全な動作条件の遵守・範囲外の安全拒否",
                "viewpoints": [
                    {
                        "viewpoint": "システムが規定の安全動作範囲（温度・負荷・入力値）を超えた場合の安全停止/拒否",
                        "technique": "限界条件テスト",
                        "expected": "安全動作範囲外の条件でシステムが安全に停止または拒否し、データ破壊なし",
                        "authority": "ISO/IEC 25010:2023 §4.2.8.1 / IEC 61508",
                    },
                    {
                        "viewpoint": "並行して実行できないプロセスの排他制御（ウォッチドッグ・インターロック）",
                        "technique": "排他制御テスト",
                        "expected": "競合する安全クリティカル操作の同時実行が完全に防止される",
                        "authority": "ISO/IEC 25010:2023 §4.2.8.1 / IEC 61508",
                    },
                ],
            },
            {
                "code": "SAFE-RI",
                "name": "リスク識別",
                "desc": "ハザードの自動検知・報告",
                "viewpoints": [
                    {
                        "viewpoint": "潜在的ハザード（異常値・侵害試行・リソース枯渇）の自動検知と担当者通知",
                        "technique": "ハザード検知テスト",
                        "expected": "定義済みハザード条件で≤1分以内に担当者へアラート通知",
                        "authority": "ISO/IEC 25010:2023 §4.2.8.2 / IEC 61508",
                    },
                    {
                        "viewpoint": "FMEA（故障モード・影響分析）で特定したリスクシナリオの網羅的テスト",
                        "technique": "リスクベーステスト",
                        "expected": "FMEA全リスクシナリオにテストケースが存在し、全件で安全な挙動を確認",
                        "authority": "ISO/IEC 25010:2023 §4.2.8.2 / IEC 61508 §7.4",
                    },
                ],
            },
            {
                "code": "SAFE-FS",
                "name": "フェイルセーフ",
                "desc": "障害時の安全状態への遷移",
                "viewpoints": [
                    {
                        "viewpoint": "電源切断・ネットワーク断・プロセスクラッシュ時の安全停止確認",
                        "technique": "フェイルセーフテスト",
                        "expected": "あらゆる障害モードで安全状態（データ整合・危険出力停止）へ移行",
                        "authority": "ISO/IEC 25010:2023 §4.2.8.3 / IEC 61508 SIL評価",
                    },
                    {
                        "viewpoint": "部分的システム障害時のデータ整合性（ACID保証・ロールバック）確認",
                        "technique": "部分障害インジェクションテスト",
                        "expected": "コミット途中の障害でロールバックが完全実施されデータ不整合なし",
                        "authority": "ISO/IEC 25010:2023 §4.2.8.3",
                    },
                ],
            },
            {
                "code": "SAFE-HW",
                "name": "危険警告",
                "desc": "ユーザーへの危険状態の警告",
                "viewpoints": [
                    {
                        "viewpoint": "危険な操作（一括削除・本番環境切替・大量送信等）への明示的警告と二重確認",
                        "technique": "警告メカニズムテスト",
                        "expected": "全危険操作に視覚的警告＋明示的確認ステップ（入力確認等）",
                        "authority": "ISO/IEC 25010:2023 §4.2.8.4",
                    },
                    {
                        "viewpoint": "システム健全性の低下（ディスク逼迫・メモリ不足）をユーザーへ事前警告",
                        "technique": "閾値警告テスト",
                        "expected": "危険閾値（例：ディスク使用率80%）でユーザーへの警告が表示",
                        "authority": "ISO/IEC 25010:2023 §4.2.8.4",
                    },
                ],
            },
            {
                "code": "SAFE-SI",
                "name": "セーフインテグレーション",
                "desc": "他システムとの安全な統合・切り離し",
                "viewpoints": [
                    {
                        "viewpoint": "連携先システムの障害時に自システムへの影響を安全に遮断できるか",
                        "technique": "連携安全テスト",
                        "expected": "連携先障害で自システムが安全縮退し、ユーザーに明確なエラーを返す",
                        "authority": "ISO/IEC 25010:2023 §4.2.8.5",
                    },
                    {
                        "viewpoint": "外部システムからの悪意ある/誤ったデータ入力による安全への影響確認",
                        "technique": "境界入力安全テスト",
                        "expected": "外部入力の検証失敗でシステムが安全状態を維持（サービス継続または安全停止）",
                        "authority": "ISO/IEC 25010:2023 §4.2.8.5",
                    },
                ],
            },
        ],
    },
    {
        "code": "PORT",
        "name": "移植性",
        "name_en": "Portability",
        "icon": "📦",
        "sub": [
            {
                "code": "PORT-ADAPT",
                "name": "適応性",
                "desc": "異なる環境・OS・クラウドへの適応",
                "viewpoints": [
                    {
                        "viewpoint": "コンテナ（Docker）ビルドの再現性確認（別マシン・CI環境）",
                        "technique": "環境再現テスト",
                        "expected": "同一Dockerfileから異なるマシン・CI環境で同一イメージがビルド成功",
                        "authority": "ISO/IEC 25010:2023 §4.2.9.1",
                    },
                    {
                        "viewpoint": "マルチクラウド/オンプレミス切替時の設定外部化確認",
                        "technique": "設定移植テスト",
                        "expected": "環境固有設定が全て外部化（環境変数/設定ファイル）され、コード変更不要",
                        "authority": "ISO/IEC 25010:2023 §4.2.9.1 / 12 Factor App",
                    },
                ],
            },
            {
                "code": "PORT-INST",
                "name": "設置性",
                "desc": "インストール・デプロイの容易性・手順書の正確性",
                "viewpoints": [
                    {
                        "viewpoint": "手順書に従ったクリーンインストール完了時間と成功率",
                        "technique": "インストールテスト",
                        "expected": "手順書通りに規定時間内（例：30分）でインストール完了。10人中10人が成功",
                        "authority": "ISO/IEC 25010:2023 §4.2.9.2",
                    },
                ],
            },
            {
                "code": "PORT-REPL",
                "name": "置換性",
                "desc": "同目的の別製品との置換可能性",
                "viewpoints": [
                    {
                        "viewpoint": "標準インターフェース（REST/JDBC/ODBC等）経由での代替製品への移行可能性",
                        "technique": "移行互換テスト",
                        "expected": "標準インターフェース経由で代替製品への切替が可能（ベンダーロックインなし）",
                        "authority": "ISO/IEC 25010:2023 §4.2.9.3",
                    },
                ],
            },
        ],
    },
    {
        "code": "FUNC",
        "name": "機能適合性",
        "name_en": "Functional Suitability",
        "icon": "✅",
        "sub": [
            {
                "code": "FUNC-COMP",
                "name": "機能完全性",
                "desc": "規定タスクをカバーする機能の充足",
                "viewpoints": [
                    {
                        "viewpoint": "要件定義書の全機能の存在・動作確認（機能トレーサビリティ）",
                        "technique": "機能カバレッジ確認",
                        "expected": "全要件にテストが紐づき、未カバー要件がゼロ",
                        "authority": "ISO/IEC 25010:2023 §4.2.1.1 / ISO/IEC 29119-2",
                    },
                ],
            },
            {
                "code": "FUNC-CORR",
                "name": "機能正確性",
                "desc": "規定精度での正確な結果の提供",
                "viewpoints": [
                    {
                        "viewpoint": "計算・変換処理の結果精度確認（小数精度・丸め方式の仕様適合）",
                        "technique": "精度テスト",
                        "expected": "計算結果が仕様書記載の精度・丸め方式に完全準拠",
                        "authority": "ISO/IEC 25010:2023 §4.2.1.2",
                    },
                ],
            },
            {
                "code": "FUNC-APP",
                "name": "機能適切性",
                "desc": "目標達成のための適切な機能提供",
                "viewpoints": [
                    {
                        "viewpoint": "ユーザーが目標（業務タスク完了）に到達できるUXフロー全体の確認",
                        "technique": "エンドツーエンドシナリオテスト",
                        "expected": "主要業務シナリオを最短経路で完遂できること",
                        "authority": "ISO/IEC 25010:2023 §4.2.1.3",
                    },
                ],
            },
        ],
    },
]

# 特性コード → 定義の高速参照用辞書
CHAR_MAP = {c["code"]: c for c in CHARS}


def generate(selected_codes, sla_uptime="99.9", sla_resp_ms=3000):
    """選択された品質特性コードに対して非機能テスト観点リストを生成する。

    Returns:
        {rows, total, selected_chars, by_char}
    """
    rows = []
    by_char = []

    for code in selected_codes:
        char = CHAR_MAP.get(code)
        if not char:
            continue
        char_rows = []
        for sub in char["sub"]:
            for vp in sub["viewpoints"]:
                expected = (
                    vp["expected"]
                    .replace("SLA_UPTIME", str(sla_uptime))
                    .replace("SLA_RESP", f"{sla_resp_ms // 1000}秒")
                )
                row = {
                    "id": f"NF-{len(rows) + 1:03d}",
                    "char_code": code,
                    "char_name": char["name"],
                    "char_icon": char["icon"],
                    "sub_code": sub["code"],
                    "sub_name": sub["name"],
                    "viewpoint": vp["viewpoint"],
                    "technique": vp["technique"],
                    "expected": expected,
                    "authority": vp["authority"],
                }
                rows.append(row)
                char_rows.append(row)
        by_char.append({
            "code": code,
            "name": char["name"],
            "icon": char["icon"],
            "rows": char_rows,
        })

    return {
        "rows": rows,
        "total": len(rows),
        "selected_chars": [CHAR_MAP[c] for c in selected_codes if c in CHAR_MAP],
        "by_char": by_char,
    }
