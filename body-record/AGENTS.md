# AGENTS.md — body-record

> 共通規約は親フォルダの `sandbox/AGENTS.md` を参照。
> このファイルにはプロジェクト固有の情報のみ記載する。

---

## このプロジェクトの概要

体重・体組成記録 PWA（RecStyle 乗り換え）。要件定義書 v0.1 準拠。
GitHub Pages（ma-garin）へ公開。スマホ主対象・オフライン対応・端末内保存。
RecStyle の名称・ロゴ・配色・画面デザインは流用しない（機能のみ参考）。

## 対象ファイル

```
body-record/
├── index.html / vite.config.ts / tsconfig.json / playwright.config.ts / package.json
├── public/icons/       # icon.svg / icon-maskable.svg（独自パレット）
├── src/
│   ├── main.ts         # シェル・4タブ（記録/グラフ/履歴/設定）・状態
│   ├── types.ts styles.css
│   ├── lib/            # ★UI 非依存・テスト対象: calc / csv / backup / db / settings
│   └── ui/             # 画面 + chart.ts（Chart.js）+ dom.ts（共通ヘルパー）
├── tests/              # Vitest（calc/csv/backup/db）
└── e2e/                # Playwright
```

## 使用技術・制約

- TypeScript / Vite / Chart.js / Dexie(IndexedDB) / vite-plugin-pwa / Vitest / Playwright
- **データ分離**: 計算・保存・取込は `src/lib` に集約し UI から分離（NFR-008）。ロジック変更時は必ず `tests/` を更新
- **永続化**: 記録は IndexedDB（Dexie、`measuredAt` を主キーに「1日1件」を DB で保証）。設定は localStorage
- **相対 base**: `vite.config.ts` の `base: './'`。Pages のサブパス配信で動くため絶対パスにしない
- **PWA**: `registerType: 'prompt'` + `workbox.clientsClaim: true`（初回からオフライン制御、更新は通知）
- **iOS ズーム抑止**: input の font-size は 16px 以上を維持
- **immutable / 確認操作**: データ変更は新オブジェクト、削除・全復元・全消去は confirm 必須（NFR-006）

## よくある変更の注意

- 記録項目（型）を増やす → `types.ts` の `Metric`/`BodyRecord`、`db.ts`、`csv.ts` の列判定、UI フォーム、テストを揃える
- Dexie スキーマ変更 → `db.ts` の `version(n).stores(...)` を追加（既存 version は消さない）
- CSV 列エイリアス追加 → `csv.ts` の `detectColumns` と `tests/csv.test.ts`
- 依存追加はオフライン要件（バンドルに含まれること）を満たす範囲で

## 検証コマンド

```bash
npm run build   # 型チェック + ビルド
npm test        # 単体テスト
npm run e2e     # E2E（要 Chromium）
```

## 現在のタスク

→ `CURRENT_STATE.md` を参照
