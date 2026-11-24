/* Cache only the public app shell. AI requests and writing data never enter Cache Storage. */
const scope = new URL('./', self.location.href);
const prefix = 'xiaoxing-shell:' + scope.pathname + ':';
const cache = prefix + '4.1.0';
const index = new URL('index.html', scope).href;
const assets = [
  'css/style.css?v=4.1.0', 'js/app.js?v=4.1.0', 'js/draft-review.js?v=4.1.0', 'manifest.webmanifest',
  'icons/xiaoxing-192.png', 'icons/xiaoxing-512.png', 'qr-tip.png'
].map(path => new URL(path, scope).href);
const assetURLs = new Set(assets);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cache).then(box => box.addAll([index, ...assets]
    .map(url => new Request(url, { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(prefix) && key !== cache)
    .map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (req.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === new URL(index).pathname)) {
    event.respondWith(fetch(req).catch(async () => (await caches.open(cache)).match(index).then(r => r || Response.error())));
  } else if (assetURLs.has(url.href)) {
    event.respondWith(caches.open(cache).then(box => box.match(req)).then(hit => hit || fetch(req)));
  }
});
