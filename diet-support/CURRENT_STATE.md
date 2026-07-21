# CURRENT_STATE.md — diet-support

> **更新タイミング**: 各セッション終了時に更新する。
> **次回開始**: 「CURRENT_STATE.mdを読んで再開して」の1行でコンテキスト復元。

---

## プロジェクト名

diet-support（体重管理 PWA / recstyle 乗り換え）

## 最終更新

2026-07-21

## 現在のフェーズ

実装中（MVP 完成・動作確認済み）

## 直近の完了タスク

- `_template/` をコピーして diet-support を作成
- PWA 一式を実装: index.html / app.js / manifest.json / sw.js / icons
- 機能: 体重・体脂肪率記録、BMI 自動計算、目標進捗、推移グラフ（自作 SVG・移動平均・目標ライン）、履歴編集/削除
- recstyle CSV インポート（列自動判別・複数日付形式対応）、JSON エクスポート/インポート
- localStorage 永続化（スキーマ version + migration hook）
- GitHub Pages 自動デプロイ用ワークフロー追加（`.github/workflows/deploy-diet-support.yml`）
- Playwright ヘッドレスで全画面のスモークテスト実施（ランタイムエラーなし）

## 次のタスク（最優先）

- GitHub Pages を有効化して公開（Settings → Pages → Source: GitHub Actions）
- 実機（Galaxy Z Fold5 / iPhone Safari）で「ホーム画面に追加」動作確認
- recstyle の実エクスポート CSV で取り込み検証（列名が想定と違う場合は `parseRecstyle()` のエイリアス追加）

## 未解決の判断待ち事項

- recstyle の実 CSV フォーマット（列名・日付形式）が未確認。実ファイルが手に入り次第、パーサのエイリアスを調整
- Pages 公開方式（リポジトリ直下 or サブパス）はユーザー環境の設定次第

## 既知の問題・技術的負債

- Google Fonts はオンライン時のみ。オフライン/取得失敗時は system font にフォールバック（意図通り）
- グラフの横軸は等間隔でなく日付スケール。記録が疎な期間は点が寄る（仕様）

## 重要な設計決定

- チャートは外部ライブラリ不使用の自作 SVG（オフライン要件・ゼロ依存のため）
- すべて相対パス（`./`）で、Pages のサブパス公開でも動くようにした
- データは端末内 localStorage のみ。外部送信なし（プライバシー・ゼロコスト）

## セッション開始時の指示テンプレート

```
CURRENT_STATE.mdを読んで、次のタスクから作業を再開してください。
プロジェクト: /Users/fujimagariyuki/Desktop/app/sandbox/diet-support/
```
