/* data.js — サービスカタログ定義とメニュー構造
 * kind: 'catalog'（人的支援サービス＝詳細表示） / 'tool'（実working MVPツール）
 */

const SERVICES = {
  /* ── 品質PMO（カタログ：人的支援サービス） ── */
  consultant: {
    icon: '👔', iconBg: '#e8edf8', group: 'quality', kind: 'catalog',
    title: 'コンサルタント派遣', category: '品質PMO › プロフェッショナル支援',
    breadcrumb: ['品質PMO', '品質評価支援軸', 'プロフェッショナル支援', 'コンサルタント派遣'],
    desc: '豊富な経験を持つ品質コンサルタントを派遣し、現場に入り込んで課題を特定・解決します。',
    features: [
      { icon: '🔍', title: '課題アセスメント', desc: '品質課題を多角的に分析し優先度付けします' },
      { icon: '🤝', title: '伴走支援', desc: 'チームに入って実務レベルで支援します' },
      { icon: '📊', title: '定量的改善', desc: 'KPIを設定し進捗を可視化します' },
      { icon: '🔄', title: '知識移転', desc: '自走できるようノウハウを移転します' },
    ],
    steps: ['ヒアリング', '課題分析', '改善計画', '現場支援', '効果測定'],
    tags: ['品質改善', 'PMO支援', 'ISO 25010'],
    cta: 'コンサルタント派遣について相談する',
  },
  planning: {
    icon: '📋', iconBg: '#e8edf8', group: 'quality', kind: 'catalog',
    title: '各種策定支援', category: '品質PMO › プロフェッショナル支援',
    breadcrumb: ['品質PMO', '品質評価支援軸', 'プロフェッショナル支援', '各種策定支援'],
    desc: 'テスト計画書・品質計画書・プロセス定義書などをISO 29119/ISTQB準拠で策定支援します。',
    features: [
      { icon: '📝', title: 'テスト計画策定', desc: 'ISO 29119準拠の計画書を作成します' },
      { icon: '⚙️', title: 'プロセス定義', desc: '組織に合わせた品質プロセスを定義します' },
      { icon: '✅', title: '品質基準設計', desc: '終了基準・受入条件を明確化します' },
      { icon: '🗂️', title: 'テンプレ整備', desc: '再利用可能な雛形を整備します' },
    ],
    steps: ['ヒアリング', 'ドラフト', 'レビュー', '承認・展開'],
    tags: ['ISO 29119', 'ISTQB', 'プロセス定義'],
    cta: '策定支援について相談する',
  },
  impl: {
    icon: '⚡', iconBg: '#e8edf8', group: 'quality', kind: 'catalog',
    title: '実装推進支援', category: '品質PMO › プロフェッショナル支援',
    breadcrumb: ['品質PMO', '品質評価支援軸', 'プロフェッショナル支援', '実装推進支援'],
    desc: '品質改善施策・新プロセスの実装フェーズを推進し、計画を確実に実行へ移します。',
    features: [
      { icon: '🚀', title: '推進管理', desc: '実装タスクの進捗とボトルネックを管理します' },
      { icon: '🛠️', title: 'ツール導入', desc: 'ツールの選定・導入・定着を支援します' },
      { icon: '👥', title: '関係者調整', desc: '合意形成を円滑に進めます' },
      { icon: '📈', title: '定着化', desc: '新プロセスの定着までフォローします' },
    ],
    steps: ['計画確認', '準備', 'パイロット', '本展開', '定着確認'],
    tags: ['変革管理', 'プロセス改善', 'ツール導入'],
    cta: '実装推進支援について相談する',
  },
  advisor: {
    icon: '🎯', iconBg: '#e8edf8', group: 'quality', kind: 'catalog',
    title: '顧問型支援', category: '品質PMO › プロフェッショナル支援',
    breadcrumb: ['品質PMO', '品質評価支援軸', 'プロフェッショナル支援', '顧問型支援'],
    desc: '継続的な顧問契約により、中長期の品質向上を伴走支援します。',
    features: [
      { icon: '📅', title: '月次レビュー', desc: '定期的に品質状況をレビューします' },
      { icon: '💬', title: '随時相談', desc: '品質課題に素早く対応します' },
      { icon: '🗺️', title: '品質ロードマップ', desc: '中長期の向上計画を策定します' },
      { icon: '🏅', title: '組織能力向上', desc: '品質マインドを底上げします' },
    ],
    steps: ['契約', '初期診断', '月次レビュー', '改善推進', '継続改善'],
    tags: ['継続支援', '顧問契約', '品質戦略'],
    cta: '顧問型支援について相談する',
  },
  education: {
    icon: '🎓', iconBg: '#fff3e0', group: 'quality', kind: 'catalog',
    title: '教育・示唆', category: '品質PMO › 品質評価支援軸',
    breadcrumb: ['品質PMO', '品質評価支援軸', '教育・示唆'],
    desc: 'ISTQBを軸にした体系的教育から現場ワークショップまで、品質教育を提供します。',
    features: [
      { icon: '📚', title: 'ISTQB研修', desc: 'Foundation〜Advanced対応の研修' },
      { icon: '🖥️', title: 'ハンズオン', desc: '実ツール・事例を使う実践研修' },
      { icon: '💡', title: '品質思考醸成', desc: '品質を作り込む文化を根付かせます' },
      { icon: '📊', title: '習熟度評価', desc: 'before/afterで効果を可視化します' },
    ],
    steps: ['ニーズ把握', '設計', '研修', '演習', '効果測定'],
    tags: ['ISTQB', 'トレーニング', '人材育成'],
    cta: '教育プログラムについて相談する',
  },
  project: {
    icon: '📌', iconBg: '#fce4ec', group: 'quality', kind: 'catalog',
    title: 'プロジェクト推進', category: '品質PMO',
    breadcrumb: ['品質PMO', 'プロジェクト推進'],
    desc: 'スケジュール・リスク・ステークホルダー管理を品質視点でワンストップ支援します。',
    features: [
      { icon: '📆', title: 'スケジュール管理', desc: 'WBS・ガントの作成と可視化を支援します' },
      { icon: '⚠️', title: 'リスク管理', desc: 'リスクの特定・評価・対策を実施します' },
      { icon: '📣', title: '報告体制', desc: '報告ラインとフォーマットを整備します' },
      { icon: '🔗', title: '横断調整', desc: '部門・チーム間の調整を円滑化します' },
    ],
    steps: ['計画', 'キックオフ', '推進', '課題対応', 'クローズ'],
    tags: ['PM', 'PMO', 'リスク管理', 'WBS'],
    cta: 'プロジェクト推進支援について相談する',
  },
  'test-promo': {
    icon: '🧪', iconBg: '#e8f5e9', group: 'quality', kind: 'catalog',
    title: 'テスト推進', category: '品質PMO',
    breadcrumb: ['品質PMO', 'テスト推進'],
    desc: 'テストマネージャーとして計画・実行・報告を推進し、リリース判定まで支援します。',
    features: [
      { icon: '📋', title: 'テスト計画管理', desc: '立案から承認まで一気通貫で管理します' },
      { icon: '🔬', title: '実施管理', desc: '進捗・カバレッジを管理します' },
      { icon: '🚦', title: '品質ゲート', desc: 'リリース判定基準を運用します' },
      { icon: '📊', title: 'テスト報告', desc: 'ISO 29119準拠のレポートを作成します' },
    ],
    steps: ['計画', '設計', '実施', '分析', 'リリース判定'],
    tags: ['テスト管理', 'ISO 29119', '品質ゲート'],
    cta: 'テスト推進支援について相談する',
  },

  /* ── AIサービス（実working MVPツール。AIなし＝決定的アルゴリズム） ── */
  'doc-verify': {
    icon: '📄', iconBg: '#e8f5e9', group: 'ai', kind: 'tool', tool: 'docVerifier',
    title: 'ドキュメント検証', category: 'AIサービス › AIツール',
    breadcrumb: ['AIサービス', 'AIツール', 'ドキュメント検証'],
    desc: 'ルールベース校正（textlint/RedPen系）で曖昧語・冗長文・必須節欠落を検出します。',
    tags: ['校正', '曖昧語検出', 'ISTQB severity'],
  },
  trace: {
    icon: '🔗', iconBg: '#e8f5e9', group: 'ai', kind: 'tool', tool: 'traceability',
    title: 'トレーサビリティ', category: 'AIサービス › AIツール',
    breadcrumb: ['AIサービス', 'AIツール', 'トレーサビリティ'],
    desc: '要件↔テストのRTMを生成し、カバレッジ・未カバー要件・孤立テストを算出します。',
    tags: ['RTM', 'カバレッジ', '影響分析'],
  },
  'plan-ai': {
    icon: '🗓️', iconBg: '#e8f5e9', group: 'ai', kind: 'tool', tool: 'testPlan',
    title: '計画策定', category: 'AIサービス › AIツール',
    breadcrumb: ['AIサービス', 'AIツール', '計画策定'],
    desc: 'ISO 29119-3構造のテスト計画書をフォーム入力から自動生成します。',
    tags: ['ISO 29119', 'テスト計画', '自動生成'],
  },
  'test-design': {
    icon: '✏️', iconBg: '#e8f5e9', group: 'ai', kind: 'tool', tool: 'testDesign',
    title: 'テスト設計', category: 'AIサービス › AIツール',
    breadcrumb: ['AIサービス', 'AIツール', 'テスト設計'],
    desc: 'ISTQB技法（境界値・同値分割・ペアワイズ）でテストケースを自動生成します。',
    tags: ['境界値', '同値分割', 'ペアワイズ', 'ISTQB'],
  },
  uiux: {
    icon: '🖥️', iconBg: '#e8f5e9', group: 'ai', kind: 'tool', tool: 'uiuxChecker',
    title: 'UI/UX検証', category: 'AIサービス › AIツール',
    breadcrumb: ['AIサービス', 'AIツール', 'UI/UX検証'],
    desc: 'axe-core（WCAG）＋決定的ヒューリスティックでアクセシビリティを検証します。',
    tags: ['axe-core', 'WCAG', 'アクセシビリティ'],
  },
  'test-auto': {
    icon: '🤖', iconBg: '#e3f2fd', group: 'ai', kind: 'tool', tool: 'testAuto',
    title: 'テスト自動化（UI・API・BAT）', category: 'AIサービス › 自動化サービス',
    breadcrumb: ['AIサービス', '自動化サービス', 'テスト自動化（UI・API・BAT）'],
    desc: 'Playwright / pytest+requests / bats のテストscaffoldを生成します。',
    tags: ['Playwright', 'pytest', 'bats', 'scaffold'],
  },
  cicd: {
    icon: '🔄', iconBg: '#e3f2fd', group: 'ai', kind: 'tool', tool: 'cicd',
    title: 'CI/CD構築', category: 'AIサービス › 自動化サービス',
    breadcrumb: ['AIサービス', '自動化サービス', 'CI/CD構築'],
    desc: 'ランタイム別にGitHub Actionsのパイプライン（build→test→gate→deploy）を生成します。',
    tags: ['GitHub Actions', 'CI/CD', 'YAML生成'],
  },
};

/* メニュー構造（ツリー）。リーフは SERVICES の id を参照。 */
const NAV_TREE = [
  {
    label: '品質PMO', icon: '🛡️', iconBg: '#e8edf8',
    children: [
      {
        label: '品質評価支援軸',
        children: [
          {
            label: 'プロフェッショナル支援',
            children: [
              { id: 'consultant' }, { id: 'planning' }, { id: 'impl' }, { id: 'advisor' },
            ],
          },
          { id: 'education' },
        ],
      },
      { id: 'project' },
      { id: 'test-promo' },
    ],
  },
  {
    label: 'AIサービス', icon: '🤖', iconBg: '#e8f5e9',
    children: [
      {
        label: 'AIツール',
        children: [
          { id: 'doc-verify' }, { id: 'trace' }, { id: 'plan-ai' },
          { id: 'test-design' }, { id: 'uiux' },
        ],
      },
      {
        label: '自動化サービス',
        children: [{ id: 'test-auto' }, { id: 'cicd' }],
      },
    ],
  },
];
