# sandbox

AIDDの学習や一時的な検証のための場所。

## ルール

- 各プロジェクトは独立したフォルダで管理する
- フォルダ間で依存・干渉しない
- 各フォルダが自己完結する（セットアップ手順は各 README に書く）

## フォルダ命名規則

```
NNN-short-description/
```

例: `001-aidd-hello/`, `002-api-trial/`

## 新規プロジェクトの始め方

1. `_template/` をコピーしてリネーム（命名規則: `NNN-short-description/`）
2. コピー先の以下ファイルを編集する：
   - `README.md` — プロジェクト概要・セットアップ手順
   - `AGENTS.md` — プロジェクト固有の技術スタック・対象ファイル
   - `CURRENT_STATE.md` — 現在のフェーズ・次のタスク
3. 必要な技術スタックのセットアップは各フォルダ内で完結させる

## Codex / Claude Code との連携

- **共通規約**: `sandbox/AGENTS.md` が全プロジェクトに自動適用される
- **プロジェクト規約**: 各フォルダの `AGENTS.md` に固有情報を追記
- **セッション引き継ぎ**: `CURRENT_STATE.md` をセッション終了時に更新

## 構成

| フォルダ / ファイル | 内容 |
|---|---|
| `_template/` | 新規フォルダのひな形 |
| `yuki-aidd-kit/` | AIDD開発キット（スキル・フック・テンプレート） |
| `001-qa-skills-pro/` | QA監査Skillスイート（DOM-06 MVP・実装済み） |
| `002-tracegate/` | 仕様・テスト整合性監査CLI（INF-01・Sonnet実装待ち） |
| `003-agentlint/` | エージェント権限Lint（GT-15・Sonnet実装待ち） |
| `ROADMAP.md` | QAポートフォリオ実装計画とSonnet実装セッションの運用ルール |
| `AGENTS.md` | Codex用の全プロジェクト共通規約 |
