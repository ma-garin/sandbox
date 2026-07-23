// SCR-06 設定 + SCR-05 データ管理
import type { AppContext } from './context';
import type { Metric } from '../types';
import { METRIC_DEFS } from '../types';
import { buildImportPreview, draftsToImport, recordsToCsv, type ImportPreview } from '../lib/csv';
import { parseBackup, serializeBackup, BackupError } from '../lib/backup';
import { bulkImport, replaceAll, clearAll, allRecords } from '../lib/db';
import { hasPin, setPin, clearPin, isValidPinFormat } from '../lib/pin';
import { $, esc, toast, download, pickFile, todayStr } from './dom';

const APP_VERSION = '0.2.0';
let pendingPreview: ImportPreview | null = null;

export function renderSettings(ctx: AppContext, mount: HTMLElement): void {
  const s = ctx.settings;
  const themeBtn = (v: string, label: string) =>
    `<button data-theme-opt="${v}" aria-pressed="${s.theme === v}">${label}</button>`;
  const fieldToggle = (m: Metric, label: string) =>
    m === 'weightKg'
      ? ''
      : `<label class="stamp" style="cursor:pointer" aria-pressed="${s.enabledFields.includes(m)}">
           <input type="checkbox" data-field="${m}" ${s.enabledFields.includes(m) ? 'checked' : ''} style="width:auto">${label}</label>`;

  mount.innerHTML = `
    <h2 class="view-title">設定</h2>

    <div class="group-title">プロフィール・目標</div>
    <div class="card">
      <div class="field"><label class="l" for="s-height">身長 (cm)</label>
        <input type="number" id="s-height" inputmode="decimal" step="0.1" placeholder="170" value="${val(s.heightCm)}"></div>
      <div class="grid2">
        <div class="field"><label class="l" for="s-goal">目標体重 (kg)</label>
          <input type="number" id="s-goal" inputmode="decimal" step="0.1" placeholder="65" value="${val(s.targetWeightKg)}"></div>
        <div class="field"><label class="l" for="s-goal-fat">目標体脂肪率 (%)</label>
          <input type="number" id="s-goal-fat" inputmode="decimal" step="0.1" placeholder="17" value="${val(s.targetBodyFatPercent)}"></div>
      </div>
      <button class="btn btn-primary" id="s-save">プロフィールを保存</button>
    </div>

    <div class="group-title">表示・入力項目</div>
    <div class="card">
      <p class="hint" style="margin-top:0">記録・グラフで扱う項目（体重は常に有効）</p>
      <div class="stamps" style="margin-top:10px">
        ${METRIC_DEFS.map((m) => fieldToggle(m.key, m.label)).join('')}
      </div>
    </div>

    <div class="group-title">テーマ</div>
    <div class="card">
      <div class="seg" id="s-theme">
        ${themeBtn('light', 'ライト')}${themeBtn('dark', 'ダーク')}${themeBtn('system', '端末設定')}
      </div>
    </div>

    <div class="group-title">データ移行・バックアップ</div>
    <div class="card">
      <p class="card-title">RecStyle など CSV からの取込</p>
      <p class="hint" style="margin-top:0">RecStyle は「設定 → データのエクスポート」で <b>RecStyleData.csv</b> を出力できます（メール添付や共有で端末に保存）。そのファイルを選ぶと、日付・体重・体脂肪率・筋肉量・ウエスト・メモ列を自動判別し、取り込む前に内容をプレビューします。日付のみ（時刻なし）でも取り込めます。</p>
      <button class="btn btn-outline" id="s-csv-import" style="margin-top:10px">CSV を選択して取り込む</button>
      <div id="import-area"></div>

      <hr class="divider">
      <p class="card-title">エクスポート</p>
      <div class="btn-row">
        <button class="btn btn-ghost" id="s-json-export">JSON 出力</button>
        <button class="btn btn-ghost" id="s-csv-export">CSV 出力</button>
      </div>
      <hr class="divider">
      <p class="card-title">復元（JSON）</p>
      <button class="btn btn-ghost" id="s-json-import">JSON バックアップから復元</button>
      <p class="hint">機種変更・引き継ぎ用。復元は現在のデータを置き換えます。不正なファイルの場合、既存データは変更されません。</p>
    </div>

    <div class="group-title">PIN ロック</div>
    <div class="card">
      ${hasPin()
        ? `<p class="hint" style="margin-top:0">PIN は設定済みです。起動時に入力を求めます。</p>
           <button class="btn btn-danger" id="s-pin-clear" style="margin-top:8px">PIN を解除</button>`
        : `<p class="hint" style="margin-top:0">起動時に 4〜6 桁の PIN を要求します（この端末のみ・端末内に安全なハッシュで保存）。</p>
           <div class="grid2" style="margin-top:8px">
             <input type="password" id="s-pin1" inputmode="numeric" maxlength="6" placeholder="PIN（4〜6桁）">
             <input type="password" id="s-pin2" inputmode="numeric" maxlength="6" placeholder="確認のため再入力">
           </div>
           <button class="btn btn-primary" id="s-pin-set" style="margin-top:8px">PIN を設定</button>`}
    </div>

    <div class="group-title">その他</div>
    <div class="card">
      <button class="btn btn-danger" id="s-clear">すべてのデータを削除</button>
      <p class="hint">Body Record v${APP_VERSION} ／ 記録 ${ctx.records.length}件 ／ データは端末内にのみ保存され、外部送信しません。</p>
    </div>`;

  wire(ctx);
}

function wire(ctx: AppContext): void {
  $('#s-save')!.addEventListener('click', () => {
    ctx.updateSettings({
      heightCm: num('#s-height'),
      targetWeightKg: num('#s-goal'),
      targetBodyFatPercent: num('#s-goal-fat'),
    });
    toast('プロフィールを保存しました ✓');
    ctx.rerender();
  });

  $$field().forEach((cb) =>
    cb.addEventListener('change', () => {
      const key = cb.dataset.field as Metric;
      const set = new Set(ctx.settings.enabledFields);
      if (cb.checked) set.add(key);
      else set.delete(key);
      set.add('weightKg');
      ctx.updateSettings({ enabledFields: METRIC_DEFS.map((m) => m.key).filter((k) => set.has(k)) });
    }),
  );

  $('#s-theme')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-theme-opt]');
    if (!b) return;
    ctx.updateSettings({ theme: b.dataset.themeOpt as 'light' | 'dark' | 'system' });
    ctx.rerender();
  });

  $('#s-csv-import')!.addEventListener('click', () => importCsv(ctx));
  $('#s-json-export')!.addEventListener('click', () => exportJson(ctx));
  $('#s-csv-export')!.addEventListener('click', () => exportCsv(ctx));
  $('#s-json-import')!.addEventListener('click', () => importJson(ctx));
  $('#s-clear')!.addEventListener('click', () => clear(ctx));

  $('#s-pin-set')?.addEventListener('click', async () => {
    const p1 = $<HTMLInputElement>('#s-pin1')!.value;
    const p2 = $<HTMLInputElement>('#s-pin2')!.value;
    if (!isValidPinFormat(p1)) return toast('PIN は 4〜6 桁の数字で入力してください');
    if (p1 !== p2) return toast('PIN が一致しません');
    await setPin(p1);
    toast('PIN を設定しました ✓');
    ctx.rerender();
  });
  $('#s-pin-clear')?.addEventListener('click', () => {
    if (!confirm('PIN ロックを解除しますか？')) return;
    clearPin();
    toast('PIN を解除しました');
    ctx.rerender();
  });
}

/* ---------- CSV import with preview (AC-06) ---------- */
async function importCsv(ctx: AppContext): Promise<void> {
  const file = await pickFile('.csv,text/csv,text/plain');
  if (!file) return;
  const text = await file.text();
  const existing = new Set(ctx.records.map((r) => r.measuredAt));
  pendingPreview = buildImportPreview(text, existing);
  renderPreview(ctx);
}

function renderPreview(ctx: AppContext): void {
  const area = $('#import-area');
  if (!area || !pendingPreview) return;
  const p = pendingPreview;
  if (!p.validCount && !p.duplicateCount) {
    area.innerHTML = `<p class="hint" style="color:var(--danger)">取り込める行がありませんでした（不正 ${p.invalidCount} 件）。区切り文字・列名をご確認ください。</p>`;
    return;
  }
  const sample = p.rows.slice(0, 60);
  area.innerHTML = `
    <div class="preview-summary">
      <div class="pill ok"><span class="l">新規</span>${p.validCount}</div>
      <div class="pill dup"><span class="l">重複</span>${p.duplicateCount}</div>
      <div class="pill bad"><span class="l">不正</span>${p.invalidCount}</div>
    </div>
    <div class="preview-list">
      ${sample.map((r) => {
        const badge = r.status === 'valid' ? '<span class="badge b-ok">新規</span>' : r.status === 'duplicate' ? '<span class="badge b-dup">重複</span>' : '<span class="badge b-bad">不正</span>';
        const body = r.draft ? `${r.draft.measuredAt}　${r.draft.weightKg}kg${r.draft.bodyFatPercent != null ? ' / ' + r.draft.bodyFatPercent + '%' : ''}` : `${esc(r.rawDate ?? '')}　${esc(r.error ?? '')}`;
        return `<div class="prow ${r.status === 'invalid' ? 'invalid' : ''}">${badge}<span>${esc(body)}</span></div>`;
      }).join('')}
      ${p.rows.length > sample.length ? `<div class="prow"><span>…ほか ${p.rows.length - sample.length} 行</span></div>` : ''}
    </div>
    ${p.duplicateCount ? `<label class="hint" style="display:flex;gap:8px;align-items:center;margin-top:10px;cursor:pointer">
      <input type="checkbox" id="ovw" style="width:auto"> 同一日付の既存データを上書きする（既定: 上書きしない）</label>` : ''}
    <div class="btn-row" style="margin-top:12px">
      <button class="btn btn-ghost" id="imp-cancel">キャンセル</button>
      <button class="btn btn-primary" id="imp-run">取り込む</button>
    </div>`;

  $('#imp-cancel')!.addEventListener('click', () => {
    pendingPreview = null;
    area.innerHTML = '';
  });
  $('#imp-run')!.addEventListener('click', async () => {
    const overwrite = ($<HTMLInputElement>('#ovw')?.checked) ?? false;
    const drafts = draftsToImport(p, overwrite);
    if (!drafts.length) {
      toast('取り込む行がありません');
      return;
    }
    const n = await bulkImport(drafts, ctx.settings.heightCm);
    pendingPreview = null;
    toast(`${n} 件を取り込みました ✓`);
    await ctx.reload();
  });
}

function exportJson(ctx: AppContext): void {
  const json = serializeBackup(ctx.records, ctx.settings, new Date().toISOString());
  download(json, `body-record-backup-${todayStr()}.json`, 'application/json');
  toast('JSON を出力しました');
}

function exportCsv(ctx: AppContext): void {
  if (!ctx.records.length) return toast('記録がありません');
  download(recordsToCsv(ctx.records), `body-record-${todayStr()}.csv`, 'text/csv;charset=utf-8');
  toast('CSV を出力しました');
}

async function importJson(ctx: AppContext): Promise<void> {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  const text = await file.text();
  let parsed;
  try {
    parsed = parseBackup(text); // 失敗時は例外 → 既存データ不変（AC-05）
  } catch (e) {
    toast(e instanceof BackupError ? e.message : '復元に失敗しました');
    return;
  }
  if (!confirm(`現在のデータを、バックアップの ${parsed.records.length} 件で置き換えます。よろしいですか？`)) return;
  await replaceAll(parsed.records);
  if (parsed.settings) ctx.updateSettings(parsed.settings);
  // DB の記録数と件数整合のため再読込
  await ctx.reload();
  toast(`${(await allRecords()).length} 件を復元しました ✓`);
}

async function clear(ctx: AppContext): Promise<void> {
  if (!confirm('すべての記録を削除します。取り消せません。先に JSON 出力を推奨します。続けますか？')) return;
  await clearAll();
  await ctx.reload();
  toast('削除しました');
}

/* helpers */
const val = (n: number | null | undefined) => (n == null ? '' : String(n));
const num = (sel: string) => {
  const v = parseFloat($<HTMLInputElement>(sel)!.value);
  return Number.isFinite(v) ? v : null;
};
const $$field = () => Array.from(document.querySelectorAll<HTMLInputElement>('[data-field]'));
