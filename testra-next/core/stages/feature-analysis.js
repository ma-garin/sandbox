// ステージ2: テストフィーチャー分析（feature analysis）
// 文書モデルから「テスト対象フィーチャー」を抽出・分類する。
//  - 機能フィーチャー: 要件を機能単位にクラスタリング
//  - 非機能フィーチャー: ISO/IEC 25010 品質特性キーワードで検出
//
// 出力は後続の「テストモデル分析」の入力になる。

import { stableId } from '../util/id.js';
import { keyPhrases, hasAny } from '../util/text.js';

// ISO/IEC 25010 品質特性 → 検出キーワード
const NFR_CHARACTERISTICS = [
  { key: 'security', label: 'セキュリティ', kw: ['ロック', '認証', 'パスワード', '権限', '暗号', 'セッション', 'csrf', '不正'] },
  { key: 'performance', label: '性能効率性', kw: ['秒以内', 'レスポンス', 'スループット', '同時', '負荷', '応答時間'] },
  { key: 'usability', label: '使用性', kw: ['入力補助', 'エラーメッセージ', 'ガイド', '操作', '表示'] },
  { key: 'reliability', label: '信頼性', kw: ['リトライ', '再送', '復旧', '冪等', 'タイムアウト', '障害'] },
  { key: 'compatibility', label: '互換性', kw: ['ブラウザ', 'os', '端末', 'バージョン', '解像度'] },
  { key: 'maintainability', label: '保守性', kw: ['ログ', '監査', 'トレース'] },
];

// 機能クラスタリングのための代表動詞（機能名の核）
const FEATURE_VERBS = ['ログイン', '登録', '検索', '購入', '決済', '送信', '削除', '編集', '更新', '表示', '遷移', 'ログアウト', 'アップロード', 'ダウンロード'];

/** 要件テキストから機能フィーチャー名の候補を決める */
function featureNameOf(reqText) {
  const hit = FEATURE_VERBS.find((v) => reqText.includes(v));
  if (hit) return `${hit}機能`;
  const phrase = keyPhrases(reqText)[0];
  return phrase ? `${phrase}機能` : '一般機能';
}

/**
 * @param {object} doc ingest の出力
 * @returns {{features: Array}}
 */
export function analyzeFeatures(doc) {
  const functional = new Map(); // name -> feature
  const nonfunctional = new Map(); // key -> feature

  for (const req of doc.requirements || []) {
    // 非機能判定（優先）
    const nfrHit = NFR_CHARACTERISTICS.find((c) => hasAny(req.text, c.kw));
    if (req.kind === 'nfr' || nfrHit) {
      const c = nfrHit || NFR_CHARACTERISTICS[0];
      if (!nonfunctional.has(c.key)) {
        nonfunctional.set(c.key, {
          id: stableId('FT', 'nfr', c.key),
          type: 'nonfunctional',
          characteristic: c.key,
          name: `${c.label}`,
          requirements: [],
        });
      }
      nonfunctional.get(c.key).requirements.push(req.id);
    }

    // 機能フィーチャーへも所属させる（NFRは機能に紐づくことが多い）
    const name = featureNameOf(req.text);
    if (!functional.has(name)) {
      functional.set(name, {
        id: stableId('FT', 'func', name),
        type: 'functional',
        name,
        requirements: [],
      });
    }
    functional.get(name).requirements.push(req.id);
  }

  const features = [...functional.values(), ...nonfunctional.values()].map((f) => ({
    ...f,
    // 各フィーチャーの初期リスク（要件数×種別重み）— 後段の優先度付けに使う
    risk: f.requirements.length * (f.type === 'nonfunctional' ? 2 : 1),
  }));

  return {
    features,
    stats: {
      functional: functional.size,
      nonfunctional: nonfunctional.size,
      total: features.length,
    },
  };
}
