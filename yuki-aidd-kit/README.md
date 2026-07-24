# Yuki AIDD Kit

過去のAIDD実績から抽出した、Claude Code用パーソナライズドキット。

## 構成

```
yuki-aidd-kit/
├── CLAUDE.md.template          # グローバル設定（環境・トークン規律・QA観点）
├── claude-projects-setup.md    # Claude Projects「AIDDラボ」セットアップ手順
├── skills/
│   ├── single-html-tool/       # 単一HTMLツール開発（MD3・localStorage・JSON強制）
│   ├── sdd-ecc-workflow/       # SDD 10ステップ + ECC + cc-sdd（templatesあり）
│   ├── qa-review-standards/    # ISO 25010・ISTQB severity・Whittakerツアー
│   ├── personal-pwa/           # GitHub Pages PWA・Gemini無料枠・Fold5対応
│   ├── streamlit-rag-app/      # PMOエージェント系（VeriRAG・16モジュール）
│   └── browser-use/            # Playwright MCPで実ブラウザを操作・目視確認
└── claude-code/
    ├── mcp/
    │   └── mcp.json.template   # Playwright / Context7 / Firecrawl MCP登録テンプレート
    ├── hooks/
    │   ├── settings.json       # Claude Code hookの設定ファイル
    │   ├── pre-write-check.sh  # 書き込み前: 秘密情報・外部分割を警告
    │   ├── post-write-html.sh  # HTML保存後: 行数・localStorage確認
    │   └── session-summary.sh  # セッション終了: コミット忘れ・implement.md確認
    └── commands/
        ├── new-pwa.md          # /new-pwa   — 新規PWA立ち上げ
        ├── qa-review.md        # /qa-review — ISO/ISTQB準拠レビュー実行
        ├── sdd-start.md        # /sdd-start — SDD 10ステップ起動
        └── token-check.md      # /token-check — トークン使用量確認と最適化
```

## 導入手順

```bash
# 1. グローバル設定
cp CLAUDE.md.template ~/.claude/CLAUDE.md

# 2. スキル（全プロジェクト共通）
cp -r skills/* ~/.claude/skills/

# 3. Hooks（hookスクリプトに実行権限を付与）
cp claude-code/hooks/settings.json ~/.claude/settings.json
cp claude-code/hooks/*.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/*.sh

# 4. スラッシュコマンド（全プロジェクト共通）
cp claude-code/commands/* ~/.claude/commands/

# 5. MCP（任意・使うプロジェクトのルートで実行）
cp claude-code/mcp/mcp.json.template ./.mcp.json   # APIキーを埋めてから使う
```

## Claude Projects セットアップ
`claude-projects-setup.md` を参照してclaud.ai上に「AIDDラボ」プロジェクトを作成する。

## 推奨MCP
`claude-code/mcp/mcp.json.template` をプロジェクトルートに `.mcp.json` としてコピーし、必要なAPIキーを埋める。個別追加は `claude mcp add` でも可（フラグはCLIバージョンで変わるため `claude mcp add --help` を確認）。

| MCP | 用途 | APIキー |
|---|---|---|
| **Playwright** | 実ブラウザ操作（`browser-use` skillのドライバ） | 不要 |
| **Context7** | 最新ライブラリドキュメント参照 | 任意（無いと低レート制限） |
| **Firecrawl** | Webスクレイピング・クロール | 必要（firecrawl.dev/app/api-keys で発行） |
| **Exa** | Web Search + Code Docs Search | 必要 |

- 1MCP≈数千トークン。使わないプロジェクトでは有効化しない（CLAUDE.md.templateのトークン規律を参照）

## 外部スキル集（任意）
- **mattpocock/skills**: `npx skills@latest add mattpocock/skills` → 導入後 `/setup-matt-pocock-skills` を実行。grill→PRD→issues→TDD→code-reviewの一連ワークフローが入る。既存skills（qa-review-standards・sdd-ecc-workflow等）と役割が重なる部分があるため、導入前に `ask-matt` で一覧を確認してから取捨選択する
