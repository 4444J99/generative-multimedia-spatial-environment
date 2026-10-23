/**
 * Compatibility retirement worker. Media caching now belongs to root sw.js.
 * Keep this URL available while PR #138 owns js/main.js registration changes:
 * existing registrations update to this script and new registrations retire too.
 * Never claim clients or delete origin-wide CacheStorage during retirement.
 */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.registration.unregister());
});
