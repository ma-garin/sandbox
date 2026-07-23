# CURRENT_STATE.md — body-record

> **更新タイミング**: 各セッション終了時に更新する。
> **次回開始**: 「CURRENT_STATE.mdを読んで再開して」の1行でコンテキスト復元。

---

## プロジェクト名

body-record（体重・体組成記録 PWA / RecStyle 乗り換え / 要件定義書 v0.1 準拠）

## 最終更新

2026-07-23

## 現在のフェーズ

MVP（Must）は main にマージ・GitHub Pages 公開済み。Should 機能を追加実装しフォローPR進行中。

## 直近の完了タスク

- v0.1（Must FR-001〜018）を実装し PR #41 を main へ Squash マージ、Pages 公開（https://ma-garin.github.io/sandbox/）
- **記録タブ改善**: 上部の大きな「◯◯の記録」カードを廃止し、入力フォームを最上部に。サマリーは入力の下へ移動
- **Should 追加（v0.2）**:
  - FR-101 月次集計（グラフ画面に月平均・月内増減・最小最大・記録率）
  - FR-103 カレンダー（履歴で リスト/カレンダー 切替、記録日ハイライト、月間記録率、日タップで編集）
  - FR-105 PIN ロック（起動ゲート、ソルト付き SHA-256、平文非保存）
  - FR-107 継続状況（連続記録日数・月間記録率）
- RecStyle 取込の堅牢化: RecStyleData.csv 前提のガイド文、時刻付き日付の日付採用、テスト追加
- テスト: Vitest 50件 / Playwright E2E 7件（カレンダー・PIN 追加）すべて PASS、型チェック・ビルド成功

## 次のタスク（最優先）

- フォロー PR をレビュー・マージ → main で Pages 自動再デプロイ
- FR-106 カスタム項目（太もも・体温など任意指標）は未実装。データモデル拡張が必要なため次段で対応
- 実機（Android Chrome / Samsung Internet / iPhone Safari）で追加機能の確認・Lighthouse 点検

## 未解決の判断待ち事項

- RecStyle 実 CSV の実物は未確認（ユーザーは送付しない方針）。現行の自動判別で取り込めない列名が出た場合は `src/lib/csv.ts` の `detectColumns` にエイリアス追加で対応
- FR-106 カスタム項目の要否・優先度

## 既知の問題・技術的負債

- E2E はローカルで環境同梱 Chromium を使う場合 `PW_CHROME_PATH` 指定が必要（CI は playwright install で解決）
- npm audit に開発依存中心の警告あり

## 重要な設計決定

- 記録タブは「入力優先」。ダッシュボードは補助として入力フォームの下に配置
- PIN は端末内 localStorage にソルト付きハッシュのみ保存（平文・可逆保存はしない）
- 月次集計・カレンダーは計算層（`src/lib/calc.ts`）に純粋関数として実装しテスト対象化
- 4 タブ（記録/グラフ/履歴/設定）を維持し、カレンダーは履歴内トグル、月次集計はグラフ内カードとして統合

## セッション開始時の指示テンプレート

```
CURRENT_STATE.mdを読んで、次のタスクから作業を再開してください。
プロジェクト: /Users/fujimagariyuki/Desktop/app/sandbox/body-record/
```
