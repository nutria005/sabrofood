// Sabrofood PWA Service Worker - OFFLINE COMPLETO
// Versión: 2.0.0
// Fecha: 04-03-2026

const CACHE_VERSION = 'sabrofood-v2.0.0-offline-complete';
const CACHE_NAME = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

// Archivos a cachear para funcionamiento offline COMPLETO
const STATIC_ASSETS = [
  '/sabrofood/',
  '/sabrofood/index.html',
  '/sabrofood/manifest.json',
  '/sabrofood/style.css',
  '/sabrofood/script.js',
  '/sabrofood/supabase-config.js',
  '/sabrofood/bodega-module.js',
  '/sabrofood/pwa-install.js',
  // Fuentes de Google
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  // CDN externas (QR y Charts)
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  // Supabase SDK
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// URLs que NUNCA deben cachearse (solo APIs de Supabase)
const NEVER_CACHE = [
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

  // 🔒 REGLA 1: APIs de Supabase - Network First (intentar red, fallback a caché si offline)
  if (shouldNeverCache(url.href)) {
    event.respondWith(networkFirstWithOfflineSupport(request));
    return;
  }

  // 📦 REGLA 2: Todos los recursos estáticos - Cache First
  event.respondWith(cacheFirstWithUpdate(request));
});

// ===================================
// ESTRATEGIAS DE CACHÉ
// ===================================

// Cache First con actualización en segundo plano
async function cacheFirstWithUpdate(request) {
  try {
    const cachedResponse = await caches.match(request);
    
    // Devolver caché inmediatamente si existe
    if (cachedResponse) {
      // Actualizar caché en segundo plano
      fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse);
          });
        }
      }).catch(() => {}); // Ignorar errores de red
      
      return cachedResponse;
    }

    // Si no hay caché, obtener de red y cachear
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;

  } catch (error) {
    // Intentar caché como último recurso
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback para archivos HTML
    if (request.destination === 'document') {
      return caches.match('/sabrofood/index.html');
    }
    
    return new Response('Offline - Recurso no disponible', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First con soporte offline para APIs
async function networkFirstWithOfflineSupport(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Solo cachear respuestas exitosas de lectura (GET)
    if (request.method === 'GET' && networkResponse.status === 200) {
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;

  } catch (error) {
    // Si falla la red, intentar caché
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] 📡 Modo Offline: Sirviendo desde caché:', request.url);
      return cachedResponse;
    }
    
    // Si no hay caché, retornar error
    throw error;
  }
}

// ===================================
// FUNCIONES DE UTILIDAD
// ===================================

// Verificar si una URL NO debe cachearse (solo APIs)
function shouldNeverCache(url) {
  return NEVER_CACHE.some(pattern => url.includes(pattern));
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
