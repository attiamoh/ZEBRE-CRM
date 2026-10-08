// Service worker : l'application s'ouvre et fonctionne sans connexion.
// Les fichiers de l'application sont servis depuis le cache puis rafraîchis ; l'API n'est jamais mise en cache.
const CACHE = 'zebre-v1';
const SHELL = ['/', '/index.html', '/css/app.css', '/config.js', '/manifest.webmanifest', '/icon.svg',
  '/js/main.js', '/js/api.js', '/js/auth.js', '/js/store.js', '/js/session.js', '/js/crm.js', '/js/admin.js', '/js/demo.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;
  const key = req.mode === 'navigate' ? '/index.html' : req;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(key);
    const network = fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
