/* Mi Plata — service worker
   Guarda la app en el dispositivo para que abra sin internet.
   Estrategia: responde al toque desde la caché y, si hay señal,
   busca una versión nueva por atrás para la próxima vez. */

const CACHE = 'miplata-v1';
const CORE = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function notify(msg){
  const cs = await self.clients.matchAll({type:'window'});
  cs.forEach(c => c.postMessage(msg));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, {ignoreSearch:true});

    // Buscar versión fresca por atrás (no bloquea la respuesta)
    const fresh = fetch(req).then(async res => {
      if (res && res.ok) {
        if (hit) {
          try {
            const [a, b] = await Promise.all([hit.clone().text(), res.clone().text()]);
            if (a !== b) notify({type:'updated'});
          } catch (_) {}
        }
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);

    if (hit) { e.waitUntil(fresh); return hit; }

    const res = await fresh;
    if (res) return res;
    return (await cache.match('./index.html')) || Response.error();
  })());
});