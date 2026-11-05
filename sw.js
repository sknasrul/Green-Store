const V = 'green-store-v1';
const SHELL = [
  'index.html',
  'home.html',
  'login.html',
  'orders.html',
  'offline.html',
  'manifest.json',
  'icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];
const scopePath = new URL(self.registration.scope).pathname;

const clean = async r => {
  if (!r.redirected) return r;
  return new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers });
};

const net = (q, ms) => Promise.race([fetch(q), new Promise((_, j) => setTimeout(j, ms))]);

const store = async (q, r) => {
  if (!(r.status === 200 && r.type === 'basic')) return;
  const c = r.clone();
  const y = await clean(c);
  await (await caches.open(V)).put(q, y);
};

async function netFirst(e, q, u) {
  try {
    const r = await net(q, 4000);
    if (r.status >= 500) throw r;
    e.waitUntil(store(q, r));
    return r;
  } catch {
    const c = await caches.open(V);
    const hit = await c.match(q, { ignoreSearch: true });
    if (hit || q.mode !== 'navigate') return hit || Response.error();
    const rel = u.pathname.slice(scopePath.length) || 'index';
    return (await c.match(rel.endsWith('.html') ? rel : rel + '.html')) || (await c.match('offline.html')) || Response.error();
  }
}

async function swr(e, q) {
  const c = await caches.open(V);
  const hit = await c.match(q);
  const p = fetch(q)
    .then(r => {
      e.waitUntil(store(q, r));
      return r;
    })
    .catch(() => hit || Response.error());
  e.waitUntil(p);
  return hit || p;
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches
      .open(V)
      .then(c =>
        Promise.allSettled(
          SHELL.map(async u => {
            const r = await fetch(u, { cache: 'reload' });
            if (r.ok) await c.put(u, await clean(r));
          })
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(k => Promise.all(k.filter(n => n !== V).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const q = e.request;
  const u = new URL(q.url);
  if (q.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  const doc = q.mode === 'navigate' || /\.(html|json)$/.test(u.pathname);
  e.respondWith(doc ? netFirst(e, q, u) : swr(e, q));
});
