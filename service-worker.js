// ===================================
// 🚀 SABROFOOD PWA SERVICE WORKER
// ===================================
// Versión: 2.1.0-ios-fix
// Fecha: 04-03-2026
// 
// CAMBIOS EN ESTA VERSIÓN:
// - Network First para archivos críticos (script.js, style.css, index.html)
// - Cache First solo para assets estáticos (fuentes, imágenes, libs)
// - Mejor manejo de errores y logs
// - Soporte para actualización forzada desde la app
// - Prevención de caché agresivo en iOS PWA
// ===================================

const CACHE_VERSION = 'sabrofood-v2.1.0-ios-fix';
const CACHE_NAME = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

// ===================================
// CONFIGURACIÓN DE CACHÉ
// ===================================

// 🔥 ARCHIVOS CRÍTICOS - Network First (siempre buscar versión nueva primero)
// Estos archivos deben estar SIEMPRE actualizados para que los fixes funcionen
const NETWORK_FIRST_FILES = [
  '/sabrofood/index.html',
  '/sabrofood/script.js',
  '/sabrofood/style.css',
  '/sabrofood/supabase-config.js',
  '/sabrofood/bodega-module.js',
  '/sabrofood/pwa-install.js'
];

// 📦 ASSETS ESTÁTICOS - Cache First (ok si están cacheados)
// Fuentes, librerías CDN, etc. No cambian frecuentemente
const CACHE_FIRST_ASSETS = [
  '/sabrofood/',
  '/sabrofood/manifest.json',
  // Fuentes de Google
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://fonts.gstatic.com',
  // CDN externas (QR y Charts)
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  // Supabase SDK
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// 🚫 URLs QUE NUNCA SE CACHEAN - Solo APIs y auth
const NEVER_CACHE = [
  '.supabase.co',             // API de Supabase
  'supabase.co',              // Realtime y auth
  '/auth/',                   // Endpoints de autenticación
  '/rest/',                   // API REST de Supabase
  '/realtime/'                // WebSockets tiempo real
];

// ===================================
// 📦 INSTALACIÓN DEL SERVICE WORKER
// ===================================
self.addEventListener('install', (event) => {
  console.log('[SW] 🚀 Instalando Service Worker...', CACHE_VERSION);
  console.log('[SW] 📋 Estrategia: Network First para archivos críticos, Cache First para assets');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 💾 Pre-cacheando archivos estáticos...');
        // Solo pre-cachear assets que no cambian frecuentemente
        return cache.addAll(CACHE_FIRST_ASSETS);
      })
      .then(() => {
        console.log('[SW] ✅ Pre-caché completado');
        // NO hacer skipWaiting aquí - esperar a que la app lo solicite
        // return self.skipWaiting(); 
      })
      .catch((error) => {
        console.error('[SW] ❌ Error al cachear:', error);
        // Aún así, marcar como instalado
        return self.skipWaiting();
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
   🌐 INTERCEPTAR PETICIONES (FETCH)
// ===================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 🚫 REGLA 1: APIs de Supabase - Network Only (nunca cachear)
  if (shouldNeverCache(url.href)) {
    event.respondWith(
      fetch(request).catch(error => {
        console.log('[SW] 📡 API offline:', request.url);
        return new Response(
          JSON.stringify({ error: 'Sin conexión a internet' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 🔥 REGLA 2: Archivos críticos - Network First (siempre buscar nueva versión)
  if (isNetworkFirstFile(url.pathname)) {
   📋 ESTRATEGIAS DE CACHÉ
// ===================================

/**
 * 🔥 NETWORK FIRST - Para archivos críticos
 * Intenta descargar de red primero, usa caché solo si falla
 * Esto asegura que iOS PWA siempre tenga la última versión
 */
async function networkFirstStrategy(request) {
  const url = request.url;
  
  try {
    // Intentar red primero con timeout de 3 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    // Si la respuesta es exitosa, actualizar caché
    if (networkResponse && networkResponse.status === 200) {
      console.log('[SW] ✅ Archivo crítico actualizado desde red:', url);
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    return networkResponse;

  } catch (error) {
    // Error de red o timeout - intentar caché
    console.log('[SW] 📡 Red no disponible, usando caché:', url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[SW] 💾 Sirviendo desde caché (offline):', url);
      return cachedResponse;
    }
    
    // No hay caché - retornar error
    console.error('[SW] ❌ No disponible ni en red ni en caché:', url);
    return new Response('Archivo no disponible offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * 📦 CACHE FIRST - Para assets estáticos
 * Usa caché primero, descarga si no existe
 * Opcional: actualiza en segundo plano
 */
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  // Si existe en caché, devolverlo inmediatamente
  if (cachedResponse) {
    // Actualizar en segundo plano (opcional)
    fetch(request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse);
          });
        }
      })
      .catch(() => {}); // Ignorar errores de actualización
    
    return cachedResponse;
  }

  // No está en caché, descargar y cachear
  try {
   🛠️ FUNCIONES DE UTILIDAD
// ===================================

/**
 * Verificar si una URL NO debe cachearse (solo APIs)
 */
function shouldNeverCache(url) {
  return NEVER_CACHE.some(pattern => url.includes(pattern));
}

/**
 * Verificar si un archivo debe usar estrategia Network First
 */
function isNetworkFirstFile(pathname) {
  return NETWORK_FIRST_FILES.some(path => pathname.endsWith(path.split('/').pop()));
}

// ===================================
// 📨 MENSAJES DEL CLIENTE
// ===================================
self.addEventListener('message', (event) => {
  // Comando: Activar nuevo service worker inmediatamente
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] 🚀 Comando recibido: Activar nueva versión inmediatamente');
    self.skipWaiting();
  }

  // Comando: Obtener versión actual del SW
  if (event.data && event.data.type === 'GET_VERSION') {
    console.log('[SW] 📋 Enviando versión:', CACHE_VERSION);
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }

  // Comando: Limpiar TODO el caché (actualización forzada)
  if (event.data && event.data.type === 'CLEAR_ALL_CACHE') {
    console.log('[SW] 🗑️ Limpiando TODO el caché...');
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('[SW] 🗑️ Eliminando:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('[SW] ✅ Caché limpiado completamente');
        // Notificar a la app
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHE_CLEARED' });
          });
        });
      })
    );
  }
});

// ===================================
// 🎯 INICIALIZACIÓN
// ===================================
console.log('[SW] 🚀 Service Worker cargado:', CACHE_VERSION);
console.log('[SW] 📋 Network First:', NETWORK_FIRST_FILES.length, 'archivos');
console.log('[SW] 📦 Cache First:', CACHE_FIRST_ASSETS.length, 'assets'
    
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
