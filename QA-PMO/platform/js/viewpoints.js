/* viewpoints.js — テスト観点ナレッジベース（差別化の中核資産）
 *
 * これは単なる定数ではなく「観点表（test viewpoint library）」という知識資産。
 * SHIFT/ベリサーブ型の優位性の源泉である"蓄積された観点"をコード資産化したもの。
 * - 拡張可能（業界別・顧客別の観点を追記して育てる）
 * - バージョン管理可能（観点の改廃を追跡）
 * - 将来そのままRAGの知識源（AI版の精度の堀）になる
 *
 * 各観点は { vp:観点, tech:適用技法(ISTQB), cat:カテゴリID } を持ち、
 * 生成された各テスト条件は観点ID→技法→カテゴリへ追跡可能（監査証跡）。
 *
 * v1.0.0 初版（基本観点・項目型別・機能特性別）
 * v2.0.0 業種別観点（金融/EC/医療/SaaS）＋欠陥パターンDB追加
 */

const VIEWPOINTS = {
  version: '2.0.0',

  // 観点カテゴリ（カバレッジ算出の母集団）
  categories: [
    { id: 'C-FUNC', name: '機能/正常系' },
    { id: 'C-BVA', name: '境界値' },
    { id: 'C-EQ', name: '同値/データ種別' },
    { id: 'C-EXC', name: '例外/異常系' },
    { id: 'C-STATE', name: '状態遷移' },
    { id: 'C-SEC', name: 'セキュリティ' },
    { id: 'C-PERF', name: '性能/負荷' },
    { id: 'C-COMPAT', name: '互換性' },
    { id: 'C-USAB', name: 'ユーザビリティ' },
    { id: 'C-I18N', name: '国際化/ロケール' },
    { id: 'C-DATA', name: 'データ整合/監査' },
    { id: 'C-CONC', name: '同時実行/競合' },
  ],

  // 入力フィールド型ごとの観点
  byFieldType: {
    number: [
      { vp: '下限値・下限-1・上限値・上限+1の境界', tech: '境界値分析', cat: 'C-BVA' },
      { vp: '0・負数・最大桁あふれ', tech: '同値分割', cat: 'C-EQ' },
      { vp: '非数値・全角数字・小数・指数表記', tech: '同値分割', cat: 'C-EXC' },
    ],
    text: [
      { vp: '最大長・最大長+1・空文字', tech: '境界値分析', cat: 'C-BVA' },
      { vp: '特殊文字・絵文字・制御文字・改行', tech: '同値分割', cat: 'C-EXC' },
      { vp: 'SQL/HTML/スクリプト注入', tech: '攻撃パターン', cat: 'C-SEC' },
      { vp: '前後空白・全角/半角・サロゲートペア', tech: '同値分割', cat: 'C-I18N' },
    ],
    date: [
      { vp: '過去・未来・当日の境界', tech: '境界値分析', cat: 'C-BVA' },
      { vp: '不正日付(2/30)・閏年(2/29)', tech: '同値分割', cat: 'C-EXC' },
      { vp: '書式違反・タイムゾーン・和暦/西暦', tech: '同値分割', cat: 'C-I18N' },
    ],
    select: [
      { vp: '各選択肢の選択', tech: '同値分割', cat: 'C-FUNC' },
      { vp: '未選択・一覧外の不正値送信', tech: '異常系', cat: 'C-EXC' },
    ],
    email: [
      { vp: 'RFC準拠/非準拠形式の判定', tech: '同値分割', cat: 'C-EQ' },
      { vp: '最大長・国際化ドメイン(IDN)', tech: '境界値分析', cat: 'C-I18N' },
      { vp: 'ヘッダインジェクション', tech: '攻撃パターン', cat: 'C-SEC' },
    ],
    file: [
      { vp: '許可/非許可の拡張子・MIME偽装', tech: '同値分割', cat: 'C-EXC' },
      { vp: 'サイズ上限・上限+1・0バイト', tech: '境界値分析', cat: 'C-BVA' },
      { vp: '実行ファイル偽装・パストラバーサル', tech: '攻撃パターン', cat: 'C-SEC' },
    ],
  },

  // 機能フラグごとの横断観点
  byFlag: {
    auth: [
      { vp: '未認証アクセスの拒否', tech: '異常系', cat: 'C-SEC' },
      { vp: 'セッション期限切れ後の挙動', tech: '状態遷移', cat: 'C-STATE' },
      { vp: '権限昇格・水平権限の越境不可', tech: '攻撃パターン', cat: 'C-SEC' },
    ],
    integration: [
      { vp: '外部API タイムアウト・接続失敗', tech: '異常系', cat: 'C-EXC' },
      { vp: '部分失敗・リトライ・冪等性', tech: '異常系', cat: 'C-EXC' },
      { vp: '応答遅延時のUX/ローディング', tech: '性能', cat: 'C-PERF' },
    ],
    money: [
      { vp: '丸め・端数処理の方式', tech: '境界値分析', cat: 'C-DATA' },
      { vp: '金額の上限・負数・0・通貨単位', tech: '境界値分析', cat: 'C-BVA' },
      { vp: '取引の監査ログ記録', tech: 'データ整合', cat: 'C-DATA' },
    ],
    pii: [
      { vp: '画面表示時のマスキング', tech: '同値分割', cat: 'C-SEC' },
      { vp: '保存時暗号化・アクセス監査', tech: 'データ整合', cat: 'C-DATA' },
    ],
    state: [
      { vp: '正常な状態遷移の網羅', tech: '状態遷移', cat: 'C-STATE' },
      { vp: '不正な状態遷移の拒否', tech: '状態遷移', cat: 'C-STATE' },
    ],
    concurrent: [
      { vp: '同時更新の競合（楽観/悲観ロック）', tech: '同時実行', cat: 'C-CONC' },
      { vp: '二重送信・多重クリック防止', tech: '同時実行', cat: 'C-CONC' },
    ],
    perf: [
      { vp: '想定最大データ量での応答時間', tech: '性能', cat: 'C-PERF' },
      { vp: '同時接続数・スパイク負荷', tech: '負荷', cat: 'C-PERF' },
    ],
  },

  // 常に適用する基本観点
  always: [
    { vp: '正常系ハッピーパス', tech: '同値分割', cat: 'C-FUNC' },
    { vp: '必須項目の欠落', tech: '異常系', cat: 'C-EXC' },
    { vp: '主要ブラウザ/OSでの互換', tech: '互換性', cat: 'C-COMPAT' },
    { vp: 'エラーメッセージの分かりやすさ', tech: 'ユーザビリティ', cat: 'C-USAB' },
  ],

  // ── 業種別観点（Phase 2: 知識資産の深化） ──
  byIndustry: {
    finance: [
      { vp: 'PCI-DSS準拠: カード番号の暗号化・マスキング（PAN非保持）', tech: '攻撃パターン', cat: 'C-SEC' },
      { vp: 'SOX準拠: 金融取引の承認フロー・電子監査証跡', tech: 'データ整合', cat: 'C-DATA' },
      { vp: '為替レート変動時の金額再計算・通貨丸め', tech: '境界値分析', cat: 'C-BVA' },
      { vp: '振込・送金の二重処理防止（冪等性キー）', tech: '同時実行', cat: 'C-CONC' },
      { vp: '残高不足・残高0境界での決済拒否とエラーメッセージ', tech: '境界値分析', cat: 'C-BVA' },
      { vp: '利率・手数料の端数処理方式（切り上げ/切り捨て/四捨五入）の一貫性', tech: '境界値分析', cat: 'C-DATA' },
    ],
    ecommerce: [
      { vp: 'カート追加→在庫減算の同時更新競合（在庫オーバーセル防止）', tech: '同時実行', cat: 'C-CONC' },
      { vp: 'クーポン・割引の重複適用・上限額・有効期限境界チェック', tech: '境界値分析', cat: 'C-BVA' },
      { vp: '配送料計算（重量・距離・地域・キャンペーン条件の組合せ）', tech: '境界値分析', cat: 'C-DATA' },
      { vp: '決済失敗後の在庫・ポイント・クーポンのロールバック', tech: '状態遷移', cat: 'C-STATE' },
      { vp: '売り切れ・入荷待ち商品のカート追加/購入フローの制御', tech: '異常系', cat: 'C-EXC' },
      { vp: '消費税率・国別税率・インボイス対応の計算精度', tech: '同値分割', cat: 'C-DATA' },
    ],
    healthcare: [
      { vp: '患者氏名・診断名・病歴のマスキング表示（RBAC対応）', tech: '同値分割', cat: 'C-SEC' },
      { vp: '処方・投薬量の上限値・下限値チェック（過量・過少防止）', tech: '境界値分析', cat: 'C-BVA' },
      { vp: '診療記録の改ざん不可・削除不可・操作ログ必須', tech: 'データ整合', cat: 'C-DATA' },
      { vp: 'HIPAA/個人情報保護法: PHI非暗号化での保存・送信の拒否', tech: '攻撃パターン', cat: 'C-SEC' },
      { vp: 'ロール別アクセス制御（医師/看護師/患者/管理者の権限分離）', tech: '異常系', cat: 'C-SEC' },
      { vp: 'バイタルアラート閾値超過時の通知・エスカレーションフロー', tech: '状態遷移', cat: 'C-STATE' },
    ],
    saas: [
      { vp: 'マルチテナント: 他テナントデータへのアクセス不可（テナント分離）', tech: '攻撃パターン', cat: 'C-SEC' },
      { vp: 'APIレート制限: 上限超過時の429応答・Retry-Afterヘッダ・段階的スロットリング', tech: '境界値分析', cat: 'C-BVA' },
      { vp: 'サブスクリプション期限切れ後の機能制限・猶予期間・再有効化', tech: '状態遷移', cat: 'C-STATE' },
      { vp: 'プランダウングレード時のデータ保持ポリシーと機能ロック', tech: '状態遷移', cat: 'C-STATE' },
      { vp: 'ウェブフック: 配信失敗時のリトライ・冪等性・署名検証', tech: '異常系', cat: 'C-EXC' },
      { vp: 'SSO/SAML/OIDC: 外部IdPタイムアウト・フェイルオーバー・セッション同期', tech: '異常系', cat: 'C-EXC' },
    ],
  },

  // ── 欠陥パターンDB（業界共通の既知バグパターン＝知識資産） ──
  defectPatterns: [
    {
      id: 'DP-001', cat: 'C-BVA',
      pattern: 'オフバイワンエラー（Off-by-One）',
      example: '上限チェックに < を使い = を忘れ、上限値そのものが通過してしまう',
      prevention: '境界値をBVAで必ずカバー。チェック条件の包含/非包含を仕様に明記する',
    },
    {
      id: 'DP-002', cat: 'C-CONC',
      pattern: 'TOCTOU（検証後使用間競合）',
      example: '在庫チェック後〜在庫更新前に別セッションが同一在庫を先着で消費',
      prevention: 'DBトランザクション/楽観ロックで検証と更新を原子的に実行する',
    },
    {
      id: 'DP-003', cat: 'C-SEC',
      pattern: 'SQLインジェクション',
      example: "WHERE id = '+userId+' のような動的SQL文字列結合",
      prevention: 'プリペアドステートメント/ORMを必須化。動的SQL生成をレビューで禁止',
    },
    {
      id: 'DP-004', cat: 'C-DATA',
      pattern: '浮動小数点丸め誤差',
      example: '0.1+0.2 が 0.30000000000000004 になり金額計算がずれる',
      prevention: 'Decimal/BigDecimal等の固定小数点型を使用。金額は整数（最小通貨単位）で管理',
    },
    {
      id: 'DP-005', cat: 'C-STATE',
      pattern: '状態遷移漏れ',
      example: '「承認→却下」のみ考慮し「承認→差し戻し→再提出」経路を漏らす',
      prevention: '状態遷移表で全遷移と禁止遷移を列挙。正/負パスをテスト設計に組み込む',
    },
    {
      id: 'DP-006', cat: 'C-EXC',
      pattern: 'タイムゾーン依存バグ',
      example: 'UTC→JST変換漏れで締め切り日が1日ずれ、期限判定が誤動作する',
      prevention: '日付はUTC統一・変換はUIレイヤのみ実施。テストはTZを明示してCI実行',
    },
    {
      id: 'DP-007', cat: 'C-PERF',
      pattern: 'N+1クエリ問題',
      example: 'リスト100件取得後、各行で個別DBクエリを発行し計101回のSQLが走る',
      prevention: 'JOINまたはEager loadで一括取得。クエリログ/APMで本番前に検出',
    },
    {
      id: 'DP-008', cat: 'C-SEC',
      pattern: 'IDOR（不適切な直接オブジェクト参照）',
      example: '/api/orders/123 のIDを124に変えて他ユーザーの注文が参照できる',
      prevention: '全取得操作でオーナーシップ・権限を必ずサーバー側で検証する',
    },
    {
      id: 'DP-009', cat: 'C-I18N',
      pattern: 'サロゲートペア切断',
      example: '文字列長制限で絵文字（U+1F600等）を途中切断し文字化けが発生',
      prevention: 'codePoint単位でカウント・スライス。DB文字コードをutf8mb4等に統一',
    },
    {
      id: 'DP-010', cat: 'C-EQ',
      pattern: '型強制比較ミス',
      example: 'if (status == 0) で文字列 "0" にも誤マッチしビジネスロジックが誤作動',
      prevention: '厳格等価（===）を統一使用。型変換が必要な箇所は明示的に行う',
    },
    {
      id: 'DP-011', cat: 'C-CONC',
      pattern: '二重送信（Double Submit）',
      example: '購入ボタン連打で同一注文が2件DBに登録され在庫が過剰減少する',
      prevention: 'クライアント側ボタン即時無効化＋サーバー側冪等性キー（UUID）の必須チェック',
    },
    {
      id: 'DP-012', cat: 'C-DATA',
      pattern: '孤立レコード（外部キー未整合）',
      example: '親テーブル削除後も子レコードが残存し参照時にNullPointerException',
      prevention: 'DB制約（CASCADE/RESTRICT）設定または削除前の子レコード存在確認ロジック',
    },
  ],

  // ユーティリティ
  industryName(key) {
    return { finance: '金融', ecommerce: 'EC/小売', healthcare: '医療/ヘルスケア', saas: 'SaaS/B2B' }[key] || key;
  },

  catName(id) {
    const c = this.categories.find(x => x.id === id);
    return c ? c.name : id;
  },
};
