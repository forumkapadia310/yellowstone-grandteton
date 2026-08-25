// Service worker for Yellowstone & Grand Teton itinerary
// Caches map tiles, Wikipedia data, and the app shell for offline use

const APP_CACHE = 'yellowstone-app-v1';
const TILE_CACHE = 'yellowstone-tiles-v1';
const WIKI_CACHE = 'yellowstone-wiki-v1';
const IMG_CACHE  = 'yellowstone-imgs-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL).catch(()=>{}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![APP_CACHE, TILE_CACHE, WIKI_CACHE, IMG_CACHE].includes(k))
          .map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Map tiles - cache first, network fallback
  if (url.includes('tile.openstreetmap.de') || url.includes('tile.openstreetmap.org')) {
    event.respondWith(cacheFirst(event.request, TILE_CACHE));
    return;
  }

  // Wikipedia API - cache first
  if (url.includes('en.wikipedia.org/api/rest_v1')) {
    event.respondWith(cacheFirst(event.request, WIKI_CACHE));
    return;
  }

  // Wikipedia images
  if (url.includes('upload.wikimedia.org')) {
    event.respondWith(cacheFirst(event.request, IMG_CACHE));
    return;
  }

  // App shell + Leaflet CDN - cache first
  if (APP_SHELL.some(s => url.endsWith(s.replace('./','')) || url === s)) {
    event.respondWith(cacheFirst(event.request, APP_CACHE));
    return;
  }

  // Everything else - network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    return cached || new Response('Offline', { status: 503 });
  }
}
