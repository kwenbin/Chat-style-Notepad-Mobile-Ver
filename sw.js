// sw.js - 强化版 Service Worker
const CACHE_NAME = 'chat-notepad-v1.0.1'; // 更新版本号以触发缓存更新
const GITHUB_PATH = '/Chat-style-Notepad-Mobile-Ver/'; 

// 需要缓存的资源列表 (修正路径)
const urlsToCache = [
  '.', 
  './index.html',
  './manifest.json',
  './xlsx.full.min.js', 
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 安装阶段：预缓存关键资源
self.addEventListener('install', event => {
  console.log('[Service Worker] 安装中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] 正在缓存应用外壳');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // 关键步骤：强制 Service Worker 立即激活
        console.log('[Service Worker] 安装完成，跳过等待直接激活');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[Service Worker] 安装失败:', err);
      })
  );
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', event => {
  console.log('[Service Worker] 激活中...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 立即控制所有客户端
      console.log('[Service Worker] 激活完成，准备就绪');
      return self.clients.claim();
    })
  );
});

// 拦截请求：缓存优先，网络兜底策略
self.addEventListener('fetch', event => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;
  
  // 可选：跳过某些请求（如 Chrome 扩展）
  if (event.request.url.indexOf('chrome-extension') !== -1) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 1. 如果有缓存，立即返回
        if (cachedResponse) {
          console.log('[Service Worker] 从缓存返回:', event.request.url);
          return cachedResponse;
        }
        
        // 2. 没有缓存，则从网络获取
        return fetch(event.request)
          .then(networkResponse => {
            // 检查是否为有效响应
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // 克隆响应以进行缓存
            const responseToCache = networkResponse.clone();
            
            // 将新资源加入缓存（异步）
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('[Service Worker] 已缓存新资源:', event.request.url);
              });
            
            return networkResponse;
          })
          .catch(error => {
            console.log('[Service Worker] 网络请求失败:', event.request.url, error);
            // 3. 网络失败时，可返回一个兜底页面（如果有）
            if (event.request.url.indexOf('.html') !== -1) {
              return caches.match('./index.html');
            }
            // 对于其他资源，可以返回一个占位符或直接拒绝
            return new Response('网络不可用，请检查连接', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});
