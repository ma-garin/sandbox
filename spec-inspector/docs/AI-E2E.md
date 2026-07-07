# AI補足の実キーE2Eテスト手順書

> 対象: `spec-inspector` の OpenAI AI補足機能（`src/llm.js` / `src/providers/openai.js`）
> 実施者: 人間（実 OpenAI APIキーを持つ別環境）。**このリポジトリにキーを置かないこと。**
> 目的: オフラインではモック検証済みの経路を、実APIで最終確認し、プロンプトを実測チューニングする。

## 0. 前提

- OpenAI の Organization ID / Project ID / APIキーを保有していること
- 課金が発生する（解析1回につき数リクエスト＝入力トークンに依存）。**少量の文書から始める**こと
- 実行環境: ブラウザ（`index.html` をローカルサーバ経由で開く。例: `python3 -m http.server 8000`）

## 1. 設定手順

1. アプリを開き「設定」タブへ
2. 解析エンジン = 「ルールベース＋OpenAI AI補足（要APIキー）」
3. AIモデル = `gpt-5-mini`（既定。必要に応じて `gpt-5` / `gpt-4.1-mini`）
4. Organization ID / Project ID / APIキー を入力し「OpenAI設定を保存」
5. localStorageに保存されたことを確認（DevTools > Application > Local Storage に
   `spec-inspector.openai.key.v1` 等。**スクショや共有時はキーをマスクする**）

## 2. 確認チェックリスト

各項目、実施したら `[x]` に更新し、結果を「実測メモ」に記録する。

### 2-1. 正常系
- [ ] サンプル3文書を投入し解析 → 「解析完了（AI補足 N件を含む）」トースト
- [ ] 指摘一覧に「AI補足」タグ付きの指摘が表示される
- [ ] AI指摘の evidence が**原文の引用**になっている（要約・創作でないこと）
- [ ] AI指摘によって観点別スコア・総合スコアが**変化しない**（スコアはルールベース固定）
- [ ] テスト設計タブにAI補足の候補（AI補足タグ）が出る場合、reason が妥当

### 2-2. 異常系（graceful degradation）
- [ ] 無効なAPIキーで解析 → 「APIキーが無効です」を含むトースト＋**ルール結果は表示される**
- [ ] 誤った Organization/Project ID → 「Organization/Project IDの権限がありません」（403）
- [ ] 短時間に連続解析でレート制限（429）に達した場合 → 「レート制限に達しました」＋ルール結果は維持
- [ ] 機内モード等ネットワーク遮断で解析 → 「ネットワークエラー」or「タイムアウト」＋ルール結果は維持

### 2-3. JSONモード・長文
- [ ] 応答が必ずJSONとして解釈される（コンソールに parse エラーが出ない）
- [ ] 16,000字を超える文書を投入し、チャンク分割されても解析が完了する
- [ ] 各チャンクのリクエスト body に `response_format: {type:"json_object"}` と
      `max_completion_tokens` が入り、`max_tokens`/`temperature` が**入っていない**
      （DevTools > Network で確認。gpt-5系の非互換パラメータ対策）

## 3. プロンプト実測チューニング記録

実測して初めて分かる調整（誤検出・粒度・severity感）を記録し、`src/prompts/` を更新する。

| 日付 | モデル | 良かった点 | 誤検出・過剰指摘の例 | 見落とし | prompts/ への修正 |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

チューニング対象ファイル:
- `src/prompts/viewpoints.js` … 観点別 focus/avoid（重複指摘の抑止）
- `src/prompts/examples.js` … few-shot（粒度・severity感の見本）
- `src/prompts/contract.js` … 出力契約（severity基準・件数上限）
- `src/prompts/chunking.js` … 分割サイズ（maxChars）

修正後は必ずオフラインテストを通す:
```bash
node tests/prompts.test.mjs && node tests/llm.test.mjs
```

## 4. 課金・セキュリティ注意

- 大きな文書・多数の文書は入力トークンが増え課金が増える。まず小さく試す
- APIキーはブラウザの localStorage にのみ保存され、Anthropic ではなく **OpenAI API へ**送信される
- 共有画面・スクショではキー・org/project をマスクする
- テスト後、共有端末では設定タブでキー欄を空にして保存（削除）する

## 5. 完了条件

- 2章のチェックリストがすべて `[x]`
- 3章に少なくとも1回分の実測記録があり、必要な `src/prompts/` 修正が反映済み
  （修正後にオフラインテストが緑）
