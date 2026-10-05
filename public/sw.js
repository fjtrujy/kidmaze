const CACHE_NAME = 'kidmaze-v2';
const APP_SHELL = ['./', './index.html'];
const IS_LOCALHOST = ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname);

self.addEventListener('install', (event) => {
  if (IS_LOCALHOST) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  if (IS_LOCALHOST) {
    event.waitUntil(
      Promise.all([
        self.registration.unregister(),
        caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('kidmaze-')).map((name) => caches.delete(name)))),
      ]).then(() =>
        self.clients.matchAll({ type: 'window' }).then((clients) =>
          Promise.all(clients.map((client) => client.navigate(client.url))),
        ),
      ),
    );
    return;
  }

  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (
    IS_LOCALHOST ||
    event.request.method !== 'GET' ||
    new URL(event.request.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && responseMatchesRequest(event.request, response)) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }
        if (event.request.mode === 'navigate') {
          return (await caches.match('./index.html')) ?? Response.error();
        }
        return Response.error();
      }),
  );
});

function responseMatchesRequest(request, response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (request.destination === 'script') {
    return contentType.includes('javascript') || contentType.includes('wasm');
  }
  if (request.destination === 'style') {
    return contentType.includes('text/css');
  }
  if (request.destination === 'image') {
    return contentType.includes('image/');
  }
  return true;
}

