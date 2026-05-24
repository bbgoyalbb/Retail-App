/* eslint-disable no-restricted-globals */

// Simple service worker for PWA "Add to Home Screen" support
// This enables the app to be installable on Android

const CACHE_NAME = 'retail-book-v1';

// Install event - just claim clients, don't cache (avoids errors)
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
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

// Fetch event - just pass through to network (no caching to avoid errors)
// This keeps the PWA installable without breaking the app
self.addEventListener('fetch', (event) => {
  // Let all requests go to network normally
  // The service worker just needs to exist for PWA installability
  return;
});
