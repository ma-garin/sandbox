// ステージ3: テストモデル分析（model analysis）
// 各フィーチャーの要件パターンから、適用すべきテストモデル（設計技法）を選定する。
// ISO/IEC/IEEE 29119-4 の技法を、要件文のシグナルにマッピングする（ルールベース）。

import { TECHNIQUES } from '../model.js';
import { stableId } from '../util/id.js';
import { hasAny } from '../util/text.js';

// シグナル → 技法。順序は評価順（先に一致したものを優先採用しつつ複数付与）。
const SIGNAL_RULES = [
  { tech: 'STT', kw: ['状態', '遷移', 'ロック', 'ログイン後', '回連続', '回誤', 'セッション'], why: '状態やイベント駆動の振る舞いが記述されている' },
  { tech: 'DT', kw: ['場合', '条件', 'かつ', 'または', 'のとき', 'なら', '以外'], why: '複数条件の組合せで結果が変わる' },
  { tech: 'BVA', kw: ['以上', '以下', '未満', '超', '桁', '文字以内', '回まで', '秒以内', '最大', '最小', '範囲'], why: '境界を持つ数値/長さの制約がある' },
  { tech: 'EP', kw: ['入力', '値', 'メール', 'パスワード', '形式', '種別'], why: '入力値のクラス分割が有効' },
  { tech: 'PW', kw: ['ブラウザ', 'os', '端末', 'バージョン', '組合せ', 'プラン'], why: '多因子の組合せ空間が大きい' },
  { tech: 'UC', kw: ['フロー', 'ユーザーは', '一連', '手順', 'シナリオ'], why: '利用シナリオ単位の妥当性確認が必要' },
  { tech: 'ERR', kw: ['エラー', '異常', '失敗', '不正', 'タイムアウト', '例外'], why: '異常系・エラー処理の記述がある' },
];

/**
 * @param {object} featureArtifact feature-analysis の出力
 * @param {object} doc ingest の出力（要件テキスト参照用）
 */
export function analyzeModels(featureArtifact, doc) {
  const reqById = new Map((doc.requirements || []).map((r) => [r.id, r]));

  const models = (featureArtifact.features || []).map((feature) => {
    const texts = feature.requirements.map((id) => reqById.get(id)?.text || '').join('\n');
    const chosen = [];
    for (const rule of SIGNAL_RULES) {
      if (hasAny(texts, rule.kw)) {
        chosen.push({ technique: rule.tech, name: TECHNIQUES[rule.tech], rationale: rule.why });
      }
    }
    // 何も当たらない機能フィーチャーには最低限 EP+ERR を割り当てる（網羅の底上げ）
    if (chosen.length === 0) {
      chosen.push(
        { technique: 'EP', name: TECHNIQUES.EP, rationale: '既定の入力クラス分割' },
        { technique: 'ERR', name: TECHNIQUES.ERR, rationale: '既定のエラー推測' },
      );
    }
    return {
      id: stableId('TM', feature.id),
      featureId: feature.id,
      featureName: feature.name,
      type: feature.type,
      techniques: chosen,
      // カバレッジモデル: 選定技法数に応じた想定カバレッジ目標
      coverageTarget: feature.type === 'nonfunctional' ? '観点網羅' : 'C1相当',
    };
  });

  return {
    models,
    stats: {
      total: models.length,
      techniqueUsage: countTechniques(models),
    },
  };
}

function countTechniques(models) {
  const counts = {};
  for (const m of models) {
    for (const t of m.techniques) counts[t.technique] = (counts[t.technique] || 0) + 1;
  }
  return counts;
}
