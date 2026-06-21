# CURRENT_STATE.md — QA Knowledge Reverse Docs

> **更新タイミング**: 各セッション終了時に更新する。
> **次回開始**: 「CURRENT_STATE.mdを読んで再開して」の1行でコンテキスト復元。

---

## プロジェクト名

QA Knowledge Reverse Docs

## 最終更新

2026-06-21

## 現在のフェーズ

狩野モデルUI刷新検証済み

## 直近の完了タスク

- Streamlit MVPを追加
- 公開URLのHTML解析、ルールベース文書生成、Markdown/ZIPエクスポートを実装
- pytestの最小テストを追加
- design-systemスキルのMD3 Lightパレットに合わせてUI配色を修正
- `yuki-aidd-kit/` をこのプロジェクトの最上位規約として `AGENTS.md` に明文化
- 現状UIをkit準拠で再修正（日本語UI、MD3 Light、サイドナビ、バッジ、スコアカード、session_state命名）
- Streamlit 1.55の廃止警告に対応し、`use_container_width` を `width="stretch"` に置換
- インシデント修正: URL列挙を利用者に強いる設計をやめ、起点URLから同一ドメイン内リンクを自動探索する標準動線に変更
- sitemap.xml / robots.txt Sitemap / 主要ナビゲーションを使った候補画面探索を追加
- 重要画面分類（ログイン、料金、機能、一覧、詳細、登録、問い合わせ、管理）と優先度・探索理由を追加
- 複数ページの統合分析モデルを追加し、画面一覧、機能一覧、画面遷移、データ項目、外部IF、未確認事項、トレーサビリティを生成
- 文書ごとのレビュー状態（未レビュー / 要確認 / 確認済み / 差戻し）と未確認事項回答メモをUIに追加
- Markdown一括、レビュー済み版、文書別Markdown+CSV ZIP、未確認事項CSVの出力を追加
- Streamlit AppTestで初期表示、起点URL解析後UI、レビュー状態変更、未確認事項回答の保存、CSV反映を検証
- PlaywrightサンプルE2EをローカルStreamlit向けスモークに置換（`PLAYWRIGHT_BASE_URL` 指定時のみ実行）
- pytest 12件 pass、py_compile pass、秘密情報パターン検出なし
- 狩野モデルUXレビューを追加し、当たり前品質 / 一元的品質 / 魅力的品質 / 無関心品質 / 逆品質で改善項目を生成
- 生成文書に `狩野モデルUXレビュー` を追加し、文書数を16件に更新
- ZIP内CSVに `csv/kano-ux-review.csv` を追加
- Streamlit UIを「上部ワークヘッダー」「起点URL優先の入力パネル」「レビュー完了までの残作業」「ダッシュボード / 画面 / 文書レビュー / 根拠・確認事項 / 改善 / 出力」へ再編
- レビュー完了条件（全文書確認済み、High以上リスク確認済み、未確認事項回答済み、出力可能性）をダッシュボードと出力画面に表示
- pytest 13件 pass、py_compile pass、秘密情報パターンは既存実装記録中の検査コマンド文字列のみ一致
- Playwright E2Eをリスクベースで再設計。ローカルfixtureサイトをテスト内HTTPサーバで配信し、初期導線、Fold5幅、解析後の残作業、改善タブ、出力ゲート、文書レビュー状態、未確認事項回答を検証
- Playwright Chromium: 3件 pass。全ブラウザ実行は修正前に6/9 pass、残りはStreamlitタブDOM/reload起因のテスト安定性問題として修正済み。修正後の全ブラウザ再実行は利用上限により未実施

## 次のタスク（最優先）

- 実URLで sitemap/robots/リンク探索の取得失敗パターンを確認
- 必要時のみ Playwright で実ブラウザ/Fold5幅のUI導線を確認
- Playwright全ブラウザ（Chromium/Firefox/WebKit）の修正後再実行
- 狩野モデルUXレビューの実URLサンプルでの有用性を確認
- SQLite永続化、差分再解析、AI補完を段階追加

## 未解決の判断待ち事項

- JavaScript必須サイトをPlaywright対応するか
- LLM補完を任意機能として入れるか

## 既知の問題・技術的負債

- MVPは公開HTMLページのみ対象
- 自動探索は同一ドメインのHTML候補のみ。通常利用者にはページ上限を意識させず、詳細設定に安全上限を置く
- ログイン後画面と動的レンダリングは対象外
- 生成文書は推定であり、人間レビュー前提
- レビュー状態と確認事項回答は現時点ではセッション状態のみで保持し、永続化は未対応
- High以上リスク確認済み状態もセッション状態のみで保持し、永続化は未対応
- UI実装時は必ず yuki-aidd-kit/skills/design-system/SKILL.md を先に参照する
- 実装・設計・テストの各作業で該当kitスキルを読んだ上で進めること

## 重要な設計決定

- `yuki-aidd-kit/` は参考資料ではなく、このプロジェクトの憲法として扱う
- 初期版はAPI利用を控え、HTML解析とルールベース生成を標準にする
- 起点URL1件から sitemap.xml、robots.txt Sitemap、同一ドメイン内リンクを自動探索し、手動URL追加は補助機能にする
- UI/UX確認を優先し、FastAPI/SQLiteは後続拡張に回す
- URLから断定できない情報は推定、根拠、確信度、人間レビュー要否として扱う
- 開発引継ぎ短縮のUI価値は、狩野モデルの当たり前品質を先に満たし、一元的品質と魅力的品質でレビュー効率を上げる方針にする

## セッション開始時の指示テンプレート

```
CURRENT_STATE.mdを読んで、次のタスクから作業を再開してください。
プロジェクト: /Users/fujimagariyuki/Desktop/app/sandbox/QA-knowledge/
```
