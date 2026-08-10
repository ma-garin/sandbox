# Body Record — 体重・体組成記録 PWA

スマートフォンから毎日の体重・体組成を短時間で記録し、推移と目標達成状況を確認できる個人用アプリ。
RecStyle からの乗り換えを想定（名称・ロゴ・配色・画面デザインは流用せず、機能のみ参考）。

- **ゼロランニングコスト**: GitHub Pages で配信、外部 API / 広告 / サーバーなし
- **オフライン対応**: Service Worker + IndexedDB。通信がなくても記録・閲覧できる
- **データは端末内のみ**: 外部送信しない（プライバシー）

## 主な機能（MVP / Must）

| 分類 | 内容 |
|---|---|
| 記録 | 日付・体重・体脂肪率・筋肉量・ウエスト・BMI 自動計算・スタンプ・メモ。前回値を初期表示し数タップで登録。同日は上書き |
| ダッシュボード | 最新値・前日差・7日前差・開始差・目標までの残量・BMI・連続記録日数・直近30日グラフ |
| グラフ | 指標切替（体重/体脂肪率/筋肉量/ウエスト）・期間切替（7/30/90日・1年・全期間）・目標線・7日移動平均・点タップで詳細 |
| 履歴 | 日付降順一覧・検索・編集・削除（確認あり） |
| データ移行 | RecStyle 等の CSV 取込（列名・日付形式を自動判別、取込前プレビューで新規/重複/不正を分類） |
| バックアップ | 全データを JSON / CSV 出力、JSON から復元（不正ファイルでは既存データを変更しない） |
| PWA | ホーム画面への追加・単独起動・オフライン・更新通知 |

## 技術構成

TypeScript / Vite / Chart.js / IndexedDB（Dexie.js）/ Vitest / Playwright / vite-plugin-pwa。
UI とデータ処理を分離し、計算・保存・取込ロジックは単体テスト対象（`src/lib`）。

```
body-record/
├── index.html
├── src/
│   ├── main.ts            # アプリシェル・タブ・状態管理
│   ├── types.ts           # ドメイン型
│   ├── styles.css         # テーマ（ライト/ダーク/端末連動）
│   ├── lib/               # ── UI 非依存・テスト対象 ──
│   │   ├── calc.ts        #   BMI・差分・移動平均・連続日数・目標進捗
│   │   ├── csv.ts         #   CSV 取込プレビュー・出力
│   │   ├── backup.ts      #   JSON バックアップ・復元
│   │   ├── db.ts          #   Dexie（IndexedDB）CRUD
│   │   └── settings.ts    #   設定（localStorage）
│   └── ui/                # 画面（記録/グラフ/履歴/設定）+ Chart.js ラッパー
├── tests/                 # Vitest 単体テスト
└── e2e/                   # Playwright E2E
```

## 開発

```bash
cd body-record
npm install
npm run dev        # 開発サーバ
npm run build      # 型チェック + 本番ビルド（dist/）
npm test           # 単体テスト（Vitest）
npm run e2e        # E2E（Playwright, ビルド→preview を自動起動）
```

> E2E をローカルで動かす際、環境同梱の Chromium を使う場合は
> `PW_CHROME_PATH=/path/to/chrome PLAYWRIGHT_BROWSERS_PATH=... npm run e2e` のように指定できます。

## デプロイ（GitHub Pages）

リポジトリ Settings → Pages → Source を **GitHub Actions** にすると、`.github/workflows/body-record.yml`
が main への push でビルド・テストののち `body-record/dist` を公開します（プロジェクトサイトの
サブパス配信に対応するため `base: './'`）。公開後、スマホのブラウザで開き「ホーム画面に追加」。

## RecStyle からの移行手順

1. RecStyle でデータを CSV エクスポート
2. 本アプリ「設定 → CSV を選択して取り込む」で選択
3. プレビュー（新規 / 重複 / 不正の件数と内容）を確認し「取り込む」
   - 同一日付が既存にある場合、既定では**上書きしない**（チェックで上書き可）

対応する日付表記: `2026/07/21` `2026-07-21` `2026.07.21` `2026年7月21日` `20260721`。
区切りはカンマ / タブ / セミコロンを自動判定。ヘッダ無し CSV は列位置で推定。

## データ・プライバシー

- 記録は IndexedDB、設定は localStorage（いずれも端末内）。外部送信なし
- iOS Safari はストレージが削除される場合があるため、定期的な JSON 出力を推奨

## MVP 対象外・将来候補

月次集計 / カレンダー / PIN ロック / カスタム項目 / 写真 / 複数回記録 / 端末間同期 /
Web Push / ヘルスケア連携 等は将来対応（要件定義書 3.2 / 3.3 参照）。
