// sw.js
const CACHE_NAME = 'inventory-app-v6';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/variables.css',
    './css/globals.css',
    './css/components.css',
    './css/layout.css',
    './js/config.js',
    './js/api.js',
    './js/ui.js',
    './js/app.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css'
];

self.addEventListener('install', (e) => {
    self.skipWaiting(); // Force the waiting service worker to become the active service worker.
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (e) => {
    // Never cache API calls (POST or App Script GETs with token)
    if (e.request.url.includes('script.google.com') || e.request.url.includes('/api') || e.request.method === 'POST') {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((response) => {
            if (response) return response;
            return fetch(e.request).catch(() => console.log('Offline:', e.request.url));
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        }).then(() => self.clients.claim()) // Force all clients to use the new service worker immediately.
    );
});
