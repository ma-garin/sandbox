// yuki-aidd-kit の tokens.css・ui/components.css・ui/layout.css を無改変で kit-css.ts に写す（ビルド時に 1 回）。
// 使い方: node src/render/sync-kit-css.ts [kit のルート]（省略時は環境変数 AIDD_KIT_DIR、無ければ既定の置き場所）
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_KIT_DIR = '/Users/fujimagariyuki/dev/active/yuki-aidd-kit';
export const KIT_FILES = {
  TOKENS_CSS: '02_共通/ひな形/tokens.css',
  COMPONENTS_CSS: '02_共通/ひな形/ui/components.css',
  LAYOUT_CSS: '02_共通/ひな形/ui/layout.css',
} as const;

/** 埋め込む kit のアイコン（02_共通/ひな形/components/icons.js の Material Symbols の path） */
export const KIT_ICONS_FILE = '02_共通/ひな形/components/icons.js';
export const KIT_ICON_NAMES = ['checklist', 'close', 'error', 'check-circle', 'info', 'download', 'manage-search', 'data-object'] as const;

/** icons.js の本文から名前の path を取り出す（見つからなければ例外） */
export function extractIcons(iconsJs: string): Record<(typeof KIT_ICON_NAMES)[number], string> {
  const entries = KIT_ICON_NAMES.map((name) => {
    const m = new RegExp(`'${name}':\\s*'([^']+)'`).exec(iconsJs);
    if (!m?.[1]) throw new Error(`icons.js にアイコン ${name} がありません`);
    return [name, m[1]] as const;
  });
  return Object.fromEntries(entries) as Record<(typeof KIT_ICON_NAMES)[number], string>;
}

export function kitDir(): string {
  return process.env['AIDD_KIT_DIR'] ?? DEFAULT_KIT_DIR;
}

if (import.meta.main) {
  const root = process.argv[2] ?? kitDir();
  const body = Object.entries(KIT_FILES)
    .map(([name, rel]) => `/** ${rel} の写し */\nexport const ${name} = ${JSON.stringify(readFileSync(join(root, rel), 'utf8'))};\n`)
    .join('\n');
  const icons = extractIcons(readFileSync(join(root, KIT_ICONS_FILE), 'utf8'));
  const iconBody = `\n/** ${KIT_ICONS_FILE} から取り出した path */\nexport const KIT_ICONS = ${JSON.stringify(icons, null, 2)} as const;\n`;
  const header =
    '// 自動生成（src/render/sync-kit-css.ts）。手で直さない。yuki-aidd-kit のデザイン出荷物の無改変の写し。\n' +
    '// kit を更新したら `node src/render/sync-kit-css.ts` で作り直す。一致は test/render.test.ts が確かめる。\n\n';
  writeFileSync(join(import.meta.dirname, 'kit-css.ts'), header + body + iconBody, 'utf8');
  console.log('kit-css.ts を更新しました');
}
