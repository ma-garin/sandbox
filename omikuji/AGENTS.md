# AGENTS.md — omikuji

`sandbox/AGENTS.md` の共通規約に加えて、このフォルダだけの決めごと。

## 技術スタック

**ビルドツールを使わない。** 素の HTML / CSS / ES modules。npm 依存もゼロ。
静的 33 件と localStorage だけを扱うのにフレームワークは要らず、Pages へそのまま置ける利点を優先している。

| 何 | どう |
|---|---|
| 画面 | `app/index.html` 1 枚。表示の切り替えは `hidden` 属性 |
| スタイル | `app/styles.css` 1 枚。CSS 変数でパレットを持つ |
| ロジック | `app/js/store.js`（データ）/ `view.js`（DOM 生成）/ `app.js`（配線） |
| 保存 | 過去の記録は `data/omikuji.json`（読み取り専用）、利用者が足した分は localStorage |
| オフライン | `app/sw.js`。全部で 100KB 台なので丸ごと先読みする |

## 触るときの約束

- **`view.js` で `innerHTML` を使わない。** 書き写した本文をそのまま扱うので、必ず `textContent` を通す。
- **`data/omikuji.json` を手で書き換えない。** 書き起こしの元は写真であり、直すなら根拠と一緒に直す。推定した値には `dateEstimated` / `shrineInferred` / `confidence` の印を必ず残す。
- **`builtin` と `user` を混ぜない。** 書き起こした記録は編集・削除できない作りにしてある（`source` フィールドで分岐）。
- **状態を書き換えない。** `app.js` の `state` は必ず新しいオブジェクトを作って差し替える。
- **写真を表示しない。** 表示するのは本文テキストだけ。`data/` の原本はリポジトリに入れない。

## 配色

利用者の別アプリ `my_forward` に合わせた blue-grey 系。変えるときは `styles.css` の `:root` だけを触れば全体に効く。

| 変数 | 値 | 用途 |
|---|---|---|
| `--bg` | `#EFF1F5` | 地 |
| `--surface` | `#FFFFFF` | カード・入力欄 |
| `--text` | `#263238` | 文字 |
| `--text-sub` | `#546E7A` | 副文字 |
| `--bar` | `#546E7A` | 上部バー |
| `--primary` | `#37474F` | 主ボタン・選択状態 |
| `--danger` | `#B71C1C` | 削除・必須 |

UI はサンセリフ、おみくじの本文と歌だけ明朝（`--mincho`）。

## アイコン

Google Fonts の Material Symbols (Outlined) を SVG で `index.html` に同梱している。
外部から読み込まないのは、オフラインでアイコンが欠けないようにするため。
足すときは `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/<name>/default/24px.svg` から取り、`<symbol id="i-...">` として追記する。

## 確認のしかた

```sh
cd omikuji/app && python3 -m http.server 8765
```

UI の確認は Playwright（MCP優先）で、ビューポート 390x844 で行う。
