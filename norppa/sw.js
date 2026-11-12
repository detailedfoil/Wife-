/* Pikku Norppa: lets the game open with no signal.
   Online, the newest files are always fetched; the copy kept here is only the fallback. */
const CACHE = 'pikku-norppa-v27';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'vendor/three.min.js',
  'js/data.js', 'js/lang.js', 'js/sim.js', 'js/astro.js', 'js/audio.js', 'js/props.js', 'js/seal.js', 'js/fx.js', 'js/world.js', 'js/ui.js', 'js/games.js', 'js/arcade.js', 'js/main.js',
  'fonts/dynapuff-600.woff2', 'fonts/nunito-600.woff2', 'fonts/nunito-800.woff2',
  'icons/favicon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.origin + url.pathname;            // ignore ?query so one copy serves all
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    const fresh = fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    });
    if (!cached) return fresh;
    // give the network a moment; if it is slow or gone, use the kept copy
    const patience = new Promise((resolve) => setTimeout(() => resolve(cached), 2500));
    return Promise.race([fresh.catch(() => cached), patience]);
  })());
});
