const CACHE_VERSION = 'nullyex-v2';
const CACHE_NAME = CACHE_VERSION;

const PRECACHE_URLS = [
    './index.html',
    './app.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

const NETWORK_ONLY_PATTERNS = [
    /supabase\.co/,
    /cloudflare\.com/,
    /workers\.dev/,
    /cloudflareinsights\.com/,
    /unpkg\.com/,
    /cdnjs\.cloudflare\.com/,
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/
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

    if (request.destination === 'image') {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request)
                    .then(response => {
                        if (response && response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                        }
                        return response;
                    })
                    .catch(() => new Response('', { status: 503 }));
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;
            return fetch(request)
                .then(response => {
                    if (response && response.ok && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    }
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
            tag: 'nullyex-notification',
            data: { url: payload.url || './app.html' },
            vibrate: [100, 50, 100]
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
});
