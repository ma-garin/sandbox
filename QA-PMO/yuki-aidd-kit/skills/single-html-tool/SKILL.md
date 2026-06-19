---
name: single-html-tool
description: 単一HTMLファイルでツールのデモ/プロトタイプを作る際に使うスキル。「デモを作って」「単一HTMLで」「まず動くものを見せて」という言及で使用。本格実装の前段階として必ずこの形式を経由する。
---

# Single HTML Tool Pattern

Yukiの確立パターン：**まず単一HTMLでデモ→OK取得後にStreamlit/CLI等で本実装**。executiveやチームへの提案・買い手提示にも使う。

## 必須要件
- 1ファイル完結（CSS/JS同梱、外部依存はGoogle Fonts等のCDNのみ許可）
- データ永続化は`localStorage`（個人PWA用途）。業務デモはメモリ内state可
- design-systemスキルのトークンを必ず適用（カラー・フォント・余白）
- AIに判断させる箇所は出力をJSON形式で強制（パース失敗を防ぐ）
- サイドナビ+ヘッダー固定のノースクロールレイアウトが基本（業務系）

## 構成テンプレート
```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{ツール名}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>/* design-systemのCSS変数をここに */</style>
</head>
<body>
  <!-- topbar / sidenav / main -->
  <script>/* ロジック。AI呼び出しはJSON強制プロンプトで */</script>
</body>
</html>
```

## AI出力JSON強制の例
```javascript
const systemPrompt = `必ずJSON形式のみで応答してください。前置き・Markdown記法は禁止。
形式: {"severity": "Critical|Major|Minor|Cosmetic", "reason": "string"}`;
```

## 次フェーズへの移行判断
- 個人PWA向けで完結 → そのままGitHub Pagesにデプロイ（personal-pwaスキル参照）
- 複雑なRAG/multi-agent化が必要 → Streamlit移行（streamlit-rag-appスキル参照）
- 業務提案で承認後 → 本実装フェーズ（sdd-ecc-workflowスキル参照）
