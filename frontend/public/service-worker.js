/* eslint-disable no-restricted-globals */

// Simple service worker for PWA "Add to Home Screen" support
// This enables the app to work offline and be installable

const CACHE_NAME = 'retail-book-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/main.*.js',
  '/static/css/main.*.css'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('Service Worker: Cache failed', err);
      })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('Service Worker: Deleting old cache', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API calls - let them go to network
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache API responses or non-successful responses
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            // Cache successful responses for static assets
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => {
            // If network fails and not in cache, return offline fallback
            console.log('Service Worker: Network failed, serving offline');
            // Could return a custom offline page here
          });
      })
  );
});
