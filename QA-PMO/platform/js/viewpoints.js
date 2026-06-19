/* viewpoints.js — テスト観点ナレッジベース（差別化の中核資産）
 *
 * これは単なる定数ではなく「観点表（test viewpoint library）」という知識資産。
 * SHIFT/ベリサーブ型の優位性の源泉である“蓄積された観点”をコード資産化したもの。
 * - 拡張可能（業界別・顧客別の観点を追記して育てる）
 * - バージョン管理可能（観点の改廃を追跡）
 * - 将来そのままRAGの知識源（AI版の精度の堀）になる
 *
 * 各観点は { vp:観点, tech:適用技法(ISTQB), cat:カテゴリID } を持ち、
 * 生成された各テスト条件は観点ID→技法→カテゴリへ追跡可能（監査証跡）。
 */

const VIEWPOINTS = {
  version: '1.0.0',

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

  // カテゴリID→名称
  catName(id) {
    const c = this.categories.find(x => x.id === id);
    return c ? c.name : id;
  },
};
