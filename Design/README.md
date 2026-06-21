# UI/UX Knowledge Atlas

GitHub Pages で公開する大型 UI/UX 学習サイト。QAエンジニア・PdM・開発者・デザイナー未経験者を対象に、基礎から応用まで体系的に学べる「オライリー級」の静的サイトを目指す。

## 構成

```
Design/
├── README.md
├── AGENTS.md
├── CURRENT_STATE.md
├── site-structure.md          ← サイト全体構成・ディレクトリ設計
├── wireframes.md              ← 4画面ワイヤーフレーム定義
├── chapters/
│   ├── 01-foundation.md       ← Part 1: UI/UX基礎原理
│   ├── 02-cognitive-laws.md   ← Part 2: 認知心理・UX法則
│   ├── 03-ui-patterns.md      ← Part 3: UIパターン・デザインレシピ
│   ├── 04-research.md         ← Part 4: UXリサーチ・評価・計測
│   ├── 05-accessibility.md    ← Part 5: アクセシビリティ
│   ├── 06-design-system.md    ← Part 6: デザインシステム
│   ├── 07-qa-ux.md            ← Part 7: QAエンジニア向けUX検証
│   └── 08-ai-ux.md            ← Part 8: AI/エージェント時代のUX
└── roadmap.md                 ← 制作ロードマップ・フェーズ管理
```

## 8本柱

| Part | タイトル |
|------|----------|
| 1 | UI/UX 基礎原理 |
| 2 | 認知心理・UX法則・フレームワーク |
| 3 | UIパターン・デザインレシピ |
| 4 | UXリサーチ・評価・計測 |
| 5 | アクセシビリティ |
| 6 | デザインシステム |
| 7 | QAエンジニア向けUX検証 |
| 8 | AI/エージェント時代のUX |

## 公開方針

- 公開先: GitHub Pages
- 実装: `index.html` + `chapters/*.html` に分割（単一巨大HTML禁止）
- 将来規模: 300MB 超を想定。章分割・画像最適化・検索index分離前提
- 図表: SVG 中心で軽量に保つ
