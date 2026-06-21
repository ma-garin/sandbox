# 実装記録

## 2026-06-21

### 目的
開発引継ぎ短縮を最優先価値として、公開URL解析MVPを「自動探索、統合文書生成、人間レビュー、Markdown/CSVエクスポート」まで一気通貫で使える形へ拡張した。

### 実装
- `src/crawler.py`: sitemap.xml、robots.txt の Sitemap 指定、主要ナビゲーション、ページ内リンクから同一ドメイン候補を探索。外部リンク、ファイルリンク、アンカー、重複を除外。画面分類、優先度、探索理由を付与。
- `src/models.py`: `GeneratedDocument` にレビュー状態、確信度、未確認事項を追加。`CrawlCandidate` と `SystemAnalysis` を追加。
- `src/document_builder.py`: 複数ページの統合分析から画面一覧、機能一覧、遷移、データ項目、外部IF、未確認事項、引継ぎ阻害リスク、トレーサビリティを生成。全Markdown文書にレビュー情報、根拠、確信度、未確認事項を追加。
- `src/exporter.py`: 文書別Markdown ZIPにCSV一式を同梱できるようにし、レビュー済み版Markdown、CSV生成を追加。
- `app.py`: レビューダッシュボード、文書別レビュー状態、未確認事項回答メモ、レビュー済み版/CSVエクスポート導線を追加。
- `tests/`: crawler、分類、統合分析、CSV/ZIP出力のpytestを追加。

### 検証
- `pytest tests/ -q`: 9 passed
- `python3 -m py_compile app.py src/*.py`: pass

### 残課題
- レビュー状態と確認事項回答はセッション状態のみ。SQLite永続化は後続。
- ログイン後画面、JavaScript必須画面は後続。
- 実URLでの探索失敗パターン確認とUI E2Eは必要時に実施。

## 2026-06-21 追加検証強化

### 目的
MVP拡張後の実務利用前リスクを下げるため、ネットワークに依存しないStreamlit UIスモークと任意Playwrightスモークを追加した。

### 実装
- `app.py`: AppTestから取得処理を差し替えられるよう、`reverse_fetch_url_fn` と `reverse_crawl_from_seed_fn` をsession_state経由で参照する薄いフックを追加。通常実行では既存の `fetch_url` / `crawl_from_seed` を使用する。
- `app.py`: 未確認事項CSV反映をテストしやすいよう、回答辞書を明示注入できる純関数形に調整。
- `tests/test_app.py`: 初期表示、起点URL解析後のタブ/ダッシュボード、レビュー状態変更、未確認事項回答、CSV反映をStreamlit AppTestで検証。
- `e2e/example.spec.ts`: Playwright公式サンプルを削除し、`PLAYWRIGHT_BASE_URL` 指定時のみ動くローカルStreamlitスモークへ置換。

### 検証
- `pytest tests/ -q`: 12 passed
- `python3 -m py_compile app.py src/*.py tests/*.py`: pass
- `rg -n "(API_KEY|SECRET|TOKEN|PASSWORD|sk-[A-Za-z0-9]{20,})" ...`: 検出なし

### 残課題
- Playwright実ブラウザ確認はサーバ起動が必要なため未実施。必要時に `PLAYWRIGHT_BASE_URL=http://localhost:8501` を指定して実行する。
- 実URLでのsitemap/robots/リンク探索の失敗パターン確認は未実施。

## 2026-06-21 狩野モデルUI刷新

### 目的
開発引継ぎ短縮を最優先価値として、起点URL投入後に「次に何を確認し、何を出力すべきか」が分かるStreamlit UIへ再編した。狩野モデルで当たり前品質、一元的品質、魅力的品質を分け、出力前の品質ゲートを明示した。

### 実装
- `src/kano.py`: 狩野モデルUXレビューとレビュー完了条件を生成するロジックを追加。当たり前品質 / 一元的品質 / 魅力的品質 / 無関心品質 / 逆品質、ISTQB severity、ISO/IEC 25010観点、根拠、改善提案、完了条件をフラットな行で返す。
- `src/models.py`: `SystemAnalysis` に `kano_ux_review` を追加。
- `src/document_builder.py`: 生成文書に `狩野モデルUXレビュー` を追加し、文書数を16件に更新。
- `src/exporter.py`: ZIP同梱CSVに `csv/kano-ux-review.csv` を追加。
- `app.py`: 起点URL優先の入力パネル、レビュー完了までの残作業、5指標の進捗カード、レビュー完了条件、`ダッシュボード / 画面 / 文書レビュー / 根拠・確認事項 / 改善 / 出力` タブへ再構成。追加URLと安全上限は詳細設定に移動。
- `tests/`: 狩野モデル分類、High以上の当たり前品質項目、ZIP内CSV、改善タブ、レビュー完了条件のAppTestを追加・更新。
- `README.md`: 生成文書とCSV一覧に狩野モデルUXレビューを追記。

### 検証
- `pytest tests/ -q`: 13 passed
- `python3 -m py_compile app.py src/*.py tests/*.py`: pass
- `rg -n "(API_KEY|SECRET|TOKEN|PASSWORD|sk-[A-Za-z0-9]{20,})" app.py src tests README.md CURRENT_STATE.md implement.md`: 既存実装記録中の検査コマンド文字列のみ一致。コード・テスト・READMEに秘密情報パターンなし。

### 残課題
- Playwright実ブラウザ確認は未実施。必要時のみローカルStreamlit起動後に実行する。
- High以上リスク確認済み状態、レビュー状態、未確認事項回答はセッション状態のみ。SQLite永続化は後続。

## 2026-06-21 Playwrightテスト設計・実行

### 目的
狩野モデルUI刷新後の主要UX導線を、Streamlit AppTestだけでなく実ブラウザ操作で検証した。外部Webサイトの状態に依存しないよう、Playwrightテスト内でfixture HTTPサーバを起動し、アプリのサーバサイドURL取得、HTML解析、画面更新までをE2E対象にした。

### テスト設計
- Guidebook Tour: 初期表示、起点URL入力、詳細設定、解析実行、タブ表示を仕様どおり確認。
- Money Tour: fixtureサイト解析後にレビュー残作業、狩野モデル改善、出力ゲートが表示されることを確認。
- Landmark Tour: `ダッシュボード` / `文書レビュー` / `根拠・確認事項` / `改善` / `出力` の主要遷移を確認。
- FedEx Tour: 起点URL入力から解析結果、文書レビュー状態変更、未確認事項回答、ZIP出力導線までのデータライフサイクルを確認。
- Fold5カバー幅: 360px幅で起点URL入力と解析ボタンが表示されることを確認。
- Saboteur観点: sitemapに403ページを含め、取得失敗が警告として扱われ、取得成功分で生成が継続することを確認。

### 実装
- `e2e/reverse-docs.spec.ts`: 既存スモークを置換し、ローカルfixtureサイト、コンソールエラー検出、初期導線、解析後UI、文書レビュー、未確認事項回答のE2Eを追加。
- `package.json`: `npm run test:e2e` で `playwright test` を実行できるようにした。

### 実行結果
- Streamlit起動: `streamlit run app.py --server.headless true --server.address 127.0.0.1 --server.port 8501`
- Chromium単体: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8501 npx playwright test --project=chromium --reporter=list` → 3 passed
- 全ブラウザ修正前: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8501 npx playwright test --reporter=list` → 6 passed / 3 failed
  - 失敗原因は製品機能の欠陥ではなく、Streamlitの非表示タブDOM参照、reload時のWebKit一過性 `TypeError: Load failed`、並列実行時のタブ切替待ち不足。
  - テストをserial化、reload回避、表示中のユーザー可視要素へのアサーションに修正済み。
- 修正後の全ブラウザ再実行は、権限付き実行の利用上限で承認されず未実施。迂回実行は行っていない。

### QA判定
- Critical: 0件
- High: 0件
- Medium: 1件。修正後のFirefox/WebKit再実行が未完了。
- Low: 1件。Playwright HTMLレポートは生成済みだが、最終全ブラウザpassの証跡は未取得。
