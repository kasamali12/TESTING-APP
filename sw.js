/* StudyDeck Pro service worker
 * Build id is stamped by the GitHub Pages workflow (see .github/workflows/pages.yml).
 * A new build id installs a new worker, which waits until the user taps "Update" in the app. */
const BUILD = '__BUILD__';
const CORE = 'sd-core-' + BUILD;
const RUNTIME = 'sd-runtime-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];
/* Third-party files the app loads (libraries, fonts). They are cached after the first online visit. */
const CDN_HOSTS = [
  'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'cdn.sheetjs.com',
  'fonts.googleapis.com', 'fonts.gstatic.com', 'code.jquery.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CORE).then(cache =>
      Promise.all(CORE_ASSETS.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
      ))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('sd-core-') && k !== CORE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', build: BUILD });
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

/* Page loads: try the network first so a new version shows up quickly, fall back to the saved copy offline. */
async function handleNavigation(request) {
  const cache = await caches.open(CORE);
  try {
    const fresh = await withTimeout(fetch(request), 4000);
    if (fresh && fresh.ok) cache.put('./index.html', fresh.clone());
    return fresh;
  } catch (err) {
    return (await cache.match('./index.html')) || (await cache.match(request)) || Response.error();
  }
}

/* Same-origin files and CDN files: show the saved copy at once and refresh it in the background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  if (cached && (cached.type !== 'opaque' || request.mode === 'no-cors')) return cached;
  return (await network) || cached || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') { event.respondWith(handleNavigation(request)); return; }
    event.respondWith(staleWhileRevalidate(request, CORE));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
  }
  /* Everything else (sign-in, AI providers, Firebase) goes straight to the network. */
});
