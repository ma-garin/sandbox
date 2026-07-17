# CURRENT_STATE.md — QA-managed（観点駆動マネージドQaaS）

> **更新タイミング**: 各セッション終了時に更新する。
> **次回開始**: 「CURRENT_STATE.mdを読んで再開して」の1行でコンテキスト復元。

---

## プロジェクト名

QA-managed（観点駆動マネージドQaaS ／ 通称: 国産QA Wolf）

## 最終更新

2026-07-17

## 現在のフェーズ

構想・設計（コード未着手）

## 直近の完了タスク

- 欧米のQA×AIツールを調査（QA Wolf / Mabl / Testim / Functionize / Momentic / KaneAI / Applitools ほか）
- 市場シグナル確認（Gartner 2025/10 初MQ、Forrester「Autonomous Testing Platforms」へ改称）
- 国内充足度マップを作成（自動化Autify・VRT NTTテクノクロスAIspectorは充足、QaaSマネージド国産主体と観点自動設計が空白）
- QA Wolf を分解し弱点を特定（保守・トリアージが労働集約→テスト増でコスト膨張、年間中央値≒$90k）
- 事業方針を決定：**上流の観点設計をAIで握り、実行はマネージドで回す**国産QaaS
- `_template/` を複製し `QA-managed/` を作成、README/AGENTS/CURRENT_STATE を初期化

## 次のタスク（最優先）

- MVPスコープの確定（まず「①観点自動設計」を単体の価値実証に絞るか、②実行まで通すか）
- 既存資産の棚卸し：`QA-PMO/portal/knowledge`（観点エンジン・63観点）、`spec-inspector`（観点スコアリング）、`QA-knowledge`（URL→上流ドキュメント逆生成）のどれをどう再利用するか
- 技術スタック選定（ブラウザ完結 or Django or Python CLI）
- 課金/保証モデルの仮設計（観点網羅率 × evidence-only 判定）

## 未解決の判断待ち事項

- **MVPの最小価値**：まず「URL/仕様書 → テスト観点を自動生成」だけを出すのが最速か？
- 実行レイヤ（Playwright生成・並列実行）を自作するか、既存OSS/サービスに委ねるか
- ターゲット業界を汎用にするか、規制業界（金融/組込/医療機器）に特化して参入障壁を作るか
- 事業形態：単体SaaSか、本業（第三者検証）の高付加価値化（送客・成果課金）か

## 既知の問題・技術的負債

- なし（未着手）

## 重要な設計決定

- 実行フェーズで欧米大手と正面から戦わない。**上流の観点設計**を差別化の核に置く（QA Wolf が人手に頼る領域をAIで前倒し）
- 第三者検証会社の**中立性・観点ナレッジ・エンジニア供給網**を競争優位の源泉とする

## セッション開始時の指示テンプレート

```
CURRENT_STATE.mdを読んで、次のタスクから作業を再開してください。
プロジェクト: /Users/fujimagariyuki/Desktop/app/sandbox/QA-managed/
```
