/* ORG Sales Dashboard — offline service worker.
   Caches the dashboard + SheetJS on first online load so it works with no internet
   (open the site once online, then Add to Home Screen on the iPad). */
const CACHE = 'salesdash-offline-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))   // don't fail install if one asset is unreachable
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_e) { return; }

  // The dashboard page itself: network-first (so a freshly deployed build shows when online),
  // falling back to the cached copy when offline.
  const isPage = req.mode === 'navigate'
    || url.pathname === '/' || url.pathname.endsWith('/')
    || url.pathname.endsWith('/index.html') || url.pathname.endsWith('index.html');

  if (isPage) {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => { c.put(req, copy); }); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (SheetJS, manifest): cache-first, then network (and cache the result).
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => hit)
    )
  );
});
