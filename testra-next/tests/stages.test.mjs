import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingest } from '../core/stages/ingest.js';
import { analyzeFeatures } from '../core/stages/feature-analysis.js';
import { analyzeModels } from '../core/stages/model-analysis.js';

test('ingest: 要件行を抽出し apk 権限を非機能要件化する', () => {
  const doc = ingest({
    title: 't',
    sources: [
      { name: 'spec', kind: 'spec', text: 'ユーザーはログインできる。\n\nパスワードは8文字以上とする。' },
      { name: 'app.apk', kind: 'apk', meta: { package: 'com.x', permissions: ['CAMERA'], activities: ['Main'] } },
    ],
  });
  assert.ok(doc.requirements.length >= 2);
  const nfr = doc.requirements.find((r) => r.kind === 'nfr');
  assert.ok(nfr, 'apk 権限が非機能要件になっていない');
});

test('feature-analysis: セキュリティ語を非機能フィーチャーに分類', () => {
  const doc = ingest({ sources: [{ name: 's', kind: 'spec', text: 'アカウントがロックされる。' }] });
  const fa = analyzeFeatures(doc);
  const nfr = fa.features.find((f) => f.type === 'nonfunctional');
  assert.ok(nfr, '非機能フィーチャーが無い');
  assert.equal(nfr.characteristic, 'security');
});

test('model-analysis: 技法未該当の機能には EP+ERR を最低保証', () => {
  const doc = ingest({ sources: [{ name: 's', kind: 'spec', text: '何かを保存する。' }] });
  const fa = analyzeFeatures(doc);
  const ma = analyzeModels(fa, doc);
  assert.ok(ma.models.every((m) => m.techniques.length >= 1));
});
