/**
 * sw.js — Service Worker para caché offline
 * 
 * Estrategia:
 * - INSTALL: precarga archivos esenciales (HTML, CSS, JS, JSON, fotos principales)
 * - FETCH: stale-while-revalidate para archivos cacheados,
 *          network-first para galerías y recursos nuevos
 * - UPDATE: detecta nueva versión y actualiza caché en segundo plano
 */

// Versión del caché — cambiar al hacer deploy con cambios
const CACHE_VERSION = 'guia-v1.0.0';

// Archivos esenciales que se precargan al instalar
// Las fotos principales de lugares se cachean aquí
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/search.js',
  './js/speech.js',
  './js/ai-chat.js',
  './js/challenges.js',
  './js/preferences.js',
  './data/config.json',
  './data/places-barcelona.json',
  './data/places-roma.json',
  './data/places-florencia.json',
  './data/places-paris.json',
  './data/food-barcelona.json',
  './data/challenges.json'
  // Las imágenes principales se agregan dinámicamente abajo
  // Las imágenes de galería NO se precargan (se cachean al verlas)
];

// --- INSTALL: precargar archivos esenciales ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => {
        console.log('[SW] Precargando archivos esenciales...');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        // Activar inmediatamente sin esperar a que se cierren pestañas anteriores
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Error en precarga:', err);
      })
  );
});

// --- ACTIVATE: limpiar cachés viejos ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_VERSION)
            .map(name => {
              console.log('[SW] Eliminando caché viejo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Tomar control de todas las páginas abiertas
        return self.clients.claim();
      })
  );
});

// --- FETCH: servir desde caché con actualización en segundo plano ---
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo manejar requests GET
  if (request.method !== 'GET') return;

  // No cachear requests al proxy de Gemini (IA requiere internet)
  if (request.url.includes('workers.dev') || request.url.includes('googleapis.com')) {
    return;
  }

  // No cachear requests a Google Fonts (ya se sirven desde CDN con su propio caché)
  if (request.url.includes('fonts.googleapis.com') || request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          // Cachear fuentes para offline
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Estrategia: Stale-While-Revalidate
  // 1. Servir desde caché inmediatamente (si existe)
  // 2. En segundo plano, obtener versión fresca de la red
  // 3. Actualizar el caché con la versión fresca
  event.respondWith(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.match(request).then(cachedResponse => {
        // Intentar obtener de la red en segundo plano
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            // Solo cachear respuestas válidas
            if (networkResponse && networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Sin red: devolver lo cacheado (o undefined)
            return cachedResponse;
          });

        // Devolver lo cacheado si existe; si no, esperar la red
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// --- Mensaje para forzar actualización desde la app ---
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
