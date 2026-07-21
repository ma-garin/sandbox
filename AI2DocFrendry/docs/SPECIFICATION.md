# 仕様書（基本設計） — AI2DocFrendry

> ステータス: **ドラフト（レビュー待ち）** ／ 版: 0.1 ／ 最終更新: 2026-07-21
> 上位文書: [`REQUIREMENTS.md`](REQUIREMENTS.md) ／ 対応関係: [`TRACEABILITY.md`](TRACEABILITY.md)

---

## 1. アーキテクチャ

### 1-1. 全体構成

```
┌──────────────────────────────────────────────────────────┐
│ UI層（Streamlit app.py） / CLI層（cli.py）                │
│  投入・設定・進捗表示・結果閲覧・ZIPダウンロード          │
└───────────────────────┬──────────────────────────────────┘
                        │  ※UI層はロジックを持たない
┌───────────────────────▼──────────────────────────────────┐
│ パイプライン層（pipeline.py）                             │
│  ingest → extract → normalize → structure → chunk        │
│         → score → report → export                        │
└───┬──────────┬──────────┬──────────┬──────────┬──────────┘
    │          │          │          │          │
┌───▼───┐ ┌────▼────┐ ┌───▼────┐ ┌───▼────┐ ┌───▼─────┐
│ingest │ │extractors│ │normalize│ │chunker │ │scoring  │
│       │ │(plugin)  │ │structure│ │        │ │6観点     │
└───────┘ └──────────┘ └─────────┘ └────────┘ └─────────┘
                        すべて純粋関数・副作用はI/O層に隔離
```

**設計原則**
- 各段は「入力を受け取り新しいオブジェクトを返す」純粋関数とする（CON-04）。
- 段間の受け渡しは後述の中間データモデルに固定し、段の差し替えを可能にする。
- I/O（ファイル読み書き・ログ）は `io_adapter.py` に集約する。

### 1-2. ディレクトリ構成（予定）

```
AI2DocFrendry/
├── app.py                     # Streamlit UI（ロジックを持たない）
├── cli.py                     # CLIエントリポイント（FR-43）
├── requirements.txt
├── config/
│   ├── default.yaml           # 既定設定（拡張子・しきい値・重み）
│   └── patterns_secret.yaml   # 機密情報検出パターン（FR-30）
├── src/
│   ├── pipeline.py            # 各段のオーケストレーション
│   ├── models.py              # 中間データモデル（immutable）
│   ├── ingest.py              # 探索・フィルタ・隔離判定
│   ├── extractors/            # ★プラグイン（NFR-12）
│   │   ├── base.py            #   Extractorプロトコル
│   │   ├── docx.py / xlsx.py / pptx.py / pdf.py
│   │   ├── text.py / csv.py / html.py
│   │   └── registry.py        #   拡張子→Extractor解決
│   ├── normalize.py           # 文字コード・ノイズ除去・表記ゆれ検出
│   ├── structure.py           # Markdown再構成・front matter付与
│   ├── chunker.py             # 見出し境界分割
│   ├── scoring/               # ★中核（6観点）
│   │   ├── structure_score.py / self_contained.py / consistency.py
│   │   ├── extractability.py / context.py / safety.py
│   │   └── aggregate.py       #   総合スコア・A〜D判定
│   ├── report.py              # 品質レポート生成
│   ├── export.py              # Markdown/JSONL/CSV/ZIP出力
│   └── io_adapter.py          # 副作用の集約
├── tests/                     # 単体テスト（NFR-14）
└── docs/                      # 本ドキュメント群
```

## 2. 中間データモデル

すべて不変（frozen dataclass）。段の入出力はこの型に固定する。

```python
SourceFile   : path, ext, size, mtime, sha256, status(ok|skipped|failed), reason
RawDocument  : source, blocks[Block], images[ImageRef], warnings[]
Block        : kind(heading|paragraph|list|table|footnote), level, text, table_rows, position
NormalizedDoc: source, blocks[Block], removed_noise[], encoding, variants[TermVariant]
StructuredDoc: source, front_matter{}, markdown, headings[HeadingPath]
Chunk        : chunk_id, parent_doc_id, heading_path, text, token_count, source_ref
Finding      : viewpoint(V1..V6), severity(Critical|High|Medium|Low), message,
               evidence{quote, location}, action        ← evidence必須（FR-24）
DocScore     : viewpoint_scores{V1..V6}, total, grade(A|B|C|D), findings[Finding]
```

## 3. 処理仕様

### 3-1. ingest（FR-01〜FR-04）

| 項目 | 仕様 |
|---|---|
| 入力 | フォルダパス／ZIPパス／個別ファイル |
| 探索 | 再帰。シンボリックリンクは辿らない |
| 除外 | 既定 `~$*` `.DS_Store` `.git/` `node_modules/` ＋設定の除外パターン |
| 対象判定 | 拡張子がregistryに存在するもの。非対応は `status=skipped`、理由 `unsupported_ext` |
| 破損検知 | オープン失敗・サイズ0・ヘッダ不整合は `status=failed`。**処理は継続**（NFR-07） |
| 冪等 | 同一 `sha256` の既処理ファイルは再処理をスキップ（FR-04） |

### 3-2. extract（FR-05〜FR-09）

| 形式 | 抽出方針 | 使用ライブラリ（案） |
|---|---|---|
| `.docx` | 見出しスタイル→heading、表→table、箇条書き→list、脚注を保持 | python-docx |
| `.xlsx` | シート＝見出し。結合セルは値を展開して複製。数式は計算結果値を採用 | openpyxl |
| `.pptx` | スライド＝見出し（タイトル）、本文プレースホルダ→paragraph、ノートも抽出 | python-pptx |
| `.pdf` | ページ単位でテキスト＋表抽出。フォントサイズから見出しを推定 | pdfplumber |
| `.html` | `h1〜h6`→heading、`table`→table、`script`/`style`/`nav`/`footer`除去 | BeautifulSoup4 |
| `.csv` | 全体を1テーブルとして扱い、1行目をヘッダと推定 | 標準csv |
| `.txt` `.md` | Markdownは構造をそのまま解釈。txtは空行・連番から段落推定 | 標準／markdown-it |
| 画像・図形 | **本文抽出せず** `ImageRef(position, count)` として記録（FR-08） | — |

**表の扱い（FR-07）**: 結合セルは結合範囲の全セルに同一値を複製して矩形を保つ。ネスト表は展開せず「複雑表」として警告を立てる。

### 3-3. normalize（FR-12, FR-13, FR-16）

| 処理 | 仕様 |
|---|---|
| 文字コード | 自動判定しUTF-8化。信頼度が閾値未満なら `failed(encoding_undetermined)` |
| 反復ノイズ除去 | 全ページ／全シートの**80%以上に出現する短い行**をヘッダ・フッタとみなし除去。除去内容は `removed_noise` に記録し監査可能にする |
| ページ番号 | `- 12 -` `12/34` `Page 12` 等のパターンを除去 |
| 目次 | 「目次」「Contents」見出し直後の、ページ番号付き行が連続するブロックを除去 |
| 空白・改行 | 連続空行を1つに、行末空白を削除。**文中の改行は段落判定後に結合** |
| 表記ゆれ検出 | 全半角、長音有無（ユーザ/ユーザー）、送り仮名ゆれを**検出のみ**。修正はしない（ADR-04） |

### 3-4. structure（FR-14, FR-15）

Markdown再構成規則:

| Block | 出力 |
|---|---|
| heading(level=n) | `#` × n ＋ テキスト |
| paragraph | 段落（前後に空行） |
| list | `- ` ／ ネストは2スペースインデント |
| table | Markdown表（1行目をヘッダ、区切り行を挿入） |
| footnote | 本文末に `> 注: ...` として集約 |
| ImageRef | `<!-- image: 位置=p3, 本文抽出なし -->` |

YAML front matter（FR-15）:

```yaml
---
doc_id: <sha256先頭12桁>
title: <文書タイトル（先頭h1 or ファイル名）>
source_path: <元ファイルの相対パス>
source_ext: docx
updated_at: 2024-03-15
sha256: <ハッシュ>
readability_score: 78
readability_grade: B
confidentiality: unknown | detected   # FR-29の結果
staleness: fresh | stale              # FR-31の結果
---
```

### 3-5. chunk（FR-17〜FR-20）

```
1. 見出し境界で分割する（h1〜h3を既定の境界レベル。設定可）
2. 各チャンクが上限トークン数（既定800）以下ならそのまま確定する
3. 超過する場合のみ、段落境界で二次分割する（オーバーラップ既定80トークン）
4. 表は分断しない。単独で上限超過する場合のみ行単位で分割し、
   各チャンクの先頭にヘッダ行を複製する（FR-20）
5. 全チャンクの先頭に見出しパスを付与する（例: "# 運用手順 > ## 障害対応"）
   → チャンク単体で文脈が通るようにするため（自己完結性の担保）
```

JSONL出力（1行1チャンク、FR-35）:
```json
{"chunk_id":"a1b2c3-004","parent_doc_id":"a1b2c3","heading_path":["運用手順","障害対応"],
 "text":"...","token_count":642,"source_path":"...","updated_at":"2024-03-15",
 "readability_grade":"B"}
```

### 3-6. scoring（FR-21〜FR-27）★中核

各観点0〜100点。減点方式（初期値100からルール該当ごとに減点、下限0）。

| 観点 | 主な減点ルール（例） | severity |
|---|---|---|
| **V-1 構造明示性** | 見出しが1つもない | High |
| | 1見出しあたりの本文が2,000字超（節が粗すぎる） | Medium |
| | 箇条書き・表が全くなく全文が連続段落 | Medium |
| **V-2 自己完結性** | 「別紙参照」「上記の通り」「同左」「後述」等の外部・指示語依存 | High |
| | 主語のない命令文が連続する | Medium |
| | 略語が定義なしに初出する | Low |
| **V-3 表現一貫性** | 同一概念に複数表記（ユーザ/ユーザー） | Medium |
| | 全半角の混在（英数字・記号） | Low |
| **V-4 抽出性** | 抽出文字数 ÷ ファイルサイズ が閾値未満（＝ほぼ画像） | **Critical** |
| | 画像が本文の主要部を占める（画像数 ≧ 段落数） | High |
| | 複雑表（ネスト・結合多用）を含む | Medium |
| **V-5 文脈情報量** | 版数・更新日・所管部署のいずれも記載がない | High |
| | タイトルが「資料1」等の無情報な名称 | Medium |
| **V-6 安全性** | 機密情報パターンを検出（FR-29） | **Critical** |
| | 最終更新から既定期間超過（FR-31） | High |
| | 他文書と内容ハッシュ一致（完全重複） | Medium |

**総合スコアと判定（FR-22）**

```
総合 = Σ(観点スコア × 重み)     既定重み: V1 .20 / V2 .20 / V3 .10 / V4 .25 / V5 .10 / V6 .15
```

| 判定 | 条件 | 意味 |
|---|---|---|
| **A** | 総合 85以上 かつ Critical指摘なし | そのまま投入可 |
| **B** | 総合 70以上 かつ Critical指摘なし | 投入可（軽微な改善余地あり） |
| **C** | 総合 50以上 または High指摘あり | 要改善（投入前に確認） |
| **D** | 総合 50未満 または **Critical指摘あり** | 投入非推奨 |

> Critical指摘が1件でもあれば、総合点に関わらずD判定とする（安全側に倒す）。

**指摘の形式（FR-23〜FR-25）**
```
[High] V-2 自己完結性 — 外部参照により単体で意味が通らない
  根拠: 「詳細は別紙3を参照のこと」（第2章・8行目）
  改善: 別紙3の該当内容を本文に取り込むか、別紙3も併せて投入する
```

### 3-7. report / export（FR-34〜FR-39）

出力ZIPの構成:
```
output_YYYYMMDD/
├── markdown/<相対パス構造を保持>.md
├── chunks.jsonl
├── metadata.csv        # 出典・形式・スコア・判定・指摘件数・機密・陳腐化
├── findings.csv        # 全指摘（文書ID・観点・severity・根拠・改善案）
├── quarantine.csv      # 隔離ファイル一覧（理由付き）
└── REPORT.md           # サマリ（判定分布・観点別平均・上位の問題）
```

## 4. 画面仕様（Streamlit）

| # | 画面／タブ | 内容 |
|---|---|---|
| S-1 | 投入 | フォルダパス指定 or ファイルアップロード、設定（拡張子・チャンクサイズ・しきい値）、実行ボタン |
| S-2 | 進捗 | プログレスバー、処理済/残件数、現在のファイル名、失敗件数（FR-40） |
| S-3 | 結果一覧 | 文書別のスコア・判定・指摘件数の表。判定・観点でフィルタ可能 |
| S-4 | 文書詳細 | 変換前後の並列表示（FR-39）、6観点スコア、指摘一覧（根拠・改善案付き） |
| S-5 | 隔離一覧 | 処理できなかったファイルと理由 |
| S-6 | 出力 | ZIPダウンロード、レポートのプレビュー |

**操作フロー（NFR-05: 3ステップ）**: ①投入対象を指定 → ②実行 → ③ZIP取得

## 5. エラー処理方針

| 事象 | 挙動 | 利用者への表示 |
|---|---|---|
| 非対応拡張子 | skip・継続 | 隔離一覧に「未対応形式」と表示 |
| ファイル破損・オープン失敗 | fail・継続 | 隔離一覧に理由を表示 |
| 文字コード判定不能 | fail・継続 | 「文字コードを判定できません」 |
| パーサ例外 | 当該ファイルのみfail・継続（NFR-07） | 「解析に失敗しました（形式: xxx）」 |
| 出力先の書き込み不可 | **処理中断** | 「出力先に書き込めません。権限を確認してください」 |
| メモリ逼迫 | 逐次処理により回避。超過時は当該ファイルをfail | 「ファイルが大きすぎます」 |

ログには本文・機密情報を出力しない（NFR-10）。記録するのは パス・形式・成否・理由・処理時間 のみ。

## 6. セキュリティ仕様（NFR-09〜NFR-11）

| 項目 | 仕様 |
|---|---|
| 通信 | 既定構成でHTTP/HTTPS通信を行わない。LLM補完（FR-28）を明示的に有効化した場合のみ発生し、有効化時は警告を表示する |
| 認証情報 | ソースへ埋め込まない。環境変数または利用者入力（セッション保持のみ）とする |
| ログ | 本文・抽出テキスト・検出した機密情報の値そのものを出力しない（種別と位置のみ） |
| 出力 | 機密検出文書には front matter に `confidentiality: detected` を付与し、レポート冒頭で警告する |
| 一時ファイル | 処理終了時に削除する |

## 7. 未確定事項

| ID | 内容 | 影響範囲 |
|---|---|---|
| SPEC-OPEN-01 | トークン計数の方式（tiktoken採用可否。日本語での精度） | chunker |
| SPEC-OPEN-02 | 類似度による重複検出のアルゴリズムとしきい値（FR-32） | scoring/safety |
| SPEC-OPEN-03 | PDFの見出し推定精度（フォントサイズ推定で足りるか） | extractors/pdf |
| SPEC-OPEN-04 | 減点ルールの配点（実ファイル検証で調整が必要） | scoring全体 |

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| 0.1 | 2026-07-21 | 初版ドラフト作成 |
