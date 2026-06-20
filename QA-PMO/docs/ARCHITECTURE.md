# アーキテクチャ設計書 — ベリサーブ 品質ポータル

本書は社内品質ポータル（Django版）のシステム構成・データモデル・画面遷移を図解する。
図は GitHub 上でグラフィカルに描画される（Mermaid）。

---

## 1. システム構成

```mermaid
flowchart TB
    subgraph Client["ブラウザ（社内ユーザー）"]
        UI["サーバーレンダリングHTML + 最小JS"]
    end
    subgraph Django["Django アプリケーション（localhost / 将来は社内サーバー）"]
        URL["config/urls.py ルーティング"]
        subgraph catalog["catalog アプリ"]
            CV["views: home / detail / search"]
            NAV["nav.py: サイドナビ生成"]
        end
        subgraph tools["tools アプリ"]
            TV["views: tool_key ディスパッチ"]
            LOGIC["logic.py: 計算ロジック（決定的）"]
        end
        subgraph knowledge["knowledge アプリ"]
            ENG["engine.py: 観点ベース設計"]
        end
        ORM["Django ORM"]
    end
    DB[("SQLite（将来 PostgreSQL）")]

    UI -->|HTTP| URL
    URL --> CV
    URL --> TV
    CV --> NAV
    TV --> LOGIC
    TV --> ENG
    CV --> ORM
    TV --> ORM
    ENG --> ORM
    NAV --> ORM
    ORM --> DB
```

**設計の要点**
- 計算ロジック（`logic.py` / `engine.py`）はビューから独立した**純粋関数**。単体テストが容易（QAグレード）。
- 状態は **DB に永続化**（旧版の localStorage 依存を脱却）。複数ユーザー・複数端末で共有可能。
- 画面は**サーバーレンダリング**。JS は最小限（ナビ開閉のみ）でアクセシビリティと保守性を確保。

---

## 2. データモデル（ER図）

```mermaid
erDiagram
    Category ||--o{ ServiceGroup : has
    Category ||--o{ Service : has
    ServiceGroup ||--o{ Service : groups
    ViewpointCategory ||--o{ Viewpoint : classifies
    ViewpointCategory ||--o{ DefectPattern : classifies

    Category {
        slug slug PK
        string name
        string icon
        int order
    }
    Service {
        slug slug PK
        string title
        string kind "tool|catalog"
        string tool_key
        string product
        json tags
        json features
        json steps
    }
    Viewpoint {
        string viewpoint
        string technique
        string source_type "always|field|flag|industry"
        string source_key
    }
    DefectPattern {
        string pattern_id PK
        string pattern
        string example
        string prevention
    }
    Defect {
        string title
        string severity "ISTQB"
        string phase
        string root_cause
        string status
        datetime created_at
    }
```

- **Service.kind** が `tool` のものは `tool_key` で `tools/views.py` の処理に紐付く。
- **Viewpoint** は適用契機（常時 / 入力項目型 / 機能特性 / 業種）で分類され、観点ベース設計エンジンが参照する。
- **Defect** は ISTQB severity を持ち、DB に保存される（旧版の localStorage から移行）。

---

## 3. 画面遷移

```mermaid
flowchart LR
    HOME["🏠 ホーム<br/>区分別カード"] -->|サービス選択| DETAIL{"種別?"}
    HOME -->|検索| SEARCH["🔍 検索結果"]
    SEARCH --> DETAIL
    DETAIL -->|catalog| CAT["📄 サービス詳細<br/>特徴・フロー・タグ"]
    DETAIL -->|tool| TOOL["🛠️ 実務ツール画面<br/>フォーム→実行→結果"]
    TOOL -->|再実行| TOOL
    HOME -.サイドナビ.-> DETAIL
```

全画面に**パンくず**（区分 › グループ › サービス）と**サイドナビ**を常時表示し、現在位置を明示する。

---

## 4. リクエスト処理フロー（ツール実行時）

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant V as tools/views.py
    participant L as logic.py / engine.py
    participant D as DB(ORM)

    U->>V: POST /s/test-design/ (フォーム入力)
    V->>L: engine.generate(機能, 項目, 特性, 業種)
    L->>D: 該当する観点を問い合わせ
    D-->>L: 観点リスト
    L-->>V: テスト条件 + 観点カバレッジ
    V-->>U: 結果テーブルを描画（監査証跡付き）
```

---

## 5. 技術選定の理由

| 項目 | 選定 | 理由 |
|---|---|---|
| フレームワーク | Django 5.1 | 認証・DB(ORM)・管理画面が標準装備。社内ポータル/管理システムに最適 |
| DB | SQLite → PostgreSQL | 開発は即起動のSQLite、本番運用時にPostgreSQLへ移行可能 |
| レンダリング | サーバーサイド | SEO/アクセシビリティ/保守性。JSを最小化しQAしやすい |
| 計算ロジック | 純粋関数 | ビューから分離し単体テスト可能。AIなし・決定的で再現性100% |
| コスト | 0円 | すべて無料OSS。外部API・課金・登録なし |
