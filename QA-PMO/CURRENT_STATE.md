# CURRENT STATE

## プロジェクト
PMOサービス提供基盤（QA-PMO）

## 全体アーキテクチャ
- **platform/**（メイン成果物）: 提供メニュー＋実working MVP（AIなし・確立技術・ゼロ依存静的サイト）
- **apps/**: AI連携版を個別実装（例: uiux-verifier = OpenAI連携）
- **pmo-menu.html**: 初期カタログデモ（platformの前身）

## 現在のフェーズ
統合プラットフォーム（AIなしMVP）実装完了

## 直近の決定事項
- 一度の実装でメニュー＋プラットフォーム＋実機能（AIなしMVP）を構築
- AIが使えない制約 → 全機能を決定的アルゴリズム/確立OSSで実装
  - ドキュメント検証=ルールベース校正 / トレーサビリティ=RTM /
    計画策定=ISO29119テンプレ / テスト設計=境界値・同値・ペアワイズ /
    UI/UX=axe-core＋DOM検査 / テスト自動化=scaffold生成 / CI/CD=YAML生成
- ゼロ依存（バックエンド・ビルドなし）。axe-coreのみCDN（フォールバックあり）

## 検証済み
- 全JS構文チェック（node --check）
- ペアワイズの全ペア網羅をテスト（9ケースで21ペア網羅）

## 未解決事項 / 次フェーズ
- qa-review-standardsによる通しQAレビュー
- GitHub Pagesデプロイ（personal-pwa方針）
- 各ツールのAI強化版（apps/配下、要API基盤）

## 最終更新
2026-06-19
