/**
 * analyzer.js — 仕様テキストの自動解析（キーワード・ルールベース）
 *
 * MVPの中核: 仕様文（要件・機能説明）を読み、テスト観点の生成に必要な
 *   - 入力項目の型（field: number/text/date/select/email/file）
 *   - 機能特性（flag: auth/integration/money/pii/state/concurrent/perf/ai）
 *   - 業種（industry: finance/ecommerce/healthcare/saas）
 * を推定する。決定的（LLM非依存・0円）で、根拠となった語句を evidence として返す。
 *
 * LLM補完は後続フェーズ（任意）。まずルールベースで実用最小を出す。
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.ANALYZER = mod;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 各シグナルのキーワード辞書（日本語＋英語）。小文字化して部分一致で判定。
  const FIELD_KW = {
    number: ["数値", "金額", "個数", "数量", "回数", "点数", "年齢", "件数", "number", "amount", "quantity", "count", "整数", "小数"],
    text: ["氏名", "名前", "テキスト", "文字列", "コメント", "備考", "住所", "タイトル", "説明", "text", "name", "string", "入力欄"],
    date: ["日付", "日時", "期限", "開始日", "終了日", "予約日", "生年月日", "date", "datetime", "期間", "締切", "締め切り"],
    select: ["選択", "プルダウン", "ドロップダウン", "区分", "カテゴリ", "種別", "ラジオ", "select", "dropdown", "リスト選択"],
    email: ["メール", "email", "e-mail", "メールアドレス", "mail"],
    file: ["ファイル", "アップロード", "添付", "画像", "csv", "pdf", "file", "upload", "attachment", "ドキュメント"],
  };

  const FLAG_KW = {
    auth: ["ログイン", "認証", "サインイン", "権限", "ロール", "アクセス制御", "login", "auth", "認可", "パスワード", "session", "セッション", "サインアップ", "会員"],
    integration: ["外部api", "連携", "webhook", "外部システム", "api連携", "third party", "外部サービス", "統合", "integration", "外部連携"],
    money: ["決済", "支払", "支払い", "料金", "課金", "請求", "金額", "価格", "value", "payment", "billing", "購入", "取引", "残高", "送金", "振込"],
    pii: ["個人情報", "氏名", "住所", "電話番号", "生年月日", "マイナンバー", "pii", "個人データ", "機微情報", "患者", "顧客情報"],
    state: ["ステータス", "状態", "承認", "遷移", "ワークフロー", "申請", "却下", "status", "workflow", "state", "フロー", "審査", "下書き", "公開"],
    concurrent: ["同時", "並行", "在庫", "予約", "排他", "競合", "ロック", "concurrent", "同時実行", "二重", "重複登録"],
    perf: ["性能", "大量", "負荷", "レスポンス", "応答時間", "スループット", "パフォーマンス", "performance", "同時接続", "スパイク"],
    ai: ["ai", "生成ai", "llm", "機械学習", "ml", "推論", "モデル", "chatgpt", "生成", "レコメンド", "分類", "予測", "自然言語", "プロンプト"],
  };

  const INDUSTRY_KW = {
    finance: ["金融", "銀行", "証券", "保険", "決済", "ローン", "融資", "口座", "pci", "sox", "fintech", "為替", "残高", "送金", "振込"],
    ecommerce: ["ec", "通販", "カート", "注文", "在庫", "商品", "配送", "クーポン", "購入", "小売", "ショップ", "checkout", "決済"],
    healthcare: ["医療", "病院", "患者", "診療", "処方", "投薬", "カルテ", "hipaa", "phi", "看護", "ヘルスケア", "バイタル"],
    saas: ["saas", "マルチテナント", "サブスク", "テナント", "sso", "saml", "oidc", "api", "b2b", "プラン", "契約プラン"],
  };

  function countHits(lowerText, keywords) {
    const evidence = [];
    for (const kw of keywords) {
      if (lowerText.indexOf(kw.toLowerCase()) !== -1) evidence.push(kw);
    }
    return evidence;
  }

  function detectGroup(lowerText, dict, threshold) {
    threshold = threshold || 1;
    const result = {};
    for (const key of Object.keys(dict)) {
      const evidence = countHits(lowerText, dict[key]);
      if (evidence.length >= threshold) result[key] = evidence;
    }
    return result;
  }

  /**
   * analyze(text, opts) → {
   *   feature, fields:[{name,type,evidence}], flags:[{key,evidence}],
   *   industry:{key,evidence}|null, industryCandidates:{key:evidence[]}
   * }
   */
  function analyze(text, opts) {
    opts = opts || {};
    const raw = (text || "").trim();
    const lower = raw.toLowerCase();

    // 機能名: 先頭行（見出し）を機能名の初期値に採用
    const firstLine = (raw.split(/\r?\n/)[0] || "").trim();
    const feature = opts.feature || firstLine.slice(0, 60) || "対象機能";

    // 入力項目型
    const fieldHits = detectGroup(lower, FIELD_KW);
    const fields = Object.keys(fieldHits).map((type) => ({
      name: type, type: type, evidence: fieldHits[type],
    }));

    // 機能特性フラグ
    const flagHits = detectGroup(lower, FLAG_KW);
    const flags = Object.keys(flagHits).map((key) => ({ key, evidence: flagHits[key] }));

    // 業種: 最多ヒットを採用（同数は辞書順で安定化）
    const industryHits = detectGroup(lower, INDUSTRY_KW);
    let industry = null;
    const indKeys = Object.keys(industryHits);
    if (indKeys.length) {
      indKeys.sort((a, b) => {
        const d = industryHits[b].length - industryHits[a].length;
        return d !== 0 ? d : a.localeCompare(b);
      });
      industry = { key: indKeys[0], evidence: industryHits[indKeys[0]] };
    }

    return {
      feature,
      fields,
      flags,
      industry,
      industryCandidates: industryHits,
      empty: raw.length === 0,
    };
  }

  return { analyze, FIELD_KW, FLAG_KW, INDUSTRY_KW };
});
