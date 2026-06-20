# design.md — PMOサービスメニューツール

## アーキテクチャ
単一HTMLファイル（single-html-tool準拠）。CSS変数・Vanilla JS。外部依存はGoogle Fonts CDNのみ。

## レイアウト構成
```
┌─────────────────────────────────────────────┐
│  Topbar（固定 60px）                         │
├──────────┬──────────────────────────────────┤
│ Sidenav  │  Main エリア                      │
│ （260px  │  ┌──────────────────────────────┐│
│  固定）  │  │ ① Home: サービスカード一覧    ││
│          │  │ ② Detail: サービス詳細        ││
│ 2階層    │  │   - パンくず                  ││
│ ツリー   │  │   - ヘッダー・説明            ││
│          │  │   - 特徴カード(4枚)           ││
│ 検索     │  │   - 支援フロー                ││
│ ボックス │  │   - タグ                      ││
│          │  │   - CTA（問い合わせモーダル） ││
│          │  └──────────────────────────────┘│
└──────────┴──────────────────────────────────┘
```

## デザイントークン（design-system準拠・業務PMO紺系）
- Primary: `#1a3a6b` / Light: `#2e5aa8` / Dark: `#0d2240`
- BG: `#f0f2f7` / Surface: `#ffffff`
- フォント: Noto Sans JP（300/400/500/700）、font-display:swap

## 状態管理（メモリ内state）
```javascript
state = {
  currentView: 'home' | 'detail',
  activeServiceId: string | null,
  searchQuery: string,
}
```

## 問い合わせモーダル
- オーバーレイ表示
- 入力項目: 会社名・氏名・メールアドレス・問い合わせ内容・希望サービス（自動セット）
- 送信はダミー（alert）— 本実装時にメール/フォームサービス連携

## データ構造
```javascript
SERVICES = {
  [id]: {
    icon, iconBg, title, category,
    breadcrumb: string[],
    desc: string,
    features: [{ icon, title, desc }],  // 4件
    steps: string[],                     // 支援フロー
    tags: string[],
    cta: string,
  }
}
```
