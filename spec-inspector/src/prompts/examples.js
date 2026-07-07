// prompts/examples.js — few-shot例（日本語仕様スニペット＋期待指摘）
//
// 目的: AIの指摘の粒度・severity感・evidence引用の忠実さを固定する。
// 各exampleのoutputは contract.js の parseAIFindings を必ず通過すること
// （tests/prompts.test.mjs の自己整合テストで機械検証される）。

export const FEWSHOT_EXAMPLES = [
  {
    id: "ex-accuracy-1",
    viewpoint: "accuracy",
    input: "セッションの有効期限は30分とする。ただし管理者の操作中はセッションを無期限に維持する。全セッションは30分で強制失効させることでセキュリティを担保する。",
    output: {
      viewpoint: "accuracy",
      severity: "Critical",
      doc: "要件定義書",
      message: "管理者セッションの無期限維持と全セッション30分強制失効が同一文書内で矛盾している",
      evidence: "管理者の操作中はセッションを無期限に維持する",
      suggestion: "管理者セッションを例外とするなら「全セッション」を「管理者を除く全セッション」に修正し、例外の根拠（リスク受容）を明記する",
      expectedEffect: "実装時の解釈齟齬とセキュリティホールの防止",
    },
  },
  {
    id: "ex-accuracy-2",
    viewpoint: "accuracy",
    input: "利用者はポイントを使用して割引を受けられる。ポイントの付与率は購入金額の1%とする。ポイント還元率は購入金額の2%とする。",
    output: {
      viewpoint: "accuracy",
      severity: "High",
      doc: "要件定義書",
      message: "「付与率1%」と「還元率2%」が同一概念の用語揺れか別概念か判別できない",
      evidence: "ポイント還元率は購入金額の2%とする",
      suggestion: "用語集で「付与率」「還元率」を定義し、別概念なら適用場面を明記、同一なら一方に統一する",
      expectedEffect: "ポイント計算ロジックの誤実装防止",
    },
  },
  {
    id: "ex-clarity-1",
    viewpoint: "clarity",
    input: "承認後、通知を送信する。却下した場合は理由を記録し、再申請を促すメールを申請者と承認者に送る。",
    output: {
      viewpoint: "clarity",
      severity: "Medium",
      doc: "基本設計書",
      message: "「再申請を促すメール」の宛先に承認者が含まれる理由が読み取れず、係り受けの誤読余地がある",
      evidence: "再申請を促すメールを申請者と承認者に送る",
      suggestion: "「申請者には再申請案内を、承認者には却下記録の控えを送る」のように宛先ごとに内容を分けて記述する",
      expectedEffect: "通知仕様の誤実装防止",
    },
  },
  {
    id: "ex-visual-1",
    viewpoint: "visual",
    input: "入力チェックは、氏名は必須で50文字以内、メールアドレスは必須で形式チェックあり、電話番号は任意で数字とハイフンのみ、住所は任意で200文字以内、備考は任意で1000文字以内とする。",
    output: {
      viewpoint: "visual",
      severity: "Medium",
      doc: "基本設計書",
      message: "5項目の入力チェック仕様が散文で列挙され、項目×制約の対応が読み取りにくい",
      evidence: "氏名は必須で50文字以内、メールアドレスは必須で形式チェックあり",
      suggestion: "項目／必須／型／桁／形式チェックの列を持つ表に変換する",
      expectedEffect: "チェック仕様の抜け漏れ確認が容易になる",
    },
  },
  {
    id: "ex-depth-1",
    viewpoint: "depth",
    input: "利用者はCSVファイルをアップロードし、システムは内容を取り込んでデータベースに登録する。取り込み完了後、件数を画面に表示する。",
    output: {
      viewpoint: "depth",
      severity: "High",
      doc: "要件定義書",
      message: "CSV取り込みの異常系（形式不正・重複・部分失敗時のロールバック方針）が定義されていない",
      evidence: "内容を取り込んでデータベースに登録する",
      suggestion: "形式不正行の扱い（全体中断/スキップ）、重複キーの扱い、部分失敗時のトランザクション方針を追記する",
      expectedEffect: "データ不整合と実装者判断による仕様化の防止",
    },
  },
  {
    id: "ex-depth-2",
    viewpoint: "depth",
    input: "本機能は複数の担当者が同時に同じ案件を編集できる。保存時に最新の内容で上書きされる。",
    output: {
      viewpoint: "depth",
      severity: "High",
      doc: "要件定義書",
      message: "同時編集の競合制御（後勝ち上書きによる先行更新の消失）が考慮されていない",
      evidence: "保存時に最新の内容で上書きされる",
      suggestion: "楽観ロック（バージョン番号チェック）か編集ロックの方式を定め、競合時のユーザー通知を仕様化する",
      expectedEffect: "更新消失（lost update）の防止",
    },
  },
  {
    id: "ex-reliability-1",
    viewpoint: "reliability",
    input: "本システムは同時接続1万ユーザーまで性能劣化なく動作する。",
    output: {
      viewpoint: "reliability",
      severity: "Medium",
      doc: "基本設計書",
      message: "同時接続1万ユーザーの根拠（見積もり・実測・類似実績）が示されていない断定である",
      evidence: "同時接続1万ユーザーまで性能劣化なく動作する",
      suggestion: "根拠（負荷試験計画・キャパシティ見積もり）を参照として付すか、目標値であることを明示する",
      expectedEffect: "検証不能な性能保証によるリリース判定トラブルの防止",
    },
  },
  {
    id: "ex-verifiability-1",
    viewpoint: "verifiability",
    input: "検索結果は十分に高速に表示されること。体感でストレスのない応答性能を実現する。",
    output: {
      viewpoint: "verifiability",
      severity: "High",
      doc: "要件定義書",
      message: "「十分に高速」「体感でストレスのない」は測定方法がなく合否判定できない",
      evidence: "体感でストレスのない応答性能を実現する",
      suggestion: "「検索結果の初期表示は95パーセンタイルで2秒以内（計測点: APIレスポンス受信まで）」のように数値・計測点・統計量を定義する",
      expectedEffect: "性能テストの合否基準が明確になる",
    },
  },
];

// few-shotブロックを組み立てる。viewpoints="all" または観点keyの配列で絞り込み。
export function fewshotBlock({ viewpoints = "all", max = 4 } = {}) {
  const pool = viewpoints === "all"
    ? FEWSHOT_EXAMPLES
    : FEWSHOT_EXAMPLES.filter((e) => viewpoints.includes(e.viewpoint));
  const picked = pool.slice(0, max);
  if (!picked.length) return "";
  const items = picked.map((e) =>
    `【入力抜粋】${e.input}\n【期待する指摘】${JSON.stringify(e.output)}`
  ).join("\n\n");
  return `## 指摘の粒度の例（この水準・この形式で）\n\n${items}`;
}
