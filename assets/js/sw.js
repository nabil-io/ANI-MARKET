/**
 * ANI MARKET - Service Worker (sw.js)
 * Cache l'interface et le dernier catalogue.
 * Si le réseau répond, ne sert jamais un catalogue périmé de plus de 5 minutes.
 */

const CACHE_NAME = 'ani-market-cache-v2';
const STATIC_ASSETS = [
  './',
  'index.html',
  'assets/css/site.css',
  'assets/js/site.js',
  'assets/js/cart.js',
  'assets/js/api.js',
  'assets/js/zip.js',
  'assets/brand/logo-rond.png',
  'assets/brand/logo-44.webp',
  'assets/brand/monogramme.svg',
  'data/catalog.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes admin ou API
  if (url.pathname.includes('/admin') || url.pathname.includes('api.php')) {
    return;
  }

  // Pour data/catalog.json : Network First avec timeout de 2.5s puis cache
  if (url.pathname.includes('catalog.json')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Pour les autres ressources statiques : Cache First avec mise à jour en arrière-plan
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
