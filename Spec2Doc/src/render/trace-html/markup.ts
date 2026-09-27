// traceability.html の骨格（左の絞り込み・保存したビュー・書き出し、上部の操作、5 つのタブ）。kit の部品クラスだけを使う。
import { kitIcon } from '../html.ts';

const KIND_OPTIONS: [string, string, string][] = [
  ['folder', 'フォルダ', '角丸四角'], ['file', 'ファイル', '四角'], ['code', 'コード要素', '円'], ['doc', '文書', 'ひし形'], ['section', '節', '小さい円'],
];

function select(id: string, label: string): string {
  return `<div class="field"><label for="${id}">${label}</label><select class="select" id="${id}"><option value="">すべて</option></select></div>`;
}

export function sidebar(): string {
  const kinds = KIND_OPTIONS.map(
    ([k, label, shape]) => `<tr><td><label class="kind-opt"><input type="checkbox" data-kind="${k}" checked><span class="swatch-box" aria-hidden="true"><span class="swatch swatch--${k}"></span></span><span>${label}<span class="shape">${shape}</span></span></label></td><td class="num count"></td></tr>`,
  ).join('');
  return `<div class="side-backdrop" id="side-backdrop" aria-hidden="true"></div><aside class="sidenav" id="trace-side" aria-label="絞り込み">
<div class="card side-card">
<div class="side-head"><h2>絞り込み</h2><button class="btn btn--ghost side-close" id="side-close" type="button" aria-label="絞り込みを閉じる">${kitIcon('close')}</button></div>
<section class="side-sec" data-for="graph">
<div class="field"><label for="g-search" class="field-icon">${kitIcon('manage-search', 16)}<span>点を探す</span></label><input class="input" id="g-search" type="search" placeholder="名前・パス" autocomplete="off"></div>
<p class="muted side-note" id="g-search-count" role="status"></p>
<label class="kind-opt"><input type="checkbox" id="g-detail-mode">詳細を表示（コード要素・節）</label>
<div id="g-fold"><label class="kind-opt"><input type="checkbox" id="g-expand">コード要素を展開</label><p class="muted side-note" id="g-fold-note"></p></div>
<p class="side-sub" id="legend-title">表示する種類（凡例）</p>
<table class="legend-table" aria-labelledby="legend-title"><thead><tr><th scope="col">種類と形</th><th scope="col" class="num">点の数</th></tr></thead><tbody>${kinds}</tbody></table>
<p class="muted side-note">名前が重なる点は名前を省いています。点に重ねると出ます。線のラベルはリンクの種類です</p>
</section>
<section class="side-sec" data-for="matrix">
<label class="kind-opt"><input type="checkbox" id="mx-uncovered">対応の無い節・ファイルだけを表示</label>
<p class="muted side-note">セルを押すと、その節とファイルの対応を管理タブで開きます</p>
</section>
<section class="side-sec" data-for="manage">
${select('f-doc', '文書')}
${select('f-status', '状態')}
${select('f-suspect', '要確認')}
${select('f-kind', 'リンクの種類')}
${select('f-evidence', '根拠')}
<div class="field"><label for="f-text">語</label><input class="input" id="f-text" type="search" placeholder="節・要約・ソース位置・メモ" autocomplete="off"></div>
</section>
<section class="side-sec" data-for="gaps"><p class="muted side-note">抜けの表は絞り込みの対象外です。名前を押すと関係図で位置が出ます</p></section>
<section class="side-sec" data-for="compare"><p class="muted side-note">比べる実行はタブの上段で選びます。監査の記録は下段にあります</p></section>
<section class="side-sec side-views" aria-labelledby="v-title">
<p class="side-sub" id="v-title">保存したビュー</p>
<div class="field"><label for="v-name">今のタブと絞り込みに名前を付ける</label><div class="view-save"><input class="input" id="v-name" type="text" maxlength="40" placeholder="例: 要確認だけ" autocomplete="off"><button class="btn" id="v-save" type="button">ビューを保存</button></div></div>
<ul class="view-list" id="v-list"></ul>
</section>
</div>
<section class="side-io" aria-label="書き出しと控え">
<p>書き出し（CSV は画面の上部）</p>
<button class="btn btn--ghost" id="io-xlsx" type="button">${kitIcon('download')}<span>Excel（マトリクス）</span></button>
<button class="btn btn--ghost" id="io-reqif" type="button">${kitIcon('download')}<span>ReqIF</span></button>
<button class="btn btn--ghost" id="io-json" type="button">${kitIcon('download')}<span>JSON（確認状態の控え）</span></button>
<button class="btn btn--ghost" id="io-import" type="button">${kitIcon('data-object')}<span>JSON を読み込む</span></button>
<input type="file" id="io-file" accept="application/json,.json" aria-label="読み込む確認状態の JSON ファイル" hidden>
</section>
</aside>`;
}

function tab(id: string, label: string, active: boolean): string {
  const sel = active ? 'class="active" aria-selected="true"' : 'aria-selected="false" tabindex="-1"';
  return `<button type="button" role="tab" id="tab-btn-${id}" data-tab="${id}" aria-controls="tab-${id}" ${sel}>${label}<span class="badge tab-count" id="tab-${id}-count">0</span></button>`;
}

const th = (cols: string[]) => `<thead><tr>${cols.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>`;

function tableCard(title: string, cols: string[], key: string): string {
  return `<div class="card table-card"><h2>${title}</h2><div class="table-wrap"><table class="table trace-table">${th(cols)}<tbody id="gap-${key}-body"></tbody></table></div><div class="pagebar" id="gap-${key}-pagebar"></div></div>`;
}

function matrixPanel(): string {
  return `<section id="tab-matrix" role="tabpanel" aria-labelledby="tab-btn-matrix" class="trace-main" hidden>
<div class="card table-card"><h2>トレーサビリティマトリクス</h2><p class="muted mx-summary" id="mx-summary" role="status"></p>
<div class="mx-legend"><span><span class="mx-key mx-l1" aria-hidden="true"></span>対応が少ない</span><span><span class="mx-key mx-l2" aria-hidden="true"></span><span class="mx-key mx-l3" aria-hidden="true"></span><span class="mx-key mx-l4" aria-hidden="true"></span>多い</span><span>セル下のバー: 判定済みの割合</span><span><span class="mx-key mx-sus-key" aria-hidden="true"><span class="mx-sus"></span></span>要確認を含む</span><span class="badge badge-high">対応なし</span><span>の見出し: どことも対応の無い節・ファイル</span></div>
<div class="table-wrap mx-wrap" id="mx-host"></div></div>
</section>`;
}

function comparePanel(): string {
  return `<section id="tab-compare" role="tabpanel" aria-labelledby="tab-btn-compare" class="trace-main" hidden>
<div class="card side-card compare-head">
<div class="compare-bar"><div class="field"><label for="c-base">比べる実行（同じ入力元の過去の実行）</label><select class="select" id="c-base"><option value="">選んでください</option></select></div>
<button class="btn" id="c-set-baseline" type="button">この実行をベースラインにする</button></div>
<p class="muted side-note" id="c-note" role="status"></p>
</div>
<div class="kpi-row" id="c-kpi" aria-label="ベースラインからの変化" hidden></div>
<div class="card table-card"><h2>ベースラインからの変化</h2><div class="table-wrap"><table class="table trace-table">${th(['区分', '文書', '節', '要約', '状態'])}<tbody id="c-body"></tbody></table></div></div>
<div class="card table-card" id="audit"><h2>監査の記録（すべての変更。新しい順）</h2><div class="table-wrap"><table class="table trace-table">${th(['日時', '確認者', '対応', '項目', '変更'])}<tbody id="audit-body"></tbody></table></div></div>
</section>`;
}

export function mainCol(): string {
  return `<div class="maincol">
<header class="app-topbar">
<div class="topbar-titles"><nav class="breadcrumb" aria-label="パンくず"><a href="/#result">結果</a><span aria-hidden="true">/</span><span aria-current="page">トレーサビリティ</span></nav><h1>トレーサビリティ</h1></div>
<span class="spacer"></span><span class="save-status" id="t-save" role="status"></span>
<button class="btn btn--ghost" id="t-audit" type="button">監査の記録</button>
<button class="btn btn--primary" id="io-csv" type="button">${kitIcon('download')}<span>CSV で書き出す</span></button>
</header>
<main class="app-content trace-main">
<p class="muted trace-meta" id="t-meta"></p>
<div class="embed-actions" id="embed-actions"></div>
<div class="trace-summary"><div class="kpi-row" id="m-kpi" aria-label="確認の進み具合"></div></div>
<div class="trace-toolbar">
<button class="btn side-open" id="side-open" type="button" aria-controls="trace-side">${kitIcon('checklist')}<span>絞り込み</span></button>
<div class="seg trace-tabs" role="tablist" aria-label="表示">${tab('graph', '関係図', true)}${tab('matrix', 'マトリクス', false)}${tab('manage', '管理', false)}${tab('gaps', '抜け', false)}${tab('compare', '比較', false)}</div>
</div>
<section id="tab-graph" role="tabpanel" aria-labelledby="tab-btn-graph" class="graph-wrap">
<div class="card graph-stage"><canvas id="g-canvas" role="img" aria-label="関係図。点を選ぶと右に詳細が出ます"></canvas>
<div class="graph-tools"><span class="muted" id="g-count"></span><button class="btn" id="g-fit" type="button">全体を表示</button></div></div>
<aside class="card graph-detail" id="g-detail" aria-live="polite"></aside>
</section>
${matrixPanel()}
<section id="tab-manage" role="tabpanel" aria-labelledby="tab-btn-manage" class="trace-main" hidden>
<div class="filter-row" id="m-chips"></div>
<div class="manage-wrap">
<div class="card table-card"><div class="bulk-bar" id="m-bulk"></div><div class="table-wrap"><table class="table trace-table compact" id="m-table"><colgroup><col class="c-check"><col><col class="c-kind"><col class="c-ev"><col class="c-src"><col class="c-sus"><col class="c-st"></colgroup>${th(['<span class="visually-hidden">選択</span>', '要約', '種類', '根拠', 'ソース位置', '要確認', '状態'])}<tbody id="m-body"></tbody></table></div><div class="pagebar" id="m-pagebar"></div></div>
<aside class="card graph-detail" id="m-detail" aria-live="polite"></aside>
</div>
</section>
<section id="tab-gaps" role="tabpanel" aria-labelledby="tab-btn-gaps" class="gaps" hidden>
${tableCard('トレース先の候補（解析からの推定。確定ではありません）', ['文書', '節', '要約', '状態', '候補と根拠'], 'c')}
${tableCard('未記述（どの節からも参照されないファイル・コード要素）', ['種類', '名前', '位置', '要素の種類・解析', '候補と根拠'], 'u')}
${tableCard('根拠なし（ソース位置の無い行）', ['文書', '節', '要約', '根拠', '状態'], 's')}
</section>
${comparePanel()}
</main>
</div>`;
}
