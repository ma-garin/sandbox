# PWA の UI/UX 調査

調査日: 2026-08-10 ／ 対象記事 34 件（取得成功 31 / 失敗 3）

「おみくじ帳」の見た目と使い勝手を上げるために、PWA の UI/UX に関する記事を集めて読んだ記録。
**同じ調査を二度しないために残す。** 数値は記事の記述であり、断りのないものは一次データまで辿っていない。

## 調査のしかた

1. 検索を5回かけて候補 URL を 34 件集めた
2. 3 本のサブエージェント（Opus）に 11 / 11 / 12 件ずつ配り、全件を実際に取得させた
3. 取得できなかったものは「失敗」として記録し、推測で埋めていない

### 取得できなかった記事（3件）

| 記事 | 理由 |
|---|---|
| [PWA Design（gomage）](https://www.gomage.com/blog/pwa-design/) | HTTP 403 |
| [Progressive Web App Design（morhover）](https://morhover.com/blog/progressive-web-app-design/) | 60秒タイムアウト（2回） |
| [Mobile App UI/UX Design Trends（GitNexa）](https://www.gitnexa.com/blogs/mobile-app-ui-ux-design-trends) | 接続拒否（2回） |

この3件にしかない指針は反映できていない。

---

## 数値を伴う指針

**設計の判断に直接使えるもの。** 出典が1件しかないものはその旨を付けた。

| 指針 | 数値 | 出典 |
|---|---|---|
| タップできる的の最小 | **48×48px** | [topdevelopers](https://www.topdevelopers.co/blog/tips-to-build-a-great-ui-ux-design-for-pwa/) / [Netguru](https://www.netguru.com/blog/pwa-ux-techniques) |
| 文字と背景のコントラスト | **4.5:1**（WCAG 2.1） | topdevelopers |
| 本文の文字サイズ | **16px 以上** | topdevelopers（単独） |
| 色数 | **3〜4色**に絞る | topdevelopers（単独） |
| 3G 回線で操作可能になるまで | **2秒以内** | [Alphonso Labs](https://www.alphonsolabs.com/pwa-must-have-features-2026/) |
| 初回表示に要る JavaScript | **200KB 未満** | Alphonso Labs |
| 再訪問時の LCP | **1秒以下** | [MobileViewer](https://mobileviewer.github.io/pwa-mobile-testing-checklist-2026) |
| CLS | **0.1 以下** | Netguru |
| スケルトン表示が効く帯 | 読み込み **2〜10秒** | Netguru / [Abbacus](https://www.abbacustechnologies.com/progressive-web-design/) |
| Safari のキャッシュ上限 | オリジンあたり **50MB** | Alphonso Labs |
| **iOS のストレージ削除** | **7日**未使用で消える可能性 | MobileViewer |
| 影の段数 | **2〜3レベル**を一貫した光の方向で | [Muzli](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/) |
| ダーク設計の面の段数 | 最低 **4段階** | Muzli |
| 片手シングルタッチ操作の割合 | **75%** | Muzli |
| 動画オンボーディング | **3〜5秒** | [Moburst](https://www.moburst.com/blog/top-mobile-web-design-trends/) |
| maskable アイコンの安全域 | 中央 **80%** | MobileViewer |
| 必須アイコンサイズ | **192px と 512px の両方** | [MDN Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) |

## 領域ごとの指針

### ナビゲーション
- ナビゲーションは画面**下部**に置く（[magenest](https://magenest.com/en/progressive-web-app-design/) / [exposit](https://exposit.medium.com/pwa-design-considerations-ui-and-ux-best-practices-9be966b2961b) / [codica](https://www.codica.com/blog/tips-for-great-progressive-web-app-design/) / Abbacus）
- 快適に届くのは「画面下部 1/3 ＋ 利き手側の曲線」。中央より上はデッドゾーン（Muzli）
- 重要な要素へは 3クリック以内（topdevelopers）
- モバイルでは従来型フッターを削除する（magenest / codica / topdevelopers / [PWA Checklist](https://pwa-checklist.netlify.app/) / [MDN Best practices](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Best_practices)）
- **standalone にはブラウザの戻るボタンがない。** 戻る手段を自前で用意する（PWA Checklist / Alphonso Labs）

### オフライン
- 汎用エラーではなく**何ができるかを書く**。例:「You are offline. You can still browse saved items and recent pages.」（Abbacus / Alphonso Labs）
- キャッシュ戦略は3種を使い分ける — 静的アセット: cache-first ／ 鮮度が要る API: network-first ／ 即時表示して裏で更新: stale-while-revalidate（Alphonso Labs）
- 検証は DevTools の Offline だけでなく実機の機内モードで行う（Alphonso Labs）

### インストール促進
- 初回ロードではなく、**意味のある操作の後**に出す（Netguru / Abbacus / [web.dev](https://web.dev/learn/pwa/installation-prompt)）
- manifest に `description` と `screenshots` を入れると、Chrome Android の表示が小さな info bar から詳細ダイアログに格上げされる（web.dev / MDN）
- `prompt()` は保持した `beforeinstallprompt` に対して**1回しか呼べない**（web.dev / [MDN Trigger install prompt](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt)）
- **iOS には自動プロンプトがない。** `display-mode: browser` で判定し、手動追加の手順を出す（web.dev / [dev.to](https://dev.to/designly/creating-an-install-to-home-screen-prompt-in-a-nextjs-progressive-web-app-2o1)）

### 見た目（「洗練」の作り方）
- **影と elevation だけで奥行き演出の 80% の効果**が出る。ジャイロ等は残り20%（Muzli）
- 面は「地／カード／浮いたサーフェス／オーバーレイ」の4段階（Muzli）
- Glassmorphism を使ってよいのは通知・メディア・モーダル・ナビのオーバーレイ。**避けるのはデータテーブル・フォーム入力・低コントラスト環境**（Muzli）
- 余白は generous に。競合する要素数を減らす（Moburst / [UIDesignz](https://uidesignz.com/blogs/mobile-ui-design-best-practices) / [Sphinx](https://sphinxjsc.com/blog/app-design-for-2026-trends-techniques-and-tools)）
- ボールドとライトの対比で階層を作る（[Dev-Story](https://dev-story.com/blog/ui-ux-design-trends/)）
- Calm / Low-Stimulus UI: コントラストを柔らかく、遷移を遅く（Moburst）
- Human Touch: グレイン、紙のような質感、不完全な形（Moburst）
- **px の具体値はどの記事にも書かれていなかった**（余白・文字サイズの基準値は未記載）

### その他
- スクロール位置を詳細から戻ったときに復元する（magenest / exposit / codica）
- 件数が増えるなら無限スクロールではなく仮想リスト（magenest）
- 各セクションに固有 URL を与えディープリンク可能にする（MDN Best practices）
- `font-family: system-ui` でネイティブ体験に近づける（PWA Checklist / MDN Best practices）
- `prefers-color-scheme` で OS のテーマに追従（MDN Best practices）
- Badging API は許可プロンプト不要。ただし iPhone 非対応（Alphonso Labs）
- Lighthouse の PWA 監査は 13項目。合格しても UX の良さは保証しない（Alphonso Labs）

---

## この帳面への適用

### 対応した（実測で確認）

| 指針 | 対応 |
|---|---|
| タップの的 48×48px | 月送り 36→48、月ラベル 38→48、検索消去 30→44、記録のある日はマス全体（48×62）を的に |
| コントラスト 4.5:1 | `--text-weak` を #90A4AE（2.29:1）→ #57727D（4.52:1）へ |
| オフラインで何ができるか書く | 「電波が届いていません。書きとめた記録はすべて読めます」を上部に出す |
| 下部ナビゲーション | 4タブのタブバー |
| maskable アイコン・192/512px | 両方用意、中央80%に収めた |
| フッター不採用 | タブバー方式 |
| 全件オフライン閲覧 | Service Worker で本文ごと先読み |

### まだ対応していない

優先度順。上から効きが大きい。

1. **インストール促進 UI** — 記録し終えた直後に出す。`beforeinstallprompt` を保持して自前バナーから `prompt()`
2. **iOS の手動追加手順** — 自動プロンプトが来ないため、`display-mode: browser` のときだけ設定に案内を出す
3. **スクロール位置の復元** — 一覧→詳細→戻るで位置が飛ぶ
4. **記録ごとの固有 URL** — 共有も履歴戻りもできない
5. **manifest に `description` と `screenshots`** — Android のインストール画面が格上げされる
6. **影を 2〜3 レベルで戻す** — いまは影を全廃して1px罫のみ。Muzli の指摘に照らすと奥行きが0レベル
7. **面の4段階化** — いまは地と面の2段
8. **タップのフィードバック**（リップル/ハイライト）
9. **`prefers-color-scheme` でのダーク対応**
10. **実機 standalone での safe-area 確認** — in-browser では出ず standalone でだけ出る不具合の巣

---

## 引用してはいけない数値

一次データまで辿っていない、または記事の記述自体が壊れていたもの。**次回そのまま使わない。**

- 「下部ナビ導入で DAU・セッション時間が 65〜70% 増」（Lollypop）— 出典元の調査が示されていない
- 「47% のユーザーが3秒以内の読み込みを期待」「0.1秒短縮でコンバージョン最大10%向上」（Netguru）— 同上
- 「タップフィードバックで 75% のユーザーが満足度向上を報告」（Netguru / Lollypop）— 同上
- 「第一印象の 94% がデザインに依存」「DoorDash 再設計で初回注文完了率 20% 増」（Dev-Story）— 同上
- Tinder のロード時間事例（topdevelopers）— **記事本文の数値記載が不整合**のため引用不可
- 「Twitter Lite データ 70% 削減」「Pinterest 40% 高速化」（ysinc）— よく引かれるが本調査では原典未確認
