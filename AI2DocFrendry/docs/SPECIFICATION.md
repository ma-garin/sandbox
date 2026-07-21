# 仕様書（基本設計） — AI2DocFrendry

> 版: 1.0 ／ 2026-07-21
> 上位: [`REQUIREMENTS.md`](REQUIREMENTS.md) ／ 根拠: [`RESEARCH.md`](RESEARCH.md)

---

## 1. アーキテクチャ

```
UI層（app.py / cli.py）— ロジックを持たない
        ↓
パイプライン層（pipeline.py）
  ingest → extract → normalize → structure
        → restructure → verify → chunk → diagnose → export
        ↓
ingest / extractors(plugin) / normalize / structure /
restructure(plugin) / verify / chunker / diagnosis
        すべて純粋関数。副作用は io_adapter.py に集約
```

### 1-1. ディレクトリ構成

```
AI2DocFrendry/
├── app.py / cli.py / requirements.txt
├── config/
│   ├── default.yaml          # 拡張子・しきい値・重み・オーバーラップ規則
│   ├── patterns_secret.yaml  # 機密検出パターン
│   └── variants.yaml         # 表記ゆれ辞書
├── src/
│   ├── pipeline.py / models.py / io_adapter.py / ingest.py
│   ├── extractors/           # ★プラグイン（NFR-13）
│   │   ├── base.py registry.py
│   │   └── docx.py xlsx.py pptx.py pdf.py html.py csv.py text.py
│   ├── normalize.py / structure.py
│   ├── restructure/          # ★プラグイン
│   │   ├── rules/            #   層1: variants / refs / meta / abbrev
│   │   └── llm/              #   層2: headings / deixis（任意・ローカル）
│   ├── verify.py             # ★層3: 改変検証（決定的）
│   ├── chunker.py
│   ├── diagnosis/            # ★DQ5次元 + ノイズ2分類
│   │   ├── intrinsic.py contextual.py representational.py
│   │   ├── accessibility.py accountability.py
│   │   └── aggregate.py
│   ├── report.py / export.py
└── tests/
```

## 2. データモデル（すべて frozen / immutable）

```python
SourceFile    : path, ext, size, mtime, sha256, status(ok|skipped|failed), reason
RawDocument   : source, blocks[Block], images[ImageRef], style_marks[StyleMark], warnings[]
Block         : kind(heading|paragraph|list|table|footnote), level, text, table_rows, position
StyleMark     : kind(strikethrough|emphasis|color|textbox), text, position, preserved(bool)  ← FR-08
NormalizedDoc : source, blocks, removed_noise[], encoding, variants[TermVariant]
StructuredDoc : source, front_matter{}, markdown, tables_html{}, headings[HeadingPath]
Operation     : op_id, kind, before, after, location, method(rule|llm), confidence, applied, reason
VerifyResult  : checks[], violations[], rolled_back[]
Chunk         : chunk_id, parent_doc_id, heading_path, context_prefix, text, token_count, source_ref
Finding       : dimension(I|C|R|Ac|Ao), noise_type(semantic|formatting),
                severity(Critical|High|Medium|Low), message, evidence{quote,location}, action
DocScore      : dimension_scores{}, semantic_score, formatting_score, total, grade(A|B|C|D), findings[]
```

## 3. 処理仕様

### 3-1. ingest

再帰探索。除外は既定 `~$*` `.DS_Store` `.git/` `node_modules/` ＋設定分。非対応拡張子は `skipped`、破損は `failed`。**いずれも処理を止めない**（NFR-08）。同一 `sha256` は再処理をスキップ。

### 3-2. extract（★最重要 / ADR-02）

| 形式 | 方針 | ライブラリ（案） |
|---|---|---|
| `.docx` | 見出しスタイル→heading、表→table、**打ち消し線・強調・色を StyleMark として記録** | python-docx |
| `.xlsx` | シート＝見出し。**結合セルは範囲の全セルに値を複製して矩形を保つ**。数式は計算結果値 | openpyxl |
| `.pptx` | スライド＝見出し、**テキストボックスの位置関係から読み順を推定**、ノートも抽出 | python-pptx |
| `.pdf` | ページ単位でテキスト＋表抽出。フォントサイズから見出し推定 | pdfplumber |
| `.html` | `h1〜h6`→heading、`table`→table、`script`/`style`/`nav`/`footer`除去 | BeautifulSoup4 |
| `.csv` | 全体を1テーブル。1行目をヘッダと推定 | 標準csv |
| `.txt` `.md` | Markdownは構造をそのまま解釈。txtは空行・連番から段落推定 | markdown-it |
| 画像・チャート | **本文抽出せず** `ImageRef` として記録。チャートはOCR経路では救えない（GT比−72%） | — |

**パーサはプラグイン（FR-10）。**文書タイプ別に最適パーサが異なることが実証されている（Scientific/Patent では汎用パーサのF1が0.99→0.85に低下）ため、切り替え可能にする。

**抽出率の算出（FR-11）**: `抽出文字数 ÷ 推定情報量`。閾値未満なら「ほぼ画像」と判定し **Critical**。

### 3-3. normalize

| 処理 | 仕様 |
|---|---|
| 文字コード | 自動判定→UTF-8。信頼度不足なら `failed` |
| 反復ノイズ | 全ページの80%以上に出現する短い行をヘッダ・フッタとみなし除去。**除去内容を `removed_noise` に記録し監査可能にする** |
| ページ番号 | `- 12 -` `12/34` `Page 12` を除去 |
| 目次 | 「目次」「Contents」直後のページ番号付き連続行を除去 |
| 表記ゆれ | 検出し、層1で統一（FR-21） |

### 3-4. structure

| Block | 出力 |
|---|---|
| heading(level=n) | `#` × n |
| paragraph / list | 段落 / `- `（ネストは2スペース） |
| table（単純） | Markdown表 |
| **table（結合セル・階層ヘッダあり）** | **Markdown表＋HTML併記**（Markdownにcolspan/rowspanが存在しないため / ADR-04） |
| footnote | 本文末に `> 注:` |
| ImageRef | `<!-- image: p3, 本文抽出なし -->` |
| **StyleMark（消失するもの）** | `<!-- 警告: 打ち消し線 "..." が本文に反映されていない -->` |

**無関係なマークアップを持ち込まない**（FR-19）。フォーマットノイズは表で−18.4pt、数式で−19.4pt。

front matter:
```yaml
doc_id / title / source_path / source_ext / updated_at / sha256
extraction_rate: 0.94
semantic_score: 82   # 情報の欠落・誤り
formatting_score: 71 # 書式の不統一
grade: B
confidentiality: unknown | detected
staleness: fresh | stale
```

### 3-5. restructure（層1 → 層2）

**原則**: 情報を追加しない／削除しない／全変更を差分提示する。

| 操作 | 層 | 例 |
|---|---|---|
| 表記ゆれ統一 | 1（決定的） | 「ユーザ」→「ユーザー」 |
| 章番号参照の実体化 | 1 | 「上記2項」→「2. 移行手順」 |
| メタ情報補完 | 1 | ファイル属性からタイトル・日付・版 |
| 略語の初出定義 | 1 | 文書内に定義がある場合のみ |
| 外部参照の警告 | 1 | 「別紙3参照」→ 解決不能なら警告として残す |
| **見出し生成** | 2（LLM） | ベタ書きに `## 決定事項` |
| **指示語の実体化** | 2（LLM） | 「標記の件」→「サーバ移行の件」 |

層2は**ローカル実行・既定ONだが未導入なら自動的に層1のみで動作**（FR-28）。

### 3-6. verify（層3・決定的）

| ID | 検証 | 方法 | 違反時 |
|---|---|---|---|
| VF-1 | 情報追加なし | 再構成後の固有名詞・数値・日付が原文に存在するか照合 | **当該変更をロールバック** |
| VF-2 | 情報欠落なし | 原文の各文が再構成後に対応を持つか。カバー率しきい値 | ロールバック＋警告 |
| VF-3 | 数値の同一性 | 数値トークンの多重集合が一致するか | ロールバック |
| VF-4 | 否定の反転なし | 否定表現の数と対応 | 警告 |

**安全側に倒す**（ADR-10）。検証を通らない変更は適用せず原文のまま残す。

### 3-7. chunk

```
1. 見出し境界で分割（h1〜h3が既定。設定可）
   ※ semantic chunking は行わない（ADR-05: 精度差1.65ptに対し計算時間54,000倍）
2. 上限トークン（既定800）以下ならそのまま確定
3. 超過時のみ段落境界で二次分割
4. オーバーラップは文書種別で切り替え（ADR-06）
     表を含む  : 25%   ← 0%比 +9.8pt
     表を含まない: 極小 ← 20%超で precision −40%
5. 表は行単位でチャンクし、各行の先頭にヘッダを反復（ADR-07）
6. 全チャンクの先頭に context_prefix を前置（FR-40）
     "文書名 / 更新日 / 見出しパス"  ← Contextual Retrieval: 検索失敗率 −35%
```

JSONL:
```json
{"chunk_id":"a1b2c3-004","parent_doc_id":"a1b2c3","heading_path":["運用手順","障害対応"],
 "context_prefix":"障害対応マニュアル / 2024-03-15 / 運用手順 > 障害対応",
 "text":"...","token_count":642,"source_path":"...","grade":"B"}
```

### 3-8. diagnose（ICIS 2025 DQ次元 × OHRBench ノイズ2分類 / ADR-11）

**各次元を0〜100で採点し、ノイズ種別に振り分ける。**

| 次元 | 主な減点ルール | ノイズ種別 | severity |
|---|---|---|---|
| **`Intrinsic`** 抽出正確性 | 抽出率が閾値未満（ほぼ画像） | Semantic | **Critical** |
| | **意味を持つ書式が消失**（打ち消し線・強調） | Semantic | **Critical** |
| | チャート・画像が本文の主要部を占める | Semantic | High |
| | 文書内に矛盾する記述がある | Semantic | High |
| **`Contextual`** | 他文書と内容ハッシュ一致（完全重複） | Semantic | Medium |
| | 最終更新から既定期間超過 | Semantic | High |
| **`Representational`** | 見出しが1つもない | Formatting | High |
| | 複雑表（ネスト・結合多用） | Semantic | Medium |
| | 表記ゆれが残存 | Formatting | Low |
| | 略語が定義なしに初出 | Formatting | Low |
| **`Accessibility`** | 解決できない外部参照（「別紙3参照」） | Semantic | High |
| | 指示語が実体化できずに残存 | Semantic | Medium |
| **`Accountability`** | 機密パターンを検出 | Semantic | **Critical** |
| | 版数・更新日・所管のいずれも記載なし | Formatting | Medium |

**配点（FR-45）**
```
semantic_score   = Semantic Noise 起因の減点のみを集計
formatting_score = Formatting Noise 起因の減点のみを集計
total = semantic_score × 0.75 + formatting_score × 0.25
```
根拠: Semantic Noise は「誰も耐性を持たない」、Formatting Noise は「モデルが強いほど耐性が上がる」（OHRBench）。**書式は逓減資産、内容は逓減しない資産。**

| 判定 | 条件 |
|---|---|
| **A** | total ≥ 85 かつ Critical なし |
| **B** | total ≥ 70 かつ Critical なし |
| **C** | total ≥ 50 または High あり |
| **D** | total < 50 **または Critical が1件でもあれば無条件でD** |

**指摘の形式（FR-48）**
```
[Critical] Intrinsic / Semantic — 打ち消し線が本文に反映されていない
  根拠: 「~~旧手順: 手動で再起動~~」（第2章・8行目）
  改善: 取り消された内容を本文から削除するか、無効である旨を明記する
```

**再構成前後の両方を採点する**（FR-50）。改善量を `REPORT.md` に示す。

**CER/WER は使わない**（ADR-12）。OCR精度82.9%でRAG精度52.8%という実例があり、相関が弱い。

### 3-9. export

```
output_YYYYMMDD/
├── markdown/<相対パス>.md
├── chunks.jsonl
├── metadata.csv    # 出典・形式・抽出率・semantic/formatting・判定・機密・陳腐化
├── findings.csv    # 全指摘（次元・ノイズ種別・severity・根拠・改善案）
├── diff.md         # 全変更（種別・方式・信頼度・ロールバック有無）
├── quarantine.csv  # 隔離ファイルと理由
└── REPORT.md       # サマリ・判定分布・再構成による改善量
```

## 4. 画面仕様（Streamlit）

| # | 画面 | 内容 |
|---|---|---|
| S-1 | 投入 | パス指定／アップロード、設定、実行 |
| S-2 | 進捗 | 件数・残数・現在ファイル・失敗件数 |
| S-3 | 結果一覧 | 文書別の抽出率・semantic/formatting・判定・指摘件数。フィルタ可 |
| S-4 | 文書詳細 | 変換前後の並列表示、次元別スコア、指摘（根拠・改善案）、変更差分 |
| S-5 | 隔離一覧 | 処理できなかったファイルと理由 |
| S-6 | 出力 | ZIP取得、レポートプレビュー |

## 5. エラー処理

| 事象 | 挙動 | 表示 |
|---|---|---|
| 非対応拡張子 | skip・継続 | 隔離一覧「未対応形式」 |
| 破損・オープン失敗 | fail・継続 | 隔離一覧に理由 |
| 文字コード判定不能 | fail・継続 | 「文字コードを判定できません」 |
| パーサ例外 | 当該ファイルのみfail・継続 | 「解析に失敗しました」 |
| 層2のLLM未導入・応答なし | **層1のみで継続** | 「LLM補完は無効です」 |
| 出力先書き込み不可 | **中断** | 「出力先に書き込めません」 |

ログには本文・機密情報を出力しない（NFR-11）。記録するのはパス・形式・成否・理由・処理時間のみ。

## 6. セキュリティ

| 項目 | 仕様 |
|---|---|
| 通信 | 既定構成でHTTP/HTTPS通信を行わない。**層2もローカル実行** |
| 認証情報 | ソースへ埋め込まない |
| ログ | 本文・抽出テキスト・検出した機密情報の値を出力しない（種別と位置のみ） |
| 出力 | 機密検出文書は front matter に `confidentiality: detected`、レポート冒頭で警告 |
| 一時ファイル | 処理終了時に削除 |

## 7. 未確定事項

| ID | 内容 |
|---|---|
| SPEC-OPEN-01 | トークン計数方式（日本語での精度） |
| SPEC-OPEN-02 | 「表を含む」の判定基準（オーバーラップ切替の条件） |
| SPEC-OPEN-03 | PDFの見出し推定精度（フォントサイズ推定で足りるか） |
| SPEC-OPEN-04 | 診断の減点配点（実ファイル検証で調整） |
| SPEC-OPEN-05 | 層2に使うローカルLLMのモデル選定と実行速度 |
| SPEC-OPEN-06 | VF-2（情報欠落）のカバー率しきい値 |

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| 0.1 | 2026-07-21 | 初版。独自6観点による採点 |
| **1.0** | 2026-07-21 | **調査結果を反映。StyleMark（意味を持つ書式）を追加。表のHTML併記。semantic chunking 削除、オーバーラップの条件分岐、表の行単位チャンク、context_prefix を追加。採点を DQ5次元×ノイズ2分類へ差し替え、配点を 0.75:0.25 に。restructure/verify の3層を追加** |
