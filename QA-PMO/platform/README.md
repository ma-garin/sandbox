# PMO統合プラットフォーム

VeriServeの32サービス・10実working MVPツールを1画面に統合した、  
ゼロ依存の静的Webアプリ。ブラウザで `index.html` を開くだけで動く。

---

## 起動

```bash
open QA-PMO/platform/index.html
# または file:// URLをブラウザに直接ドロップ
```

---

## アーキテクチャ

```
platform/
├── index.html          # 骨格（topbar / sidenav / main / modal）
├── styles.css          # デザインシステム（紺系 #1a3a6b）
└── js/
    ├── data.js         # SERVICES（32件）+ NAV_TREE（4大カテゴリ）
    ├── viewpoints.js   # テスト観点ライブラリ v2.0.0（凍結: commit db1c882）
    ├── tools.js        # 実working MVPツール×10
    └── app.js          # ルーター・ナビ生成・検索・問い合わせモーダル
```

### データフロー

```
data.js（SERVICES / NAV_TREE）
  → app.js（buildNav / renderHome / route）
      → tools.js（Tools[service.tool].render(container)）
viewpoints.js（VIEWPOINTS）
  → testDesign ツール（観点ライブラリ適用）
  → viewpointBrowser ツール（KB閲覧・欠陥パターン）
```

---

## サービスカタログ（32サービス）

### 品質PMO（9サービス）
品質コンサルタント派遣 / 各種策定支援 / 実装推進支援 / 顧問型支援 /  
教育・示唆 / プロジェクト推進 / テスト推進 / プロセス診断 / テストプロセス改善

### 第三者検証（4サービス）
ソフトウェアテスト受託 / 組込み・IoT検証 / SAP・業務システム検証 / 負荷・性能・非機能テスト

### AIサービス（16サービス）

#### 実working MVPツール（10）
| ツール | ID | 製品連携 |
|---|---|---|
| ドキュメント検証 | `doc-verify` | — |
| トレーサビリティ | `trace` | ConTrack |
| 計画策定 | `plan-ai` | — |
| テスト設計 | `test-design` | GIHOZ |
| UI/UX検証 | `uiux` | — |
| テスト自動化 | `test-auto` | — |
| CI/CD構築 | `cicd` | — |
| 観点ライブラリ | `viewpoint-kb` | — |
| 欠陥管理 | `defect-mgr` | — |
| ROI計算機 | `roi-calc` | — |

#### カタログサービス（6）
テスト設計エージェント（TESTRA）/ ソースコード静的解析 / OSSリスク管理 /  
探索的テスト支援（InsighTest）/ AI製品の品質保証（QA4AI）/ 生成AIアプリ品質保証

### セキュリティ（3サービス）
Webアプリケーション脆弱性診断（Vex）/ 組込み・IoTセキュリティ診断 / セキュリティトレーニング

---

## ツール仕様

### 1. ドキュメント検証 (`doc-verify`)
- 入力: 要件定義書・設計書等のテキスト（種別選択: 汎用/要件定義書/テスト設計書/API仕様書）
- 処理: 曖昧語辞書（Major/Minor/Critical）+ 一文100字超の長文検出 + 必須節欠落検査
- 出力: Severity別指摘リスト（行番号付き）+ 品質スコア（/100）

### 2. トレーサビリティ (`trace`, ConTrack相当)
- 入力: 要件リスト（`REQ-001, 名称`形式）/ テストケース（`TC-001, REQ-001, 名称`形式）
- 処理: RTM生成・カバレッジ%計算・未カバー要件と孤立テストの抽出
- 出力: トレーサビリティマトリクス + ギャップ一覧

### 3. 計画策定 (`plan-ai`)
- 入力: プロジェクト名・範囲・環境・日程・開始/終了基準・リスク
- 処理: ISO/IEC 29119-3テンプレートへ流し込み
- 出力: Markdown形式のテスト計画書（DLボタン付き）

### 4. テスト設計 (`test-design`, GIHOZ相当)
4タブ構成:
- **観点ベース設計**（差別化機能）: 観点ライブラリv2.0.0から観点を自動適用し、観点カバレッジ%・監査証跡付きでテスト条件を生成。業種別観点（金融/EC/医療/SaaS）対応
- **境界値分析**: 下限-1/下限/下限+1/上限-1/上限/上限+1の6ケース生成
- **同値分割**: 有効・無効クラスを自動分割
- **ペアワイズ**: all-pairs貪欲法で全ペアを網羅する最小ケースセットを生成（CSVダウンロード）

### 5. UI/UX検証 (`uiux`)
- 入力: HTMLソース
- 処理: DOMParser決定的検査（alt/lang/label/button名）+ axe-core WCAG検査（CDN取得成功時）
- 出力: WCAG準拠指摘（ISO 25010対応）

### 6. テスト自動化 (`test-auto`)
- 種別: UI（Playwright TypeScript）/ API（pytest + requests）/ BAT（bats-core）
- 出力: Page Objectパターン等のscaffoldコード（ファイルDLボタン付き）

### 7. CI/CD構築 (`cicd`)
- ランタイム: Node.js / Python / Java（Maven）
- オプション: GitHub Pages デプロイジョブ
- 出力: `build → test → 品質ゲート → deploy` 構成のGitHub Actions YAML

### 8. 観点ライブラリ (`viewpoint-kb`)
3タブ:
- **観点ブラウザ**: キーワード・カテゴリ・種別（常時/項目型/特性/業種）でフィルタ可能な全観点一覧
- **欠陥パターンDB**: 業界の繰り返し欠陥パターンと予防策
- **カバレッジマップ**: カテゴリ別の観点数バーチャート

統計ウィジェット: 観点総数 / カテゴリ数 / 対応業種数 / 欠陥パターン数

### 9. 欠陥管理 (`defect-mgr`)
- ISTQB severity（Critical/Major/Minor/Cosmetic）で登録
- 検出フェーズ・根本原因・ステータス管理（Open→Fixed→Closed等）
- localStorageに永続化（ページ再読み込み後も保持）
- CSVエクスポート対応

### 10. ROI計算機 (`roi-calc`)
- 入力: 業種（6種）/ 年間本番障害件数 / 障害1件コスト（万円）/ 現在のアプローチ
- 根拠: バリデーション研究結果（観点ライブラリ=85%、ISTQB=5%、GPT-4o=10%）
- 出力: 年間コスト削減額 / 年間予防可能障害数 / 投資回収期間 / 3年ROI + 捕捉率バー比較 + 根拠テーブル

---

## スモークテスト

```bash
cd QA-PMO/platform/tests
npm install          # 初回のみ（playwright をローカルインストール）
npm test             # node smoke.js で Chromium を起動し全24ケースを検証
```

現在のテスト結果: **24/24 PASS / JSエラー0件**

テスト項目の概要:
- ホームに32サービスカード表示
- サイドナビに実機能バッジ10件
- 4カテゴリ（品質/検証/AI/セキュリティ）に分類表示
- 製品名チップ（GIHOZ/Vex等）表示
- 全10ツールの動作（結果テーブル・スコア等）
- カタログCTAボタン・製品名バッジ
- 検索機能

---

## デモ動画

`platform/demo-video.html` を開くと9シーン・約66秒の自己完結HTMLアニメーションが再生できる。  
（自動再生ボタン・タイムラインスクラブ・シーンキャプション付き）

---

## 設計原則

| 原則 | 内容 |
|---|---|
| AI不使用 | 全ツールを決定的アルゴリズム/確立OSSで実装。LLMへのAPI呼び出しゼロ |
| ゼロ依存 | バックエンド・ビルドツール・DBなし。`index.html` を開くだけ |
| 品質規格準拠 | ISTQB severity / ISO 25010 / ISO/IEC 29119 を非交渉で適用 |
| 製品名整合 | VeriServe既存製品（GIHOZ/ConTrack/InsighTest/TESTRA/Vex）のサービス定義と完全一致 |
| テスタビリティ | Playwright E2Eスモークテストで全ツールの動作を自動検証 |
