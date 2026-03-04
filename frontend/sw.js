// sw.js
const CACHE_NAME = 'inventory-app-v3';
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
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (e) => {
    // Never cache API calls (POST or App Script GETs with token)
    if (e.request.url.includes('script.google.com') || e.request.method === 'POST') {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((response) => {
            // Return cached response if found
            if (response) {
                return response;
            }

            // Else fetch network request
            return fetch(e.request).catch(() => {
                // Optional offline fallback logic here
                console.log('Offline and not in cache:', e.request.url);
            });
        })
    );
});

self.addEventListener('activate', (e) => {
    // Clean up old caches
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});
