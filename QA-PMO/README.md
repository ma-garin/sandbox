# QA-PMO プロジェクト

VeriServe（ベリサーブ）の品質PMOサービスを対外向けに可視化・体験できる  
静的Webプラットフォームと、その有効性を裏付けるバリデーション研究のリポジトリ。

---

## 何が入っているか

```
QA-PMO/
├── platform/          # PMOサービスプラットフォーム（メイン成果物）
│   ├── index.html     # エントリポイント — ブラウザで開くだけ
│   ├── styles.css
│   ├── js/
│   │   ├── data.js        # 32サービス定義 + NAV_TREE
│   │   ├── viewpoints.js  # テスト観点ライブラリ v2.0.0
│   │   ├── tools.js       # 実working MVPツール×10
│   │   └── app.js         # ルーター・検索・ナビ
│   ├── tests/
│   │   ├── smoke.js       # Playwright E2Eスモークテスト（24/24 PASS）
│   │   └── package.json
│   ├── docs/              # 設計・要件ドキュメント
│   └── demo-video.html    # 全画面Remotion風デモ（自己完結HTML）
│
├── validation/        # 観点ライブラリのバリデーション研究（事前登録方式）
│   ├── PRE_REGISTRATION.md  # 評価方法の事前宣言（commit 1024e21 で凍結）
│   ├── BUGS.md              # Saleor Commerce 本番障害20件
│   ├── SCORING.md           # 3手法×20件の採点結果
│   └── RESULTS.md           # 最終スコアカード
│
├── apps/              # AI連携版（個別実装。例: uiux-verifier = OpenAI版）
├── pmo-menu.html      # 初期カタログデモ（platformの前身・参考用）
└── CURRENT_STATE.md   # 現状サマリー（開発進行用）
```

---

## 起動方法

ビルド不要。ブラウザでそのまま開く。

```bash
open QA-PMO/platform/index.html
```

---

## プラットフォーム概要

| 項目 | 内容 |
|---|---|
| サービス総数 | **32**（品質PMO 9 / 第三者検証 4 / AIサービス 13 / セキュリティ 3 / ROIほか 3） |
| 実working MVPツール | **10**（AIなし・決定的アルゴリズム） |
| VeriServe製品連携 | GIHOZ / ConTrack / InsighTest / TESTRA / Vex |
| 依存関係 | ゼロ（axe-core のみ CDN、フォールバックあり） |
| テスト | Playwright E2E 24/24 PASS、JSエラー0件 |

### 10の実working MVPツール

| # | ツール | 中核技術 |
|---|---|---|
| 1 | ドキュメント検証 | ルールベース校正（textlint系） |
| 2 | トレーサビリティ（ConTrack相当） | RTM・カバレッジ算出 |
| 3 | 計画策定 | ISO/IEC 29119-3 テンプレ |
| 4 | テスト設計（GIHOZ相当） | 境界値・同値分割・ペアワイズ（all-pairs貪欲法）＋観点ベース設計 |
| 5 | UI/UX検証 | axe-core + DOM決定的ヒューリスティック |
| 6 | テスト自動化 | Playwright/pytest/bats scaffold生成 |
| 7 | CI/CD構築 | GitHub Actions YAML生成 |
| 8 | 観点ライブラリ（v2.0.0） | テスト観点KB・欠陥パターンDB・カバレッジマップ |
| 9 | 欠陥管理 | ISTQB severity・localStorage永続化・CSVエクスポート |
| 10 | ROI計算機 | バリデーション研究結果（85% vs 5〜10%）→ 年間削減額試算 |

---

## バリデーション研究

観点ライブラリの有効性を**事前登録方式**（臨床試験型）で検証した研究。

| 手法 | 全バグ捕捉率（N=20） | ドメイン特有バグ捕捉率（N=16） |
|---|---|---|
| ISTQB/一般チェックリスト | 5% | 0% |
| GPT-4o（標準プロンプト） | 10% | 0% |
| **観点ライブラリ（VeriServe）** | **85%** | **88%** |

詳細 → [`validation/RESULTS.md`](validation/RESULTS.md)

---

## 開発・テスト

```bash
# スモークテスト実行
cd QA-PMO/platform/tests
npm install   # 初回のみ（playwright）
npm test
```

---

## 設計方針

- **AI不使用**：全ツールを決定的アルゴリズム/確立OSSで実装（MVP）
- **ゼロ依存**：バックエンド・ビルド・DBなし。GitHub Pages等へ即デプロイ可
- **品質規格準拠**：ISTQB severity / ISO 25010 / ISO/IEC 29119 を適用
- **VeriServe製品との一致**：サービス定義・製品名・観点ライブラリはすべてVeriServe既存資産を反映
