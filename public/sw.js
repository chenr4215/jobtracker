// 定义缓存名称和需要缓存的资源
const CACHE_NAME = 'jobtracker-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  // 如果你有图标资源，也需要缓存进去：
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 安装阶段，缓存资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('打开缓存');
        return cache.addAll(urlsToCache);
      })
  );
});

// 激活阶段，清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('清理旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 拦截请求，优先使用缓存
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 缓存中有则返回，否则通过网络获取
        return response || fetch(event.request);
      })
  );
});
