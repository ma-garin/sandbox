# サードパーティ ライセンス表記 — AI2DocFrendry

> 版: 0.1 ／ 2026-07-22

## 0. 本体のライセンス方針は未決定（要判断）

**本リポジトリ（AI2DocFrendry 本体）のライセンスは未決定です。** そのため `LICENSE` ファイルは意図的に置いていません。

ベリサーブは検証事業者であり、本ツールが顧客案件へ持ち出される可能性があります。持ち出し・再配布の前に、少なくとも次を確定してください。

| # | 決めるべきこと | 状態 |
|---|---|---|
| L-01 | 本体を社内限定とするか、顧客へ成果物として引き渡すか | **要判断** |
| L-02 | 引き渡す場合のライセンス（独占／MIT／Apache-2.0 等） | **要判断** |
| L-03 | 顧客の秘密情報を処理する用途での責任範囲・免責条項 | **要判断** |
| L-04 | 本ファイルの配布物への同梱要否と、同梱時の生成手順の自動化 | **要判断** |

## 1. 本ファイルの根拠と限界

- 記載は **PyPI の公開メタデータ（`license` / `license_expression` / Trove classifier）を 2026-07-22 に取得**して確認した内容に基づきます。
- **各パッケージのライセンス全文（LICENSE ファイル）までは照合していません。** 配布前には全文の取得と同梱可否の確認が必要です（下記「要確認」）。
- **推移的依存（間接依存）のライセンスは未調査です。** 直接依存のみを列挙しています。

## 2. 実行時依存（`requirements.txt`）

| パッケージ | 確認した版 | ライセンス（PyPIメタデータ） | 出典フィールド | 備考 |
|---|---|---|---|---|
| streamlit | 1.60.0 | Apache-2.0 | `license_expression` | Apache-2.0 は NOTICE ファイルの継承義務あり → **要確認** |
| python-docx | 1.2.0 | MIT | `license` / classifier | — |
| openpyxl | 3.1.5 | MIT | `license` / classifier | — |
| python-pptx | 1.0.2 | MIT | `license` / classifier | — |
| pdfplumber | 0.11.10 | MIT | classifier | 依存する `pdfminer.six` のライセンスは未調査 → **要確認** |
| beautifulsoup4 | 4.15.0 | MIT | `license` / classifier | — |
| lxml | 6.1.1 | BSD-3-Clause | `license` | wheel が libxml2 / libxslt をバンドルする。同梱ライブラリの表記義務は未確認 → **要確認** |
| charset-normalizer | 3.4.9 | MIT | `license` | — |
| markdown-it-py | 4.2.0 | MIT | classifier | `license` フィールドは空。classifier のみで判定 → **要確認** |
| PyYAML | 6.0.3 | MIT | `license` / classifier | — |

## 3. 開発時依存（`requirements-dev.txt`）

配布物には含めない前提です（含める場合は本表も配布対象に加えてください）。

| パッケージ | 確認した版 | ライセンス（PyPIメタデータ） | 出典フィールド | 備考 |
|---|---|---|---|---|
| pytest | 9.1.1 | MIT | `license_expression` | — |
| pytest-cov | 7.1.0 | MIT | `license_expression` / classifier | — |
| ruff | 0.15.22 | MIT | `license_expression` | Rust 製。バンドルされる Rust クレート群のライセンスは未調査 → **要確認** |
| mypy | 2.3.0 | MIT | `license_expression` | typeshed（別ライセンスの可能性）を同梱 → **要確認** |
| bandit | 1.9.4 | Apache-2.0 | `license` | Apache-2.0 は NOTICE 継承義務あり → **要確認** |
| pip-audit | 2.10.1 | Apache Software License | classifier | SPDX識別子（Apache-2.0 と断定してよいか）は未確認 → **要確認** |

## 4. 未解決事項（要確認）一覧

| # | 内容 |
|---|---|
| TPN-01 | 本体のライセンス方針が未決定（§0 L-01〜L-04） |
| TPN-02 | 各パッケージの LICENSE 全文を未照合。メタデータのみで判断している |
| TPN-03 | 推移的依存のライセンスが未調査。`pip-licenses` 等での機械生成が必要 |
| TPN-04 | Apache-2.0 採用パッケージ（streamlit, bandit）の NOTICE ファイル同梱要否 |
| TPN-05 | lxml がバンドルする libxml2 / libxslt の表記義務 |
| TPN-06 | markdown-it-py / pip-audit は classifier のみが根拠で SPDX 識別子が未確定 |
| TPN-07 | 層2（ローカルLLM）で使用するモデルの重みのライセンス。**モデルのライセンスはコードと別枠**であり、商用利用可否の確認が必須 |
| TPN-08 | 本ファイルの更新契機がプロセスに組み込まれていない（W-24 CI で依存追加時に再生成する等） |

## 5. 更新手順（案・要確認）

1. `pip install pip-licenses` 等で推移的依存を含む一覧を機械生成する。
2. 生成結果と本ファイルを突き合わせ、差分を解消する。
3. 依存を追加・更新した際は同一コミット内で本ファイルを更新する。
4. 顧客へ引き渡す前に §4 の「要確認」がすべて解消されていることを確認する。

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| 0.1 | 2026-07-22 | 初版。直接依存16件を PyPI メタデータで確認。本体ライセンスは未決定として明記 |
