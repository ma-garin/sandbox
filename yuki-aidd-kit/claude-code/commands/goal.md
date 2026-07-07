# /goal — GOALS.mdバックログの1ゴール実行

引数: $ARGUMENTS（ゴールID。例: `G-01`。省略時は依存が満たされた先頭の「未着手」ゴール）

## 実行内容

1. **ゴール選定**: プロジェクト直下の `docs/GOALS.md` を読む（spec-inspectorなら `spec-inspector/docs/GOALS.md`）。
   引数のIDを選ぶ。省略時は「依存」がすべて完了済みの先頭「未着手」ゴールを選ぶ。
   依存が未充足なら実装せず、その旨と充足に必要なゴールを報告して停止する。
2. **スコープ確認**: 選定ゴールの「対象ファイル」欄に挙がったファイルだけを読む。
   指定外のファイルは読まない・変更しない（トークン・スコープ規律）。
3. **実装**: 受入基準の範囲内で実装する。sandbox共通規約を守る:
   immutableパターン／エラーは明示的に処理しUIに分かりやすく表示／
   指摘・診断ロジックは evidence-only（根拠引用のない指摘を作らない）／
   APIキー等のハードコード禁止。
4. **検証**: 受入基準に書かれた検証コマンドを実行する（例: `node tests/testdesign.test.mjs`、
   既存回帰 `node tests/engine.test.mjs` ほか全テスト）。UIゴールはE2E検証
   （playwright-core + `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`、
   scratchpadに検証スクリプトを作る。api.openai.com は route stub で偽装し実APIは呼ばない）。
   失敗したら修正して再実行する。
5. **状態更新**: `docs/GOALS.md` の該当ゴールの状態を「完了(YYYY-MM-DD)」に更新し、
   `CURRENT_STATE.md` の「直近の完了タスク」「次のタスク」を更新する。
6. **コミット**: Conventional Commits（feat/fix/docs/refactor/test/chore）で
   1ゴール＝1コミットにまとめる。
7. **停止**: 1ゴールで停止し、実行結果（テスト件数・変更ファイル）と次の候補ゴールを報告する。
   受入基準を満たせない場合は、基準を緩めずに状態を「保留(理由)」へ更新して報告する。

## 禁止事項

- 受入基準にない機能の追加（スコープクリープ）
- 複数ゴールの一括実行
- テスト失敗のままのコミット
- 実APIキーを要するテストの実行（実API検証は G-13 の手順書で人間が実施する）
