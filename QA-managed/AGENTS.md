# AGENTS.md — QA-managed（観点駆動マネージドQaaS）

> 共通規約は親フォルダの `sandbox/AGENTS.md` を参照。
> このファイルにはプロジェクト固有の情報のみ記載する。

---

## このプロジェクトの概要

米 QA Wolf 型のマネージドQaaSを国産化する事業・システムの設計/検証リポジトリ。
差別化の核は **「テスト観点の自動設計（上流）」× 「AI＋第三者検証者によるマネージド実行」**。
現フェーズは**設計・構想**（コードなし）。まず MVP スコープと技術選定を確定する。

## 対象ファイル

```
QA-managed/
├── README.md         サービス構想・市場仮説・QA Wolf との対比
├── AGENTS.md         本ファイル（プロジェクト規約）
├── CURRENT_STATE.md  現在のフェーズ・次タスク・判断待ち
└── （以降、設計確定後に docs/ ・実装を追加）
```

## 対象外ファイル

- 他プロジェクト（`QA-PMO/` `spec-inspector/` `QA-knowledge/` `yuki-aidd-kit/`）は
  **参照のみ**。sandbox規約によりフォルダ間依存は禁止。資産を使う場合は本フォルダ内へ
  再実装またはコピーする。無差別に読まない（必要箇所を grep/glob で絞ってから読む）。

## 使用技術・制約

- 技術スタック未定（設計フェーズ）。決定は `CURRENT_STATE.md` に記録する。
- APIキー等はハードコード禁止（localStorage / 環境変数）。GitHub Pages既定。
- 成果物は ISO/IEC 25010 で自己レビュー、指摘は ISTQB severity、判定は evidence-only。

## 現在のタスク

→ `CURRENT_STATE.md` を参照
