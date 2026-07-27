# AGENTS.md — warikan-django

> `sandbox/AGENTS.md` の共通規約に加えて、本プロジェクト固有の事項を記す。

## 技術スタック

- Python 3.13 / Django 6.0
- QR コード生成: segno（Pillow 非依存）
- テスト: pytest + pytest-django
- DB: SQLite（検証用途のため）

## 対象ファイル

| 用途 | パス |
|---|---|
| 計算規則 | `warikan/domain/calculation.py` |
| 入力範囲の定数 | `warikan/domain/constraints.py` |
| 入力検証 | `warikan/forms.py` |
| 画面 | `warikan/views.py` / `warikan/templates/warikan/` |
| 状態保持 | `warikan/session.py` |
| 外部サービス | `external/nomikui.py` / `external/juspay.py` |

## 変更時の規律

1. **仕様書に無い挙動を足さない。** 追加が必要なら `docs/SPEC_ISSUES.md` に指摘として記録し、
   採用した解釈をコード中のコメントにも残す。
2. **`warikan` から `external` への依存は一方向。** 逆向きの import を作らない
   （`external/models.py` が `warikan.domain.constraints` を参照するのは定数の共有のみ）。
3. **金額計算に浮動小数点を使わない。** `calculation.py` は整数演算のみで書く。
4. 仕様の節番号をコメントで参照する（例: `# 仕様 1.3 手順2`）。
5. 認証情報をソースに書かない。検証用アカウントは `seed_accounts` コマンドで投入する。

## テストの位置づけ

`external/tests/` はシステムテストの対象外だが、上限管理の誤りが `warikan` の履歴表示に
現れるためリグレッション防止として維持する。
