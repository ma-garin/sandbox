/**
 * オフラインで読めるようにするための Service Worker。
 *
 * 扱うのは本文だけで全部あわせても 100KB 台なので、
 * 画面の骨格も記録も最初にまとめて取りに行き、以後は通信なしで読める。
 */

const VERSION = 'v9';
const SHELL = `omikuji-shell-${VERSION}`;

const SHELL_FILES = [
  './',
  'index.html',
  'styles.css',
  'js/app.js',
  'js/store.js',
  'js/view.js',
  'js/presets.js',
  'js/holidays.js',
  'js/koyomi.js',
  'js/koyomi-terms.js',
  'js/fortune.js',
  'js/install.js',
  'data/omikuji.json',
  'data/koi-drafts.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 新しい方を優先し、オフラインならキャッシュに落とす。
  //
  // ここで request をそのまま fetch すると、ブラウザの HTTP キャッシュが挟まって
  // 更新したはずのファイルが古いまま返ることがある（実際に起きた）。
  // 取りに行くときは必ずネットワークまで届かせる。
  const fresh = new Request(request.url, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: request.headers,
    mode: request.mode === 'navigate' ? 'same-origin' : request.mode,
    redirect: 'follow',
  });

  event.respondWith(
    fetch(fresh)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html')))
  );
});
