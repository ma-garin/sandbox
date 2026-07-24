# Part 6: デザインシステム

## この章で学ぶこと

デザインシステムを「見た目のルール集」ではなく、**設計の一貫性・実装の再利用性・QA観点の標準化** まで接続するものとして理解する。

---

## 6-1. デザインシステムの4層

```
Governance（ガバナンス）
  ← 命名規則 / レビュープロセス / 変更管理
        ↑
Patterns（パターン）
  ← 認証フロー / 検索 / 承認 / 登録
        ↑
Components（コンポーネント）
  ← Button / Input / Table / Modal / Toast
        ↑
Foundations（基礎）
  ← Color / Typography / Spacing / Shadow / State
```

---

## 6-2. Foundations

### カラー

| トークン | 用途 |
|---------|------|
| `--color-primary` | メインブランドカラー |
| `--color-danger` | エラー・破壊的操作 |
| `--color-warning` | 注意・警告 |
| `--color-success` | 成功・完了 |
| `--color-neutral-*` | テキスト・背景・ボーダー |

> **原則**: 色そのもの（`#2f5fca`）ではなく意味（`primary`）で参照する。

### タイポグラフィ

| スケール | サイズ | 用途 |
|---------|--------|------|
| `text-xs` | 12px | ヘルプテキスト・キャプション |
| `text-sm` | 14px | ラベル・補足 |
| `text-base` | 16px | 本文 |
| `text-lg` | 18px | リードコピー |
| `text-xl` | 20px | セクション見出し |
| `text-2xl` | 24px | ページ見出し |

### スペーシング

4px グリッドを基本とする（4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px）

### 状態（State）

| 状態 | 視覚的表現 |
|------|-----------|
| Default | 通常表示 |
| Hover | わずかに背景色変化 |
| Focus | フォーカスリング表示（2px 以上） |
| Active | 押下時の視覚フィードバック |
| Disabled | 薄く・ポインターを `not-allowed` に |
| Error | 赤系ボーダー + エラーテキスト |
| Loading | スピナー or スケルトン |

---

## 6-3. Components

### Button

| バリアント | 用途 |
|-----------|------|
| Primary | メインのCTA（1画面に1〜2個まで） |
| Secondary | サブアクション |
| Destructive | 削除・取り消しなど危険操作 |
| Ghost | 視覚的重みを最小化したいとき |
| Icon-only | `aria-label` 必須 |

### Input

| 状態 | 表現 |
|------|------|
| Default | ボーダー1px neutral |
| Focus | ボーダー2px primary |
| Error | ボーダー2px danger + エラーメッセージ |
| Disabled | 背景グレー + `cursor: not-allowed` |

### Modal

- 開いたとき: フォーカスをモーダル内へ移動
- `Escape` キーで閉じられる
- 背景は `aria-hidden="true"` に
- 閉じたとき: フォーカスをトリガー要素に戻す

### Toast / Notification

| 種別 | 色 | 表示時間 |
|------|-----|---------|
| Success | Green | 3秒 |
| Warning | Yellow | 5秒 |
| Error | Red | 手動で閉じる |
| Info | Blue | 3〜5秒 |

---

## 6-4. Patterns（設計パターン）

| パターン | 構成要素 |
|---------|---------|
| 認証 | LoginForm / PasswordReset / 2FA / SocialLogin |
| 検索 | SearchInput / FilterPanel / ResultList / EmptyState |
| 承認 | ApprovalCard / ReviewForm / StatusBadge / AuditLog |
| 登録 | MultiStepForm / ProgressBar / Review / Confirmation |

---

## 6-5. Governance（ガバナンス）

### 命名規則

```
コンポーネント:  PascalCase（Button / InputField）
CSS変数:       --[category]-[name]-[variant]（--color-primary-600）
クラス名:       kebab-case（btn-primary / form-input）
```

### 変更管理プロセス

```
提案（Proposal）
    ↓
レビュー（Design Review + Dev Review）
    ↓
承認（Approval）
    ↓
実装・リリース（Implementation）
    ↓
ドキュメント更新（Documentation）
```

---

## 6-6. QA観点への接続

| デザインシステム要素 | QAチェック項目 |
|--------------------|--------------|
| カラートークン | 定義外の色コードが直書きされていないか |
| コンポーネント状態 | 全状態（Hover/Focus/Error/Disabled）が実装されているか |
| スペーシング | 4px グリッドからズレていないか |
| Modal | フォーカス管理・Escape キー・aria 属性が正しいか |
| Button | 1画面に Primary が複数ないか。icon-only に aria-label があるか |

---

## 参照ソース

- [Google Material Design 3](https://m3.material.io/)
- [Atlassian Design System](https://atlassian.design/)
- [Shopify Polaris](https://polaris.shopify.com/)
