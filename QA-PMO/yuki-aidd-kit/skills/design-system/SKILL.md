---
name: design-system
description: YukiのAIDDツール群に一貫したビジュアルデザインを適用するスキル。HTMLツール・PWA・Streamlitアプリのデザインを決める際、「デザインどうする」「色は」「レイアウトは」「Material Design」「UIを作る」「コンポーネントを実装する」という言及があれば必ずこのスキルを使うこと。UX Reviewer・QA Lens・PMOエージェント・my-accounting-app等の既存ツールと統一感を保つためにも必ず参照する。
---

# Yuki Design System（MD3 Lightベース）

過去ツール群（UX Reviewer v3〜v5 / QA Lens / my-accounting-app / PMOエージェント）から抽出した統一デザイン言語。迷ったらここの値をそのまま使う。

## カラーパレット（CSS変数）

```css
:root {
  /* Primary */
  --color-primary:       #1976D2;
  --color-primary-light: #E3F2FD;
  --color-primary-dark:  #0D47A1;

  /* Surface */
  --color-bg:            #F8F9FA;
  --color-surface:       #FFFFFF;
  --color-surface-2:     #F1F3F4;

  /* Border & Divider */
  --color-border:        #E0E0E0;
  --color-divider:       #F0F0F0;

  /* Text */
  --color-text:           #212121;
  --color-text-secondary: #616161;
  --color-text-disabled:  #9E9E9E;

  /* Status（ISTQB severity対応） */
  --color-critical: #D32F2F;
  --color-high:      #F57C00;
  --color-medium:    #FBC02D;
  --color-low:        #689F38;
  --color-info:        #0288D1;
  --color-success:    #2E7D32;
}
```

別系統（落ち着いた紺ベースが要件の場合。PMOエージェント系で使用）:
```css
--md-primary: #1a3a6b; --md-primary-light: #2e5aa8; --md-primary-dark: #0d2240;
--md-bg: #f0f2f7; --md-surface: #ffffff; --md-surface-v: #f7f8fc;
```
→ デフォルトは`#1976D2`系。「落ち着いた雰囲気」「PMO」「業務向け」の言及があれば紺系`#1a3a6b`に切り替える。

## タイポグラフィ
- 日本語本文: `Noto Sans JP`（300/400/500/700）
- コード・数値: `JetBrains Mono`（400/500/600）
- Google Fonts経由: `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`

## レイアウト数値
```css
--nav-w: 248px;      /* サイドナビ幅 */
--top-h: 60px;       /* ヘッダー高さ */
--r: 10px;           /* カード角丸 */
--r-sm: 6px;         /* ボタン・バッジ角丸 */
```

## エレベーション（shadow）
```css
--el1: 0 1px 3px rgba(26,58,107,.08), 0 1px 2px rgba(26,58,107,.12);
--el2: 0 3px 8px rgba(26,58,107,.10), 0 2px 4px rgba(26,58,107,.08);
--el3: 0 8px 24px rgba(26,58,107,.12), 0 4px 8px rgba(26,58,107,.08);
```

## コンポーネントパターン
- **バッジ**: severity色を背景薄め+文字濃いめのペアで表現（例: critical背景`#FFEBEE`+文字`#D32F2F`）
- **サイドナビ**: 固定幅248px、アクティブ項目は`--color-primary-light`背景+左ボーダー強調
- **カード**: `--r`角丸、`--el1`基本、ホバー/フォーカスで`--el2`
- **ノースクロールレイアウト**: PMO系業務ツールはヘッダー固定+サイドバー固定+メインのみoverflow-y

## 適用判断
- 個人PWA・ツールデモ → `#1976D2`系、親しみやすさ優先
- 業務向け・PMO・大規模SIer向け → `#1a3a6b`系、落ち着き優先
- 迷ったら個人物は前者、対外/上長提出物は後者
