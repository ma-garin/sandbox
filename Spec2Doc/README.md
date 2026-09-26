# Spec2Doc

## 概要

既存システムのソースコード（GitHub リポジトリ・ローカルフォルダ）を解析し、リバースエンジニアリングで仕様書などの各種ドキュメントを生成するツール。
モダナイゼーション・マイグレーション案件で、仕様書が失われた・古くなった現行システムの「いま動いている仕様」を復元するために使う。

## 入力

- GitHub リポジトリ（URL＋ブランチ・タグ・コミット。非公開は環境変数 `GITHUB_TOKEN`）
- .zip（Web でアップロード、または CLI でパス指定）
- ローカルフォルダ／ファイル
- 第 1 リリースの解析対象は JavaScript・TypeScript・HTML・CSS（HTML 内の script・style を含む）

## 出力

D01 概要書／D02 要求仕様書／D03 画面仕様書／D04 データ仕様書／D05 データ連携仕様書／D06 依存ライブラリ一覧／
D07 移行論点・技術的負債一覧／D08 解析カバレッジ・追跡レポート／D09 確認事項一覧／D11 基本設計書／D12 詳細設計書／
D13 テスト観点表（ISTQB の同値分割・境界値分析・デシジョンテーブル・状態遷移・エラー推測）。
形式は Markdown・HTML・Word（.docx）・Excel（.xlsx）と **HTML（トレーサビリティ）**。各記述に根拠（事実＝ソース位置／推測（LLM・解析による対応付け）／不明＝D09 番号）が付く。

- 図: D03 画面遷移図・D11 モジュール依存図・D12 呼び出し関係図（HTML は SVG、Markdown は mermaid）
- D04 CRUD 表、D05 共通の送信処理を経由した連携の URL・メソッド、D07 変更影響分析、D08 確度のまとめ・自動度
- 前回の実行との差分: 同じ入力元でもう一度実行すると、改版履歴に変わった節（位置だけの変化は別に数える）と版が出る。自動実行はしない
- トレーサビリティ（`traceability.html`・`trace.json`）: フォルダ・ファイル・コード要素・文書・節の関係図（Obsidian のグラフビュー型。既定は概観、点を選ぶと周辺を展開）、対応の管理（状態＝未確認／確認済み／要修正／対象外、メモ、一括変更、文書→節の束ね）、抜け（どこからも記述されないファイル・要素）。Web から開くと確認状態はサーバに保存され、次の実行へ引き継がれる。ファイル単体で開いた場合はブラウザに保存し JSON・CSV で書き出せる

## デモ

- 画面の「デモのサンプルで試す」を押して「文書を作る」→ 結果の「トレーサビリティ」から開く
- サンプルは `fixtures/demo-library/`（図書館の貸出システム・16 ファイル・約 1,100 行。意図的に入れた論点は同フォルダの README）
- 生成済みの一式は `demo/library-output/`（サーバ無しで各 HTML を開ける。トレーサビリティの保存はブラウザ内）

## セットアップ

```bash
cd Spec2Doc
npm install          # Node.js 25 以上。ビルドは不要
```

## 使い方

```bash
# Web 画面（主な使い方）: http://127.0.0.1:8765 を開く（自端末からのみ接続可）
npm run web                      # ポートを変えるなら PORT=9000 npm run web

# CLI
node src/cli.ts --folder fixtures/sample-app --out out \
  --docs D01,D02,D03,D04,D05,D06,D07,D08,D09,D11,D12 --format md,html,docx,xlsx
node src/cli.ts --github https://github.com/<owner>/<repo> --ref main --out out
node src/cli.ts --zip ./src.zip --out out --exclude 'vendor/**'
node src/cli.ts --help           # 終了コード: 0 成功／1 一部のファイルが解析失敗／2 入力の誤り

# LLM による説明文（既定は無効。ソースを外部に送る）
ANTHROPIC_API_KEY=... node src/cli.ts --folder <dir> --out out --llm
```

結果は `out/<実行ID>/` に文書・`ir.json`（中間表現）・`run-log.json`（入力・処理時間・件数・LLM 使用量）として残る。

## テスト

```bash
npm test             # node:test（単体・結合・E2E。Web の E2E はサーバを自動で起動・停止）
```

## メモ

- 実装方針は `PLAN.md`。工程承認は保守者の指示（2026-09-25）で省略し、要件定義書 `docs/lifecycle/01-requirements.md` を直接入力にした
- 検証記録: `docs/verify/p3-security.md`・`p3-content.md`・`p3-ui.md`
- デザインは yuki-aidd-kit の design-system を無改変で使用。Web は kit の `tokens.css`・`components.css`・`layout.css`・`feedback.js`・`icons.js` を `src/web/` に複製（demo-shell の骨格）。HTML 出力は同じ CSS とアイコンを `src/render/kit-css.ts` に写して埋め込み（`.layout-2pane`）。kit を更新したら `node src/render/sync-kit-css.ts` と `src/web/` への再複製を行う（テストが kit との一致を確かめる）
