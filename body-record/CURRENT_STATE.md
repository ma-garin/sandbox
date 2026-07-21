# CURRENT_STATE.md — body-record

> **更新タイミング**: 各セッション終了時に更新する。
> **次回開始**: 「CURRENT_STATE.mdを読んで再開して」の1行でコンテキスト復元。

---

## プロジェクト名

body-record（体重・体組成記録 PWA / RecStyle 乗り換え / 要件定義書 v0.1 準拠）

## 最終更新

2026-07-21

## 現在のフェーズ

実装中（MVP 完成・全テスト通過。Pages 有効化と実機確認が残る）

## 直近の完了タスク

- 単一ファイル版プロトタイプ `diet-support/` を廃し、仕様準拠の `body-record/` を新設
- 基盤: Vite + TypeScript + vite-plugin-pwa + Vitest + Playwright
- ドメイン層（`src/lib`）: calc / csv / backup / db(Dexie) / settings をUIと分離
- UI: 4タブ（記録/グラフ/履歴/設定）、SCR-01〜06 相当。Chart.js グラフ、CSV取込プレビュー、JSON/CSV入出力、テーマ（light/dark/system）、更新通知
- Must（FR-001〜018）を実装。オフライン（clientsClaim で初回から制御）
- テスト: Vitest 40件 PASS、Playwright E2E 5件 PASS（AC-01 永続化 / AC-02 BMI / AC-04 オフライン / ナビ / スタンプ）
- CI/CD: `.github/workflows/body-record.yml`（build/test/e2e → main で Pages デプロイ）
- ドキュメント整備（README/AGENTS/本ファイル）

## 次のタスク（最優先）

- GitHub Pages を有効化（Settings → Pages → Source: GitHub Actions）して公開
- 実機確認（Android Chrome / Samsung Internet / iPhone Safari）で「ホーム画面に追加」と主要操作
- RecStyle の実エクスポート CSV で取込検証。列名・日付が想定と違えば `src/lib/csv.ts` の `detectColumns` を調整
- Lighthouse で PWA / アクセシビリティに重大問題がないか確認（MVP 完了定義）

## 未解決の判断待ち事項

- RecStyle の実 CSV フォーマット（列名・区切り・日付形式）が未確認。実ファイル入手後にパーサ調整
- Should（月次集計 / カレンダー / PIN / カスタム項目 / 移動平均の既定表示 等）の着手順

## 既知の問題・技術的負債

- E2E はローカルで環境同梱 Chromium を使う場合 `PW_CHROME_PATH` 指定が必要（バージョン差異）。CI では `playwright install` で解決
- npm audit に既知の警告あり（開発依存中心）。実行時バンドルへの影響は要確認

## 重要な設計決定

- 記録は IndexedDB（Dexie、`measuredAt` 主キー）で「1日1件」を DB レベルで保証
- 計算・取込・保存を `src/lib` に集約し UI から分離（テスト容易性・NFR-008）
- `base: './'` で Pages のサブパス配信に対応
- PWA は prompt 更新 + clientsClaim（更新通知を保ちつつ初回からオフライン制御）
- RecStyle の意匠は一切流用せず独自パレット（緑基調）

## セッション開始時の指示テンプレート

```
CURRENT_STATE.mdを読んで、次のタスクから作業を再開してください。
プロジェクト: /Users/fujimagariyuki/Desktop/app/sandbox/body-record/
```
