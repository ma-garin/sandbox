/* app.js — ルーター・ナビ生成・検索・問い合わせ */

/* ── サイドナビをNAV_TREEから再帰生成 ── */
function buildNav() {
  const nav = document.getElementById('sidenav');
  nav.innerHTML = `<button class="nav-home active" id="nav-home" onclick="showHome()">🏠 すべてのサービス</button>`;
  NAV_TREE.forEach(section => {
    const sec = document.createElement('div');
    sec.className = 'nav-section open';
    sec.innerHTML = `
      <button class="nav-sec-head" aria-expanded="true">
        <span class="sec-ico" style="background:${section.iconBg}">${section.icon}</span>
        <span class="sec-label">${section.label}</span>
        <span class="chev">▶</span>
      </button>
      <div class="nav-sec-body"></div>`;
    sec.querySelector('.nav-sec-head').onclick = () => {
      sec.classList.toggle('open');
    };
    const body = sec.querySelector('.nav-sec-body');
    section.children.forEach(ch => body.appendChild(buildNode(ch, 1)));
    nav.appendChild(sec);
  });
}

function buildNode(node, depth) {
  // リーフ（サービス）
  if (node.id) {
    const s = SERVICES[node.id];
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.id = node.id;
    btn.style.paddingLeft = (16 + depth * 16) + 'px';
    const badge = s.kind === 'tool' ? '<span class="tool-tag">実機能</span>' : '';
    btn.innerHTML = `<span class="dot"></span><span class="nm">${s.title}</span>${badge}`;
    btn.onclick = () => route(node.id);
    return btn;
  }
  // サブセクション（折りたたみ）
  const wrap = document.createElement('div');
  wrap.className = 'nav-sub open';
  const head = document.createElement('button');
  head.className = 'nav-sub-head';
  head.style.paddingLeft = (16 + depth * 16) + 'px';
  head.innerHTML = `<span class="nm">${node.label}</span><span class="chev sm">▶</span>`;
  head.onclick = () => wrap.classList.toggle('open');
  wrap.appendChild(head);
  const body = document.createElement('div');
  body.className = 'nav-sub-body';
  node.children.forEach(ch => body.appendChild(buildNode(ch, depth + 1)));
  wrap.appendChild(body);
  return wrap;
}

/* ── ルーティング ── */
function setActive(id) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-home').classList.remove('active');
  if (id) {
    const el = document.querySelector(`.nav-item[data-id="${id}"]`);
    if (el) el.classList.add('active');
  }
}

function route(id) {
  const s = SERVICES[id];
  if (!s) return;
  setActive(id);
  hideAllViews();
  const main = document.getElementById('view-detail');
  main.style.display = 'block';

  const bc = s.breadcrumb.map((b, i) =>
    i === s.breadcrumb.length - 1
      ? `<span class="bc cur">${b}</span>`
      : `<span class="bc">${b}</span><span class="bc-sep">›</span>`).join('');

  let body;
  if (s.kind === 'tool') {
    body = `<div class="tool-host" id="tool-host"></div>`;
  } else {
    body = renderCatalog(s);
  }

  main.innerHTML = `
    <nav class="breadcrumb">${bc}</nav>
    <div class="detail-head">
      <div class="d-icon" style="background:${s.iconBg}">${s.icon}</div>
      <div>
        <h1>${s.title} ${s.kind === 'tool' ? '<span class="tool-tag lg">実機能 MVP</span>' : ''}</h1>
        <span class="cat-badge">${s.category}</span>
      </div>
    </div>
    <p class="lead">${s.desc}</p>
    ${body}`;

  if (s.kind === 'tool') {
    Tools[s.tool].render(document.getElementById('tool-host'));
  }
  document.getElementById('main').scrollTop = 0;
}

function renderCatalog(s) {
  const features = (s.features || []).map(f => `
    <div class="f-card"><div class="f-ico">${f.icon}</div><div class="f-t">${f.title}</div><div class="f-d">${f.desc}</div></div>`).join('');
  const steps = (s.steps || []).map((st, i) => `<div class="step"><div class="step-n">${i + 1}</div><div>${st}</div></div>`).join('');
  const tags = (s.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
  return `
    <div class="f-grid">${features}</div>
    ${steps ? `<div class="panel"><h3>⚡ 支援フロー</h3><div class="steps">${steps}</div></div>` : ''}
    <div class="tags">${tags}</div>
    <div class="cta">
      <div><h4>まずはお気軽にご相談ください</h4><p>内容・費用・スケジュールをご説明します</p></div>
      <button class="btn-primary" onclick="openModal('${s.title}')">${s.cta || '相談する'}</button>
    </div>`;
}

/* ── ホーム（全サービスカード） ── */
function showHome() {
  setActive(null);
  document.getElementById('nav-home').classList.add('active');
  hideAllViews();
  document.getElementById('view-home').style.display = 'block';
}

function renderHome() {
  const q = document.getElementById('home-q'), a = document.getElementById('home-a');
  Object.entries(SERVICES).forEach(([id, s]) => {
    const card = document.createElement('button');
    card.className = 'h-card';
    const badge = s.kind === 'tool' ? '<span class="tool-tag">実機能</span>' : '';
    card.innerHTML = `<div class="h-ico">${s.icon}</div><div class="h-t">${s.title} ${badge}</div><div class="h-c">${s.category}</div>`;
    card.onclick = () => route(id);
    (s.group === 'quality' ? q : a).appendChild(card);
  });
}

/* ── 検索 ── */
function onSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) { showHome(); return; }
  hideAllViews();
  document.getElementById('view-search').style.display = 'block';
  const results = Object.entries(SERVICES).filter(([, s]) =>
    s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) ||
    (s.tags || []).some(t => t.toLowerCase().includes(q)));
  document.getElementById('search-label').innerHTML = `「<strong>${e.target.value}</strong>」の検索結果：${results.length}件`;
  const box = document.getElementById('search-cards');
  box.innerHTML = '';
  results.forEach(([id, s]) => {
    const card = document.createElement('button');
    card.className = 'h-card';
    const badge = s.kind === 'tool' ? '<span class="tool-tag">実機能</span>' : '';
    card.innerHTML = `<div class="h-ico">${s.icon}</div><div class="h-t">${s.title} ${badge}</div><div class="h-c">${s.category}</div>`;
    card.onclick = () => route(id);
    box.appendChild(card);
  });
}

/* ── ビュー切替 ── */
function hideAllViews() {
  ['view-home', 'view-search', 'view-detail'].forEach(v => document.getElementById(v).style.display = 'none');
}

/* ── 問い合わせモーダル ── */
function openModal(service) {
  document.getElementById('m-service').value = service || '';
  ['m-company', 'm-name', 'm-email', 'm-body'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('modal').classList.add('open');
  document.getElementById('m-company').focus();
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }
function submitModal() {
  const v = id => document.getElementById(id).value.trim();
  if (!v('m-company') || !v('m-name') || !v('m-email')) { alert('会社名・お名前・メールは必須です。'); return; }
  closeModal();
  alert(`${v('m-name')} 様\n\nお問い合わせを受け付けました。担当者よりご連絡します。`);
}

/* ── 初期化 ── */
function initApp() {
  buildNav();
  renderHome();
  showHome();
  document.getElementById('search').addEventListener('input', onSearch);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}
window.addEventListener('DOMContentLoaded', initApp);
