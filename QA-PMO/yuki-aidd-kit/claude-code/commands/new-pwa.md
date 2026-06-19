---
description: 新規個人PWAの立ち上げ（personal-pwa + design-system + single-html-tool スキルを連動）
---

新規PWAプロジェクトを開始します。

1. single-html-toolスキルでまず単一HTMLのデモを作成
2. design-systemスキルのトークン（`#1976D2`系、Noto Sans JP）を適用
3. AIバックエンドはGemini無料枠のみ使用（personal-pwaスキルの呼び出し例参照）
4. localStorageでデータ永続化
5. デモ確認後、manifest.json + service worker追加でPWA化
6. `ma-garin`配下のリポジトリにpush、GitHub Pagesでデプロイ

ユーザーに以下を確認してから着手:
- プロジェクト名
- 主要機能（最小限のMVP範囲）
- 既存PWA（cashflow tracker等）との連携有無
