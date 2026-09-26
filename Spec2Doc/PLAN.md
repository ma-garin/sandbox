# PLAN — Spec2Doc 第 1 リリース（最短実装版）

**2026-09-25 保守者指示**: 工程承認（phase-0〜9 の承認記録・gate-agent・trace-check）は行わない。
`docs/lifecycle/01-requirements.md` を入力にそのまま実装する。要件は参照するが、設計書（02〜）は作らない。

## 完成の定義
Web 画面で GitHub URL・.zip・フォルダ（パス指定）のどれかを渡すと、D01〜D09・D11・D12 を生成し、
画面で閲覧でき、Markdown / HTML / .docx / .xlsx でダウンロードできる。CLI も同じ中核で動く。
確認は同梱のサンプル Web アプリ（`fixtures/sample-app/`）を入力にして行う。

## 技術選定（理由）
| 項目 | 採用 | 理由 |
|---|---|---|
| 言語 | Node.js 25 + TypeScript（`node` の型除去でそのまま実行。ビルド不要） | 解析対象が JS/TS/HTML/CSS。解析器が同じ言語で揃う |
| JS/TS 解析 | `typescript`（Compiler API） | JS も TS も 1 つで構文木が取れる |
| HTML / CSS | `parse5` / `postcss` | 標準的・依存が軽い |
| .zip | `yauzl` | ストリーム展開で zip slip・サイズ上限（REQ-N-016〜018）を自前で検査できる |
| 出力 | 自前 Markdown・HTML、`docx`、`exceljs` | 文書モデル 1 つから 4 形式へ |
| Web | `node:http` + 静的 HTML 1 枚（127.0.0.1 のみ。Q-05） | 依存を増やさない |
| LLM | `@anthropic-ai/sdk`、**既定は無効**（Q-02）。`ANTHROPIC_API_KEY` は環境変数 | REQ-F-016・029 |

## 構成（契約 2 つで各層を切り離す）
```
src/
  ir/schema.ts        # 中間表現（版番号付き JSON。REQ-F-019）— 契約 1
  doc/model.ts        # 文書モデル（見出し・段落・表・根拠ラベル 事実/推測/不明）— 契約 2
  ingest/             # github・folder・files・zip → 読み取り専用の作業ディレクトリ ＋ 除外（REQ-F-001〜005・040・041、N-016〜018）
  analyze/            # js-ts・html・css・deps → IR（REQ-F-006〜015・033・034・036・037）
  generate/           # IR → 文書モデル D01〜D09・D11・D12（REQ-F-017・020・022〜025・031・032・035・038・039）
  render/             # 文書モデル → md・html・docx・xlsx（REQ-F-021）
  llm/                # 説明文の生成。無効時は「LLM 無効のため未生成」（REQ-F-016・029）
  core.ts             # 取得→解析→生成→出力→実行記録（REQ-F-030）を 1 関数に
  cli.ts              # 引数・終了コード 0/1/2（REQ-F-026）
  web/server.ts, web/index.html  # REQ-F-027・028、進み具合は SSE
fixtures/sample-app/  # 検証用の小さな Web アプリ（入力制約・状態・エラー・fetch・localStorage を含む）
test/                 # node:test。受入基準 G/W/T に対応するものだけ
```

## 進め方（並列）
| 段 | 担当 | 内容 | 依存 |
|---|---|---|---|
| P0 | impl-opus ×1 | package.json・tsconfig・契約 2 つ・core.ts の骨組み・sample-app | — |
| P1 | impl-opus ×4 並列 | ingest / analyze / generate / render＋llm＋cli＋web | P0 の契約だけ |
| P2 | impl-opus ×1 | 結合して sample-app で CLI・Web を通す | P1 |
| P3 | verify ×1（作った本人以外） | 壊れている箇所を探す → 修正は P2 担当へ（2 周まで） | P2 |

## 割り切り（第 1 リリースで浅くするもの）
- 業務ルール・状態遷移の抽出は構文パターン（if/switch・代入・classList）止まり。取れないものは D09 に送る
- 改版履歴（REQ-F-035, Could）は生成日時・入力コミットのみ。差分章は後回し
- 性能（REQ-N-001 5 万行）と受入評価（REQ-N-006・007）は計測だけして目標未達でも止めない
