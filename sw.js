'use strict';

// Bump this version whenever any app-shell file changes. Each installation
// downloads a complete shell before it becomes available to the user.
const CACHE_VERSION = 'v25';
const SCOPE = self.registration.scope;
const CACHE_PREFIX = `fitness-tracker:${encodeURIComponent(SCOPE)}:`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const SHELL_FILES = [
  'index.html',
  'styles.css',
  'app.js',
  'workout-ui.js',
  'navigation.js',
  'data.js',
  'backup-reminder.js',
  'recovery.js',
  'recovery-ui.js',
  'leaderboard.js',
  'leaderboard-ui.js',
  'leaderboard-config.js',
  'exercise-catalog.js',
  'exercise-names-ui.js',
  'exercise-videos.js',
  'exercise-video-ui.js',
  'stats.js',
  'stats.css',
  'progress-ui.js',
  'groups-ui.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
];
const SHELL_URLS = new Set(SHELL_FILES.map((file) => new URL(file, SCOPE).href));
const INDEX_URL = new URL('index.html', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([...SHELL_URLS].map((url) => new Request(url, { cache: 'reload' })));
    // An update waits until the user chooses to apply it, or all old windows
    // close. Never reload a workout in progress automatically.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only the exact application shell is cached. In particular, no other
  // GitHub Pages project, third-party request, or user data is intercepted.
  let shellUrl = `${url.origin}${url.pathname}`;
  if (request.mode === 'navigate' && (shellUrl === SCOPE || shellUrl === INDEX_URL)) {
    shellUrl = INDEX_URL;
  }
  if (!SHELL_URLS.has(shellUrl)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(shellUrl);
    // Serving one complete shell version prevents mixed JS/CSS releases.
    // fetch() is a recovery path if the browser removed a cached entry.
    return cached || fetch(request);
  })());
});
