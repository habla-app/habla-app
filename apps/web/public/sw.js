/* eslint-disable */
// Habla! Service Worker — Lote I v3.1 (1 may 2026).
//
// Estrategia "offline-light":
//   - HTML / navegación → network-first con fallback a cache (si offline,
//     sirve la última versión cacheada de esa ruta).
//   - Static assets (`/_next/static/*`) → cache-first (Next.js los emite
//     con hash inmutable, son cacheables agresivamente).
//   - Fonts / images / icons → cache-first con cache runtime separado.
//   - API endpoints (`/api/*`) → SIEMPRE network, NUNCA cacheado. Esta
//     regla es absoluta: las APIs devuelven datos vivos (cuotas, picks,
//     suscripciones) que no se pueden servir stale.
//   - Rutas autenticadas / data RSC → siempre network.
//
// Bumpear `CACHE_VERSION` cuando se hagan cambios incompatibles (ej. el
// shape de las rutas cambia drásticamente). El listener `activate`
// borra caches viejos al detectar un nuevo nombre.
//
// Sin pre-cache (no `cache.addAll([...])`): la app degrada gracefully
// sin SW activo, así que el primer paint NO depende de assets pre-
// cacheados. Cache se llena conforme el usuario navega.

const CACHE_VERSION = "habla-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const HTML_CACHE = `${CACHE_VERSION}-html`;

// Límite suave para HTML cacheado — evita que el cache crezca sin tope
// si el usuario visita muchas rutas únicas (ej. cientos de partidos).
const HTML_MAX_ENTRIES = 30;
const RUNTIME_MAX_ENTRIES = 60;

self.addEventListener("install", (event) => {
  // skipWaiting: el SW nuevo toma control de inmediato sin esperar a que
  // se cierren todas las pestañas con la versión vieja. Combinado con
  // clients.claim() en activate, garantiza que un deploy de SW se aplique
  // sin requerir un refresh adicional del usuario.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const valid = new Set([STATIC_CACHE, RUNTIME_CACHE, HTML_CACHE]);
      await Promise.all(
        keys
          .filter((k) => k.startsWith("habla-") && !valid.has(k))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Solo GET — POST/PUT/DELETE nunca se cachea.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Solo same-origin — nunca interceptamos requests a Cloudflare,
  // api-football, OpenPay, etc.
  if (url.origin !== self.location.origin) return;

  // NUNCA cachear API endpoints (datos vivos).
  if (url.pathname.startsWith("/api/")) return;

  // NUNCA cachear server actions ni RSC payload (Next.js usa /_next/data
  // y headers RSC para hidratación parcial).
  if (url.pathname.startsWith("/_next/data/")) return;
  if (request.headers.get("rsc")) return;
  if (request.headers.get("next-router-state-tree")) return;

  // NUNCA cachear flujo de auth (NextAuth maneja cookies sensibles).
  if (
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/api/auth/")
  ) {
    return;
  }

  // NUNCA cachear redirects de afiliación (`/go/[casa]` registra clicks).
  if (url.pathname.startsWith("/go/")) return;

  // Static assets de Next.js (hash inmutable) → cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Fonts, imágenes, iconos → cache-first con tope.
  if (
    url.pathname.startsWith("/icons/") ||
    /\.(woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|avif|ico)$/i.test(
      url.pathname,
    )
  ) {
    event.respondWith(
      cacheFirstWithLimit(request, RUNTIME_CACHE, RUNTIME_MAX_ENTRIES),
    );
    return;
  }

  // HTML / navegación → network-first con fallback a cache.
  const acceptsHtml = (request.headers.get("accept") || "").includes(
    "text/html",
  );
  if (request.mode === "navigate" || acceptsHtml) {
    event.respondWith(
      networkFirstWithLimit(request, HTML_CACHE, HTML_MAX_ENTRIES),
    );
    return;
  }

  // Default: network-only (más seguro para casos no contemplados).
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.status < 400) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function cacheFirstWithLimit(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.status < 400) {
    cache.put(request, response.clone()).catch(() => {});
    trimCache(cacheName, maxEntries).catch(() => {});
  }
  return response;
}

async function networkFirstWithLimit(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.status < 400) {
      cache.put(request, response.clone()).catch(() => {});
      trimCache(cacheName, maxEntries).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Sin cache previa y sin red: dejamos que el browser muestre su
    // pantalla nativa de offline. NO devolvemos una página custom porque
    // preferimos transparencia sobre UX engañosa (el usuario ve "sin
    // conexión" en lugar de un shell vacío).
    throw error;
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const toDelete = keys.length - maxEntries;
  for (let i = 0; i < toDelete; i += 1) {
    await cache.delete(keys[i]);
  }
}

// Permite que el cliente pida update vía postMessage (útil si más
// adelante mostramos un banner "nueva versión disponible").
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
