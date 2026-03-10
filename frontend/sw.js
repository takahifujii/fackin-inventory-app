// sw.js
const CACHE_NAME = 'inventory-app-v11';
const ASSETS = [
    './',
    './index.html',
    './manifest.json'
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
    // Never cache API calls or external Google image/script redirects
    if (
        e.request.url.includes('google.com') ||
        e.request.url.includes('googleusercontent.com') ||
        e.request.url.includes('/api') ||
        e.request.method === 'POST'
    ) {
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
