# AGENTS.md — sandbox（全プロジェクト共通）

> このファイルは `/sandbox/` 配下の全プロジェクトに適用される。
> プロジェクト固有の設定は各フォルダの `AGENTS.md` に追記する。

---

## 環境

- 開発機: MacBook Air M1
- サーバ: NEC Mate SFF Win11（常時稼働ローカルサーバ）
- モバイル: Galaxy Z Fold5 → Tailscale + Microsoft Remote Desktop → M1 Mac
- デプロイ先: GitHub Pages（ma-garin）が既定

## 応答・出力スタイル

- 日本語で応答。冗長な前置き禁止
- 専門用語（ISTQB/ISO/Scrum）は定義説明不要で正確に使用
- 提案は「判断軸＋選択肢比較」の形式

## コード規約

- APIキー・認証情報のハードコード禁止（localStorage保存パターンを使用）
- コミット規約: Conventional Commits（feat/fix/docs/refactor/test/chore）
- 1コミット＝1論理変更
- immutableパターン（データ変更時は新オブジェクト作成、元オブジェクトを変更しない）
- エラーは明示的に処理し、UIには分かりやすいメッセージを表示

## トークン・スコープ規律

- 作業前に対象ファイルを確認し、指定外ファイルは読まない
- 「全体を読んでから」系の無差別探索をしない（grep/globで絞ってから読む）
- 大規模タスクは設計・実装・テストに分割して提案する

## QA観点（全プロジェクト共通）

- 成果物はISO/IEC 25010の品質特性で自己レビューしてから提示
- 不具合・指摘はISTQB準拠のseverity分類で報告（Critical/High/Medium/Low）
- 判定はevidence-only（根拠のない指摘はしない）

## sandbox の運用ルール

- 各プロジェクトは独立したフォルダで完結させる（フォルダ間の依存禁止）
- 新規プロジェクトは `_template/` をコピーして開始する
- セッション終了時に `CURRENT_STATE.md` を更新する

## プロジェクト別追記欄

→ 各プロジェクトフォルダ内の `AGENTS.md` を参照
