/* eslint-env serviceworker */
/* global workbox */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.1/workbox-sw.js')

workbox.setConfig({ debug: false })

const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies
const { ExpirationPlugin } = workbox.expiration
const { CacheableResponsePlugin } = workbox.cacheableResponse

workbox.precaching.precacheAndRoute([
  { url: '/', revision: null },
  { url: '/dashboard', revision: null },
  { url: '/map', revision: null },
  { url: '/shelters', revision: null },
  { url: '/alerts', revision: null },
  { url: '/offline.html', revision: null },
  { url: '/manifest.json', revision: null },
  { url: '/reliefops-icon.svg', revision: null },
  { url: '/data/bangladesh-districts.geojson', revision: null },
])

workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'core-pages-v1',
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30 }),
    ],
  }),
)

workbox.routing.registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/data/'),
  new StaleWhileRevalidate({
    cacheName: 'core-data-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20 }),
    ],
  }),
)

workbox.routing.registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['script', 'style', 'image', 'font'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'core-assets-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 80 }),
    ],
  }),
)

workbox.routing.registerRoute(
  ({ request, url }) =>
    request.destination === 'image' &&
    /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname),
  new CacheFirst({
    cacheName: 'map-tiles-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 60 * 60 * 24 * 14,
        purgeOnQuotaError: true,
      }),
    ],
  }),
)

workbox.routing.setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    return caches.match('/offline.html')
  }

  return Response.error()
})
