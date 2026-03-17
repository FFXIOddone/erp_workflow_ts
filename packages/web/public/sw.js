// Service Worker for BUNDA Shop Floor PWA
const CACHE_NAME = 'bunda-shop-floor-v1';
const STATIC_CACHE = 'bunda-static-v1';
const API_CACHE = 'bunda-api-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/shop-floor',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API endpoints to cache for offline
const CACHEABLE_API_ROUTES = [
  '/api/orders',
  '/api/users/me',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('/api/')));
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip WebSocket requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Handle API requests - network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET responses for certain endpoints
          if (response.ok && CACHEABLE_API_ROUTES.some(route => url.pathname.startsWith(route))) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache when offline
          return caches.match(request);
        })
    );
    return;
  }

  // Handle static assets - cache first with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        fetch(request).then((response) => {
          if (response.ok) {
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, response);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Not in cache - fetch from network
      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-time-entries') {
    event.waitUntil(syncTimeEntries());
  } else if (event.tag === 'sync-station-updates') {
    event.waitUntil(syncStationUpdates());
  }
});

// Sync pending time entries
async function syncTimeEntries() {
  try {
    const db = await openDB();
    const pendingEntries = await db.getAll('pendingTimeEntries');
    
    for (const entry of pendingEntries) {
      try {
        const response = await fetch(`/api/orders/${entry.orderId}/time`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.data),
        });
        
        if (response.ok) {
          await db.delete('pendingTimeEntries', entry.id);
        }
      } catch (e) {
        console.error('[SW] Failed to sync time entry:', e);
      }
    }
  } catch (e) {
    console.error('[SW] Error syncing time entries:', e);
  }
}

// Sync pending station updates
async function syncStationUpdates() {
  try {
    const db = await openDB();
    const pendingUpdates = await db.getAll('pendingStationUpdates');
    
    for (const update of pendingUpdates) {
      try {
        const response = await fetch(`/api/orders/${update.orderId}/stations/${update.station}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          await db.delete('pendingStationUpdates', update.id);
        }
      } catch (e) {
        console.error('[SW] Failed to sync station update:', e);
      }
    }
  } catch (e) {
    console.error('[SW] Error syncing station updates:', e);
  }
}

// Simple IndexedDB wrapper
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('bunda-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      resolve({
        getAll: (store) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readonly');
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        }),
        delete: (store, key) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite');
          const req = tx.objectStore(store).delete(key);
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        }),
      });
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingTimeEntries')) {
        db.createObjectStore('pendingTimeEntries', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pendingStationUpdates')) {
        db.createObjectStore('pendingStationUpdates', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
