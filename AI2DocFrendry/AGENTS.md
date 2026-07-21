# AGENTS.md — AI2DocFrendry

> 共通規約は親フォルダの `sandbox/AGENTS.md` を参照。
> このファイルにはプロジェクト固有の情報のみ記載する。

---

## このプロジェクトの概要

多様な拡張子の社内ナレッジを、生成AI（RAG）が読み込みやすい形式へ変換し、
変換結果のAI可読性を6観点で採点して改善提案を返す、ローカル完結型のRAG前処理支援システム。

**中核は「変換」ではなく「投入前の可読性判定」**である。変換は既存OSSに委譲する。

## 対象ファイル

```
AI2DocFrendry/
├── README.md / AGENTS.md / CURRENT_STATE.md
├── docs/                      # 上流設計ドキュメント（現在ここまで作成済み）
│   ├── RESEARCH.md            #   先行事例調査
│   ├── RFD.md                 #   討議文書・ADR
│   ├── REQUIREMENTS.md        #   要件定義書
│   ├── SPECIFICATION.md       #   仕様書（基本設計）
│   ├── TRACEABILITY.md        #   トレーサビリティ
│   └── WBS.md                 #   工程計画
├── app.py / cli.py            # 未実装
├── config/                    # 未実装（default.yaml / patterns_secret.yaml）
├── src/                       # 未実装（構成は SPECIFICATION.md 1-2 を参照）
└── tests/                     # 未実装
```

## 対象外ファイル

- `sandbox/` 配下の他プロジェクト（`QA-PMO/` `spec-inspector/` `QA-knowledge/` `yuki-aidd-kit/`）
  → 参考にはするが、コードの依存・共有はしない（sandbox運用ルール）

## 使用技術・制約

- Python 3.11+ / Streamlit（UI）／CLI併設
- パーサ: python-docx, openpyxl, python-pptx, pdfplumber, BeautifulSoup4（いずれも無料OSS）
- **外部通信は既定で行わない**（NFR-09 / ADR-01）— 最優先の制約
- コスト0円。有償サービス・クラウドAPIを使わない
- 実行環境: macOS（M1）と Windows 11 の双方で動作すること

## このプロジェクト固有の実装規約

| # | 規約 | 出典 |
|---|---|---|
| 1 | 各処理段は純粋関数とし、副作用は `io_adapter.py` に集約する | SPECIFICATION 1-1 |
| 2 | パーサはプラグイン構造。形式追加は新規ファイル追加のみで完結させる | NFR-12 |
| 3 | 指摘（Finding）には必ず根拠（引用＋位置）を持たせる。根拠のない指摘を出力しない | FR-24 |
| 4 | 採点は決定的に実装する。乱数・時刻依存・LLM依存を採点経路に入れない | FR-26 / NFR-08 |
| 5 | 文書本文の自動書き換えを実装しない（提案までに留める） | ADR-04 |
| 6 | ログに本文・抽出テキスト・検出した機密情報の値を出力しない | NFR-10 |
| 7 | 1ファイル400行以内、関数50行以内 | NFR-13 |

## 用語

| 用語 | 意味 |
|---|---|
| AI可読性スコア | 変換後の文書が生成AIにとって読みやすいかを6観点で採点した値（0〜100） |
| 観点 V-1〜V-6 | 構造明示性／自己完結性／表現一貫性／抽出性／文脈情報量／安全性 |
| 判定 A〜D | そのまま投入可／投入可／要改善／投入非推奨 |
| 隔離（quarantine） | 変換できなかったファイルを理由付きで分離すること。処理は継続する |

## 現在のタスク

→ `CURRENT_STATE.md` を参照
