/**
 * Service Worker - PWA Offline Support
 * Issue #249: Progressive Web App Implementation
 */

const CACHE_NAME = 'college-media-v1';
const OFFLINE_URL = '/offline.html';

// Static assets to cache on install
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// API cache configuration
const API_CACHE_NAME = 'college-media-api-v1';
const IMAGE_CACHE_NAME = 'college-media-images-v1';

// Cache size limits
const MAX_API_CACHE = 50;
const MAX_IMAGE_CACHE = 100;

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_CACHE);
    }).catch((err) => {
      console.error('Failed to cache static assets:', err);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => 
            name !== CACHE_NAME && 
            name !== API_CACHE_NAME && 
            name !== IMAGE_CACHE_NAME
          )
          .map((name) => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Handle API requests - Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response to store in cache
          const responseClone = response.clone();
          caches.open(API_CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
            // Limit cache size
            limitCacheSize(API_CACHE_NAME, MAX_API_CACHE);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request);
        })
    );
    return;
  }

  // Handle images - Stale-while-revalidate
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            limitCacheSize(IMAGE_CACHE_NAME, MAX_IMAGE_CACHE);
            return networkResponse;
          });

          // Return cached response immediately, update cache in background
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Handle other requests - Cache first, network fallback
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, response.clone());
          return response;
        });
      });
    })
  );
});

// Background sync for offline POST requests
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts());
  } else if (event.tag === 'sync-comments') {
    event.waitUntil(syncComments());
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  const data = event.data ? event.data.json() : {};
  const title = data.title || 'College Media';
  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: data.url || '/',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});

// Helper function to limit cache size
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    // Delete oldest entries
    await cache.delete(keys[0]);
    await limitCacheSize(cacheName, maxItems);
  }
}

// Sync posts when back online
async function syncPosts() {
  try {
    const db = await openIndexedDB();
    const posts = await getAllPendingPosts(db);

    for (const post of posts) {
      try {
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post),
        });

        if (response.ok) {
          await deletePendingPost(db, post.id);
          console.log('Post synced:', post.id);
        }
      } catch (err) {
        console.error('Failed to sync post:', err);
      }
    }
  } catch (err) {
    console.error('Sync posts error:', err);
  }
}

// Sync comments when back online
async function syncComments() {
  try {
    const db = await openIndexedDB();
    const comments = await getAllPendingComments(db);

    for (const comment of comments) {
      try {
        const response = await fetch(`/api/posts/${comment.postId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(comment),
        });

        if (response.ok) {
          await deletePendingComment(db, comment.id);
          console.log('Comment synced:', comment.id);
        }
      } catch (err) {
        console.error('Failed to sync comment:', err);
      }
    }
  } catch (err) {
    console.error('Sync comments error:', err);
  }
}

// IndexedDB helpers
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('college-media-db', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-posts')) {
        db.createObjectStore('pending-posts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending-comments')) {
        db.createObjectStore('pending-comments', { keyPath: 'id' });
      }
    };
  });
}

function getAllPendingPosts(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending-posts', 'readonly');
    const store = transaction.objectStore('pending-posts');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getAllPendingComments(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending-comments', 'readonly');
    const store = transaction.objectStore('pending-comments');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deletePendingPost(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending-posts', 'readwrite');
    const store = transaction.objectStore('pending-posts');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

function deletePendingComment(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pending-comments', 'readwrite');
    const store = transaction.objectStore('pending-comments');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
