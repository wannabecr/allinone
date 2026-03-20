const CACHE_VERSION = 'nullyex-v1';
const CACHE_NAME = CACHE_VERSION;

const PRECACHE_URLS = [
    './index.html',
    './app.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap'
];

const NETWORK_ONLY_PATTERNS = [
    /supabase\.co/,
    /cloudflare\.com\/turnstile/,
    /workers\.dev/,
    /cloudflareinsights\.com/,
    /challenges\.cloudflare\.com/,
    /unpkg\.com/,
    /cdnjs\.cloudflare\.com/
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.allSettled(
                PRECACHE_URLS.map(url =>
                    cache.add(url).catch(err => console.warn('[SW] Precache miss:', url, err.message))
                )
            )
        )
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    if (NETWORK_ONLY_PATTERNS.some(p => p.test(request.url))) {
        event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match('./index.html').then(r => r || new Response('Offline', { status: 503 }))
            )
        );
        return;
    }

    const url = new URL(request.url);

    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(
            caches.open(CACHE_NAME).then(async cache => {
                const cached = await cache.match(request);
                if (cached) return cached;
                const response = await fetch(request).catch(() => null);
                if (response && response.ok) cache.put(request, response.clone());
                return response || new Response('', { status: 503 });
            })
        );
        return;
    }

    if (request.destination === 'image') {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request)
                    .then(response => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, response.clone());
                                limitCache(CACHE_NAME, 50);
                            });
                        }
                        return response;
                    })
                    .catch(() => caches.match('./icons/icon-192.png').then(r => r || new Response('', { status: 503 })));
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;
            return fetch(request)
                .then(response => {
                    if (!response || response.status !== 200 || response.type === 'error') return response;
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, response.clone());
                        limitCache(CACHE_NAME, 60);
                    });
                    return response;
                })
                .catch(() => {
                    if (request.destination === 'document') {
                        return caches.match('./index.html').then(r => r || new Response('Offline', { status: 503 }));
                    }
                    return new Response('', { status: 503 });
                });
        })
    );
});

async function limitCache(name, maxSize) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length > maxSize) {
        await cache.delete(keys[0]);
        await limitCache(name, maxSize);
    }
}

self.addEventListener('push', event => {
    if (!event.data) return;
    let payload;
    try { payload = event.data.json(); }
    catch { payload = { title: 'NullYex', body: event.data.text() }; }
    event.waitUntil(
        self.registration.showNotification(payload.title || 'NullYex', {
            body: payload.body || 'You have a new notification.',
            icon: './icons/icon-192.png',
            badge: './icons/icon-192.png',
            tag: payload.tag || 'nullyex-notification',
            data: { url: payload.url || './app.html' },
            vibrate: [100, 50, 100],
            requireInteraction: false
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || './app.html';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(targetUrl);
                    return;
                }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});

self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data?.type === 'GET_VERSION') {
        event.ports[0]?.postMessage({ version: CACHE_VERSION });
    }
});
