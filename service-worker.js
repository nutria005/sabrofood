// Sabrofood PWA Service Worker
// Versión: 1.0.19
// Fecha: 25-02-2026

const CACHE_VERSION = 'sabrofood-v1.0.19-20260225';
const CACHE_NAME = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

// Archivos a cachear para funcionamiento offline
const STATIC_ASSETS = [
  '/sabrofood/',
  '/sabrofood/index.html',
  '/sabrofood/manifest.json',
  // Nota: style.css y script.js se cachean dinámicamente para permitir actualizaciones
  // Fuentes de Google
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  // CDN externas (QR y Charts)
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

// URLs que NUNCA deben cachearse (seguridad y tiempo real)
const NEVER_CACHE = [
  'supabase-config.js',       // Contiene credenciales
  '.supabase.co',             // API de Supabase
  'supabase.co',              // Realtime y auth
  '/auth/',                   // Endpoints de autenticación
  '/rest/',                   // API REST de Supabase
  '/realtime/'                // WebSockets tiempo real
];

// ===================================
// INSTALACIÓN DEL SERVICE WORKER
// ===================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando archivos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Archivos cacheados correctamente');
        return self.skipWaiting(); // Activar inmediatamente
      })
      .catch((error) => {
        console.error('[SW] Error al cachear:', error);
      })
  );
});

// ===================================
// ACTIVACIÓN Y LIMPIEZA DE CACHÉS VIEJOS
// ===================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Eliminar cachés de versiones anteriores
              return name.startsWith('sabrofood-') && name !== CACHE_NAME && name !== DATA_CACHE;
            })
            .map((name) => {
              console.log('[SW] Eliminando caché viejo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activado y limpio');
        return self.clients.claim(); // Tomar control inmediato
      })
  );
});

// ===================================
// INTERCEPTAR PETICIONES (FETCH)
// ===================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 🔒 REGLA 1: NUNCA cachear URLs sensibles o de Supabase
  if (shouldNeverCache(url.href)) {
    console.log('[SW] Omitiendo caché para:', url.href);
    event.respondWith(fetch(request)); // Ir directo a la red
    return;
  }

  // � REGLA 2: Network First para JS y CSS (permite actualizaciones rápidas)
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith('.js') || pathname.endsWith('.css')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 📦 REGLA 3: Cache First para otros archivos estáticos
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 🌐 REGLA 4: Network First para todo lo demás
  event.respondWith(networkFirst(request));
});

// ===================================
// ESTRATEGIAS DE CACHÉ
// ===================================

// Cache First: Intenta desde caché, si falla va a la red
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Sirviendo desde caché:', request.url);
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    console.log('[SW] Cacheando nuevo recurso:', request.url);
    return networkResponse;

  } catch (error) {
    console.error('[SW] Error en Cache First:', error);
    // Fallback básico
    return new Response('Offline - Recurso no disponible', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First: Intenta red primero, si falla va al caché
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(DATA_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;

  } catch (error) {
    console.log('[SW] Red no disponible, intentando caché:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

// ===================================
// FUNCIONES DE UTILIDAD
// ===================================

// Verificar si una URL NO debe cachearse NUNCA
function shouldNeverCache(url) {
  return NEVER_CACHE.some(pattern => url.includes(pattern));
}

// Verificar si es un recurso estático cacheable
function isStaticAsset(url) {
  const staticExtensions = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.woff', '.woff2'];
  const pathname = url.pathname.toLowerCase();

  // Es estático si termina en alguna de las extensiones
  return staticExtensions.some(ext => pathname.endsWith(ext)) ||
         pathname === '/' ||
         url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('fonts.gstatic.com');
}

// ===================================
// MENSAJES DEL CLIENTE
// ===================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Forzando activación inmediata...');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

console.log('[SW] Service Worker cargado:', CACHE_VERSION);
