// ステージ4/5: テスト設計（基本設計 designBasic / 詳細設計 designDetail）
//
// 基本設計: テストモデル×要件から「テスト条件（カバレッジアイテムの親）」を導出する。
// 詳細設計: 各テスト条件を技法ごとに具体的なカバレッジアイテムへ展開する。

import { stableId } from '../util/id.js';
import { keyPhrases } from '../util/text.js';

/* ---------------- 基本設計 ---------------- */

/**
 * @param {object} modelArtifact model-analysis 出力
 * @param {object} featureArtifact feature-analysis 出力
 * @param {object} doc ingest 出力
 */
export function designBasic(modelArtifact, featureArtifact, doc) {
  const reqById = new Map((doc.requirements || []).map((r) => [r.id, r]));
  const featureById = new Map((featureArtifact.features || []).map((f) => [f.id, f]));

  const conditions = [];
  for (const model of modelArtifact.models || []) {
    const feature = featureById.get(model.featureId);
    const reqTexts = (feature?.requirements || []).map((id) => reqById.get(id)).filter(Boolean);

    for (const tech of model.techniques) {
      // 技法ごとに、対象要件を根拠にテスト条件を1つ作る
      const reqRefs = reqTexts.map((r) => r.id);
      const focus = reqTexts[0]?.text || feature?.name || model.featureName;
      conditions.push({
        id: stableId('TCOND', model.id, tech.technique),
        featureId: model.featureId,
        featureName: model.featureName,
        technique: tech.technique,
        techniqueName: tech.name,
        priority: prioritize(feature, tech.technique),
        condition: `【${tech.name}】${model.featureName}: ${summarize(focus)}`,
        requirementRefs: reqRefs,
      });
    }
  }
  return { conditions, stats: { total: conditions.length } };
}

function summarize(text) {
  const phrases = keyPhrases(text).slice(0, 4).join('・');
  return phrases || text.slice(0, 24);
}

function prioritize(feature, tech) {
  const risk = feature?.risk || 1;
  const weight = tech === 'STT' || tech === 'ERR' ? 2 : 1;
  const score = risk * weight;
  if (score >= 6) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}

/* ---------------- 詳細設計 ---------------- */

/**
 * 各テスト条件を技法別のカバレッジアイテムへ展開する。
 * @param {object} basicArtifact designBasic 出力
 */
export function designDetail(basicArtifact) {
  const items = (basicArtifact.conditions || []).map((cond) => ({
    conditionId: cond.id,
    featureId: cond.featureId,
    technique: cond.technique,
    priority: cond.priority,
    coverageItems: expand(cond),
  }));
  const total = items.reduce((n, it) => n + it.coverageItems.length, 0);
  return { items, stats: { conditions: items.length, coverageItems: total } };
}

// 技法別にカバレッジアイテム（後で1テストケースになる粒度）を生成する
function expand(cond) {
  const mk = (label, expect) => ({
    id: stableId('COV', cond.id, label),
    label,
    expected: expect,
  });
  switch (cond.technique) {
    case 'BVA':
      return [
        mk('境界-下限直下(invalid)', '境界外として拒否/エラー'),
        mk('境界-下限(valid)', '受理される'),
        mk('境界-上限(valid)', '受理される'),
        mk('境界-上限直上(invalid)', '境界外として拒否/エラー'),
      ];
    case 'EP':
      return [mk('有効同値クラス', '正常処理'), mk('無効同値クラス', 'エラー処理')];
    case 'DT':
      return [
        mk('全条件成立(規則1)', '主アクション実行'),
        mk('一部条件不成立(規則2)', '代替/エラー'),
        mk('全条件不成立(規則3)', '実行されない'),
      ];
    case 'STT':
      return [
        mk('初期状態→正常遷移', '目的状態へ遷移'),
        mk('繰り返しで境界イベント発火', '状態変化(例: ロック)'),
        mk('禁止遷移の試行', '遷移せず/拒否'),
      ];
    case 'PW':
      return [mk('主要因子2-wise組合せ#1', '整合動作'), mk('主要因子2-wise組合せ#2', '整合動作')];
    case 'UC':
      return [mk('基本フロー', '完走・目的達成'), mk('代替フロー', '適切に分岐')];
    case 'ERR':
      return [mk('想定エラー入力', 'メッセージ表示・回復可能'), mk('タイムアウト/中断', '安全側に倒す')];
    default:
      return [mk('既定カバレッジ', '期待どおり動作')];
  }
}
