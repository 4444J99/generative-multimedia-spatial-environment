/**
 * Service Worker for ET CETER4
 * Provides basic caching for critical assets with offline fallback
 * Cache limit ~5MB due to large images
 *
 * Bump CACHE_VERSION when deploying updated assets to bust stale caches
 */

const CACHE_VERSION = 5;
const CACHE_NAME = `etceter4-v${CACHE_VERSION}`;
const MEDIA_CACHE_VERSION = 1;

/**
 * Critical assets to cache
 * Limited to essential CSS, JS, and favicon
 */
// Use relative URLs so the service worker works both at the site root
// (e.g. etceter4.com/) and under a GitHub Pages subpath (e.g. /a-mavs-olevm/).
// self.location.pathname gives the sw.js path; strip the filename to get the base.
const _swBase = self.location.pathname.replace(/\/sw\.js$/, '') || '';
const CRITICAL_ASSETS = [
  _swBase + '/',
  _swBase + '/index.html',
  _swBase + '/offline.html',
  _swBase + '/css/styles.css',
  _swBase + '/css/vendor/tachyons/css/tachyons.min.css',
  _swBase + '/js/data/source-catalogue.js',
  _swBase + '/js/config.js',
  _swBase + '/js/modules/ScriptLoader.js',
  _swBase + '/js/modules/ChamberLoader.js',
  _swBase + '/js/modules/JourneyTracker.js',
  _swBase + '/js/modules/JourneyNarrative.js',
  _swBase + '/js/chamberManifest.js',
  _swBase + '/js/main.js',
  _swBase + '/js/page.js',
  _swBase + '/js/pageData.js',
  _swBase + '/img/favicon.ico',
  _swBase + '/img/placeholder.jpg',
];

/**
 * Install event - cache critical assets
 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(CRITICAL_ASSETS).catch(err => {
          console.warn('Failed to cache some assets:', err);
          return Promise.resolve();
        });
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('Service worker install failed:', err);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              const app = /^etceter4-v(\d+)$/.exec(cacheName);
              const media =
                /^media-cache-v(\d+)-(audio|thumbnails|waveforms|metadata)$/.exec(
                  cacheName
                );
              return (
                (app && Number(app[1]) < CACHE_VERSION) ||
                (media && Number(media[1]) < MEDIA_CACHE_VERSION)
              );
            })
            .map(cacheName => caches.delete(cacheName))
        ).catch(err => {
          console.warn('Cache cleanup failed:', err);
          return Promise.resolve();
        });
      })
      .then(() => {
        return self.clients.claim();
      })
      .catch(err => {
        console.warn('Service worker activation warning:', err);
      })
  );
});

/**
 * The root worker controls application clients, including their CDN requests.
 * Keep v1 media data compatible with the retired worker; never purge other apps.
 */
const MEDIA_CACHES = ['audio', 'thumbnails', 'waveforms', 'metadata'].map(
  type => `media-cache-v${MEDIA_CACHE_VERSION}-${type}`
);
const MEDIA_DEFAULTS = {
  audioTTL: 604800000,
  thumbnailTTL: 86400000,
  maxAudioCacheSize: 104857600,
};
const mediaConfig = { ...MEDIA_DEFAULTS };

function mediaStore(url) {
  const path = url.pathname.toLowerCase();
  if (/\.(mp3|wav|m4a|aac|flac|ogg)$/.test(path)) return MEDIA_CACHES[0];
  if (/\.(jpg|jpeg|png|gif|webp)$/.test(path)) return MEDIA_CACHES[1];
  if (path.endsWith('.json')) {
    return MEDIA_CACHES[path.includes('waveform') ? 2 : 3];
  }
  return null;
}

function mediaMetadata(response) {
  try {
    return JSON.parse(response.headers.get('x-cache-metadata'));
  } catch {
    return null;
  }
}

async function storeMedia(cache, store, request, response) {
  // Cache.put rejects 206. Opaque responses cannot be reconstructed with headers.
  // Return either response untouched to preserve native/CORS playback semantics.
  if (response.status !== 200 || response.type === 'opaque') return;
  try {
    const headers = new Headers(response.headers);
    headers.set(
      'x-cache-metadata',
      JSON.stringify({
        timestamp: Date.now(),
        ttl:
          store === MEDIA_CACHES[1]
            ? mediaConfig.thumbnailTTL
            : mediaConfig.audioTTL,
      })
    );
    await cache.put(
      request,
      new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    );
    if (store === MEDIA_CACHES[0]) await trimAudio(cache);
  } catch (error) {
    // A quota/storage failure must not turn a playable network response into 503.
    console.warn('[MediaSW] Cache write failed:', error);
  }
}

async function trimAudio(cache) {
  const entries = [];
  let total = 0;
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (!response) continue;
    // CORS responses may omit Content-Length. Measure bytes instead of counting 0.
    const size = (await response.arrayBuffer()).byteLength;
    entries.push({
      request,
      size,
      timestamp: mediaMetadata(response)?.timestamp || 0,
    });
    total += size;
  }
  entries.sort((a, b) => a.timestamp - b.timestamp);
  for (const entry of entries) {
    if (total <= mediaConfig.maxAudioCacheSize) break;
    await cache.delete(entry.request);
    total -= entry.size;
  }
}

function unavailable() {
  return new Response('Network error and no cached version available', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' },
  });
}

async function cachedAudioRange(response, range) {
  const bytes = await response.arrayBuffer();
  const length = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start;
  let end;
  if (match && (match[1] || match[2])) {
    start = match[1]
      ? Number(match[1])
      : Math.max(0, length - Number(match[2]));
    end =
      match[1] && match[2]
        ? Math.min(Number(match[2]), length - 1)
        : length - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start >= length
  ) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${length}` },
    });
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${length}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

async function mediaResponse(request, store) {
  let cache;
  let cached;
  try {
    cache = await caches.open(store);
    cached = await cache.match(request);
    // The previous controlling root worker stored complete audio in its shell
    // cache. Keep that offline history usable without reading other apps' stores.
    if (!cached && store === MEDIA_CACHES[0]) {
      cached = await (await caches.open(CACHE_NAME)).match(request);
    }
  } catch (error) {
    console.warn('[MediaSW] Cache read failed:', error);
  }
  const range = request.headers.get('Range');
  if (store !== MEDIA_CACHES[0] && cached) {
    const metadata = mediaMetadata(cached);
    if (metadata?.ttl == null || Date.now() - metadata.timestamp < metadata.ttl)
      return cached;
  }
  let network;
  try {
    network = await fetch(request);
    if (network.ok || network.type === 'opaque') {
      // Do not cache a range request even if an origin ignores Range and sends 200.
      if (!range && cache) await storeMedia(cache, store, request, network);
      return network;
    }
  } catch {
    // Audio is network-first. Images/JSON also serve stale entries when offline.
  }
  if (cached) {
    return range && store === MEDIA_CACHES[0]
      ? cachedAudioRange(cached, range)
      : cached;
  }
  return network || unavailable();
}

async function applicationResponse(request) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
  } catch (error) {
    console.warn('Application cache unavailable:', error);
  }
  try {
    const response = await fetch(request);
    if (response.status === 200 && cache) {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        console.warn('Application cache write failed:', error);
      }
    }
    return response;
  } catch {
    if (!cache) return unavailable();
    try {
      return (
        (await cache.match(request)) ||
        (request.mode === 'navigate' &&
          (await cache.match(_swBase + '/offline.html'))) ||
        unavailable()
      );
    } catch {
      return unavailable();
    }
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const mediaOrigin = url.origin === 'https://media.etceter4.com';
  if (!sameOrigin && !mediaOrigin) return;

  // Preserve the original photograph exclusion and stream video/HLS unchanged.
  // A bypass must precede application caching, including segment/subtitle URLs.
  if (sameOrigin && url.pathname.includes('/img/photos/')) return;
  if (
    request.destination === 'video' ||
    /\.(mp4|webm|mov|m4v|m3u8|mpd|ts|m4s|vtt)$/i.test(url.pathname)
  ) {
    event.respondWith(fetch(request).catch(unavailable));
    return;
  }
  const store = mediaStore(url);
  if (store) {
    event.respondWith(mediaResponse(request, store));
  } else if (sameOrigin) {
    event.respondWith(applicationResponse(request));
  }
});

// Preserve the media worker's management protocol; ALL means media stores only.
self.addEventListener('message', event => {
  const { type, payload } = event.data || {};
  const reply = data => event.ports?.[0]?.postMessage(data);
  let operation;
  if (type === 'CLEAR_AUDIO_CACHE' || type === 'CLEAR_ALL_CACHES') {
    const stores =
      type === 'CLEAR_AUDIO_CACHE' ? [MEDIA_CACHES[0]] : MEDIA_CACHES;
    operation = Promise.all(stores.map(name => caches.delete(name))).then(
      () => ({ success: true })
    );
  } else if (type === 'GET_CACHE_SIZE') {
    operation = (async () => {
      let size = 0;
      for (const name of MEDIA_CACHES) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          const response = await cache.match(request);
          if (response) size += (await response.arrayBuffer()).byteLength;
        }
      }
      return { size };
    })();
  } else if (type === 'UPDATE_CONFIG' && payload?.cache) {
    for (const key of Object.keys(MEDIA_DEFAULTS)) {
      const value = payload.cache[key];
      if (Number.isFinite(value) && value >= 0) mediaConfig[key] = value;
    }
    operation = Promise.resolve({ success: true });
  }
  if (operation)
    event.waitUntil(
      operation
        .then(reply)
        .catch(error => reply({ success: false, error: String(error) }))
    );
});
