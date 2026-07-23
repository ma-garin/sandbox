import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import type { AppContext, Tab } from './ui/context';
import type { UserSettings } from './types';
import { allRecords } from './lib/db';
import { loadSettings, saveSettings, applyTheme } from './lib/settings';
import { renderRecord } from './ui/record';
import { renderGraph } from './ui/graph';
import { renderHistory } from './ui/history';
import { renderSettings } from './ui/settings';
import { showLockScreen } from './ui/lock';
import { hasPin } from './lib/pin';
import { $, todayStr } from './ui/dom';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'record', label: '記録', icon: '✏️' },
  { id: 'graph', label: 'グラフ', icon: '📈' },
  { id: 'history', label: '履歴', icon: '📋' },
  { id: 'settings', label: '設定', icon: '⚙️' },
];

const state = {
  tab: 'record' as Tab,
  records: [] as Awaited<ReturnType<typeof allRecords>>,
  settings: loadSettings() as UserSettings,
  editDate: todayStr(),
};

const ctx: AppContext = {
  get records() {
    return state.records;
  },
  get settings() {
    return state.settings;
  },
  get editDate() {
    return state.editDate;
  },
  set editDate(v: string) {
    state.editDate = v;
  },
  reload: async () => {
    state.records = await allRecords();
    renderActive();
  },
  rerender: () => renderActive(),
  go: (tab: Tab, editDate?: string) => {
    state.tab = tab;
    if (editDate !== undefined) state.editDate = editDate;
    location.hash = tab;
    syncNav();
    renderActive();
  },
  updateSettings: (patch: Partial<UserSettings>) => {
    state.settings = { ...state.settings, ...patch };
    saveSettings(state.settings);
    applyTheme(state.settings.theme);
  },
};

function shell(): void {
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<header class="appbar"><span class="ico">🥗</span><h1>Body Record</h1><span class="day" id="appbar-day"></span></header>
     <main id="app-main"></main>
     <nav class="bottom" role="tablist">
       ${TABS.map((t) => `<button data-tab="${t.id}" role="tab"><span class="ico">${t.icon}</span>${t.label}</button>`).join('')}
     </nav>`,
  );
  const day = $('#appbar-day');
  if (day) {
    const d = new Date();
    day.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
  }
  document.querySelectorAll<HTMLButtonElement>('nav.bottom [data-tab]').forEach((b) =>
    b.addEventListener('click', () => ctx.go(b.dataset.tab as Tab)),
  );
  window.addEventListener('hashchange', () => {
    const t = (location.hash.slice(1) || 'record') as Tab;
    if (TABS.some((x) => x.id === t) && t !== state.tab) {
      state.tab = t;
      syncNav();
      renderActive();
    }
  });
}

function syncNav(): void {
  document.querySelectorAll<HTMLButtonElement>('nav.bottom [data-tab]').forEach((b) =>
    b.setAttribute('aria-current', b.dataset.tab === state.tab ? 'page' : 'false'),
  );
}

function renderActive(): void {
  const mount = $('#app-main');
  if (!mount) return;
  mount.scrollTop = 0;
  window.scrollTo(0, 0);
  switch (state.tab) {
    case 'record':
      return renderRecord(ctx, mount);
    case 'graph':
      return renderGraph(ctx, mount);
    case 'history':
      return renderHistory(ctx, mount);
    case 'settings':
      return renderSettings(ctx, mount);
  }
}

/* PWA 更新通知（NFR-010） */
function setupUpdatePrompt(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      const bar = document.createElement('div');
      bar.className = 'update-bar';
      bar.innerHTML = `<span>新しいバージョンがあります</span><button class="apply">更新</button><button class="later">後で</button>`;
      document.body.appendChild(bar);
      bar.querySelector('.apply')!.addEventListener('click', () => updateSW(true));
      bar.querySelector('.later')!.addEventListener('click', () => bar.remove());
    },
  });
}

async function startApp(): Promise<void> {
  shell();
  const startTab = (location.hash.slice(1) || 'record') as Tab;
  state.tab = TABS.some((x) => x.id === startTab) ? startTab : 'record';
  state.records = await allRecords();
  syncNav();
  renderActive();
  setupUpdatePrompt();
}

async function init(): Promise<void> {
  applyTheme(state.settings.theme);
  // system テーマ追従
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.settings.theme === 'system') applyTheme('system');
    });
  }
  // PIN ロック（設定時のみ）。解錠後にアプリ本体を起動（FR-105）
  if (hasPin()) {
    showLockScreen(() => {
      void startApp();
    });
  } else {
    await startApp();
  }
}

init();
