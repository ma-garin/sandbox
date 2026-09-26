// デザイントークンの色値（yuki-aidd-kit 02_共通/ひな形/tokens.css の :root から。値を変えない・足さない）。
// docx・xlsx が使う色値（TOKEN_HEX）。HTML は kit-css.ts の TOKENS_CSS を埋め込む。
// 更新手順: tokens.css の色値が変わったら、下の値も同じに直す（一致は test/render.test.ts が確かめる）。


/** docx・xlsx 用の色値（# を除いた 6 桁）。tokens.css の :root（ライト）から取った値 */
export const TOKEN_HEX = {
  'color-text-secondary': '616161',
  'color-surface-2': 'F1F3F4',
  'color-surface-3': 'FAFBFC',
  'color-text': '212121',
  'color-primary': '176DC2',
  'color-border': 'E0E0E0',
} as const;
