// MODERN POS SYSTEM - JavaScript
// ===============================

// Versión de la aplicación
const APP_VERSION = '2.0.0-offline-complete';

// ============================
// SISTEMA DE BASE DE DATOS OFFLINE (IndexedDB)
// ============================

let db = null;
let isOnline = navigator.onLine;
let syncInProgress = false;

/**
 * Inicializar IndexedDB para almacenamiento offline
 */
async function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('SabrofoodDB', 2);
        
        request.onerror = () => {
            console.error('❌ Error abriendo IndexedDB:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            console.log('✅ IndexedDB inicializada');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Tabla para ventas pendientes de sincronizar
            if (!db.objectStoreNames.contains('pendingSales')) {
                const salesStore = db.createObjectStore('pendingSales', { keyPath: 'id', autoIncrement: true });
                salesStore.createIndex('timestamp', 'timestamp', { unique: false });
                salesStore.createIndex('synced', 'synced', { unique: false });
                console.log('📦 Tabla pendingSales creada');
            }
            
            // Tabla para productos en caché (para consulta offline)
            if (!db.objectStoreNames.contains('cachedProducts')) {
                const productsStore = db.createObjectStore('cachedProducts', { keyPath: 'id' });
                productsStore.createIndex('nombre', 'nombre', { unique: false });
                productsStore.createIndex('categoria', 'categoria', { unique: false });
                console.log('📦 Tabla cachedProducts creada');
            }
        };
    });
}

/**
 * Guardar venta en IndexedDB (modo offline)
 */
async function guardarVentaOffline(ventaData) {
    if (!db) {
        await initIndexedDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingSales'], 'readwrite');
        const store = transaction.objectStore('pendingSales');
        
        const ventaOffline = {
            ...ventaData,
            timestamp: Date.now(),
            synced: false,
            offline: true
        };
        
        const request = store.add(ventaOffline);
        
        request.onsuccess = () => {
            console.log('💾 Venta guardada offline:', request.result);
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('❌ Error guardando venta offline:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Obtener ventas pendientes de sincronizar
 */
async function getVentasPendientes() {
    if (!db) {
        await initIndexedDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingSales'], 'readonly');
        const store = transaction.objectStore('pendingSales');
        const index = store.index('synced');
        const request = index.getAll(false); // Solo las no sincronizadas
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Marcar venta como sincronizada
 */
async function marcarVentaSincronizada(ventaId) {
    if (!db) return;
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingSales'], 'readwrite');
        const store = transaction.objectStore('pendingSales');
        const request = store.get(ventaId);
        
        request.onsuccess = () => {
            const venta = request.result;
            if (venta) {
                venta.synced = true;
                venta.syncedAt = Date.now();
                const updateRequest = store.put(venta);
                
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                resolve();
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

/**
 * Guardar productos en caché local
 */
async function guardarProductosEnCache(productos) {
    if (!db) {
        await initIndexedDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cachedProducts'], 'readwrite');
        const store = transaction.objectStore('cachedProducts');
        
        // Limpiar productos viejos
        store.clear();
        
        // Guardar nuevos productos
        productos.forEach(producto => {
            store.put(producto);
        });
        
        transaction.oncomplete = () => {
            console.log('✅ Productos guardados en caché:', productos.length);
            resolve();
        };
        
        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
}

/**
 * Obtener productos desde caché local
 */
async function getProductosDesdeCache() {
    if (!db) {
        await initIndexedDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cachedProducts'], 'readonly');
        const store = transaction.objectStore('cachedProducts');
        const request = store.getAll();
        
        request.onsuccess = () => {
            console.log('📦 Productos cargados desde caché:', request.result.length);
            resolve(request.result);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

// ============================
// DETECTOR DE CONEXIÓN Y SINCRONIZACIÓN
// ============================

/**
 * Sincronizar ventas pendientes con Supabase
 */
async function sincronizarVentasPendientes() {
    if (syncInProgress || !isOnline || !window.supabaseClient) {
        return;
    }
    
    syncInProgress = true;
    
    try {
        const ventasPendientes = await getVentasPendientes();
        
        if (ventasPendientes.length === 0) {
            console.log('✅ No hay ventas pendientes de sincronizar');
            syncInProgress = false;
            return;
        }
        
        console.log(`🔄 Sincronizando ${ventasPendientes.length} ventas pendientes...`);
        mostrarNotificacion(`Sincronizando ${ventasPendientes.length} ventas...`, 'info', 3000);
        
        let sincronizadas = 0;
        let errores = 0;
        
        for (const venta of ventasPendientes) {
            try {
                // Eliminar campos internos antes de enviar
                const ventaData = {
                    vendedor: venta.vendedor,
                    productos: venta.productos,
                    total: venta.total,
                    subtotal: venta.subtotal,
                    descuento: venta.descuento,
                    tipo_descuento: venta.tipo_descuento,
                    valor_descuento: venta.valor_descuento,
                    metodo_pago: venta.metodo_pago,
                    pagos: venta.pagos,
                    fecha: venta.fecha || new Date(venta.timestamp).toISOString()
                };
                
                // Insertar en Supabase
                const { error } = await window.supabaseClient
                    .from('ventas')
                    .insert(ventaData);
                
                if (error) throw error;
                
                // Marcar como sincronizada
                await marcarVentaSincronizada(venta.id);
                sincronizadas++;
                
            } catch (error) {
                console.error('❌ Error sincronizando venta:', error);
                errores++;
            }
        }
        
        console.log(`✅ Sincronización completada: ${sincronizadas} exitosas, ${errores} errores`);
        mostrarNotificacion(`✅ ${sincronizadas} ventas sincronizadas`, 'success');
        
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
    } finally {
        syncInProgress = false;
    }
}

/**
 * Actualizar estado de conexión y UI
 */
async function actualizarEstadoConexion(online) {
    isOnline = online;
    const statusBadge = document.getElementById('connectionStatus');
    
    if (statusBadge) {
        if (online) {
            statusBadge.className = 'connection-badge online';
            statusBadge.innerHTML = `
                <span class="connection-dot"></span>
                <span class="connection-text">Online</span>
            `;
            statusBadge.title = 'Conectado - Sincronización activa';
            
            mostrarNotificacion('✅ Conexión restaurada', 'success');
            
            // Sincronizar ventas pendientes
            setTimeout(async () => {
                const pendientes = await getVentasPendientes();
                if (pendientes.length > 0) {
                    statusBadge.className = 'connection-badge syncing';
                    statusBadge.innerHTML = `
                        <span class="connection-dot"></span>
                        <span class="connection-text">Sincronizando (${pendientes.length})</span>
                    `;
                    
                    await sincronizarVentasPendientes();
                    
                    // Volver a online después de sincronizar
                    statusBadge.className = 'connection-badge online';
                    statusBadge.innerHTML = `
                        <span class="connection-dot"></span>
                        <span class="connection-text">Online</span>
                    `;
                }
            }, 1000);
        } else {
            const pendientes = await getVentasPendientes();
            const count = pendientes.length;
            
            statusBadge.className = 'connection-badge offline';
            statusBadge.innerHTML = `
                <span class="connection-dot"></span>
                <span class="connection-text">Offline${count > 0 ? ` (${count} pendientes)` : ''}</span>
            `;
            statusBadge.title = `Sin conexión${count > 0 ? ` - ${count} ventas pendientes de sincronizar` : ''}`;
            
            mostrarNotificacion('⚠️ Modo Offline - Las ventas se guardarán localmente', 'warning', 5000);
        }
    }
}

/**
 * Inicializar listeners de conexión
 */
function initConnectionListeners() {
    // Detectar cambios de conexión
    window.addEventListener('online', () => {
        console.log('🟢 Conexión disponible');
        actualizarEstadoConexion(true);
    });
    
    window.addEventListener('offline', () => {
        console.log('🔴 Conexión perdida');
        actualizarEstadoConexion(false);
    });
    
    // Estado inicial
    isOnline = navigator.onLine;
    console.log('📡 Estado de conexión inicial:', isOnline ? 'Online' : 'Offline');
}

// ============================
// HELPER FUNCTIONS - COOKIES
// ============================

// Guardar cookie con días de expiración
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    // SameSite=Lax para mejor seguridad
    document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Lax";
}

// Leer cookie
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Eliminar cookie
function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

// ============================
// SISTEMA DE "RECORDAR DISPOSITIVO"
// ============================
// Simplicidad es clave: Solo usa localStorage para guardar sesión
// No requiere fingerprinting ni tabla de sesiones en Supabase
// Expira después de 30 días automáticamente

// Estado global
let currentUser = '';
let currentUserRole = ''; // 'vendedor' o 'encargado'
let currentView = 'pos';
let productos = [];
let carrito = [];
let totalVenta = 0;
let totalSinDescuento = 0; // Total antes de aplicar descuento
let descuentoAplicado = 0; // Monto de descuento aplicado
let tipoDescuento = 'ninguno'; // 'ninguno', 'porcentaje', 'monto'
let valorDescuento = 0; // Valor del descuento (% o $)
let metodoPagoSeleccionado = 'Efectivo';
let pagosRegistrados = [];
let categoriaActual = 'Todos';
let html5QrCode = null;
let productoEditando = null;
let realtimeChannel = null; // Canal de sincronización en tiempo real

// Chart instances
let chartVentasDiarias = null;
let chartMetodosPago = null;
let chartTopProductos = null;

// Sistema de cierre automático
let intervalVerificacionCierre = null;
let recordatorioMostrado = false;
let notificacionTempranaMostrada = false; // Para notificación de 19:30
let notificacionRecordatorio = null;

// ===================================
// FUNCIONES AUXILIARES DE AUTENTICACIÓN
// ===================================

/**
 * Verifica si el usuario está autenticado
 * @returns {boolean} true si hay usuario y rol definidos
 */
function isUserAuthenticated() {
    return !!(currentUser && currentUserRole);
}

/**
 * Verifica si el usuario tiene un rol específico
 * @param {string} requiredRole - 'vendedor' o 'encargado'
 * @returns {boolean} true si el usuario tiene el rol requerido
 */
function hasRole(requiredRole) {
    return isUserAuthenticated() && currentUserRole === requiredRole;
}

/**
 * Requiere autenticación para ejecutar una función
 * Si no está autenticado, muestra error y redirige al login
 * @param {string} funcionNombre - Nombre de la función que requiere auth
 * @returns {boolean} true si está autenticado, false si no
 */
function requireAuthentication(funcionNombre = 'esta acción') {
    if (!isUserAuthenticated()) {
        console.error(`❌ ${funcionNombre} requiere autenticación. Usuario actual:`, currentUser);
        mostrarNotificacion('Debes iniciar sesión para realizar esta acción', 'error');
        mostrarPantallaLogin();
        return false;
    }
    return true;
}

/**
 * Obtiene los datos del usuario actual de forma segura
 * @returns {{username: string, role: string} | null} Datos del usuario o null
 */
function getUserData() {
    if (!isUserAuthenticated()) {
        return null;
    }
    return {
        username: currentUser,
        role: currentUserRole,
        isAdmin: currentUserRole === 'encargado',
        isVendedor: currentUserRole === 'vendedor'
    };
}

/**
 * Valida que el usuario tenga permiso de administrador
 * @param {string} accion - Descripción de la acción que requiere permisos
 * @returns {boolean} true si es encargado, false si no
 */
function requireAdminRole(accion = 'esta acción') {
    if (!requireAuthentication(accion)) {
        return false;
    }
    if (currentUserRole !== 'encargado') {
        console.warn(`⚠️ ${accion} requiere permisos de encargado`);
        mostrarNotificacion('Solo el encargado puede realizar esta acción', 'error');
        return false;
    }
    return true;
}

// ===================================
// 🔄 ACTUALIZACIÓN FORZADA TOTAL
// ===================================

/**
 * 🔄 ACTUALIZACION FORZADA TOTAL
 * Limpia TODOS los cachés y storage, desregistra Service Workers
 * y recarga la app con versión fresca desde el servidor.
 * 
 * Útil cuando:
 * - El usuario reporta que no ve cambios
 * - Hay problemas con caché corrupto
 * - Después de un fix crítico en producción
 */
async function forzarActualizacion() {
    console.log('🔄 [UPDATE] Iniciando actualización forzada...');
    
    const confirmar = confirm(
        '🔄 ACTUALIZACIÓN COMPLETA\n\n' +
        'Esto hará:\n' +
        '• Limpiar TODO el caché\n' +
        '• Desinstalar Service Workers\n' +
        '• Descargar versión más reciente\n\n' +
        '⚠️ Necesitarás volver a iniciar sesión\n\n' +
        '¿Continuar?'
    );
    
    if (!confirmar) {
        console.log('🔄 [UPDATE] Actualización cancelada por el usuario');
        return;
    }

    try {
        console.log('🔄 [UPDATE] PASO 1/5: Desregistrando Service Workers...');
        
        // PASO 1: Desregistrar TODOS los Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            console.log(`🔄 [UPDATE] Encontrados ${registrations.length} Service Workers`);
            
            for (let registration of registrations) {
                const success = await registration.unregister();
                console.log(`🔄 [UPDATE] SW desregistrado:`, registration.scope, success ? '✅' : '❌');
            }
        }

        console.log('🔄 [UPDATE] PASO 2/5: Limpiando cachés...');
        
        // PASO 2: Limpiar TODOS los cachés
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            console.log(`🔄 [UPDATE] Encontrados ${cacheNames.length} cachés`);
            
            await Promise.all(
                cacheNames.map(cacheName => {
                    console.log('🔄 [UPDATE] Eliminando caché:', cacheName);
                    return caches.delete(cacheName);
                })
            );
            console.log('🔄 [UPDATE] ✅ Todos los cachés eliminados');
        }

        console.log('🔄 [UPDATE] PASO 3/5: Limpiando localStorage...');
        
        // PASO 3: Limpiar localStorage (con protección iOS)
        try {
            localStorage.clear();
            console.log('🔄 [UPDATE] ✅ localStorage limpiado');
        } catch (e) {
            console.warn('🔄 [UPDATE] ⚠️ No se pudo limpiar localStorage:', e);
        }

        console.log('🔄 [UPDATE] PASO 4/5: Limpiando sessionStorage...');
        
        // PASO 4: Limpiar sessionStorage
        try {
            sessionStorage.clear();
            console.log('🔄 [UPDATE] ✅ sessionStorage limpiado');
        } catch (e) {
            console.warn('🔄 [UPDATE] ⚠️ No se pudo limpiar sessionStorage:', e);
        }

        console.log('🔄 [UPDATE] PASO 5/5: Recargando con versión fresca...');
        
        // PASO 5: Recargar con timestamp único para evitar CUALQUIER caché
        const timestamp = Date.now();
        const currentUrl = window.location;
        const reloadUrl = `${currentUrl.origin}${currentUrl.pathname}?force_update=${timestamp}`;
        
        console.log('🔄 [UPDATE] 🚀 Recargando:', reloadUrl);
        
        // Dar tiempo para que los logs se escriban
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Recargar
        window.location.href = reloadUrl;
        
    } catch (error) {
        console.error('🔄 [UPDATE] ❌ Error durante actualización forzada:', error);
        alert(
            '❌ Error al actualizar\n\n' +
            'Por favor, cierra completamente la app e intenta de nuevo.\n\n' +
            'En iOS: Desliza hacia arriba para cerrar\n' +
            'En Android: Cierra desde el gestor de apps'
        );
    }
}

// Verificar si hay nueva versión disponible
function verificarVersion() {
    const versionGuardada = localStorage.getItem('app_version');

    if (versionGuardada && versionGuardada !== APP_VERSION) {
        // Mostrar notificación de actualización
        if (confirm('¡Hay una nueva versión disponible! ¿Deseas actualizar ahora?')) {
            forzarActualizacion();
        }
    }

    localStorage.setItem('app_version', APP_VERSION);
}

// ===================================
// 🚀 INICIALIZACIÓN DE LA APLICACIÓN
// ===================================

// Ejecutar inmediatamente si el DOM ya está listo, o esperar al evento
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarApp);
} else {
    // DOM ya está listo
    inicializarApp();
}

/**
 * 🚀 Función principal de inicialización
 * IMPORTANTE: Debe esperar a que initApp() termine (es async)
 */
async function inicializarApp() {
    console.log('🚀 [INIT] Iniciando aplicación Sabrofood...');
    
    try {
        // PASO 1: Inicializar app y verificar sesión (esperar a que termine)
        await initApp();
        console.log('🚀 [INIT] ✅ App inicializada');
        
        // PASO 2: Verificar si hay nueva versión disponible
        verificarVersion();
        console.log('🚀 [INIT] ✅ Inicialización completa');
        
    } catch (error) {
        console.error('🚀 [INIT] ❌ Error en inicialización:', error);
        // Mostrar pantalla de login aunque falle
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
}

async function initApp() {
    console.log('🚀 Iniciando aplicación...');
    console.log('📱 Dispositivo:', navigator.userAgent);
    console.log('🌐 Modo Standalone:', window.navigator.standalone ? 'Sí (iOS)' : 'No');
    
    // PROTECCIÓN CONTRA BUCLE INFINITO EN iOS
    try {
        const loopCounter = sessionStorage.getItem('init_loop_counter') || '0';
        const counter = parseInt(loopCounter);
        
        if (counter > 3) {
            console.error('❌ Detectado bucle infinito. Limpiando datos...');
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch (e) {
                console.error('No se pudo limpiar storage:', e);
            }
            sessionStorage.setItem('init_loop_counter', '0');
        } else {
            sessionStorage.setItem('init_loop_counter', String(counter + 1));
        }
    } catch (e) {
        console.warn('⚠️ SessionStorage no disponible:', e);
    }
    
    // Esperar a que Supabase esté disponible (máximo 5 segundos)
    let intentos = 0;
    while (!window.supabaseClient && intentos < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }
    
    if (!window.supabaseClient) {
        console.error('❌ Error: Supabase no disponible');
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        sessionStorage.setItem('init_loop_counter', '0'); // Reset counter
        return;
    }
    
    // Verificar si hay sesión guardada (con manejo de errores iOS)
    let sesionRestaurada = false;
    try {
        sesionRestaurada = await verificarSesionGuardada();
    } catch (error) {
        console.error('❌ Error al verificar sesión guardada:', error);
        // Limpiar localStorage si hay error
        try {
            localStorage.removeItem('sabrofood_remember');
        } catch (e) {
            console.error('No se pudo limpiar localStorage:', e);
        }
    }

    if (sesionRestaurada) {
        console.log('✅ Sesión restaurada');
        sessionStorage.setItem('init_loop_counter', '0'); // Reset counter
        return;
    }
    
    // Limpiar sesión antigua si existe
    try {
        localStorage.removeItem('sabrofood_user');
    } catch (e) {
        console.warn('⚠️ No se pudo limpiar sabrofood_user:', e);
    }

    // Mostrar pantalla de login
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    sessionStorage.setItem('init_loop_counter', '0'); // Reset counter
}

// ===================================
// SISTEMA DE SINCRONIZACIÓN REALTIME
// ===================================

/**
 * Inicializar suscripción a cambios en tiempo real
 */
function inicializarRealtime() {
    if (!window.supabaseClient) {
        console.warn('⚠️ Supabase no disponible, Realtime deshabilitado');
        return;
    }

    console.log('🔴 Iniciando suscripción Realtime...');

    // Crear canal para escuchar cambios en productos
    realtimeChannel = window.supabaseClient
        .channel('productos-changes')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'productos'
            },
            (payload) => {
                actualizarProductoEnTiempoReal(payload.new);
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'productos'
            },
            (payload) => {
                // Producto nuevo creado
                console.log('✨ Nuevo producto detectado:', payload.new.nombre);
                recargarVistaInventarioSiActiva();
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'productos'
            },
            (payload) => {
                // Producto eliminado
                console.log('🗑️ Producto eliminado detectado');
                recargarVistaInventarioSiActiva();
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                // Espaciar notificación de Realtime (1.5 segundos después de login)
                setTimeout(() => {
                    mostrarNotificacion('Sistema en tiempo real activado', 'success');
                }, 1500);
            }
        });
}

// Debounce para recargas de inventario (evitar múltiples recargas seguidas)
let timeoutRecargaInventario = null;

/**
 * Recargar vista de inventario si está activa
 */
function recargarVistaInventarioSiActiva() {
    // Verificar si estamos en la pestaña de inventario
    const inventarioSection = document.getElementById('inventario');
    if (inventarioSection && inventarioSection.style.display !== 'none') {
        // Cancelar recarga anterior si existe
        if (timeoutRecargaInventario) {
            clearTimeout(timeoutRecargaInventario);
        }
        
        // Esperar 500ms antes de recargar (por si hay múltiples cambios)
        timeoutRecargaInventario = setTimeout(() => {
            console.log('🔄 Recargando inventario...');
            // Recargar productos y actualizar inventario
            cargarProductos().then(() => {
                cargarInventario();
            });
            timeoutRecargaInventario = null;
        }, 500);
    }
}

/**
 * Actualizar producto en el DOM sin recargar página
 */
function actualizarProductoEnTiempoReal(productoActualizado) {
    // Actualizar en el array local
    const index = productos.findIndex(p => p.id === productoActualizado.id);
    if (index !== -1) {
        productos[index] = productoActualizado;
    }

    // Si estamos en inventario, recargar la tabla
    recargarVistaInventarioSiActiva();

    // Actualizar visualmente en la grilla de productos (Punto de Venta)
    const productCard = document.querySelector(`[data-producto-id="${productoActualizado.id}"]`);
    if (productCard) {
        const stockElement = productCard.querySelector('.product-stock');
        const stock = productoActualizado.stock || 0;

        // Si por cambios de plantilla no existe el nodo de stock, evitar error en tiempo real
        if (!stockElement) {
            console.warn('⚠️ product-stock no encontrado para producto:', productoActualizado.id);
            actualizarStockEnCarrito(productoActualizado);
            return;
        }

        // Actualizar número de stock
        if (stock === 0) {
            stockElement.textContent = 'Sin stock';
            stockElement.className = 'product-stock stock-out';
            productCard.style.opacity = '0.6';
            productCard.style.cursor = 'not-allowed';
            productCard.onclick = null;
        } else if (stock <= (productoActualizado.stock_minimo || 5)) {
            stockElement.textContent = Math.floor(stock);
            stockElement.className = 'product-stock stock-low';
        } else {
            stockElement.textContent = Math.floor(stock);
            stockElement.className = 'product-stock stock-ok';
        }

        // Animación de actualización
        productCard.style.animation = 'pulse 0.5s ease-in-out';
        setTimeout(() => {
            productCard.style.animation = '';
        }, 500);
    }

    // Actualizar productos en carrito si están afectados
    actualizarStockEnCarrito(productoActualizado);
}

/**
 * Actualizar stock disponible en items del carrito
 */
function actualizarStockEnCarrito(productoActualizado) {
    const itemEnCarrito = carrito.find(item => item.id === productoActualizado.id);

    if (itemEnCarrito) {
        itemEnCarrito.stock = productoActualizado.stock;

        // Si la cantidad en carrito supera el stock disponible
        if (itemEnCarrito.cantidad > productoActualizado.stock) {
            mostrarNotificacion(
                `⚠️ Stock actualizado: ${productoActualizado.nombre} ahora tiene ${productoActualizado.stock} unidades`,
                'warning'
            );
        }

        renderCarrito();
    }
}

/**
 * Validación final de stock antes de cobrar
 * MODIFICADO: Permite ventas con stock negativo (solo advierte)
 */
async function validarStockAntesDeVenta() {
    if (!window.supabaseClient) return true;

    try {
        // Filtrar solo productos normales (no granel) para validar stock
        const productosNormales = carrito.filter(item => !item.esGranel);
        
        if (productosNormales.length === 0) {
            // Solo hay productos de granel, no validar stock
            return true;
        }

        // Obtener IDs de productos normales en carrito
        const productosIds = productosNormales.map(item => item.id);

        // Consultar stock actual en DB
        const { data: productosActuales, error } = await window.supabaseClient
            .from('productos')
            .select('id, nombre, stock')
            .in('id', productosIds);

        if (error) throw error;

        // Verificar cada producto normal y advertir si hay stock insuficiente
        let hayProductosSinStock = false;
        for (const item of productosNormales) {
            const productoActual = productosActuales.find(p => p.id === item.id);

            if (!productoActual) {
                mostrarNotificacion(`❌ Producto "${item.nombre}" no encontrado`, 'error');
                return false;
            }

            // Solo advertir, pero PERMITIR la venta con stock negativo
            if (productoActual.stock < item.cantidad) {
                hayProductosSinStock = true;
                console.warn(
                    `⚠️ Stock insuficiente: "${productoActual.nombre}" - ` +
                    `Disponible: ${productoActual.stock} | En carrito: ${item.cantidad} | ` +
                    `Stock quedará en: ${productoActual.stock - item.cantidad}`
                );
                
                // Actualizar stock real en el item para cálculo correcto
                item.stock = productoActual.stock;
            }
        }

        // Notificar al usuario si hay productos sin stock suficiente
        if (hayProductosSinStock) {
            mostrarNotificacion('⚠️ Algunos productos quedarán con stock negativo', 'warning');
        }

        return true; // SIEMPRE permitir la venta

    } catch (error) {
        manejarError(error, {
            contexto: 'Validar stock',
            mensajeUsuario: 'Error verificando disponibilidad de productos',
            esErrorCritico: false
        });
        return false;
    }
}

/**
 * Desconectar Realtime al cerrar sesión
 */
function desconectarRealtime() {
    if (realtimeChannel) {
        window.supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
}

// ===================================
// AUTENTICACIÓN
// ===================================

function toggleLoginPasswordVisibility() {
    const passwordInput = document.getElementById('loginPassword');
    const toggleBtn = document.getElementById('toggleLoginPasswordBtn');

    if (!passwordInput || !toggleBtn) return;

    const showingPassword = passwordInput.type === 'text';
    passwordInput.type = showingPassword ? 'password' : 'text';

    toggleBtn.textContent = showingPassword ? 'Mostrar' : 'Ocultar';
    toggleBtn.setAttribute(
        'aria-label',
        showingPassword ? 'Mostrar contraseña' : 'Ocultar contraseña'
    );

    passwordInput.focus();
}

/**
 * Validar credenciales del usuario
 * @param {string} username - Nombre de usuario
 * @param {string} password - Contraseña
 * @returns {Promise<Object|null>} Datos del usuario o null si falla
 */
async function validarCredenciales(username, password) {
    if (!username) {
        mostrarNotificacion('Por favor selecciona un vendedor', 'error');
        return null;
    }

    if (!password) {
        mostrarNotificacion('Por favor ingresa tu contraseña', 'error');
        return null;
    }

    const { data, error } = await window.supabaseClient.rpc('validar_login', {
        p_username: username,
        p_password: password
    });

    if (error) throw error;

    if (!data || data.length === 0) {
        mostrarNotificacion('Usuario o contraseña incorrectos', 'error');
        return null;
    }

    const userData = data[0];

    if (!userData.activo) {
        mostrarNotificacion('Usuario inactivo. Contacta al administrador', 'error');
        return null;
    }

    return userData;
}

/**
 * 🆕 SISTEMA SIMPLE: Guardar sesión en localStorage
 * @param {boolean} rememberDevice - Si debe recordar dispositivo
 * @param {string} username - Nombre de usuario
 * @param {string} role - Rol del usuario
 * CON PROTECCIÓN iOS
 */
function guardarSesionSiRecordado(rememberDevice, username, role) {
    try {
        if (!rememberDevice) {
            try {
                localStorage.removeItem('sabrofood_remember');
            } catch (e) {
                console.warn('⚠️ No se pudo eliminar sesión:', e);
            }
            return;
        }

        // Guardar en localStorage (persiste entre recargas)
        const sessionData = {
            username: username,
            role: role,
            timestamp: Date.now(),
            expires: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 días
        };
        
        try {
            localStorage.setItem('sabrofood_remember', JSON.stringify(sessionData));
            console.log('✅ Sesión guardada para:', username);
        } catch (e) {
            console.error('❌ Error al guardar sesión (común en iOS):', e);
            console.warn('⚠️ La sesión no se recordará. Deberás iniciar sesión cada vez.');
            // No es error crítico, continuar sin recordar
        }
    } catch (error) {
        console.error('❌ Error crítico en guardarSesionSiRecordado:', error);
        // No lanzar error, solo loguear
    }
}

/**
 * Actualizar UI con datos del usuario autenticado
 * @param {string} username - Nombre de usuario
 */
function actualizarUIUsuario(username) {
    document.getElementById('sidebarUsername').textContent = username;
    document.getElementById('topUsername').textContent = username;
    
    const topUsernameAsistencia = document.getElementById('topUsernameAsistencia');
    if (topUsernameAsistencia) {
        topUsernameAsistencia.textContent = username;
    }
}

/**
 * Iniciar sesión y cargar aplicación
 */
async function iniciarSesionYCargarApp() {
    // Ocultar login y mostrar app
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'grid';

    // Ir al POS
    cambiarVista('pos');

    // Cargar datos
    cargarProductos();
    inicializarRealtime();
    await inicializarProveedores();
    inicializarCategorias();
    inicializarMarcas();
    
    // ⚡ CRÍTICO: Configurar event listeners del buscador DESPUÉS de cargar la app
    configurarEventListenersBuscador();
    
    // Inicializar sistema de cierre automático
    inicializarSistemaCierreAutomatico();
    verificarCierresAutomaticosPendientes();
    recuperarCierresPerdidos(); // NUEVO: Recuperar cierres que fallaron
    
    // Notificaciones
    mostrarNotificacion(`Bienvenido, ${currentUser}`, 'success');
    
    setTimeout(() => {
        mostrarNotificacion('📋 Recuerda marcar tu entrada en la pestaña Asistencia', 'info', 6000, true);
    }, 4000);
}

/**
 * Resetear botón de login a estado original
 * @param {HTMLElement} loginBtn - Botón de login
 */
function resetearBotonLogin(loginBtn) {
    loginBtn.disabled = false;
    loginBtn.innerHTML = `
        <span>Iniciar Sesión</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const rememberDevice = document.getElementById('rememberDevice').checked;

    // Deshabilitar botón durante validación
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span>Validando...</span>';

    try {
        // 1. Validar credenciales
        const userData = await validarCredenciales(username, password);
        
        if (!userData) {
            resetearBotonLogin(loginBtn);
            return;
        }

        // 2. Login exitoso
        currentUser = userData.username;
        currentUserRole = userData.role;

        // 3. Guardar sesión si está marcado "Recordar" (SISTEMA SIMPLE)
        guardarSesionSiRecordado(rememberDevice, currentUser, currentUserRole);

        // 4. Aplicar permisos y actualizar UI
        aplicarPermisosRol();
        actualizarUIUsuario(currentUser);

        // 5. Cargar aplicación
        await iniciarSesionYCargarApp();

    } catch (error) {
        manejarError(error, {
            contexto: 'Login',
            mensajeUsuario: 'Error al validar credenciales. Verifica tu conexión.',
            esErrorCritico: false,
            callback: () => resetearBotonLogin(loginBtn)
        });
    }
}

// Función auxiliar para aplicar permisos según rol
function aplicarPermisosRol() {
    // Validar que haya usuario autenticado
    if (!isUserAuthenticated()) {
        console.warn('⚠️ Intentando aplicar permisos sin usuario autenticado');
        return;
    }

    const esAdmin = currentUserRole === 'encargado';

    // Agregar data-attribute al body para CSS responsive
    document.body.setAttribute('data-user-role', currentUserRole);

    // Botón Asignar Códigos
    document.getElementById('btnAsignarCodigos').style.display = esAdmin ? 'flex' : 'none';
    document.getElementById('btnAsignarCodigosBottom').style.display = esAdmin ? 'flex' : 'none';

    // Botón Caja y Gastos
    document.getElementById('btnCajaGastos').style.display = esAdmin ? 'flex' : 'none';
    const btnCajaBottom = document.getElementById('btnCajaGastosBottom');
    if (btnCajaBottom) btnCajaBottom.style.display = esAdmin ? 'flex' : 'none';

    // Botón Admin Precios en Inventario
    const btnPreciosInventario = document.getElementById('btnAdminPreciosInventario');
    if (btnPreciosInventario) btnPreciosInventario.style.display = esAdmin ? 'inline-flex' : 'none';

    // Botón Crear Producto en Inventario
    const btnCrearProducto = document.getElementById('btnCrearProducto');
    if (btnCrearProducto) btnCrearProducto.style.display = esAdmin ? 'inline-flex' : 'none';

    // Botón Gestionar Proveedores en Inventario
    const btnGestionarProveedores = document.getElementById('btnGestionarProveedores');
    if (btnGestionarProveedores) btnGestionarProveedores.style.display = esAdmin ? 'inline-flex' : 'none';

    // Botón Gestionar Categorías en Inventario
    const btnGestionarCategorias = document.getElementById('btnGestionarCategorias');
    if (btnGestionarCategorias) btnGestionarCategorias.style.display = esAdmin ? 'inline-flex' : 'none';

    // Botón Gestionar Marcas en Inventario
    const btnGestionarMarcas = document.getElementById('btnGestionarMarcas');
    if (btnGestionarMarcas) btnGestionarMarcas.style.display = esAdmin ? 'inline-flex' : 'none';

    // Botón Registrar Merma en Inventario
    const btnRegistrarMerma = document.getElementById('btnRegistrarMerma');
    if (btnRegistrarMerma) btnRegistrarMerma.style.display = esAdmin ? 'inline-flex' : 'none';

    // Botón Importar Stock desde WhatsApp en Inventario
    const btnImportarStock = document.getElementById('btnImportarStock');
    if (btnImportarStock) btnImportarStock.style.display = esAdmin ? 'block' : 'none';

    // Ranking de vendedores
    const rankingVendedores = document.getElementById('rankingVendedores');
    if (rankingVendedores) rankingVendedores.style.display = esAdmin ? 'block' : 'none';

    // Filtros de asistencia (solo admin)
    const filtrosAsistencia = document.getElementById('filtrosAsistencia');
    if (filtrosAsistencia) filtrosAsistencia.style.display = esAdmin ? 'block' : 'none';

    // Columna de acciones en tabla de asistencia (solo admin)
    const thAcciones = document.getElementById('thAcciones');
    if (thAcciones) thAcciones.style.display = esAdmin ? 'table-cell' : 'none';
}

/**
 * 🚪 CERRAR SESIÓN
 * Limpia TODOS los datos y previene bucle de auto-login
 * Protegido contra errores de iOS localStorage
 */
async function handleLogout() {
    console.log('🚪 [LOGOUT] Iniciando cierre de sesión...');
    
    // Advertir si hay productos en carrito
    if (carrito.length > 0) {
        if (!confirm('Tienes productos en el carrito. ¿Deseas cerrar sesión de todas formas?')) {
            console.log('🚪 [LOGOUT] Cancelado por el usuario');
            return;
        }
    }

    try {
        // Desconectar Realtime
        console.log('🚪 [LOGOUT] Desconectando Realtime...');
        desconectarRealtime();

        // Limpiar variables en memoria
        console.log('🚪 [LOGOUT] Limpiando variables...');
        currentUser = '';
        currentUserRole = '';
        carrito = [];
        productos = [];

        // ⚠️ CRÍTICO: Setear flag ANTES de limpiar storage
        // Esto previene que verificarSesionGuardada() restaure la sesión
        console.log('🚪 [LOGOUT] Seteando flag de prevención...');
        try {
            sessionStorage.setItem('logout_in_progress', 'true');
            sessionStorage.setItem('prevent_auto_login', 'true');
            sessionStorage.setItem('init_loop_counter', '0'); // Reset contador
        } catch (e) {
            console.warn('🚪 [LOGOUT] ⚠️ No se pudo setear flags:', e);
        }

        // Intentar limpiar localStorage con múltiples reintentos (iOS puede fallar)
        console.log('🚪 [LOGOUT] Limpiando localStorage...');
        const storageCleared = await limpiarStorageConReintentos(3);
        
        if (!storageCleared) {
            console.error('🚪 [LOGOUT] ❌ No se pudo limpiar localStorage después de 3 intentos');
            
            // Opción de emergencia: reinstalar PWA
            const reinstalar = confirm(
                '⚠️ No se pudo cerrar sesión correctamente\n\n' +
                'Esto puede deberse a restricciones de iOS.\n\n' +
                'Soluciones:\n' +
                '1. Borra el caché de Safari\n' +
                '2. Reinstala la app desde Safari\n\n' +
                '¿Deseas intentar una actualización forzada?'
            );
            
            if (reinstalar) {
                await forzarActualizacion();
            }
            return;
        }

        console.log('🚪 [LOGOUT] ✅ Sesión limpiada correctamente');
        
        // Recargar página (el flag prevent_auto_login evitará auto-login)
        console.log('🚪 [LOGOUT] Recargando página...');
        window.location.reload();
        
    } catch (error) {
        console.error('🚪 [LOGOUT] ❌ Error durante logout:', error);
        
        // Intentar forzar recarga de todas formas
        try {
            sessionStorage.setItem('prevent_auto_login', 'true');
        } catch (e) {}
        
        window.location.reload();
    }
}

/**
 * 🔄 Intentar limpiar localStorage con reintentos
 * iOS a veces falla en limpiar storage, especialmente en modo standalone
 * 
 * @param {number} maxIntentos - Número máximo de intentos
 * @returns {Promise<boolean>} - true si se limpió exitosamente
 */
async function limpiarStorageConReintentos(maxIntentos = 3) {
    for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
            console.log(`🔄 [STORAGE] Intento ${intento}/${maxIntentos} de limpiar storage...`);
            
            // Intentar remover claves específicas primero
            localStorage.removeItem('sabrofood_remember');
            localStorage.removeItem('sabrofood_user');
            localStorage.removeItem('app_version');
            
            // Verificar que se hayan eliminado
            const checkRemember = localStorage.getItem('sabrofood_remember');
            const checkUser = localStorage.getItem('sabrofood_user');
            
            if (!checkRemember && !checkUser) {
                console.log(`🔄 [STORAGE] ✅ Storage limpiado en intento ${intento}`);
                return true;
            } else {
                console.warn(`🔄 [STORAGE] ⚠️ Storage no se limpió completamente, reintentando...`);
            }
            
        } catch (e) {
            console.warn(`🔄 [STORAGE] ⚠️ Error en intento ${intento}:`, e);
        }
        
        // Esperar antes del siguiente intento
        if (intento < maxIntentos) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    // Si llegamos aquí, no se pudo limpiar
    console.error('🔄 [STORAGE] ❌ No se pudo limpiar storage después de todos los intentos');
    return false;
}

/**
 * 🆕 SISTEMA SIMPLE: Verifica si hay sesión guardada en localStorage
 * Sin dependencia de tabla sessions ni fingerprinting
 * CON PROTECCIÓN iOS + PREVENCIÓN DE BUCLE EN LOGOUT
 */
async function verificarSesionGuardada() {
    try {
        // ⚠️ CRÍTICO: Verificar flag de prevención PRIMERO
        // Si el usuario hizo logout, NO restaurar sesión automáticamente
        try {
            const preventLogin = sessionStorage.getItem('prevent_auto_login');
            const logoutInProgress = sessionStorage.getItem('logout_in_progress');
            
            if (preventLogin === 'true' || logoutInProgress === 'true') {
                console.log('🔒 [SESSION] Auto-login bloqueado (logout reciente)');
                // Limpiar flags después de verificar
                sessionStorage.removeItem('prevent_auto_login');
                sessionStorage.removeItem('logout_in_progress');
                return false;
            }
        } catch (e) {
            console.warn('⚠️ [SESSION] No se pudo verificar flags:', e);
        }
        
        if (!window.supabaseClient) {
            console.warn('⚠️ [SESSION] Supabase no disponible');
            return false;
        }
        
        // Buscar sesión guardada en localStorage (con protección iOS)
        console.log('🔍 [SESSION] Buscando sesión guardada...');
        let savedSession = null;
        
        try {
            const savedData = localStorage.getItem('sabrofood_remember');
            if (savedData) {
                savedSession = JSON.parse(savedData);
                console.log('📦 [SESSION] Sesión encontrada:', savedSession.username);
            }
        } catch (storageError) {
            console.error('❌ [SESSION] Error al leer localStorage (común en iOS standalone):', storageError);
            // Intentar limpiar localStorage corrupto
            try {
                localStorage.removeItem('sabrofood_remember');
                console.log('🗑️ [SESSION] localStorage corrupto limpiado');
            } catch (e) {
                console.error('❌ [SESSION] No se pudo limpiar localStorage:', e);
            }
            return false;
        }
        
        if (!savedSession) {
            console.log('ℹ️ [SESSION] No hay sesión guardada');
            return false;
        }
        
        // Verificar expiración (30 días)
        if (Date.now() > savedSession.expires) {
            console.log('⏰ [SESSION] Sesión expirada');
            try {
                localStorage.removeItem('sabrofood_remember');
            } catch (e) {
                console.error('❌ [SESSION] No se pudo eliminar sesión expirada:', e);
            }
            return false;
        }
        
        // Verificar que el usuario aún existe y está activo en Supabase
        console.log('🔍 [SESSION] Verificando usuario en BD:', savedSession.username);
        const { data, error } = await window.supabaseClient
            .from('usuarios')
            .select('username, role, activo')
            .eq('username', savedSession.username)
            .single();

        if (error || !data || !data.activo) {
            console.log('❌ [SESSION] Usuario no válido o inactivo');
            try {
                localStorage.removeItem('sabrofood_remember');
            } catch (e) {
                console.error('❌ [SESSION] No se pudo eliminar sesión inválida:', e);
            }
            return false;
        }

        // ✅ Sesión válida - Restaurar automáticamente
        console.log('✅ [SESSION] Restaurando sesión:', data.username, `(${data.role})`);
        currentUser = data.username;
        currentUserRole = data.role;

        // Aplicar permisos y actualizar UI
        aplicarPermisosRol();
        actualizarUIUsuario(currentUser);

        // Cargar aplicación completa
        await iniciarSesionYCargarApp();

        return true;

    } catch (error) {
        console.error('❌ [SESSION] Error crítico al verificar sesión:', error);
        try {
            localStorage.removeItem('sabrofood_remember');
        } catch (e) {
            console.error('No se pudo limpiar después del error:', e);
        }
        return false;
    }
}

// ===================================
// NAVEGACIÓN
// ===================================

function cambiarVista(vista) {
    currentView = vista;

    // Ocultar todas las vistas
    document.querySelectorAll('.view-container').forEach(v => {
        v.style.display = 'none';
    });

    // Mostrar vista seleccionada
    const viewMap = {
        'pos': 'posView',
        'inventory': 'inventoryView',
        'sales': 'salesView',
        'asignar': 'asignarView',
        'asistencia': 'asistenciaView',
        'caja': 'cajaView',
        'bodega': 'bodegaView'
    };

    const viewId = viewMap[vista];
    if (viewId) {
        document.getElementById(viewId).style.display = 'block';
    }

    // Actualizar nav items (sidebar y bottom nav)
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === vista) {
            item.classList.add('active');
        }
    });

    // Cargar datos según la vista
    if (vista === 'inventory') {
        // Marcar filtro "todos" como activo por defecto
        setTimeout(() => {
            document.querySelectorAll('.stat-card-clickable').forEach(card => {
                card.classList.remove('stat-card-active');
            });
            document.querySelector('[data-filtro="todos"]')?.classList.add('stat-card-active');
        }, 100);
        cargarInventario();
    } else if (vista === 'sales') {
        cargarVentas();
        if (currentUserRole === 'encargado') {
            cargarHistorialDevoluciones(); // Solo encargado puede ver historial de devoluciones
        }
    } else if (vista === 'pos') {
        // Auto-focus en el campo de escáner
        setTimeout(() => {
            const inputCodigo = document.getElementById('inputCodigoBarras');
            if (inputCodigo) {
                inputCodigo.focus();
            }
        }, 100);
    } else if (vista === 'asignar') {
        cargarProductosSinCodigo();
    } else if (vista === 'asistencia') {
        cargarEstadoActual();
        cargarAsistencias();
        // Si es admin, cargar lista de vendedores para el filtro y panel de control
        if (currentUserRole === 'encargado') {
            cargarVendedoresParaFiltro();
            // Mostrar y cargar panel de control de admin
            const panelAdmin = document.getElementById('panelControlAdmin');
            if (panelAdmin) {
                panelAdmin.style.display = 'block';
                cargarUsuariosParaAdmin();
            }
        } else {
            // Ocultar panel de control si es vendedor
            const panelAdmin = document.getElementById('panelControlAdmin');
            if (panelAdmin) {
                panelAdmin.style.display = 'none';
            }
        }
        // Establecer fecha de hoy por defecto
        const hoy = new Date().toISOString().split('T')[0];
        if (document.getElementById('filtroFecha')) {
            document.getElementById('filtroFecha').value = hoy;
        }
    } else if (vista === 'caja') {
        cargarDatosCaja();
    } else if (vista === 'bodega') {
        // Inicializar módulo de bodega
        if (typeof cargarSolicitudesReposicion === 'function') {
            cargarSolicitudesReposicion();
        }
        if (typeof cargarStockBodega === 'function') {
            cargarStockBodega();
        }
        if (typeof cargarHistorialSacos === 'function') {
            cargarHistorialSacos();
        }
        if (typeof inicializarRealtimeBodega === 'function') {
            inicializarRealtimeBodega();
        }
    }

    // Mostrar/ocultar botón flotante del carrito en móvil
    mostrarBotonCarritoMobile();
}

// ===================================
// CARGA DE DATOS
// ===================================

async function cargarProductos() {
    try {
        // Si no hay Supabase configurado, usar mock
        if (!window.supabaseClient) {
            console.error('❌ Supabase no está configurado');
            mostrarNotificacion('Error: Supabase no conectado', 'error');
            console.warn('⚠️ Usando productos MOCK de prueba');
            mostrarProductosMock();
            return;
        }

        // Si estamos offline, cargar desde caché
        if (!isOnline) {
            console.log('📡 Modo Offline: Cargando productos desde caché local...');
            const productosCacheados = await getProductosDesdeCache();
            
            if (productosCacheados && productosCacheados.length > 0) {
                productos = productosCacheados;
                mostrarNotificacion(`📦 ${productos.length} productos cargados (Modo Offline)`, 'info', 3000);
                renderProductos();
                return;
            } else {
                mostrarNotificacion('⚠️ No hay productos en caché. Conéctate a internet.', 'warning');
                productos = [];
                renderProductos();
                return;
            }
        }

        // Modo Online: Cargar desde Supabase
        console.log('🌐 Cargando productos desde Supabase...');
        let todosLosProductos = [];
        let offset = 0;
        const pageSize = 1000;
        let hayMasProductos = true;

        while (hayMasProductos) {
            const { data, error } = await window.supabaseClient
                .from('productos')
                .select('*')
                .order('nombre', { ascending: true})
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error('Error Supabase:', error.message);
                
                // Si falla, intentar cargar desde caché
                const productosCacheados = await getProductosDesdeCache();
                if (productosCacheados && productosCacheados.length > 0) {
                    productos = productosCacheados;
                    mostrarNotificacion(`⚠️ Error de conexión. Usando ${productos.length} productos en caché`, 'warning');
                    renderProductos();
                    return;
                }
                
                mostrarNotificacion('Error al cargar productos: ' + error.message, 'error');
                mostrarProductosMock();
                return;
            }

            if (!data || data.length === 0) {
                hayMasProductos = false;
            } else {
                todosLosProductos = todosLosProductos.concat(data);
                
                if (data.length < pageSize) {
                    hayMasProductos = false;
                }
                offset += pageSize;
            }
        }

        const data = todosLosProductos;

        if (!data || data.length === 0) {
            mostrarNotificacion('No hay productos activos', 'warning');
            productos = [];
            renderProductos();
            return;
        }

        productos = data;
        
        // Guardar en caché para uso offline
        await guardarProductosEnCache(productos);
        
        // Espaciar notificación de productos cargados (2.5 segundos después de login)
        setTimeout(() => {
            mostrarNotificacion(`${productos.length} productos cargados`, 'success');
        }, 2500);
        renderProductos();

    } catch (error) {
        console.error('Error cargando productos:', error);
        
        // Intentar cargar desde caché como último recurso
        try {
            const productosCacheados = await getProductosDesdeCache();
            if (productosCacheados && productosCacheados.length > 0) {
                productos = productosCacheados;
                mostrarNotificacion(`⚠️ Usando ${productos.length} productos en caché`, 'warning');
                renderProductos();
                return;
            }
        } catch (cacheError) {
            console.error('Error cargando desde caché:', cacheError);
        }
        
        manejarError(error, {
            contexto: 'Cargar productos',
            mensajeUsuario: 'Error al cargar productos desde la base de datos',
            esErrorCritico: true,
            callback: () => mostrarProductosMock()
        });
    }
}

function mostrarProductosMock() {
    productos = [
        { id: 1, nombre: 'Pro Plan Adult 15kg', categoria: 'Adulto', precio: 54990, stock: 12, stock_minimo: 5, tipo: 'saco', peso_saco: '15kg' },
        { id: 2, nombre: 'Royal Canin Puppy 13kg', categoria: 'Cachorro', precio: 62990, stock: 8, stock_minimo: 5, tipo: 'saco', peso_saco: '13kg' },
        { id: 3, nombre: 'Whiskas Adult 10kg', categoria: 'Gato Adulto', precio: 38990, stock: 15, stock_minimo: 5, tipo: 'saco', peso_saco: '10kg' },
        { id: 4, nombre: 'Arena Gato Premium 10L', categoria: 'Arena', precio: 15990, stock: 20, stock_minimo: 8, tipo: 'unidad' },
        { id: 5, nombre: 'Shampoo Antipulgas 500ml', categoria: 'Farmacia', precio: 12990, stock: 25, stock_minimo: 10, tipo: 'unidad' },
        { id: 6, nombre: 'Snacks Dentales x12', categoria: 'Snacks', precio: 9990, stock: 30, stock_minimo: 15, tipo: 'unidad' }
    ];
    renderProductos();
}

// ===================================
// RENDER POS
// ===================================

function renderProductos() {
    const grid = document.getElementById('productosGrid');
    if (!grid) {
        console.error('❌ [RENDER] productosGrid no encontrado');
        return;
    }

    // Verificar que hay productos cargados
    if (!productos || productos.length === 0) {
        console.warn('⚠️ [RENDER] Array de productos vacío');
        grid.innerHTML = `
            <div class="loading-state" style="grid-column: 1/-1;">
                <p>No hay productos cargados</p>
            </div>
        `;
        return;
    }

    console.log(`📊 [RENDER] Iniciando render con ${productos.length} productos totales`);
    // Los productos granel se venden exclusivamente desde el modal 🌾 — no aparecen en la grilla
    let productosFiltrados = productos.filter(p =>
        !p.nombre?.toLowerCase().includes('(granel)') && p.tipo !== 'granel'
    );

    // Filtrar por categoría
    if (categoriaActual !== 'Todos') {
        console.log(`📂 [RENDER] Filtrando por categoría: ${categoriaActual}`);
        if (categoriaActual === 'Adulto') {
            // "Adulto" solo muestra productos de perro adulto (excluir gatos)
            productosFiltrados = productosFiltrados.filter(p => 
                p.categoria && 
                p.categoria.toLowerCase() === 'adulto' &&
                !p.nombre.toLowerCase().includes('gato')
            );
        } else if (categoriaActual === 'Gato') {
            // "Gato" solo muestra gatos adultos (excluir gatito/senior)
            productosFiltrados = productosFiltrados.filter(p => 
                p.categoria && 
                (p.categoria.toLowerCase() === 'gato adulto' || 
                 (p.categoria.toLowerCase().includes('gato') && 
                  !p.categoria.toLowerCase().includes('gatito') &&
                  !p.categoria.toLowerCase().includes('senior')))
            );
        } else {
            // Otras categorías usan filtro normal
            productosFiltrados = productosFiltrados.filter(p =>
                p.categoria && p.categoria.toLowerCase().includes(categoriaActual.toLowerCase())
            );
        }
        console.log(`📂 [RENDER] Productos después de filtro de categoría: ${productosFiltrados.length}`);
    }

    // Filtrar por búsqueda
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const searchValue = searchInput.value.trim(); // Trim para eliminar espacios
        if (searchValue) {
            const search = searchValue.toLowerCase();
            console.log(`🔍 [RENDER] Aplicando filtro de búsqueda: "${search}"`);
            console.log(`🔍 [RENDER] Productos antes del filtro de búsqueda: ${productosFiltrados.length}`);
            
            productosFiltrados = productosFiltrados.filter(p => {
                const matchNombre = p.nombre && p.nombre.toLowerCase().includes(search);
                const matchMarca = p.marca && p.marca.toLowerCase().includes(search);
                const matchCategoria = p.categoria && p.categoria.toLowerCase().includes(search);
                return matchNombre || matchMarca || matchCategoria;
            });
            
            console.log(`🔍 [RENDER] Productos después del filtro de búsqueda: ${productosFiltrados.length}`);
            console.log(`🔍 [RENDER] Primeros 3 productos filtrados:`, productosFiltrados.slice(0, 3).map(p => p.nombre));
        } else {
            console.log('🔍 [RENDER] Campo de búsqueda vacío, mostrando todos');
        }
    } else {
        console.warn('⚠️ [RENDER] searchInput no encontrado en el DOM');
    }

    if (productosFiltrados.length === 0) {
        grid.innerHTML = `
            <div class="loading-state" style="grid-column: 1/-1;">
                <p>No se encontraron productos</p>
                <span style="opacity: 0.7; font-size: 14px;">
                    ${categoriaActual !== 'Todos' ? 'Intenta con otra categoría' : 'Intenta con otra búsqueda'}
                </span>
            </div>
        `;
        return;
    }

    console.log(`📊 Mostrando ${productosFiltrados.length} productos`);

    grid.innerHTML = productosFiltrados.map(producto => {
        const stock = producto.stock || 0;
        const stockMinimo = producto.stock_minimo || 5;
        const stockBajo = stock <= stockMinimo && stock > 0;
        const stockCero = stock === 0;
        const esGranel = producto.nombre && producto.nombre.toLowerCase().includes('(granel)');

        let stockClass = 'stock-ok';
        let stockText = Math.floor(stock);

        // Productos granel no muestran "Sin stock"
        if (esGranel) {
            stockClass = 'stock-ok';
            stockText = ''; // Sin badge de stock para granel
        } else if (stockCero) {
            stockClass = 'stock-out';
            stockText = 'Sin stock';
        } else if (stockBajo) {
            stockClass = 'stock-low';
        }

        return `
            <div class="product-card" data-producto-id="${producto.id}">
                <div class="product-card-header">
                    <div class="product-name">${producto.nombre}</div>
                    ${stockText ? `<span class="product-stock ${stockClass}">${stockText}</span>` : ''}
                </div>
                <div class="product-footer">
                    <div class="product-price">$${formatoMoneda(producto.precio || 0)}</div>
                    ${esGranel ? 
                        `<button class="btn-add-product btn-granel" disabled title="Usa el botón 🌾 Granel">
                            🌾
                        </button>` : 
                        `<button class="btn-add-product" onclick="agregarAlCarrito(${producto.id})">
                            +
                        </button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function agregarAlCarrito(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    const itemExistente = carrito.find(item => item.id === producto.id);

    if (itemExistente) {
        // Advertir si excede el stock disponible, pero permitir
        if (itemExistente.cantidad >= producto.stock) {
            mostrarNotificacion('⚠️ Stock insuficiente - Venta permitida (stock negativo)', 'warning');
        }
        itemExistente.cantidad++;
    } else {
        // Advertir si el producto no tiene stock, pero permitir
        if (producto.stock <= 0) {
            mostrarNotificacion('⚠️ Producto sin stock - Venta permitida (stock negativo)', 'warning');
        }
        
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: 1,
            stock: producto.stock
        });
    }

    renderCarrito();
}

function renderCarrito() {
    const carritoItems = document.getElementById('carritoItems');
    const totalEl = document.getElementById('totalAmount');
    const btnCobrar = document.getElementById('btnCobrar');

    if (carrito.length === 0) {
        carritoItems.innerHTML = `
            <div class="cart-empty">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="30" stroke="currentColor" stroke-width="2" opacity="0.2"/>
                    <path d="M20 24h24l-2 16H22l-2-16z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="26" cy="48" r="2" fill="currentColor"/>
                    <circle cx="38" cy="48" r="2" fill="currentColor"/>
                </svg>
                <p>Tu carrito está vacío</p>
                <span>Agrega productos para comenzar</span>
            </div>
        `;
        totalEl.textContent = '$0';
        btnCobrar.disabled = true;
        totalVenta = 0;

        // Actualizar badge móvil
        actualizarBadgeCarritoMobile();
        return;
    }

    // Calcular total: productos normales + granel
    totalVenta = carrito.reduce((sum, item) => {
        if (item.esGranel) {
            return sum + item.montoGranel;
        } else {
            return sum + (item.precio * item.cantidad);
        }
    }, 0);

    carritoItems.innerHTML = carrito.map((item, index) => {
        // Renderizar diferente según si es granel o no
        if (item.esGranel) {
            return `
                <div class="cart-item" style="border-left: 3px solid hsl(var(--success));">
                    <div class="cart-item-header">
                        <div class="cart-item-name">
                            🌾 ${item.nombre}
                            <div style="font-size: 11px; color: hsl(var(--muted-foreground)); margin-top: 2px;">
                                ~${item.pesoEstimado} kg estimado
                            </div>
                        </div>
                        <button class="cart-item-remove" onclick="removerDelCarrito(${index})">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="cart-item-footer">
                        <div style="font-size: 12px; color: hsl(var(--muted-foreground));">
                            Granel - Monto fijo
                        </div>
                        <div class="cart-item-price">$${formatoMoneda(item.montoGranel)}</div>
                    </div>
                </div>
            `;
        } else {
            // Producto normal con controles de cantidad
            return `
                <div class="cart-item">
                    <div class="cart-item-header">
                        <div class="cart-item-name">${item.nombre}</div>
                        <button class="cart-item-remove" onclick="removerDelCarrito(${index})">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="cart-item-footer">
                        <div class="cart-item-controls">
                            <button onclick="cambiarCantidad(${index}, -1)">−</button>
                            <span class="cart-item-quantity">${item.cantidad}</span>
                            <button onclick="cambiarCantidad(${index}, 1)">+</button>
                        </div>
                        <div class="cart-item-price">$${formatoMoneda(item.precio * item.cantidad)}</div>
                    </div>
                </div>
            `;
        }
    }).join('');

    totalEl.textContent = '$' + formatoMoneda(totalVenta);
    btnCobrar.disabled = false;

    // Actualizar badge móvil
    actualizarBadgeCarritoMobile();
}

function cambiarCantidad(index, delta) {
    const item = carrito[index];
    
    // No permitir cambiar cantidad de items de granel
    if (item.esGranel) {
        mostrarNotificacion('Los productos a granel tienen monto fijo. Elimina y agrega nuevamente.', 'warning');
        return;
    }
    
    const newQty = item.cantidad + delta;

    if (newQty <= 0) {
        removerDelCarrito(index);
        return;
    }

    // Advertir si excede el stock, pero permitir
    if (newQty > item.stock) {
        mostrarNotificacion('⚠️ Stock insuficiente - Incremento permitido (stock negativo)', 'warning');
    }

    item.cantidad = newQty;
    renderCarrito();
}

function removerDelCarrito(index) {
    carrito.splice(index, 1);
    renderCarrito();
}

function limpiarCarrito() {
    if (carrito.length === 0) return;

    if (confirm('¿Deseas limpiar el carrito?')) {
        carrito = [];
        renderCarrito();
    }
}

// ===================================
// CARRITO MÓVIL
// ===================================

function toggleCarritoMobile() {
    const posCart = document.querySelector('.pos-cart');
    const overlay = document.getElementById('overlayCarritoMobile');

    const isActive = posCart.classList.contains('active');

    if (isActive) {
        cerrarCarritoMobile();
    } else {
        abrirCarritoMobile();
    }
}

function abrirCarritoMobile() {
    const posCart = document.querySelector('.pos-cart');
    const overlay = document.getElementById('overlayCarritoMobile');

    posCart.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarCarritoMobile() {
    const posCart = document.querySelector('.pos-cart');
    const overlay = document.getElementById('overlayCarritoMobile');

    posCart.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function actualizarBadgeCarritoMobile() {
    const badge = document.getElementById('badgeCarritoMobile');
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

    if (totalItems > 0) {
        badge.textContent = totalItems;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function mostrarBotonCarritoMobile() {
    const btnCarritoMobile = document.getElementById('btnCarritoMobile');
    if (currentView === 'pos') {
        btnCarritoMobile.classList.add('show');
    } else {
        btnCarritoMobile.classList.remove('show');
        cerrarCarritoMobile();
    }
}

// ===================================
// FILTROS Y BÚSQUEDA
// ===================================

function filtrarCategoria(categoria) {
    categoriaActual = categoria;

    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.classList.remove('active');
        if (chip.dataset.categoria === categoria) {
            chip.classList.add('active');
        }
    });

    renderProductos();
}

// ===================================
// 🔍 CONFIGURACIÓN DE EVENT LISTENERS DEL BUSCADOR
// ===================================
/**
 * Configura los event listeners para el buscador de productos
 * Se llama desde iniciarSesionYCargarApp() para asegurar que el DOM existe
 * Funciona en móvil y desktop
 */
function configurarEventListenersBuscador() {
    console.log('🔍 [SEARCH] Iniciando configuración de buscadores...');
    
    // ========== BUSCADOR DE TEXTO (searchInput) ==========
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        console.log('🔍 [SEARCH] ✅ searchInput encontrado, configurando listener');
        
        // Obtener botón de limpiar del searchInput
        const btnClearSearch = searchInput.parentElement?.querySelector('.btn-clear-search');
        
        // Remover listeners previos (por si se llama múltiples veces)
        const oldListener = searchInput._searchListener;
        if (oldListener) {
            searchInput.removeEventListener('input', oldListener);
        }
        
        // Crear función de búsqueda con debounce
        const debouncedRender = debounce(() => {
            const valor = searchInput.value.trim();
            console.log('🔍 [SEARCH] Ejecutando búsqueda con:', valor);
            renderProductos();
        }, 300);
        
        // Listener principal
        const newListener = (e) => {
            const valor = e.target.value;
            console.log('🔍 [SEARCH] Input detectado:', valor);
            
            // Mostrar/ocultar botón de limpiar
            if (btnClearSearch) {
                btnClearSearch.style.display = valor ? 'block' : 'none';
            }
            
            debouncedRender();
        };
        
        // Guardar referencia para poder removerlo después
        searchInput._searchListener = newListener;
        searchInput.addEventListener('input', newListener);
        
        console.log('🔍 [SEARCH] ✅ Listener configurado correctamente');
    } else {
        console.error('❌ [SEARCH] searchInput no encontrado en el DOM');
    }
    
    // ========== BUSCADOR DE CÓDIGO DE BARRAS ==========
    const inputCodigoBarras = document.getElementById('inputCodigoBarras');
    if (inputCodigoBarras) {
        console.log('🔍 [BARCODE] ✅ inputCodigoBarras encontrado');
        
        // Auto-focus al cargar
        inputCodigoBarras.focus();

        // Remover listeners previos
        if (inputCodigoBarras._inputListener) {
            inputCodigoBarras.removeEventListener('input', inputCodigoBarras._inputListener);
        }
        if (inputCodigoBarras._keypressListener) {
            inputCodigoBarras.removeEventListener('keypress', inputCodigoBarras._keypressListener);
        }

        // Mostrar/ocultar botón de limpiar
        const inputListener = (e) => {
            const btnClear = document.querySelector('.btn-clear-search');
            if (btnClear) {
                btnClear.style.display = e.target.value ? 'block' : 'none';
            }
        };
        inputCodigoBarras._inputListener = inputListener;
        inputCodigoBarras.addEventListener('input', inputListener);

        // Enter para buscar producto
        const keypressListener = async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const codigo = e.target.value.trim();
                if (codigo) {
                    const producto = await buscarPorCodigoBarras(codigo);
                    if (producto) {
                        agregarAlCarrito(producto.id);
                        mostrarNotificacion(`✅ ${producto.nombre} agregado`, 'success');
                        e.target.value = '';
                        e.target.focus();

                        const btnClear = document.querySelector('.btn-clear-search');
                        if (btnClear) btnClear.style.display = 'none';
                    } else {
                        mostrarNotificacion('❌ Código no encontrado. Intenta buscar por nombre', 'warning');
                        setTimeout(() => {
                            const searchInput = document.getElementById('searchInput');
                            if (searchInput) searchInput.focus();
                        }, 1500);
                    }
                }
            }
        };
        inputCodigoBarras._keypressListener = keypressListener;
        inputCodigoBarras.addEventListener('keypress', keypressListener);
        
        console.log('🔍 [BARCODE] ✅ Listeners configurados');
    } else {
        console.error('❌ [BARCODE] inputCodigoBarras no encontrado');
    }
    
    console.log('🔍 [SEARCH] ✅ Configuración de buscadores completa');
}

// ===================================
// 🔄 EVENT DELEGATION COMO RESPALDO
// ===================================
// Event delegation en el document para capturar eventos incluso si los inputs se recrean
document.addEventListener('input', (e) => {
    // Si el evento viene del searchInput y no tiene listener directo
    if (e.target.id === 'searchInput' && !e.target._searchListener) {
        console.log('🔍 [DELEGATION] searchInput detectado sin listener, configurando...');
        configurarEventListenersBuscador();
    }
});


function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===================================
// MODAL COBRO
// ===================================

/**
 * Resetear campos de descuentos
 */
function resetearDescuentos() {
    totalSinDescuento = totalVenta;
    descuentoAplicado = 0;
    tipoDescuento = 'ninguno';
    valorDescuento = 0;
    
    document.getElementById('inputDescPorcentaje').value = '';
    document.getElementById('inputDescMonto').value = '';
    document.getElementById('areaDescPorcentaje').style.display = 'none';
    document.getElementById('areaDescMonto').style.display = 'none';
    document.getElementById('resumenDescuento').style.display = 'none';
    document.getElementById('labelSubtotal').style.display = 'none';
    document.getElementById('montoSubtotal').style.display = 'none';
    
    document.querySelectorAll('#seccionDescuento button').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = '';
        btn.style.color = '';
    });
}

/**
 * Resetear campos de métodos de pago
 */
function resetearCamposPago() {
    document.getElementById('pagoTotal').textContent = '$' + formatoMoneda(totalVenta);
    document.getElementById('montoEntregado').value = '';
    document.getElementById('montoTarjeta').value = '';
    document.getElementById('montoTransferencia').value = '';
    document.getElementById('vueltoAmount').textContent = '$0';

    // Limpiar pago mixto
    const mixtoEfectivo = document.getElementById('montoMixtoEfectivo');
    const mixtoTarjeta = document.getElementById('montoMixtoTarjeta');
    const mixtoTransferencia = document.getElementById('montoMixtoTransferencia');
    if (mixtoEfectivo) mixtoEfectivo.value = '';
    if (mixtoTarjeta) mixtoTarjeta.value = '';
    if (mixtoTransferencia) mixtoTransferencia.value = '';

    // Limpiar display de pagos parciales
    document.getElementById('pagosRegistrados').innerHTML = '';
    document.getElementById('pagosRegistrados').style.display = 'none';
    document.getElementById('montoPendiente').style.display = 'none';
    document.getElementById('progresoMixto').style.display = 'none';

    // Resetear botón finalizar
    document.getElementById('btnFinalizarVenta').innerHTML = `
        <span>Finalizar Venta</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 10l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
}

/**
 * Configurar método de pago por defecto (Efectivo)
 */
function configurarMetodoPagoDefecto() {
    // Activar método efectivo
    document.querySelectorAll('.payment-method').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('[data-metodo="Efectivo"]')?.classList.add('active');

    // Mostrar solo área de efectivo
    const areaEfectivo = document.getElementById('areaEfectivo');
    const areaTarjeta = document.getElementById('areaTarjeta');
    const areaTransferencia = document.getElementById('areaTransferencia');
    const areaMixto = document.getElementById('areaMixto');

    if (areaEfectivo) {
        areaEfectivo.style.display = 'block';
        areaEfectivo.classList.add('visible');
    }
    if (areaTarjeta) areaTarjeta.style.display = 'none';
    if (areaTransferencia) areaTransferencia.style.display = 'none';
    if (areaMixto) areaMixto.style.display = 'none';
}

function abrirModalCobro() {
    if (carrito.length === 0) return;

    // Resetear estado
    pagosRegistrados = [];
    metodoPagoSeleccionado = 'Efectivo';
    
    // Resetear UI
    resetearDescuentos();
    resetearCamposPago();
    configurarMetodoPagoDefecto();

    // Mostrar modal
    const modal = document.getElementById('modalCobro');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

// ===================================
// SISTEMA DE DESCUENTOS
// ===================================

function seleccionarTipoDescuento(tipo) {
    tipoDescuento = tipo;
    
    // Resetear campos
    document.getElementById('inputDescPorcentaje').value = '';
    document.getElementById('inputDescMonto').value = '';
    valorDescuento = 0;
    
    // Actualizar UI de botones
    const btnPorcentaje = document.getElementById('btnDescPorcentaje');
    const btnMonto = document.getElementById('btnDescMonto');
    
    // Resetear estilos
    btnPorcentaje.style.background = '';
    btnPorcentaje.style.color = '';
    btnMonto.style.background = '';
    btnMonto.style.color = '';
    
    if (tipo === 'porcentaje') {
        document.getElementById('areaDescPorcentaje').style.display = 'block';
        document.getElementById('areaDescMonto').style.display = 'none';
        btnPorcentaje.style.background = 'hsl(var(--primary))';
        btnPorcentaje.style.color = 'white';
        
        setTimeout(() => document.getElementById('inputDescPorcentaje').focus(), 100);
    } else if (tipo === 'monto') {
        document.getElementById('areaDescPorcentaje').style.display = 'none';
        document.getElementById('areaDescMonto').style.display = 'block';
        btnMonto.style.background = 'hsl(var(--primary))';
        btnMonto.style.color = 'white';
        
        setTimeout(() => document.getElementById('inputDescMonto').focus(), 100);
    }
    
    aplicarDescuento();
}

function limpiarDescuento() {
    tipoDescuento = 'ninguno';
    valorDescuento = 0;
    descuentoAplicado = 0;
    totalVenta = totalSinDescuento;
    
    document.getElementById('inputDescPorcentaje').value = '';
    document.getElementById('inputDescMonto').value = '';
    document.getElementById('areaDescPorcentaje').style.display = 'none';
    document.getElementById('areaDescMonto').style.display = 'none';
    document.getElementById('resumenDescuento').style.display = 'none';
    document.getElementById('labelSubtotal').style.display = 'none';
    document.getElementById('montoSubtotal').style.display = 'none';
    
    // Resetear botones
    document.querySelectorAll('#seccionDescuento button').forEach(btn => {
        btn.style.background = '';
        btn.style.color = '';
    });
    
    // Actualizar total
    document.getElementById('pagoTotal').textContent = '$' + formatoMoneda(totalVenta);
    
    mostrarNotificacion('Descuento eliminado', 'info');
}

function aplicarDescuento() {
    if (tipoDescuento === 'ninguno') {
        limpiarDescuento();
        return;
    }
    
    if (tipoDescuento === 'porcentaje') {
        const porcentaje = parseFloat(document.getElementById('inputDescPorcentaje').value) || 0;
        
        if (porcentaje < 0 || porcentaje > 100) {
            mostrarNotificacion('El porcentaje debe estar entre 0 y 100', 'warning');
            return;
        }
        
        valorDescuento = porcentaje;
        descuentoAplicado = Math.round((totalSinDescuento * porcentaje) / 100);
        
    } else if (tipoDescuento === 'monto') {
        const monto = parseFloat(document.getElementById('inputDescMonto').value) || 0;
        
        if (monto < 0) {
            mostrarNotificacion('El monto no puede ser negativo', 'warning');
            return;
        }
        
        if (monto > totalSinDescuento) {
            mostrarNotificacion('El descuento no puede ser mayor al total', 'warning');
            document.getElementById('inputDescMonto').value = totalSinDescuento;
            valorDescuento = totalSinDescuento;
            descuentoAplicado = totalSinDescuento;
        } else {
            valorDescuento = monto;
            descuentoAplicado = monto;
        }
    }
    
    // Calcular nuevo total
    totalVenta = Math.max(0, totalSinDescuento - descuentoAplicado);
    
    // Actualizar UI
    if (descuentoAplicado > 0) {
        document.getElementById('labelSubtotal').style.display = 'block';
        document.getElementById('montoSubtotal').style.display = 'block';
        document.getElementById('montoSubtotal').textContent = '$' + formatoMoneda(totalSinDescuento);
        document.getElementById('resumenDescuento').style.display = 'block';
        document.getElementById('montoDescuentoAplicado').textContent = '-$' + formatoMoneda(descuentoAplicado);
    } else {
        document.getElementById('labelSubtotal').style.display = 'none';
        document.getElementById('montoSubtotal').style.display = 'none';
        document.getElementById('resumenDescuento').style.display = 'none';
    }
    
    document.getElementById('pagoTotal').textContent = '$' + formatoMoneda(totalVenta);
    
    // Recalcular vuelto si está en efectivo
    if (metodoPagoSeleccionado === 'Efectivo') {
        calcularVuelto();
    }
    
    // Recalcular pago mixto si está activo
    if (metodoPagoSeleccionado === 'Mixto') {
        calcularPagoMixto();
    }
}

function cerrarModalCobro() {
    const modal = document.getElementById('modalCobro');
    modal.style.display = 'none';
    modal.classList.remove('show');
}

function seleccionarMetodo(metodo) {
    metodoPagoSeleccionado = metodo;

    document.querySelectorAll('.payment-method').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.metodo === metodo) {
            btn.classList.add('active');
        }
    });

    const areaEfectivo = document.getElementById('areaEfectivo');
    const areaTarjeta = document.getElementById('areaTarjeta');
    const areaTransferencia = document.getElementById('areaTransferencia');
    const areaMixto = document.getElementById('areaMixto');

    // Ocultar todas las áreas
    areaEfectivo.classList.remove('visible');
    areaEfectivo.style.display = 'none';
    areaTarjeta.style.display = 'none';
    areaTransferencia.style.display = 'none';
    if (areaMixto) areaMixto.style.display = 'none';

    // Mostrar el área correspondiente
    if (metodo === 'Efectivo') {
        areaEfectivo.style.display = 'block';
        areaEfectivo.classList.add('visible');
    } else if (metodo === 'Tarjeta') {
        areaTarjeta.style.display = 'block';

        // Actualizar helper con info de pago mixto
        const helperTarjeta = document.getElementById('helperTarjeta');
        const montoPagado = pagosRegistrados.reduce((sum, p) => sum + p.monto, 0);
        const montoPendiente = totalVenta - montoPagado;

        if (montoPagado > 0) {
            helperTarjeta.textContent = `Pendiente: $${formatoMoneda(montoPendiente)} de $${formatoMoneda(totalVenta)}`;
        } else {
            helperTarjeta.textContent = 'Ingresa el monto a pagar con tarjeta';
        }
    } else if (metodo === 'Transferencia') {
        areaTransferencia.style.display = 'block';

        // Actualizar helper con info de pago mixto
        const helperTransferencia = document.getElementById('helperTransferencia');
        const montoPagado = pagosRegistrados.reduce((sum, p) => sum + p.monto, 0);
        const montoPendiente = totalVenta - montoPagado;

        if (montoPagado > 0) {
            helperTransferencia.textContent = `Pendiente: $${formatoMoneda(montoPendiente)} de $${formatoMoneda(totalVenta)}`;
        } else {
            helperTransferencia.textContent = 'Ingresa el monto a pagar con transferencia';
        }
    } else if (metodo === 'Mixto') {
        if (areaMixto) {
            areaMixto.style.display = 'block';
            // Resetear campos del pago mixto
            document.getElementById('montoMixtoEfectivo').value = '';
            document.getElementById('montoMixtoTarjeta').value = '';
            document.getElementById('montoMixtoTransferencia').value = '';
            calcularPagoMixto();
        }
    }
}

function agregarBillete(monto) {
    const input = document.getElementById('montoEntregado');
    const actual = parseFloat(input.value) || 0;
    input.value = actual + monto;
    calcularVuelto();
}

function calcularVuelto() {
    const montoEntregado = parseFloat(document.getElementById('montoEntregado').value) || 0;
    const vuelto = montoEntregado - totalVenta;

    const vueltoEl = document.getElementById('vueltoAmount');
    if (vuelto >= 0) {
        vueltoEl.textContent = '$' + formatoMoneda(vuelto);
    } else {
        vueltoEl.textContent = 'Falta: $' + formatoMoneda(Math.abs(vuelto));
    }
}

function calcularPagoMixto() {
    const efectivo = parseFloat(document.getElementById('montoMixtoEfectivo').value) || 0;
    const tarjeta = parseFloat(document.getElementById('montoMixtoTarjeta').value) || 0;
    const transferencia = parseFloat(document.getElementById('montoMixtoTransferencia').value) || 0;
    
    const totalIngresado = efectivo + tarjeta + transferencia;
    const falta = totalVenta - totalIngresado;
    
    // Actualizar displays
    document.getElementById('totalMixtoDisplay').textContent = '$' + formatoMoneda(totalVenta);
    document.getElementById('pagadoMixtoDisplay').textContent = '$' + formatoMoneda(totalIngresado);
    document.getElementById('faltaMixtoDisplay').textContent = '$' + formatoMoneda(Math.max(0, falta));
    
    // Cambiar color del falta según si está completo
    const faltaDisplay = document.getElementById('faltaMixtoDisplay');
    if (falta <= 0) {
        faltaDisplay.style.color = 'hsl(142 76% 36%)'; // Verde
    } else {
        faltaDisplay.style.color = 'hsl(0 84% 60%)'; // Rojo
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTA: Las siguientes funciones de pagos parciales ya NO se usan
// El flujo de pago mixto ahora se maneja directamente con el botón "Mixto"
// Se mantienen comentadas por compatibilidad
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/*
function agregarPagoParcial() {
    // Validar que haya un método seleccionado
    if (!metodoPagoSeleccionado) {
        mostrarNotificacion('⚠️ Selecciona un método de pago primero', 'error');
        return;
    }

    // Calcular monto ya pagado
    const montoPagado = pagosRegistrados.reduce((sum, p) => sum + p.monto, 0);
    const montoPendiente = totalVenta - montoPagado;

    if (montoPendiente <= 0) {
        mostrarNotificacion('✅ Ya se completó el pago total. Haz clic en "Finalizar Venta"', 'info');
        return;
    }

    let montoPago = 0;

    // Obtener monto según método
    if (metodoPagoSeleccionado === 'Efectivo') {
        montoPago = parseFloat(document.getElementById('montoEntregado').value) || 0;

        if (montoPago <= 0) {
            mostrarNotificacion('💵 Ingresa el monto en efectivo', 'error');
            return;
        }

        // Si paga más de lo pendiente, ajustar al pendiente
        if (montoPago > montoPendiente) {
            mostrarNotificacion(`✅ Se ajustó el monto al pendiente: $${formatoMoneda(montoPendiente)}`, 'info');
            montoPago = montoPendiente;
        }
    } else if (metodoPagoSeleccionado === 'Tarjeta') {
        montoPago = parseFloat(document.getElementById('montoTarjeta').value) || 0;

        if (montoPago <= 0) {
            mostrarNotificacion('💳 Ingresa el monto con tarjeta', 'error');
            return;
        }

        if (montoPago > montoPendiente) {
            mostrarNotificacion(`El monto no puede ser mayor al pendiente ($${formatoMoneda(montoPendiente)})`, 'error');
            return;
        }
    } else if (metodoPagoSeleccionado === 'Transferencia') {
        montoPago = parseFloat(document.getElementById('montoTransferencia').value) || 0;

        if (montoPago <= 0) {
            mostrarNotificacion('📱 Ingresa el monto con transferencia', 'error');
            return;
        }

        if (montoPago > montoPendiente) {
            mostrarNotificacion(`El monto no puede ser mayor al pendiente ($${formatoMoneda(montoPendiente)})`, 'error');
            return;
        }
    }

    // Registrar el pago
    pagosRegistrados.push({
        metodo: metodoPagoSeleccionado,
        monto: montoPago
    });

    mostrarNotificacion(`✅ Pago de $${formatoMoneda(montoPago)} registrado`, 'success');

    // Actualizar display
    renderPagosRegistrados();

    // Limpiar para el siguiente pago
    document.getElementById('montoEntregado').value = '';
    document.getElementById('montoTarjeta').value = '';
    document.getElementById('montoTransferencia').value = '';
    document.getElementById('vueltoAmount').textContent = '$0';

    // Resetear selección
    document.querySelectorAll('.payment-method').forEach(btn => {
        btn.classList.remove('active');
    });
    metodoPagoSeleccionado = '';

    const areaEfectivo = document.getElementById('areaEfectivo');
    const areaTarjeta = document.getElementById('areaTarjeta');
    const areaTransferencia = document.getElementById('areaTransferencia');

    if (areaEfectivo) {
        areaEfectivo.classList.remove('visible');
        areaEfectivo.style.display = 'none';
    }
    if (areaTarjeta) areaTarjeta.style.display = 'none';
    if (areaTransferencia) areaTransferencia.style.display = 'none';
}

/*
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FUNCIÓN OBSOLETA: Ya no se usa con el nuevo botón "Mixto"
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderPagosRegistrados() {
    const container = document.getElementById('pagosRegistrados');
    const pendienteContainer = document.getElementById('montoPendiente');
    const progresoMixto = document.getElementById('progresoMixto');

    if (pagosRegistrados.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        pendienteContainer.style.display = 'none';
        progresoMixto.style.display = 'none';
        return;
    }

    const montoPagado = pagosRegistrados.reduce((sum, p) => sum + p.monto, 0);
    const montoPendiente = totalVenta - montoPagado;
    const porcentajePagado = (montoPagado / totalVenta) * 100;

    // Mostrar barra de progreso
    progresoMixto.style.display = 'block';
    document.getElementById('barraProgreso').style.width = porcentajePagado + '%';
    document.getElementById('textoPagado').textContent = `Pagado: $${formatoMoneda(montoPagado)}`;
    document.getElementById('textoFalta').textContent = `Falta: $${formatoMoneda(montoPendiente)}`;
    document.getElementById('contadorMetodos').textContent = `${pagosRegistrados.length} método${pagosRegistrados.length > 1 ? 's' : ''}`;

    // Renderizar pagos
    const pagosHTML = pagosRegistrados.map((pago, index) => `
        <div class="pago-registrado">
            <div class="pago-numero">#${index + 1}</div>
            <div class="pago-info">
                <span class="pago-metodo">
                    ${pago.metodo === 'Efectivo' ? '💵' : pago.metodo === 'Tarjeta' ? '💳' : '📱'} ${pago.metodo}
                </span>
                <span class="pago-monto">$${formatoMoneda(pago.monto)}</span>
            </div>
            <button class="btn-remove-pago" onclick="eliminarPago(${index})" title="Eliminar">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="pagos-header">
            <h4>📋 Pagos Registrados</h4>
            <span class="badge-mixto">💳 Mixto</span>
        </div>
        <div class="pagos-lista">
            ${pagosHTML}
        </div>
        <div class="pagos-total">
            <span>Total Pagado:</span>
            <span class="total-pagado">$${formatoMoneda(montoPagado)}</span>
        </div>
    `;
    container.style.display = 'block';

    // Mostrar pendiente solo si falta
    if (montoPendiente > 0) {
        document.getElementById('pendienteAmount').textContent = '$' + formatoMoneda(montoPendiente);
        pendienteContainer.style.display = 'none'; // Ocultamos esta sección, la info está arriba

        // Cambiar texto del botón
        document.getElementById('btnPagoParcialText').textContent = 'Agregar Otro Pago';
    } else {
        pendienteContainer.style.display = 'none';
        // Si ya se completó el pago, cambiar texto del botón
        document.getElementById('btnFinalizarVenta').innerHTML = `
            <span>✅ Completar Venta</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 10l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        document.getElementById('btnPagoParcialText').textContent = 'Registrar Pago';

        // Resaltar barra de progreso completa
        document.getElementById('barraProgreso').style.background = 'linear-gradient(90deg, hsl(142 76% 36%), hsl(142 76% 46%))';
    }
}

function eliminarPago(index) {
    pagosRegistrados.splice(index, 1);
    renderPagosRegistrados();
    mostrarNotificacion('Pago eliminado', 'info');
}
*/

// ===================================
// FINALIZACIÓN DE VENTA - FUNCIONES AUXILIARES
// ===================================

/**
 * Procesar pago mixto simplificado
 * @returns {{success: boolean, metodoPago: string, montoPagado: number, error?: string}}
 */
function procesarPagoMixto() {
    const efectivo = parseFloat(document.getElementById('montoMixtoEfectivo').value) || 0;
    const tarjeta = parseFloat(document.getElementById('montoMixtoTarjeta').value) || 0;
    const transferencia = parseFloat(document.getElementById('montoMixtoTransferencia').value) || 0;
    
    const totalIngresado = efectivo + tarjeta + transferencia;
    
    if (totalIngresado < totalVenta) {
        return {
            success: false,
            error: `Falta completar el pago. Ingresado: $${formatoMoneda(totalIngresado)} de $${formatoMoneda(totalVenta)}`
        };
    }
    
    // Construir array de pagos registrados automáticamente
    pagosRegistrados = [];
    if (efectivo > 0) pagosRegistrados.push({ metodo: 'Efectivo', monto: efectivo });
    if (tarjeta > 0) pagosRegistrados.push({ metodo: 'Tarjeta', monto: tarjeta });
    if (transferencia > 0) pagosRegistrados.push({ metodo: 'Transferencia', monto: transferencia });
    
    const metodoPagoFinal = 'Mixto (' + pagosRegistrados.map(p => p.metodo).join(' + ') + ')';
    
    return {
        success: true,
        metodoPago: metodoPagoFinal,
        montoPagado: totalIngresado
    };
}

/**
 * Procesar pagos parciales registrados
 * @returns {{success: boolean, metodoPago: string, montoPagado: number, error?: string}}
 */
function procesarPagoParcial() {
    const montoPagadoTotal = pagosRegistrados.reduce((sum, p) => sum + p.monto, 0);

    if (montoPagadoTotal < totalVenta) {
        return {
            success: false,
            error: `Falta completar el pago. Pendiente: $${formatoMoneda(totalVenta - montoPagadoTotal)}`
        };
    }

    // Si hay múltiples métodos, el método es "Mixto"
    const metodoPagoFinal = pagosRegistrados.length > 1
        ? 'Mixto (' + pagosRegistrados.map(p => p.metodo).join(' + ') + ')'
        : pagosRegistrados[0].metodo;

    return {
        success: true,
        metodoPago: metodoPagoFinal,
        montoPagado: montoPagadoTotal
    };
}

/**
 * Procesar pago único (flujo normal)
 * @returns {{success: boolean, metodoPago: string, error?: string}}
 */
function procesarPagoUnico() {
    if (!metodoPagoSeleccionado) {
        return {
            success: false,
            error: 'Selecciona un método de pago'
        };
    }

    // Validar pago según método
    if (metodoPagoSeleccionado === 'Efectivo') {
        const montoEntregado = parseFloat(document.getElementById('montoEntregado').value) || 0;
        if (montoEntregado < totalVenta) {
            return {
                success: false,
                error: 'Monto insuficiente'
            };
        }
    }

    return {
        success: true,
        metodoPago: metodoPagoSeleccionado
    };
}

/**
 * Preparar objeto de venta para insertar en BD
 * @param {string} metodoPagoFinal - Método de pago final
 * @returns {Object} Objeto de venta
 */
function prepararDatosVenta(metodoPagoFinal) {
    const ahora = new Date();
    const fechaVenta = ahora.toISOString();
    const fechaSoloFecha = ahora.toISOString().split('T')[0];
    
    const venta = {
        vendedor_nombre: currentUser,
        total: totalVenta,
        metodo_pago: metodoPagoFinal,
        fecha: fechaSoloFecha,
        created_at: fechaVenta
    };
    
    // Guardar información de descuento si se aplicó
    if (descuentoAplicado > 0) {
        venta.descuento_aplicado = descuentoAplicado;
        venta.descuento_tipo = tipoDescuento;
        venta.descuento_valor = valorDescuento;
        venta.subtotal_sin_descuento = totalSinDescuento;
    }

    // Si es pago mixto, guardar detalle de pagos
    if (pagosRegistrados.length > 0) {
        venta.pagos_detalle = JSON.stringify(pagosRegistrados);
    }

    return venta;
}

/**
 * Preparar items de venta para insertar en BD
 * @param {number} ventaId - ID de la venta
 * @returns {Array} Array de items
 */
function prepararItemsVenta(ventaId) {
    return carrito.map(item => {
        if (item.esGranel) {
            return {
                venta_id: ventaId,
                producto_id: item.id,
                cantidad: 1,
                precio_unitario: item.montoGranel,
                subtotal: item.montoGranel,
                producto_nombre: item.nombre + ' (Granel)',
                es_granel: true,
                peso_estimado_kg: item.pesoEstimado
            };
        } else {
            return {
                venta_id: ventaId,
                producto_id: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio,
                subtotal: item.precio * item.cantidad,
                producto_nombre: item.nombre,
                es_granel: false
            };
        }
    });
}

/**
 * Actualizar stock de productos después de la venta
 * SOLO para productos normales (NO granel)
 */
async function actualizarStockPostVenta() {
    for (const item of carrito) {
        if (item.esGranel) {
            continue;
        }

        const nuevoStock = item.stock - item.cantidad;

        const { error: stockError } = await window.supabaseClient
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', item.id);

        if (stockError) {
            console.error('Error actualizando stock:', stockError.message);
        }
    }
}

// ===================================
// FINALIZACIÓN DE VENTA - FUNCIÓN PRINCIPAL
// ===================================

async function finalizarVenta() {
    // Validar autenticación
    if (!requireAuthentication('Finalizar venta')) {
        return;
    }

    if (carrito.length === 0) {
        mostrarNotificacion('El carrito está vacío', 'warning');
        return;
    }

    // Procesar método de pago
    let resultado;
    
    if (metodoPagoSeleccionado === 'Mixto') {
        resultado = procesarPagoMixto();
    } else if (pagosRegistrados.length > 0) {
        resultado = procesarPagoParcial();
    } else {
        resultado = procesarPagoUnico();
    }

    if (!resultado.success) {
        mostrarNotificacion(resultado.error, 'error');
        return;
    }

    // Validación final de stock en tiempo real (solo si estamos online)
    if (isOnline) {
        const stockDisponible = await validarStockAntesDeVenta();
        if (!stockDisponible) {
            return;
        }
    }

    try {
        const ventaData = prepararDatosVenta(resultado.metodoPago);
        
        // MODO OFFLINE: Guardar en IndexedDB
        if (!isOnline) {
            console.log('📡 Modo Offline: Guardando venta localmente...');
            
            await guardarVentaOffline({
                ...ventaData,
                items: carrito.map(item => ({
                    producto_id: item.id,
                    producto_nombre: item.nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio,
                    subtotal: item.cantidad * item.precio
                }))
            });
            
            mostrarNotificacion('✅ Venta guardada (Modo Offline). Se sincronizará automáticamente.', 'info', 5000);
            
            // Actualizar stock localmente (optimista)
            await actualizarStockLocalPostVenta();
            
            // Limpiar carrito y cerrar modal
            carrito = [];
            pagosRegistrados = [];
            renderCarrito();
            cerrarModalCobro();
            
            return;
        }
        
        // MODO ONLINE: Guardar en Supabase
        if (window.supabaseClient) {
            const { data: ventaGuardada, error } = await window.supabaseClient
                .from('ventas')
                .insert([ventaData])
                .select();

            if (error) {
                // Si falla Supabase pero detectamos que estamos offline, guardar localmente
                if (!navigator.onLine) {
                    console.log('⚠️ Conexión perdida durante la venta. Guardando localmente...');
                    await guardarVentaOffline({
                        ...ventaData,
                        items: carrito.map(item => ({
                            producto_id: item.id,
                            producto_nombre: item.nombre,
                            cantidad: item.cantidad,
                            precio_unitario: item.precio,
                            subtotal: item.cantidad * item.precio
                        }))
                    });
                    mostrarNotificacion('⚠️ Venta guardada localmente. Se sincronizará cuando haya conexión.', 'warning', 5000);
                    
                    carrito = [];
                    pagosRegistrados = [];
                    renderCarrito();
                    cerrarModalCobro();
                    return;
                }
                
                console.error('Error guardando venta:', error.message);
                mostrarNotificacion('Error al guardar la venta: ' + error.message, 'error');
                return;
            }

            const ventaId = ventaGuardada[0].id;

            // Guardar items en ventas_items
            const items = prepararItemsVenta(ventaId);

            const { error: itemsError } = await window.supabaseClient
                .from('ventas_items')
                .insert(items);

            if (itemsError) {
                console.error('Error guardando items:', itemsError.message);
                mostrarNotificacion('Advertencia: Items no guardados - ' + itemsError.message, 'warning');
            }

            // Actualizar stock
            await actualizarStockPostVenta();
        }

        mostrarNotificacion('¡Venta completada exitosamente!', 'success');

        // Limpiar carrito y cerrar modal
        carrito = [];
        pagosRegistrados = [];
        renderCarrito();
        cerrarModalCobro();

        // Recargar productos
        await cargarProductos();

    } catch (error) {
        console.error('Error en finalizarVenta:', error);
        
        // Último recurso: intentar guardar offline
        if (!isOnline || error.message.includes('fetch')) {
            try {
                const ventaData = prepararDatosVenta(resultado.metodoPago);
                await guardarVentaOffline({
                    ...ventaData,
                    items: carrito.map(item => ({
                        producto_id: item.id,
                        producto_nombre: item.nombre,
                        cantidad: item.cantidad,
                        precio_unitario: item.precio,
                        subtotal: item.cantidad * item.precio
                    }))
                });
                mostrarNotificacion('⚠️ Venta guardada localmente por error de conexión', 'warning', 5000);
                
                carrito = [];
                pagosRegistrados = [];
                renderCarrito();
                cerrarModalCobro();
                return;
            } catch (offlineError) {
                console.error('Error guardando offline:', offlineError);
            }
        }
        
        manejarError(error, {
            contexto: 'Finalizar venta',
            mensajeUsuario: 'Error al procesar la venta. Verifica que todos los datos sean correctos.',
            esErrorCritico: true,
            callback: () => {
                // Resetear estado del botón si existe
                const btnFinalizar = document.getElementById('btnFinalizarVenta');
                if (btnFinalizar) {
                    btnFinalizar.disabled = false;
                    btnFinalizar.innerHTML = `
                        <span>Finalizar Venta</span>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M5 10l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    `;
                }
            }
        });
    }
}

/**
 * Actualizar stock localmente (optimista) para modo offline
 */
async function actualizarStockLocalPostVenta() {
    for (const item of carrito) {
        const producto = productos.find(p => p.id === item.id);
        if (producto && !item.esGranel) {
            producto.stock -= item.cantidad;
        }
    }
    
    // Guardar productos actualizados en caché
    await guardarProductosEnCache(productos);
    renderProductos();
}

// ===================================
// MODAL SACO
// ===================================

function cerrarModalSaco() {
    const modal = document.getElementById('modalAbrirSaco');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

function confirmarAbrirSaco() {
    mostrarNotificacion('Función en desarrollo', 'info');
    cerrarModalSaco();
}

// ===================================
// INVENTARIO
// ===================================

let filtroInventarioActivo = 'todos'; // Variable global para mantener el filtro activo

/**
 * Extraer marca del nombre del producto
 * Usa la lista dinámica de marcas guardadas en localStorage
 */
function extraerMarcaDeProducto(nombre) {
    if (!nombre) return null;
    
    // Asegurar que las marcas estén inicializadas
    if (marcasActuales.length === 0) {
        inicializarMarcas();
    }
    
    const nombreLower = nombre.toLowerCase();
    
    // Buscar marcas ordenadas por longitud (primero las más largas)
    const marcasOrdenadas = [...marcasActuales].sort((a, b) => b.length - a.length);
    
    for (const marca of marcasOrdenadas) {
        const marcaLower = marca.toLowerCase();
        if (nombreLower.includes(marcaLower)) {
            return marca;
        }
    }
    
    // No se encontró marca reconocida
    return null;
}

/**
 * Actualizar select de marcas con marcas únicas de productos
 * SINCRONIZADO con el modal de gestión de marcas
 */
function actualizarSelectMarcas() {
    const selectMarca = document.getElementById('filtroMarca');
    if (!selectMarca) {
        console.warn('⚠️ No se encontró el select de filtro por marca');
        return;
    }
    
    // IMPORTANTE: Guardar la selección actual antes de repoblar
    const valorActual = selectMarca.value;
    
    console.log('🏷️ Actualizando select de marcas...');
    console.log('🏷️ Valor seleccionado actualmente:', valorActual);
    
    // Asegurar que las marcas estén inicializadas
    if (marcasActuales.length === 0) {
        inicializarMarcas();
    }
    
    console.log('🏷️ Marcas disponibles (sincronizado con modal):', marcasActuales);
    
    // Convertir a array y ordenar alfabéticamente
    const marcasOrdenadas = [...marcasActuales].sort((a, b) => 
        a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
    
    // Limpiar y repoblar el select
    selectMarca.innerHTML = '<option value="">Todas las marcas</option>';
    marcasOrdenadas.forEach(marca => {
        const option = document.createElement('option');
        option.value = marca;
        option.textContent = marca;
        selectMarca.appendChild(option);
    });
    
    // RESTAURAR la selección anterior
    if (valorActual) {
        selectMarca.value = valorActual;
        console.log('✅ Valor restaurado:', selectMarca.value);
    }
    
    console.log(`✅ ${marcasOrdenadas.length} marcas agregadas al filtro (sincronizado)`);
}

/**
 * Filtrar y ordenar inventario por estado
 */
function filtrarInventario(filtro) {
    filtroInventarioActivo = filtro;

    // Actualizar indicador visual
    document.querySelectorAll('.stat-card-clickable').forEach(card => {
        card.classList.remove('stat-card-active');
    });
    document.querySelector(`[data-filtro="${filtro}"]`)?.classList.add('stat-card-active');

    // Limpiar buscador si se selecciona un filtro
    const buscador = document.getElementById('buscadorProductos');
    if (buscador) {
        buscador.value = '';
        document.getElementById('btnLimpiarBusqueda').style.display = 'none';
    }

    // Recargar inventario con filtro
    cargarInventario();
}

/**
 * Filtrar y ordenar inventario por estado
 */
function filtrarInventario(filtro) {
    filtroInventarioActivo = filtro;

    // Actualizar indicador visual
    document.querySelectorAll('.stat-card-clickable').forEach(card => {
        card.classList.remove('stat-card-active');
    });
    document.querySelector(`[data-filtro="${filtro}"]`)?.classList.add('stat-card-active');

    // Recargar inventario con filtro
    cargarInventario();
}

/**
 * Actualizar encabezados de tabla según rol del usuario
 */
function actualizarEncabezadosInventario() {
    const thead = document.querySelector('#inventoryTable thead tr');
    if (!thead) return;

    const esVendedor = currentUserRole === 'vendedor';

    if (esVendedor) {
        // VENDEDOR: Producto | Acciones | Stock | Estado | Proveedor
        thead.innerHTML = `
            <th>Producto</th>
            <th>Acciones</th>
            <th>Stock</th>
            <th>Estado</th>
            <th>Proveedor</th>
        `;
    } else {
        // ADMIN/ENCARGADO: Producto | Proveedor | Categoría | Precio | Stock | Código de Barras | Estado | Acciones
        thead.innerHTML = `
            <th>Producto</th>
            <th>Proveedor</th>
            <th>Categoría</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Código de Barras</th>
            <th>Estado</th>
            <th>Acciones</th>
        `;
    }
}

/**
 * Calcular estadísticas del inventario
 * @param {Array} productos - Lista de productos
 * @returns {Object} Estadísticas calculadas
 */
function calcularEstadisticasInventario(productos) {
    const totalProductos = productos.length;
    const enStock = productos.filter(p => p.stock > (p.stock_minimo || 5)).length;
    const stockBajo = productos.filter(p => p.stock > 0 && p.stock <= (p.stock_minimo || 5)).length;
    const sinStock = productos.filter(p => p.stock === 0).length;
    const sinPrecio = productos.filter(p => !p.precio || p.precio === 0).length;

    return { totalProductos, enStock, stockBajo, sinStock, sinPrecio };
}

/**
 * Actualizar UI con estadísticas del inventario
 * @param {Object} estadisticas - Estadísticas calculadas
 */
function actualizarUIEstadisticas(estadisticas) {
    document.getElementById('totalProductos').textContent = estadisticas.totalProductos;
    document.getElementById('enStock').textContent = estadisticas.enStock;
    document.getElementById('stockBajo').textContent = estadisticas.stockBajo;
    document.getElementById('sinStock').textContent = estadisticas.sinStock;
    
    const sinPrecioElement = document.getElementById('sinPrecio');
    if (sinPrecioElement) {
        sinPrecioElement.textContent = estadisticas.sinPrecio;
    }
}

/**
 * Filtrar y ordenar productos según filtro activo
 * @param {Array} productos - Lista de productos
 * @param {string} filtroActivo - Filtro actual
 * @returns {Array} Productos filtrados
 */
function aplicarFiltroInventario(productos, filtroActivo) {
    let productosFiltrados = [...productos];

    switch(filtroActivo) {
        case 'sinstock':
            productosFiltrados = productos.filter(p => p.stock === 0);
            productosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
            break;
        case 'stockbajo':
            productosFiltrados = productos.filter(p => p.stock > 0 && p.stock <= (p.stock_minimo || 5));
            productosFiltrados.sort((a, b) => a.stock - b.stock);
            break;
        case 'enstock':
            productosFiltrados = productos.filter(p => p.stock > (p.stock_minimo || 5));
            productosFiltrados.sort((a, b) => b.stock - a.stock);
            break;
        case 'sinprecio':
            productosFiltrados = productos.filter(p => !p.precio || p.precio === 0);
            productosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
            break;
        case 'todos':
        default:
            productosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
            break;
    }

    return productosFiltrados;
}

/**
 * Aplicar filtros adicionales a productos
 * @param {Array} productos - Lista de productos
 * @returns {Array} Productos filtrados
 */
function aplicarFiltrosAdicionales(productos) {
    let productosFiltrados = [...productos];

    // Filtro por proveedor
    const filtroProveedorSelect = document.getElementById('filtroProveedor');
    if (filtroProveedorSelect) {
        const proveedorSeleccionado = filtroProveedorSelect.value;
        if (proveedorSeleccionado) {
            if (proveedorSeleccionado === 'Sin proveedor') {
                productosFiltrados = productosFiltrados.filter(p => 
                    !p.proveedor || p.proveedor === '' || p.proveedor === 'Sin proveedor'
                );
            } else {
                productosFiltrados = productosFiltrados.filter(p => 
                    p.proveedor === proveedorSeleccionado
                );
            }
        }
    }

    // Filtro por categoría
    const filtroCategoriaSelect = document.getElementById('filtroCategoria');
    if (filtroCategoriaSelect) {
        const categoriaSeleccionada = filtroCategoriaSelect.value;
        if (categoriaSeleccionada) {
            productosFiltrados = productosFiltrados.filter(p => 
                p.categoria === categoriaSeleccionada
            );
        }
    }

    // Filtro por marca
    const filtroMarcaSelect = document.getElementById('filtroMarca');
    if (filtroMarcaSelect) {
        const marcaSeleccionada = filtroMarcaSelect.value;
        if (marcaSeleccionada) {
            console.log('🏷️ Filtrando por marca:', marcaSeleccionada);
            const antesFiltro = productosFiltrados.length;
            productosFiltrados = productosFiltrados.filter(p => {
                const marcaProducto = extraerMarcaDeProducto(p.nombre);
                return marcaProducto === marcaSeleccionada;
            });
            console.log(`🏷️ Productos después del filtro de marca: ${productosFiltrados.length} (antes: ${antesFiltro})`);
        }
    }

    return productosFiltrados;
}

/**
 * Generar HTML para fila de producto
 * @param {Object} producto - Producto a renderizar
 * @param {boolean} esVendedor - Si el usuario es vendedor
 * @returns {string} HTML de la fila
 */
function generarFilaProducto(producto, esVendedor) {
    if (!producto.id) {
        console.error('Producto sin ID:', producto);
        return '';
    }

    const esGranel = producto.nombre && producto.nombre.toLowerCase().includes('(granel)') || producto.tipo === 'granel';
    const stockBajo = producto.stock <= (producto.stock_minimo_sacos || 5);
    const stockCero = producto.stock === 0;

    let estadoBadge = 'badge-success';
    let estadoTexto = 'En Stock';
    
    if (esGranel) {
        estadoBadge = 'badge-info';
        estadoTexto = 'Granel';
    } else if (stockCero) {
        estadoBadge = 'badge-danger';
        estadoTexto = 'Sin Stock';
    } else if (stockBajo) {
        estadoBadge = 'badge-warning';
        estadoTexto = 'Stock Bajo';
    }

    // Código de barras
    let codigoBarrasHTML = '';
    if (producto.codigo_barras && producto.codigo_barras.trim() !== '') {
        const codigoEscapado = escapeHtml(producto.codigo_barras);
        codigoBarrasHTML = `<span class="codigo-asignado">✅ ${codigoEscapado}</span>`;
    } else {
        codigoBarrasHTML = `<span class="sin-codigo">⚠️ Sin código</span>`;
    }

    const nombreEscapado = escapeHtml(producto.nombre);

    const btnEliminar = currentUserRole === 'encargado' ? `
        <button class="btn-icon btn-icon-delete" onclick="eliminarProductoDirecto(${producto.id})" title="Eliminar">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M7 3h6M3 5h14M5 5v11a2 2 0 002 2h6a2 2 0 002-2V5M8 9v6M12 9v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    ` : '';

    let proveedorCategoria = '';
    if (producto.proveedor && producto.proveedor !== '' && producto.proveedor !== 'Sin proveedor') {
        proveedorCategoria = producto.proveedor;
    }

    if (esVendedor) {
        return `
            <tr>
                <td><strong>${nombreEscapado}</strong></td>
                <td>
                    <button class="btn-icon" onclick="editarProducto(${producto.id})" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                            <path d="M13.5 6.5l-8 8V17h2.5l8-8m-2.5-2.5l2-2 2.5 2.5-2 2m-2.5-2.5l2.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </td>
                <td><strong>${Math.floor(producto.stock)}</strong></td>
                <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
                <td>${proveedorCategoria || '-'}</td>
            </tr>
        `;
    } else {
        return `
            <tr>
                <td><strong>${nombreEscapado}</strong></td>
                <td>${proveedorCategoria || '-'}</td>
                <td>${producto.categoria || '-'}</td>
                <td>$${formatoMoneda(producto.precio)}</td>
                <td><strong>${Math.floor(producto.stock)}</strong></td>
                <td>${codigoBarrasHTML}</td>
                <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
                <td>
                    <button class="btn-icon" onclick="editarProducto(${producto.id})" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                            <path d="M13.5 6.5l-8 8V17h2.5l8-8m-2.5-2.5l2-2 2.5 2.5-2 2m-2.5-2.5l2.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    ${btnEliminar}
                </td>
            </tr>
        `;
    }
}

async function cargarInventario() {
    console.log('📦 === CARGAR INVENTARIO EJECUTADO ===');
    
    if (productos.length === 0) {
        await cargarProductos();
    }

    // 1. Actualizar filtros
    actualizarSelectProveedores();
    actualizarSelectCategorias();
    actualizarSelectMarcas();
    
    const filtroProveedor = document.getElementById('filtroProveedor')?.value || '';
    const filtroCategoria = document.getElementById('filtroCategoria')?.value || '';
    const filtroMarca = document.getElementById('filtroMarca')?.value || '';
    console.log('📂 Filtros activos:', { proveedor: filtroProveedor, categoria: filtroCategoria, marca: filtroMarca });

    // 2. Actualizar encabezados según rol
    actualizarEncabezadosInventario();

    // 3. Calcular y mostrar estadísticas
    const estadisticas = calcularEstadisticasInventario(productos);
    actualizarUIEstadisticas(estadisticas);

    // 4. Aplicar filtros
    let productosFiltrados = aplicarFiltroInventario(productos, filtroInventarioActivo);
    productosFiltrados = aplicarFiltrosAdicionales(productosFiltrados);

    // 5. Renderizar tabla
    const tbody = document.getElementById('inventoryTableBody');
    const esVendedor = currentUserRole === 'vendedor';

    if (productosFiltrados.length === 0) {
        let mensajeFiltro = 'No hay productos';
        switch(filtroInventarioActivo) {
            case 'sinstock': mensajeFiltro = 'No hay productos sin stock'; break;
            case 'stockbajo': mensajeFiltro = 'No hay productos con stock bajo'; break;
            case 'enstock': mensajeFiltro = 'No hay productos en stock'; break;
        }

        const colspan = esVendedor ? 5 : 8;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" style="text-align: center; padding: 40px; color: #6b7280;">
                    <div style="font-size: 48px; margin-bottom: 12px;">📦</div>
                    <div style="font-size: 16px; font-weight: 600;">${mensajeFiltro}</div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = productosFiltrados.map(p => generarFilaProducto(p, esVendedor)).join('');

    // 6. Cargar historial de mermas (solo admin)
    if (currentUserRole === 'encargado') {
        const historialMermas = document.getElementById('historialMermas');
        if (historialMermas) {
            historialMermas.style.display = 'block';
            await cargarHistorialMermas();
        }
    } else {
        const historialMermas = document.getElementById('historialMermas');
        if (historialMermas) historialMermas.style.display = 'none';
    }
}

function editarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (producto) {
        abrirModalEditar(producto);
    } else {
        mostrarNotificacion('Producto no encontrado', 'error');
    }
}

// ===================================
// VENTAS
// ===================================

// ===================================
// VENTAS Y DASHBOARD INTEGRADO
// ===================================

// ===================================
// MÓDULO DE VENTAS - FUNCIONES AUXILIARES
// ===================================

/**
 * Cargar datos completos de ventas desde BD
 * @param {number} periodo - Días hacia atrás
 * @param {boolean} esAdmin - Es administrador
 * @returns {Promise<Array>} Array de ventas
 */
async function cargarDatosVentas(periodo, esAdmin) {
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - periodo);
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0];

    // Construir query base
    let query = window.supabaseClient
        .from('ventas')
        .select('*')
        .gte('fecha', fechaInicioStr);

    // Filtrar por vendedor si no es admin
    if (!esAdmin && currentUser) {
        query = query.eq('vendedor_nombre', currentUser);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

/**
 * Cargar items de ventas y asociarlos
 * @param {Array} ventas - Array de ventas
 * @returns {Promise<void>}
 */
async function cargarItemsVentas(ventas) {
    if (ventas.length === 0) return;

    const ventasIds = ventas.map(v => v.id);
    const { data: items, error: itemsError } = await window.supabaseClient
        .from('ventas_items')
        .select('venta_id, cantidad, producto_nombre')
        .in('venta_id', ventasIds);

    if (itemsError || !items) return;

    // Crear mapa de items agrupados por venta
    const itemsPorVenta = {};
    items.forEach(item => {
        if (!itemsPorVenta[item.venta_id]) {
            itemsPorVenta[item.venta_id] = [];
        }
        itemsPorVenta[item.venta_id].push({
            nombre: item.producto_nombre,
            cantidad: item.cantidad
        });
    });

    // Agregar items a cada venta
    ventas.forEach(venta => {
        venta.productos = itemsPorVenta[venta.id] || [];
        venta.conteo_productos = venta.productos.length;
    });
}

/**
 * Cargar devoluciones y marcar ventas devueltas
 * @param {Array} ventas - Array de ventas
 * @returns {Promise<void>}
 */
async function cargarDevolucionesVentas(ventas) {
    if (ventas.length === 0) return;

    const ventasIds = ventas.map(v => v.id);
    const { data: devoluciones, error: devError } = await window.supabaseClient
        .from('devoluciones')
        .select('venta_id')
        .in('venta_id', ventasIds)
        .is('deleted_at', null);

    if (devError || !devoluciones) return;

    const ventasConDevolucion = new Set(devoluciones.map(d => d.venta_id));
    ventas.forEach(venta => {
        venta.tiene_devolucion = ventasConDevolucion.has(venta.id);
    });
}

/**
 * Cargar movimientos de stock del sistema de reparto
 * @param {number} periodo - Días hacia atrás
 * @returns {Promise<Array>} Array de movimientos formateados
 */
async function cargarMovimientosStock(periodo) {
    try {
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - periodo);
        const fechaInicioStr = fechaInicio.toISOString();

        const { data: movimientos, error: movError } = await window.supabaseClient
            .from('movimientos_stock')
            .select('*')
            .eq('tipo', 'salida')
            .gte('created_at', fechaInicioStr)
            .order('created_at', { ascending: false });

        if (movError || !movimientos || movimientos.length === 0) {
            return [];
        }

        console.log(`📦 Movimientos encontrados:`, movimientos.length);

        // Obtener nombres de productos
        const productosIds = [...new Set(movimientos.map(m => m.producto_id).filter(Boolean))];
        let nombresProductos = {};

        if (productosIds.length > 0) {
            const { data: prods } = await window.supabaseClient
                .from('productos')
                .select('id, nombre')
                .in('id', productosIds);

            if (prods) {
                nombresProductos = Object.fromEntries(prods.map(p => [p.id, p.nombre]));
            }
        }

        // Obtener repartidores desde sistema de reparto
        let repartidoresPorPedido = {};
        const pedidosIds = [...new Set(movimientos.map(m => m.pedido_id).filter(Boolean))];

        if (pedidosIds.length > 0) {
            try {
                const { data: pedidos, error: pedidosError } = await window.supabaseClient
                    .from('pedidos')
                    .select('id, chofer_asignado')
                    .in('id', pedidosIds);

                if (!pedidosError && pedidos) {
                    repartidoresPorPedido = Object.fromEntries(
                        pedidos.map(p => [p.id, p.chofer_asignado || 'Sin asignar'])
                    );
                    console.log('✅ Integración con sistema de reparto exitosa');
                }
            } catch (pedidosErr) {
                console.warn('⚠️ No se pudo conectar con sistema de reparto:', pedidosErr.message);
            }
        }

        // Transformar movimientos al formato de "ventas"
        return movimientos.map(m => {
            const nombreProducto = nombresProductos[m.producto_id] || `Producto ID: ${m.producto_id}`;
            const esGranel = nombreProducto.toLowerCase().includes('(granel)');

            return {
                id: `M-${m.id}`,
                created_at: m.created_at,
                fecha: m.created_at,
                vendedor_nombre: repartidoresPorPedido[m.pedido_id] || '🚚 Reparto',
                productos: [{
                    nombre: nombreProducto,
                    cantidad: m.cantidad
                }],
                total: esGranel ? m.cantidad : 0,
                metodo_pago: 'REPARTO',
                pedido_id: m.pedido_id,
                tipo_registro: 'movimiento',
                motivo: m.motivo,
                es_granel: esGranel
            };
        });
    } catch (movErr) {
        console.warn('⚠️ Error al cargar movimientos de stock:', movErr.message);
        return [];
    }
}

// ===================================
// MÓDULO DE VENTAS - FUNCIÓN PRINCIPAL
// ===================================

async function cargarVentas() {
    const periodo = parseInt(document.getElementById('periodoVentas')?.value, 10) || 30;

    try {
        if (!window.supabaseClient) {
            mostrarVentasMock();
            return;
        }

        const esAdmin = currentUserRole === 'encargado';

        // 1. Cargar ventas
        const ventas = await cargarDatosVentas(periodo, esAdmin);

        // 2. Cargar items de ventas
        await cargarItemsVentas(ventas);

        // 3. Marcar ventas con devoluciones
        await cargarDevolucionesVentas(ventas);

        // 4. Cargar movimientos de stock (opcional)
        let movimientosFormateados = [];
        try {
            movimientosFormateados = await cargarMovimientosStock(periodo);
        } catch (err) {
            console.warn('⚠️ Movimientos de stock no disponibles:', err.message);
        }

        // 5. Combinar ventas con movimientos
        const todosLosRegistros = movimientosFormateados.length > 0
            ? [...ventas, ...movimientosFormateados]
            : ventas;

        // 6. Reordenar por fecha si hay movimientos
        if (movimientosFormateados.length > 0) {
            todosLosRegistros.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        // 7. Calcular KPIs (solo con ventas reales)
        calcularKPIs(ventas);

        // 8. Generar gráficos (solo con ventas)
        generarGraficoVentasDiarias(ventas, periodo);
        generarGraficoMetodosPago(ventas);
        await generarGraficoTopProductos(periodo);

        // 9. Ranking de vendedores (solo para admin)
        if (esAdmin) {
            generarTablaVendedores(ventas);
            const ranking = document.getElementById('rankingVendedores');
            if (ranking) ranking.style.display = 'block';
        } else {
            const ranking = document.getElementById('rankingVendedores');
            if (ranking) ranking.style.display = 'none';
        }

        // 10. Historial de devoluciones (solo para admin)
        const historialDevoluciones = document.getElementById('historialDevoluciones');
        if (historialDevoluciones) {
            historialDevoluciones.style.display = esAdmin ? 'block' : 'none';
        }

        // 11. Renderizar tabla de historial
        renderTablaHistorialVentas(todosLosRegistros);

    } catch (error) {
        manejarError(error, {
            contexto: 'Cargar ventas',
            mensajeUsuario: 'Error al cargar el historial de ventas',
            esErrorCritico: false
        });

        // Mostrar mensaje en la tabla
        const tbody = document.getElementById('salesTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center">
                        <p style="padding: 24px; color: hsl(var(--destructive));">
                            ❌ Error al cargar datos: ${error.message}<br>
                            <small>Verifica la consola para más detalles</small>
                        </p>
                    </td>
                </tr>
            `;
        }
    }
}

function actualizarVentas() {
    cargarVentas();
    if (currentUserRole === 'encargado') {
        cargarHistorialDevoluciones();
    }
}

function calcularKPIs(ventas) {
    const hoy = new Date();
    const fechaHoy = hoy.toISOString().split('T')[0]; // YYYY-MM-DD
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - 7);
    const inicioMes = new Date();
    inicioMes.setMonth(inicioMes.getMonth() - 1);

    // Ventas hoy (comparar por fecha exacta)
    const ventasHoy = ventas.filter(v => {
        const fechaBase = v.created_at || v.fecha;
        if (!fechaBase) return false;
        const ventaFecha = new Date(fechaBase).toISOString().split('T')[0];
        return ventaFecha === fechaHoy;
    });
    const totalHoy = ventasHoy.reduce((sum, v) => sum + v.total, 0);
    document.getElementById('kpiVentasHoy').textContent = '$' + formatoMoneda(totalHoy);

    // Ventas semana
    const ventasSemana = ventas.filter(v => new Date(v.created_at || v.fecha) >= inicioSemana);
    const totalSemana = ventasSemana.reduce((sum, v) => sum + v.total, 0);
    document.getElementById('kpiVentasSemana').textContent = '$' + formatoMoneda(totalSemana);

    // Ventas mes
    const ventasMes = ventas.filter(v => new Date(v.created_at || v.fecha) >= inicioMes);
    const totalMes = ventasMes.reduce((sum, v) => sum + v.total, 0);
    document.getElementById('kpiVentasMes').textContent = '$' + formatoMoneda(totalMes);

    // Ticket promedio
    const ticketPromedio = ventasMes.length > 0 ? totalMes / ventasMes.length : 0;
    document.getElementById('kpiTicketPromedio').textContent = '$' + formatoMoneda(ticketPromedio);
}

function generarGraficoVentasDiarias(ventas, periodo) {
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.warn('⚠️ Chart.js no disponible, omitiendo gráfico de ventas diarias');
        return;
    }

    // Agrupar ventas por día
    const ventasPorDia = {};

    for (let i = 0; i < periodo; i++) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - (periodo - 1 - i));
        const key = fecha.toLocaleDateString('es-CL', { month: 'short', day: 'numeric' });
        ventasPorDia[key] = 0;
    }

    ventas.forEach(v => {
        // Usar created_at para fecha/hora precisa, o fecha como fallback
        const fechaVenta = new Date(v.created_at || v.fecha);
        const key = fechaVenta.toLocaleDateString('es-CL', { month: 'short', day: 'numeric', timeZone: 'America/Santiago' });
        if (ventasPorDia[key] !== undefined) {
            ventasPorDia[key] += v.total;
        }
    });

    const labels = Object.keys(ventasPorDia);
    const data = Object.values(ventasPorDia);

    const ctx = document.getElementById('chartVentasDiarias');

    // Destruir gráfico anterior si existe
    if (chartVentasDiarias) {
        chartVentasDiarias.destroy();
    }

    chartVentasDiarias = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ventas ($)',
                data: data,
                borderColor: 'rgb(99, 102, 241)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => '$' + formatoMoneda(context.parsed.y)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => '$' + formatoMoneda(value)
                    }
                }
            }
        }
    });
}

function generarGraficoMetodosPago(ventas) {
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.warn('⚠️ Chart.js no disponible, omitiendo gráfico de métodos de pago');
        return;
    }

    const metodos = {};

    ventas.forEach(v => {
        const metodo = v.metodo_pago || 'No especificado';
        metodos[metodo] = (metodos[metodo] || 0) + v.total;
    });

    const labels = Object.keys(metodos);
    const data = Object.values(metodos);
    const colores = [
        'rgba(34, 197, 94, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(168, 85, 247, 0.8)'
    ];

    const ctx = document.getElementById('chartMetodosPago');

    if (chartMetodosPago) {
        chartMetodosPago.destroy();
    }

    chartMetodosPago = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colores,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = '$' + formatoMoneda(context.parsed);
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

async function generarGraficoTopProductos(periodo) {
    try {
        const ctx = document.getElementById('chartTopProductos');

        if (!ctx) {
            return;
        }

        // If Supabase is not available, skip this chart
        if (!window.supabaseClient) {
            console.log('⚠️ Supabase no disponible, omitiendo gráfico de top productos');
            if (chartTopProductos) {
                chartTopProductos.destroy();
                chartTopProductos = null;
            }
            return;
        }

        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - periodo);
        const fechaInicioStr = fechaInicio.toISOString().split('T')[0]; // YYYY-MM-DD

        // Obtener ventas del período
        const { data: ventas } = await window.supabaseClient
            .from('ventas')
            .select('id')
            .gte('fecha', fechaInicioStr);

        if (!ventas || ventas.length === 0) {
            console.log('ℹ️ No hay ventas en el período para productos');
            if (chartTopProductos) {
                chartTopProductos.destroy();
                chartTopProductos = null;
            }
            return;
        }

        const ventasIds = ventas.map(v => v.id);

        // Obtener items vendidos
        const { data: items, error: itemsError } = await window.supabaseClient
            .from('ventas_items')
            .select('producto_nombre, cantidad')
            .in('venta_id', ventasIds);

        if (itemsError || !items || items.length === 0) {
            console.warn('⚠️ No hay items de ventas en el período');
            if (chartTopProductos) {
                chartTopProductos.destroy();
                chartTopProductos = null;
            }
            return;
        }

        // Agrupar por producto
        const productosMap = {};
        items.forEach(item => {
            const nombre = item.producto_nombre || 'Producto';
            productosMap[nombre] = (productosMap[nombre] || 0) + (item.cantidad || 1);
        });

        const productosArray = Object.entries(productosMap)
            .map(([nombre, cantidad]) => ({ nombre, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 10);

        const labels = productosArray.map(p => p.nombre);
        const data = productosArray.map(p => p.cantidad);

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('⚠️ Chart.js no disponible, omitiendo gráfico de top productos');
            return;
        }

        if (chartTopProductos) {
            chartTopProductos.destroy();
        }

        chartTopProductos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: data,
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    borderRadius: 8
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        });

    } catch (error) {
        manejarError(error, {
            contexto: 'generarGraficoTopProductos',
            mensajeUsuario: 'Error generando gráfico de productos',
            mostrarNotificacion: false,
            callback: () => {
                if (chartTopProductos) {
                    chartTopProductos.destroy();
                    chartTopProductos = null;
                }
            }
        });
    }
}

function generarTablaVendedores(ventas) {
    const vendedoresMap = {};

    ventas.forEach(v => {
        const vendedor = v.vendedor_nombre || v.vendedor || 'Sin asignar';
        if (!vendedoresMap[vendedor]) {
            vendedoresMap[vendedor] = {
                numVentas: 0,
                total: 0
            };
        }
        vendedoresMap[vendedor].numVentas++;
        vendedoresMap[vendedor].total += v.total;
    });

    const vendedoresArray = Object.entries(vendedoresMap)
        .map(([nombre, datos]) => ({
            nombre,
            ...datos
        }))
        .sort((a, b) => b.total - a.total);

    const container = document.getElementById('tablaVendedores');

    if (vendedoresArray.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: hsl(var(--muted-foreground));">No hay datos de vendedores</p>';
        return;
    }

    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="border-bottom: 2px solid hsl(var(--border));">
                    <th style="padding: 12px; text-align: left;">#</th>
                    <th style="padding: 12px; text-align: left;">Vendedor</th>
                    <th style="padding: 12px; text-align: center;">N° Ventas</th>
                    <th style="padding: 12px; text-align: right;">Total Vendido</th>
                </tr>
            </thead>
            <tbody>
                ${vendedoresArray.map((v, index) => {
                    let medalla = '';
                    if (index === 0) medalla = '🥇';
                    else if (index === 1) medalla = '🥈';
                    else if (index === 2) medalla = '🥉';

                    return `
                        <tr style="border-bottom: 1px solid hsl(var(--border));">
                            <td style="padding: 12px; font-size: 20px;">${medalla || (index + 1)}</td>
                            <td style="padding: 12px; font-weight: 500;">${v.nombre}</td>
                            <td style="padding: 12px; text-align: center;">${v.numVentas}</td>
                            <td style="padding: 12px; text-align: right; font-weight: 600;">$${formatoMoneda(v.total)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Formatear lista de productos para mostrar
 * @param {Array} productos - Lista de productos
 * @returns {string} HTML formateado
 */
function formatearProductosVenta(productos) {
    if (!productos || productos.length === 0) {
        return `<span style="color: hsl(var(--muted-foreground));">Sin items</span>`;
    }

    if (productos.length <= 2) {
        return productos.map(p => `${p.nombre} (${p.cantidad})`).join(', ');
    } else {
        const primeros = productos.slice(0, 2).map(p => `${p.nombre} (${p.cantidad})`).join(', ');
        const restantes = productos.length - 2;
        return `${primeros} <span style="color: hsl(var(--muted-foreground));">(+${restantes} más)</span>`;
    }
}

/**
 * Renderizar fila de movimiento de stock
 * @param {Object} movimiento - Datos del movimiento
 * @returns {string} HTML de la fila
 */
function renderFilaMovimiento(movimiento) {
    const totalCelda = movimiento.es_granel && movimiento.total > 0 
        ? `<strong>$${formatoMoneda(movimiento.total)}</strong>` 
        : '';
    
    const productosHTML = formatearProductosVenta(movimiento.productos);
    
    return `
        <tr>
            <td><strong>${movimiento.id}</strong></td>
            <td>${new Date(movimiento.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</td>
            <td>${movimiento.vendedor_nombre}</td>
            <td>${productosHTML}</td>
            <td colspan="2"></td>
            <td>${totalCelda}</td>
            <td><span class="badge badge-warning">REPARTO</span></td>
            <td>
                <span style="font-size: 12px; color: #6b7280;">${movimiento.motivo || 'Salida por reparto'}</span>
            </td>
        </tr>
    `;
}

/**
 * Renderizar fila de venta normal
 * @param {Object} venta - Datos de la venta
 * @returns {string} HTML de la fila
 */
function renderFilaVenta(venta) {
    const filaClass = venta.tiene_devolucion ? 'venta-con-devolucion' : '';
    const badgeDevolucion = venta.tiene_devolucion 
        ? '<span class="badge-devolucion" title="Esta venta tiene devolución registrada">🔄 Devuelto</span>' 
        : '';
    
    const productosHTML = formatearProductosVenta(venta.productos);
    
    // Información de descuento
    const tieneDescuento = venta.descuento_aplicado && venta.descuento_aplicado > 0;
    const subtotalOriginal = tieneDescuento && venta.subtotal_sin_descuento 
        ? `$${formatoMoneda(venta.subtotal_sin_descuento)}` 
        : `$${formatoMoneda(venta.total)}`;
    
    let descuentoTexto = '-';
    if (tieneDescuento) {
        const tipoDesc = venta.descuento_tipo === 'porcentaje' ? `${venta.descuento_valor}%` : '$';
        descuentoTexto = `<span style="color: hsl(142 76% 36%); font-weight: 600;">-$${formatoMoneda(venta.descuento_aplicado)}</span><br><small style="color: hsl(var(--muted-foreground));">(${tipoDesc})</small>`;
    }
    
    const btnDevolucion = currentUserRole === 'encargado' ? `
        <button class="btn-icon" onclick="abrirModalDevolucion(${venta.id})" title="Procesar devolución" style="color: hsl(0 84% 60%);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    ` : '';

    const btnEditarMetodoPago = currentUserRole === 'encargado' ? `
        <button class="btn-icon" onclick="abrirModalEditarMetodoPago(${venta.id})" title="Editar método de pago" style="color: hsl(217 91% 60%);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    ` : '';

    const btnEliminar = currentUserRole === 'encargado' ? `
        <button class="btn-icon" onclick="confirmarEliminarVenta(${venta.id})" title="Eliminar venta" style="color: hsl(0 84% 60%);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    ` : '';
    
    return `
        <tr class="${filaClass}">
            <td><strong>#${venta.id}</strong> ${badgeDevolucion}</td>
            <td>${new Date(venta.created_at || venta.fecha).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</td>
            <td>${venta.vendedor_nombre || venta.vendedor || 'Sin asignar'}</td>
            <td>${productosHTML}</td>
            <td>${subtotalOriginal}</td>
            <td>${descuentoTexto}</td>
            <td><strong>$${formatoMoneda(venta.total)}</strong></td>
            <td><span class="badge badge-success">${venta.metodo_pago}</span></td>
            <td style="display: flex; gap: 4px;">
                <button class="btn-icon" onclick="verDetalleVenta(${venta.id})" title="Ver detalle">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
                        <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>
                <button class="btn-icon" onclick="imprimirBoletaDirecta(${venta.id})" title="Imprimir boleta" style="color: hsl(142 76% 36%);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>
                ${btnEditarMetodoPago}
                ${btnDevolucion}
                ${btnEliminar}
            </td>
        </tr>
    `;
}

function renderTablaHistorialVentas(ventas) {
    const tbody = document.getElementById('salesTableBody');

    if (ventas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center">
                    <p style="padding: 24px; color: hsl(var(--muted-foreground));">No hay ventas en este período</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = ventas.slice(0, 50).map(v => {
        const esMovimiento = v.tipo_registro === 'movimiento';
        return esMovimiento ? renderFilaMovimiento(v) : renderFilaVenta(v);
    }).join('');
}

function mostrarVentasMock() {
    const ventas = [
        { id: 1, fecha: new Date().toISOString(), vendedor: currentUser || 'Demo', productos: [{ nombre: 'Producto Demo', cantidad: 1 }], total: 10000, metodo_pago: 'Efectivo' }
    ];
    calcularKPIs(ventas);
    generarGraficoVentasDiarias(ventas, 30);
    generarGraficoMetodosPago(ventas);
    generarTablaVendedores(ventas);
    renderTablaHistorialVentas(ventas);
}

/**
 * Cargar datos de la venta desde BD
 * @param {number} id - ID de la venta
 * @returns {Promise<Object>} Objeto con venta, items y detalles de pago
 */
async function cargarDatosVenta(id) {
    // Consultar venta
    const { data: venta, error: ventaError } = await window.supabaseClient
        .from('ventas')
        .select('*')
        .eq('id', id)
        .single();

    if (ventaError) throw ventaError;

    // Consultar items
    const { data: items, error: itemsError } = await window.supabaseClient
        .from('ventas_items')
        .select('*')
        .eq('venta_id', id);

    if (itemsError) {
        console.warn('No se pudieron cargar los items:', itemsError);
    }

    // Parsear detalles de pagos
    let detallesPagos = [];
    if (venta.pagos_detalle) {
        try {
            detallesPagos = typeof venta.pagos_detalle === 'string'
                ? JSON.parse(venta.pagos_detalle)
                : venta.pagos_detalle;
        } catch (e) {
            console.warn('No se pudo parsear pagos_detalle');
        }
    }

    return { venta, items: items || [], detallesPagos };
}

/**
 * Generar HTML para información general de venta
 * @param {Object} venta - Datos de la venta
 * @returns {string} HTML generado
 */
function generarHTMLInfoGeneralVenta(venta) {
    return `
        <div style="background: hsl(var(--muted)/0.3); padding: 16px; border-radius: 8px;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                <div>
                    <p style="font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0 0 4px;">ID Venta</p>
                    <p style="font-weight: 600; margin: 0;">#${venta.id}</p>
                </div>
                <div>
                    <p style="font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0 0 4px;">Fecha/Hora</p>
                    <p style="font-weight: 600; margin: 0;">${new Date(venta.created_at || venta.fecha).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>
                </div>
                <div>
                    <p style="font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0 0 4px;">Vendedor</p>
                    <p style="font-weight: 600; margin: 0;">${venta.vendedor_nombre || venta.vendedor || 'Sin asignar'}</p>
                </div>
                <div>
                    <p style="font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0 0 4px;">Total</p>
                    <p style="font-weight: 700; font-size: 20px; color: hsl(142 76% 36%); margin: 0;">$${formatoMoneda(venta.total)}</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generar HTML para métodos de pago
 * @param {Object} venta - Datos de la venta
 * @param {Array} detallesPagos - Detalles de pagos múltiples
 * @returns {string} HTML generado
 */
function generarHTMLMetodosPagoVenta(venta, detallesPagos) {
    const contenidoPagos = detallesPagos.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${detallesPagos.map(pago => `
                <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: hsl(var(--muted)/0.3); border-radius: 6px;">
                    <span>${pago.metodo}</span>
                    <span style="font-weight: 600;">$${formatoMoneda(pago.monto)}</span>
                </div>
            `).join('')}
        </div>
    ` : `
        <div style="padding: 8px 12px; background: hsl(var(--muted)/0.3); border-radius: 6px;">
            <span style="font-weight: 600;">${venta.metodo_pago}</span>
        </div>
    `;

    return `
        <div>
            <h4 style="font-size: 14px; font-weight: 600; margin: 0 0 12px;">💳 Método de Pago</h4>
            ${contenidoPagos}
        </div>
    `;
}

/**
 * Generar HTML para productos vendidos
 * @param {Array} items - Items de la venta
 * @returns {string} HTML generado
 */
function generarHTMLProductosVenta(items) {
    const contenidoItems = items && items.length > 0 ? `
        <div style="border: 1px solid hsl(var(--border)); border-radius: 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: hsl(var(--muted)/0.3);">
                    <tr>
                        <th style="padding: 10px; text-align: left; font-size: 12px; font-weight: 600;">Producto</th>
                        <th style="padding: 10px; text-align: center; font-size: 12px; font-weight: 600;">Cant.</th>
                        <th style="padding: 10px; text-align: right; font-size: 12px; font-weight: 600;">P. Unit.</th>
                        <th style="padding: 10px; text-align: right; font-size: 12px; font-weight: 600;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr style="border-top: 1px solid hsl(var(--border));">
                            <td style="padding: 10px;">${item.producto_nombre}</td>
                            <td style="padding: 10px; text-align: center;">${item.cantidad}</td>
                            <td style="padding: 10px; text-align: right;">$${formatoMoneda(item.precio_unitario)}</td>
                            <td style="padding: 10px; text-align: right; font-weight: 600;">$${formatoMoneda(item.subtotal)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : `
        <div style="padding: 24px; text-align: center; color: hsl(var(--muted-foreground)); border: 1px dashed hsl(var(--border)); border-radius: 8px;">
            <p style="margin: 0;">⚠️ No hay detalle de productos para esta venta</p>
            <p style="margin: 8px 0 0; font-size: 12px;">(Venta realizada antes de implementar el sistema de items)</p>
        </div>
    `;

    return `
        <div>
            <h4 style="font-size: 14px; font-weight: 600; margin: 0 0 12px;">📦 Productos (${items && items.length > 0 ? items.length : 0} items)</h4>
            ${contenidoItems}
        </div>
    `;
}

/**
 * Ver detalle completo de una venta
 */
async function verDetalleVenta(id) {
    const modal = document.getElementById('modalDetalleVenta');
    const content = document.getElementById('detalleVentaContent');
    const title = modal?.querySelector('.modal-header h3');
    const printButton = modal?.querySelector('.modal-footer .btn.btn-primary');

    if (title) title.textContent = '🧾 Detalle de Venta';
    if (printButton) printButton.style.display = 'inline-flex';

    // Mostrar modal con loading
    modal.style.display = 'flex';
    modal.classList.add('show');
    content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: hsl(var(--muted-foreground));">
            <div class="spinner"></div>
            <p>Cargando detalle...</p>
        </div>
    `;

    try {
        // Cargar datos
        const { venta, items, detallesPagos } = await cargarDatosVenta(id);

        // Guardar para impresión
        ventaActualParaImprimir = { venta, items, detallesPagos };

        // Renderizar contenido
        content.innerHTML = `
            <div style="display: grid; gap: 20px;">
                ${generarHTMLInfoGeneralVenta(venta)}
                ${generarHTMLMetodosPagoVenta(venta, detallesPagos)}
                ${generarHTMLProductosVenta(items)}
            </div>
        `;

    } catch (error) {
        manejarError(error, {
            contexto: 'cargarDatosVenta (helper interno)',
            mensajeUsuario: 'Error cargando detalle de venta',
            mostrarNotificacion: false,
            callback: () => {
                content.innerHTML = `
                    <div style="padding: 24px; text-align: center; color: hsl(0 84% 60%);">
                        <p style="font-weight: 600; margin: 0 0 8px;">❌ Error al cargar detalle</p>
                        <p style="font-size: 14px; margin: 0; color: hsl(var(--muted-foreground));">${error.message}</p>
                    </div>
                `;
            }
        });
    }
}

/**
 * Cerrar modal de detalle de venta
 */
function cerrarModalDetalleVenta() {
    const modal = document.getElementById('modalDetalleVenta');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Variable global para almacenar la venta actual
let ventaActualParaImprimir = null;

/**
 * Imprimir boleta directamente desde el historial
 */
async function imprimirBoletaDirecta(id) {
    try {
        // Mostrar indicador de carga
        mostrarNotificacion('Preparando boleta...', 'info');

        // Consultar venta
        const { data: venta, error: ventaError } = await window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('id', id)
            .single();

        if (ventaError) throw ventaError;

        // Consultar items de la venta
        const { data: items, error: itemsError } = await window.supabaseClient
            .from('ventas_items')
            .select('*')
            .eq('venta_id', id);

        if (itemsError) {
            console.warn('No se pudieron cargar los items:', itemsError);
        }

        // Parsear detalle de pagos si existe
        let detallesPagos = [];
        if (venta.pagos_detalle) {
            try {
                detallesPagos = typeof venta.pagos_detalle === 'string'
                    ? JSON.parse(venta.pagos_detalle)
                    : venta.pagos_detalle;
            } catch (e) {
                console.warn('No se pudo parsear pagos_detalle');
            }
        }

        // Guardar datos para impresión
        ventaActualParaImprimir = {
            venta: venta,
            items: items || [],
            detallesPagos: detallesPagos
        };

        // Llamar a la función de impresión
        imprimirBoleta();

    } catch (error) {
        manejarError(error, {
            contexto: 'imprimirBoletaDirecta',
            mensajeUsuario: 'Error al cargar datos de la venta'
        });
    }
}

/**
 * Imprimir boleta de venta
 */
function imprimirBoleta() {
    if (!ventaActualParaImprimir) {
        mostrarNotificacion('No hay datos de venta para imprimir', 'error');
        return;
    }

    const venta = ventaActualParaImprimir.venta;
    const items = ventaActualParaImprimir.items || [];
    const detallesPagos = ventaActualParaImprimir.detallesPagos || [];

    // Crear ventana de impresión
    const ventanaImpresion = window.open('', '', 'width=800,height=600');
    
    const htmlBoleta = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Boleta #${venta.id} - Sabrofood</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Courier New', Courier, monospace;
                    padding: 20px;
                    max-width: 80mm;
                    margin: 0 auto;
                    background: white;
                }
                
                .boleta {
                    border: 2px solid #000;
                    padding: 15px;
                }
                
                .header {
                    text-align: center;
                    border-bottom: 2px dashed #000;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                }
                
                .header h1 {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .header p {
                    font-size: 12px;
                    margin: 2px 0;
                }
                
                .info-venta {
                    margin-bottom: 15px;
                    font-size: 12px;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 10px;
                }
                
                .info-venta p {
                    margin: 3px 0;
                    display: flex;
                    justify-content: space-between;
                }
                
                .info-venta strong {
                    font-weight: bold;
                }
                
                .productos {
                    margin-bottom: 15px;
                }
                
                .productos-header {
                    font-weight: bold;
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr;
                    gap: 5px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 5px;
                    margin-bottom: 10px;
                    font-size: 11px;
                }
                
                .producto-item {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr;
                    gap: 5px;
                    margin-bottom: 8px;
                    font-size: 11px;
                }
                
                .producto-item .nombre {
                    font-weight: 500;
                }
                
                .producto-item .cantidad,
                .producto-item .precio,
                .producto-item .subtotal {
                    text-align: right;
                }
                
                .totales {
                    border-top: 2px solid #000;
                    padding-top: 10px;
                    margin-top: 10px;
                }
                
                .total-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                    font-size: 12px;
                }
                
                .total-item.final {
                    font-size: 16px;
                    font-weight: bold;
                    border-top: 2px double #000;
                    padding-top: 8px;
                    margin-top: 8px;
                }
                
                .pagos {
                    margin-top: 15px;
                    border-top: 1px dashed #000;
                    padding-top: 10px;
                    font-size: 12px;
                }
                
                .pago-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 3px 0;
                }
                
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    border-top: 2px dashed #000;
                    padding-top: 10px;
                    font-size: 11px;
                }
                
                .footer p {
                    margin: 3px 0;
                }
                
                @media print {
                    body {
                        padding: 0;
                    }
                    
                    .boleta {
                        border: none;
                    }
                    
                    @page {
                        margin: 10mm;
                        size: 80mm auto;
                    }
                }
            </style>
        </head>
        <body>
            <div class="boleta">
                <div class="header">
                    <h1>SABROFOOD</h1>
                    <p>Sistema de Punto de Venta</p>
                    <p>━━━━━━━━━━━━━━━━━━━━</p>
                    <p><strong>BOLETA DE VENTA</strong></p>
                </div>
                
                <div class="info-venta">
                    <p><strong>N° Boleta:</strong> <span>#${venta.id}</span></p>
                    <p><strong>Fecha:</strong> <span>${new Date(venta.created_at || venta.fecha).toLocaleDateString('es-CL')}</span></p>
                    <p><strong>Hora:</strong> <span>${new Date(venta.created_at || venta.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span></p>
                    <p><strong>Vendedor:</strong> <span>${venta.vendedor_nombre || venta.vendedor || 'Sin asignar'}</span></p>
                </div>
                
                <div class="productos">
                    <div class="productos-header">
                        <div>PRODUCTO</div>
                        <div style="text-align: right;">CANT</div>
                        <div style="text-align: right;">P.U.</div>
                        <div style="text-align: right;">TOTAL</div>
                    </div>
                    ${items.length > 0 ? items.map(item => `
                        <div class="producto-item">
                            <div class="nombre">${item.producto_nombre}</div>
                            <div class="cantidad">${item.cantidad}</div>
                            <div class="precio">$${formatoMoneda(item.precio_unitario)}</div>
                            <div class="subtotal">$${formatoMoneda(item.subtotal)}</div>
                        </div>
                    `).join('') : '<p style="text-align: center; color: #666;">Sin productos registrados</p>'}
                </div>
                
                <div class="totales">
                    <div class="total-item final">
                        <span>TOTAL:</span>
                        <span>$${formatoMoneda(venta.total)}</span>
                    </div>
                </div>
                
                ${detallesPagos.length > 0 ? `
                    <div class="pagos">
                        <p style="font-weight: bold; margin-bottom: 5px;">FORMA DE PAGO:</p>
                        ${detallesPagos.map(pago => `
                            <div class="pago-item">
                                <span>${pago.metodo}:</span>
                                <span>$${formatoMoneda(pago.monto)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="pagos">
                        <p style="font-weight: bold;">FORMA DE PAGO: ${venta.metodo_pago}</p>
                    </div>
                `}
                
                <div class="footer">
                    <p>━━━━━━━━━━━━━━━━━━━━</p>
                    <p>¡Gracias por su compra!</p>
                    <p style="margin-top: 8px; font-size: 10px;">
                        Documento no válido como factura
                    </p>
                </div>
            </div>
            
            <script>
                // Imprimir automáticamente al cargar
                window.onload = function() {
                    window.print();
                    // Cerrar ventana después de imprimir o cancelar
                    setTimeout(() => window.close(), 500);
                };
            </script>
        </body>
        </html>
    `;
    
    ventanaImpresion.document.write(htmlBoleta);
    ventanaImpresion.document.close();
}

// ===================================
// UTILIDADES
// ===================================

// ===================================
// UTILIDADES Y HELPERS
// ===================================

/**
 * Manejo estandarizado de errores
 * @param {Error} error - Error capturado
 * @param {Object} options - Opciones de configuración
 * @param {string} options.contexto - Contexto donde ocurrió el error
 * @param {string} options.mensajeUsuario - Mensaje amigable para el usuario
 * @param {boolean} options.mostrarNotificacion - Si debe mostrar notificación (default: true)
 * @param {boolean} options.esErrorCritico - Si es un error crítico (default: false)
 * @param {Function} options.callback - Función a ejecutar después del error
 */
function manejarError(error, options = {}) {
    const {
        contexto = 'Operación',
        mensajeUsuario = null,
        mostrarNotificacion = true,
        esErrorCritico = false,
        callback = null
    } = options;

    // Log completo en consola
    const emoji = esErrorCritico ? '🔥' : '❌';
    console.error(`${emoji} Error en ${contexto}:`, error);
    
    if (error.message) {
        console.error('Mensaje:', error.message);
    }
    
    if (error.stack) {
        console.error('Stack:', error.stack);
    }

    // Notificar al usuario si está habilitado
    if (mostrarNotificacion) {
        const mensaje = mensajeUsuario || `Error en ${contexto}: ${error.message || 'Error desconocido'}`;
        const tipo = esErrorCritico ? 'error' : 'error';
        mostrarNotificacion(mensaje, tipo, esErrorCritico ? 5000 : 3000);
    }

    // Ejecutar callback si existe
    if (callback && typeof callback === 'function') {
        try {
            callback(error);
        } catch (callbackError) {
            console.error('Error ejecutando callback:', callbackError);
        }
    }

    // Retornar información del error para usar en lógica
    return {
        error,
        contexto,
        timestamp: new Date().toISOString()
    };
}

/**
 * Wrapper para ejecutar funciones async con manejo de errores estandarizado
 * @param {Function} fn - Función async a ejecutar
 * @param {Object} options - Opciones para manejarError
 * @returns {Promise} Resultado de la función o null en caso de error
 */
async function ejecutarConManejadorErrores(fn, options = {}) {
    try {
        return await fn();
    } catch (error) {
        manejarError(error, options);
        return null;
    }
}

function formatoMoneda(numero) {
    return Math.round(numero).toLocaleString('es-CL');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function mostrarNotificacion(mensaje, tipo = 'info', duracion = 3000, destacado = false) {
    console.log(`[${tipo.toUpperCase()}] ${mensaje}`);

    // Crear notificación temporal
    const notif = document.createElement('div');
    notif.className = `notificacion notif-${tipo}`;
    notif.textContent = mensaje;
    notif.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        padding: 16px 24px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.3s ease-out;
    `;

    // Colores normales
    if (tipo === 'success') notif.style.borderLeft = '4px solid hsl(142 76% 36%)';
    if (tipo === 'error') notif.style.borderLeft = '4px solid hsl(0 84% 60%)';
    if (tipo === 'warning') notif.style.borderLeft = '4px solid hsl(38 92% 50%)';
    if (tipo === 'info') notif.style.borderLeft = '4px solid hsl(199 89% 48%)';

    // Colores destacados (más fuertes) para notificaciones importantes
    if (destacado && tipo === 'info') {
        notif.style.borderLeft = '5px solid hsl(210 100% 45%)';
        notif.style.background = 'linear-gradient(135deg, hsl(210 100% 97%), white)';
        notif.style.color = 'hsl(210 100% 35%)';
        notif.style.boxShadow = '0 10px 50px rgba(33, 150, 243, 0.3)';
        notif.style.fontWeight = '700';
    }

    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notif.remove(), 300);
    }, duracion);
}

// Añadir animaciones al CSS global
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    .alert-info {
        background: hsl(199 89% 48% / 0.1);
        color: hsl(199 89% 48%);
        border: 1px solid hsl(199 89% 48% / 0.3);
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 14px;
    }
`;
document.head.appendChild(style);

// ===================================
// SISTEMA DE ESCANEO DE CÓDIGOS
// ===================================

function abrirEscaner() {
    const modal = document.getElementById('modalEscaner');
    const rolMensaje = document.getElementById('rolMensaje');

    // Actualizar mensaje según rol
    if (currentUserRole === 'encargado') {
        rolMensaje.innerHTML = '<strong>Modo Encargado:</strong> Escanea para editar o registrar productos';
    } else {
        rolMensaje.innerHTML = '<strong>Modo Vendedor:</strong> Escanea para agregar al carrito';
    }

    modal.style.display = 'flex';
    modal.classList.add('show');

    // Iniciar escáner con configuración optimizada
    iniciarEscaner();
}

function iniciarEscaner() {
    const config = {
        fps: 10, // 10 FPS para ahorrar batería
        qrbox: { width: 250, height: 150 }, // Rectángulo tipo código de barras
        aspectRatio: 1.777778, // 16:9 para pantalla completa
        videoConstraints: {
            facingMode: "environment" // Cámara trasera
        }
    };

    html5QrCode = new Html5Qrcode("reader");

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
            procesarCodigoEscaneado(decodedText);
        },
        (errorMessage) => {
            // Error de escaneo (normal, se ejecuta constantemente)
        }
    ).catch((err) => {
        console.error('❌ Error iniciando escáner:', err);
        mostrarNotificacion('Error al acceder a la cámara', 'error');
    });
}

async function procesarCodigoEscaneado(codigoBarra) {
    // Detener escáner
    await detenerEscaner();

    // Beep de éxito
    reproducirBeep();

    // Buscar producto por código de barras
    const producto = await buscarPorCodigoBarras(codigoBarra);

    if (producto) {
        // Producto encontrado
        if (currentUserRole === 'vendedor') {
            // VENDEDOR: Agregar al carrito
            agregarAlCarrito(producto.id);
            mostrarNotificacion(`✅ ${producto.nombre} agregado al carrito`, 'success');
            cerrarEscaner();
        } else {
            // ENCARGADO: Abrir modal de edición
            abrirModalEditar(producto);
        }
    } else {
        // Producto NO encontrado
        if (currentUserRole === 'vendedor') {
            // VENDEDOR: Error
            mostrarNotificacion('❌ Producto no encontrado', 'error');
            setTimeout(() => cerrarEscaner(), 1500);
        } else {
            // ENCARGADO: Abrir formulario de nuevo producto
            abrirModalNuevo(codigoBarra);
        }
    }
}

async function buscarPorCodigoBarras(codigoBarra) {
    try {
        const { data, error } = await window.supabaseClient
            .from('productos')
            .select('*')
            .eq('codigo_barras', codigoBarra)
            .single();

        if (error) {
            return null;
        }

        return data;
    } catch (error) {
        manejarError(error, {
            contexto: 'buscarPorCodigoBarras',
            mensajeUsuario: 'Error buscando producto por código',
            mostrarNotificacion: false
        });
        return null;
    }
}

// Limpiar campo de búsqueda por código de barras
function limpiarBusquedaCodigo() {
    const inputCodigo = document.getElementById('inputCodigoBarras');
    const btnClear = document.querySelector('.btn-clear-search');

    if (inputCodigo) {
        inputCodigo.value = '';
        inputCodigo.focus(); // Mantener focus para siguiente escaneo
    }

    if (btnClear) {
        btnClear.style.display = 'none';
    }
}

/**
 * Limpiar búsqueda de texto (searchInput)
 */
function limpiarBusquedaTexto() {
    const searchInput = document.getElementById('searchInput');
    const btnClearSearch = searchInput?.parentElement?.querySelector('.btn-clear-search');
    
    if (searchInput) {
        searchInput.value = '';
        console.log('🔍 [SEARCH] Búsqueda limpiada, renderizando todos los productos');
        renderProductos(); // Volver a mostrar todos los productos
    }
    
    if (btnClearSearch) {
        btnClearSearch.style.display = 'none';
    }
}

async function detenerEscaner() {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (err) {
            console.error('Error deteniendo escáner:', err);
        }
    }
}

function cerrarEscaner() {
    detenerEscaner();
    const modal = document.getElementById('modalEscaner');
    modal.style.display = 'none';
    modal.classList.remove('show');
}

function reproducirBeep() {
    // Crear beep corto usando Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Hz
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

// ===================================
// MODAL VENTA A GRANEL
// ===================================

let productoGranelSeleccionado = null;
let productosGranel = [];

async function cargarProductosGranel() {
    try {
        // Cargar productos tipo="granel" de la base de datos
        const { data, error } = await window.supabaseClient
            .from('productos')
            .select('*')
            .eq('tipo', 'granel')
            .eq('activo', true)
            .order('nombre')
            .limit(5000);

        if (error) throw error;

        productosGranel = data || [];
        mostrarProductosGranel(productosGranel);
    } catch (error) {
        manejarError(error, {
            contexto: 'cargarProductosGranel',
            mensajeUsuario: 'Error cargando productos a granel'
        });
    }
}

function mostrarProductosGranel(productos) {
    const lista = document.getElementById('listaProductosGranel');
    
    if (!productos || productos.length === 0) {
        lista.innerHTML = `
            <div style="padding: 40px; text-align: center; color: hsl(var(--muted-foreground));">
                <div style="font-size: 48px; margin-bottom: 12px;">🌾</div>
                <p>No hay productos a granel disponibles</p>
                <small>Contacta al encargado para agregar productos</small>
            </div>
        `;
        return;
    }

    lista.innerHTML = productos.map(p => `
        <div class="producto-granel-item" onclick="seleccionarProductoGranel(${p.id})" style="
            padding: 10px;
            margin-bottom: 6px;
            border: 2px solid ${productoGranelSeleccionado?.id === p.id ? 'hsl(var(--success))' : 'hsl(var(--border))'};
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            background: ${productoGranelSeleccionado?.id === p.id ? 'hsl(var(--success) / 0.1)' : 'white'};
        " onmouseover="this.style.borderColor='hsl(var(--primary))'" onmouseout="this.style.borderColor='${productoGranelSeleccionado?.id === p.id ? 'hsl(var(--success))' : 'hsl(var(--border))'}' ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <strong style="color: hsl(var(--foreground)); font-size: 13px;">${p.nombre}</strong>
                    <div style="font-size: 11px; color: hsl(var(--muted-foreground)); margin-top: 2px;">
                        ${p.categoria || 'Sin categoría'}
                    </div>
                </div>
                <div style="text-align: right; padding-left: 8px;">
                    <div style="font-size: 15px; font-weight: 700; color: hsl(var(--success));">
                        $${formatoMoneda(p.precio)}/kg
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function filtrarProductosGranel() {
    const busqueda = document.getElementById('searchGranelInput').value.toLowerCase();
    const productosFiltrados = productosGranel.filter(p => 
        p.nombre.toLowerCase().includes(busqueda) ||
        (p.categoria && p.categoria.toLowerCase().includes(busqueda))
    );
    mostrarProductosGranel(productosFiltrados);
}

function seleccionarProductoGranel(idProducto) {
    productoGranelSeleccionado = productosGranel.find(p => p.id === idProducto);
    if (!productoGranelSeleccionado) return;

    // Resaltar selección en lista
    mostrarProductosGranel(productosGranel);

    // Mostrar info del producto
    document.getElementById('granelSeleccionado').style.display = 'block';
    document.getElementById('granelNombreSeleccionado').textContent = productoGranelSeleccionado.nombre;
    document.getElementById('granelPrecioKg').textContent = `$${formatoMoneda(productoGranelSeleccionado.precio)} / kg`;
    document.getElementById('pesoEstimado').textContent = '0 kg';

    // Ocultar placeholder, mostrar calculadora
    document.getElementById('granelPlaceholder').style.display = 'none';
    document.getElementById('granelCalc').style.display = 'flex';

    // Limpiar calculadora
    document.getElementById('granelMonto').value = '';
    limpiarCalculadoraGranel();
}

function calcularPesoEstimado() {
    const monto = parseFloat(document.getElementById('granelMonto').value) || 0;
    const precioKg = productoGranelSeleccionado?.precio || 0;
    const pesoEl = document.getElementById('pesoEstimado');

    if (monto > 0 && precioKg > 0) {
        pesoEl.textContent = `${(monto / precioKg).toFixed(2)} kg`;
    } else {
        pesoEl.textContent = '0 kg';
    }
}

function agregarGranelAlCarrito() {
    const monto = parseFloat(document.getElementById('granelMonto').value);
    
    if (!productoGranelSeleccionado || !monto || monto <= 0) {
        mostrarNotificacion('Ingresa un monto válido', 'error');
        return;
    }

    const pesoEstimado = (monto / productoGranelSeleccionado.precio).toFixed(2);

    // Agregar al carrito como un producto especial de granel
    const itemGranel = {
        ...productoGranelSeleccionado,
        cantidad: 1, // Siempre 1 para granel
        esGranel: true, // Marcador para identificar items de granel
        montoGranel: monto, // Monto exacto ingresado
        pesoEstimado: parseFloat(pesoEstimado) // Solo informativo
    };

    // Verificar si ya existe este producto granel en el carrito
    const indexExistente = carrito.findIndex(item => 
        item.esGranel && item.id === productoGranelSeleccionado.id
    );

    if (indexExistente !== -1) {
        // Sumar al monto existente
        carrito[indexExistente].montoGranel += monto;
        carrito[indexExistente].pesoEstimado = (carrito[indexExistente].montoGranel / productoGranelSeleccionado.precio).toFixed(2);
    } else {
        // Agregar nuevo item
        carrito.push(itemGranel);
    }

    renderCarrito();
    mostrarNotificacion(`${productoGranelSeleccionado.nombre} agregado - $${formatoMoneda(monto)}`, 'success');
    cerrarModalGranel();
}

// ===================================
// CALCULADORA GRANEL (rediseñada)
// ===================================

let displayCalc = '0';
let operacionActual = '';
let valorAnterior = null;
let nuevoNumero = true;

function _actualizarDisplayCalc() {
    const spanValor = document.getElementById('displayValor');
    const spanOp    = document.getElementById('displayOp');
    const display   = document.getElementById('displayCalculadora');
    const btnMonto  = document.getElementById('displayMontoBtn');
    const btnOk     = document.getElementById('btnCalcularAplicar');

    if (!spanValor) return;

    const num = parseFloat(displayCalc);

    spanValor.textContent = isNaN(num) ? displayCalc : formatoMoneda(Math.round(num));
    spanOp.textContent  = valorAnterior !== null ? `${formatoMoneda(valorAnterior)} ${_opSimbol(operacionActual)}` : '';

    // Calcular monto final (o preview si hay operación pendiente con 2° número ya ingresado)
    let montoFinal = 0;
    if (valorAnterior === null && !isNaN(num) && num > 0) {
        // Resultado limpio
        montoFinal = Math.round(num);
    } else if (valorAnterior !== null && !nuevoNumero && operacionActual && !isNaN(num)) {
        // Operación completa (ej: 890 × 5) — calcular preview
        let preview = 0;
        switch (operacionActual) {
            case '+': preview = valorAnterior + num; break;
            case '-': preview = valorAnterior - num; break;
            case '*': preview = valorAnterior * num; break;
            case '/': preview = num !== 0 ? valorAnterior / num : 0; break;
        }
        montoFinal = Math.round(preview);
    }

    // Display verde cuando hay un resultado aplicable
    display.classList.toggle('has-value', montoFinal > 0);

    if (btnMonto) btnMonto.textContent = formatoMoneda(montoFinal);
    if (btnOk) btnOk.disabled = !(montoFinal > 0);

    // Sincronizar campo directo con el valor calculado (sin disparar oninput)
    const inputDirecto = document.getElementById('granelMontoDirecto');
    if (inputDirecto && document.activeElement !== inputDirecto) {
        inputDirecto.value = (montoFinal > 0) ? montoFinal : '';
    }
}

function _opSimbol(op) {
    return { '+': '+', '-': '−', '*': '×', '/': '÷' }[op] || op;
}

function agregarNumeroCalc(numero) {
    if (nuevoNumero) {
        displayCalc = numero;
        nuevoNumero = false;
    } else {
        displayCalc = displayCalc === '0' ? numero : displayCalc + numero;
    }
    _actualizarDisplayCalc();
}

function agregarOperacionCalc(operacion) {
    if (valorAnterior !== null && !nuevoNumero) {
        calcularResultado();
    }
    valorAnterior = parseFloat(displayCalc);
    operacionActual = operacion;
    nuevoNumero = true;
    _actualizarDisplayCalc();
}

function calcularResultado() {
    if (valorAnterior === null || nuevoNumero) return;

    const valorActual = parseFloat(displayCalc);
    let resultado = 0;

    switch (operacionActual) {
        case '+': resultado = valorAnterior + valorActual; break;
        case '-': resultado = valorAnterior - valorActual; break;
        case '*': resultado = valorAnterior * valorActual; break;
        case '/':
            if (valorActual === 0) {
                mostrarNotificacion('No se puede dividir por cero', 'error');
                limpiarCalculadoraGranel();
                return;
            }
            resultado = valorAnterior / valorActual;
            break;
        default: return;
    }

    resultado = Math.round(resultado * 100) / 100;
    displayCalc = resultado.toString();
    valorAnterior = null;
    operacionActual = '';
    nuevoNumero = true;
    _actualizarDisplayCalc();
}

function limpiarCalculadoraGranel() {
    displayCalc = '0';
    operacionActual = '';
    valorAnterior = null;
    nuevoNumero = true;
    _actualizarDisplayCalc();
    const inputDirecto = document.getElementById('granelMontoDirecto');
    if (inputDirecto) inputDirecto.value = '';
    const pesoEl = document.getElementById('pesoEstimado');
    if (pesoEl) pesoEl.textContent = '0 kg';
}

function borrarUltimoDigitoCalc() {
    if (displayCalc.length > 1) {
        displayCalc = displayCalc.slice(0, -1);
    } else {
        displayCalc = '0';
        nuevoNumero = true;
    }
    _actualizarDisplayCalc();
}

/** Ingreso directo de monto sin usar el teclado calculadora */
function ingresarMontoDirecto(valor) {
    const soloDigitos = valor.replace(/\D/g, '');
    if (soloDigitos === '' || soloDigitos === '0') {
        displayCalc = '0';
        valorAnterior = null;
        operacionActual = '';
        nuevoNumero = true;
    } else {
        displayCalc = soloDigitos;
        valorAnterior = null;
        operacionActual = '';
        nuevoNumero = false;
    }
    // Actualizar UI sin tocar el inputDirecto (evita loop)
    const num = parseFloat(displayCalc);
    const montoFinal = (!isNaN(num) && num > 0) ? Math.round(num) : 0;
    const spanValor = document.getElementById('displayValor');
    const spanOp    = document.getElementById('displayOp');
    const display   = document.getElementById('displayCalculadora');
    const btnMonto  = document.getElementById('displayMontoBtn');
    const btnOk     = document.getElementById('btnCalcularAplicar');
    if (spanValor) spanValor.textContent = montoFinal > 0 ? formatoMoneda(montoFinal) : '0';
    if (spanOp)    spanOp.textContent = '';
    if (display)   display.classList.toggle('has-value', montoFinal > 0);
    if (btnMonto)  btnMonto.textContent = formatoMoneda(montoFinal);
    if (btnOk)     btnOk.disabled = !(montoFinal > 0);
    // Actualizar peso en tiempo real
    document.getElementById('granelMonto').value = montoFinal > 0 ? montoFinal : '';
    calcularPesoEstimado();
}

/** @deprecated — reemplazada por calcularYAplicar() — conservada por si hay referencias */
function aplicarCalculadora() {
    calcularYAplicar();
}

/** Botón "=" — calcula y agrega directamente al carrito */
function calcularYAplicar() {
    if (valorAnterior !== null && !nuevoNumero) {
        calcularResultado();
    }

    const resultado = parseFloat(displayCalc);
    if (isNaN(resultado) || resultado <= 0) {
        mostrarNotificacion('Ingresa un monto válido primero', 'warning');
        return;
    }

    const montoFinal = Math.round(resultado);
    // Sincroniza input oculto y dispara lógica de peso
    document.getElementById('granelMonto').value = montoFinal;
    calcularPesoEstimado();
    // Agrega al carrito directamente
    agregarGranelAlCarrito();
}

function abrirModalGranel() {
    productoGranelSeleccionado = null;
    document.getElementById('searchGranelInput').value = '';
    document.getElementById('granelSeleccionado').style.display = 'none';
    document.getElementById('granelPlaceholder').style.display = 'flex';
    document.getElementById('granelCalc').style.display = 'none';
    document.getElementById('granelMonto').value = '';

    limpiarCalculadoraGranel();
    cargarProductosGranel();

    const modal = document.getElementById('modalGranel');
    modal.style.display = 'flex';
    modal.classList.add('show');

    setTimeout(() => document.getElementById('searchGranelInput').focus(), 100);
}

function cerrarModalGranel() {
    productoGranelSeleccionado = null;
    const modal = document.getElementById('modalGranel');
    modal.style.display = 'none';
    modal.classList.remove('show');
}

// ===================================
// MODAL CREAR/EDITAR PRODUCTO (Encargado)
// ===================================

/**
 * Abrir modal en modo crear (nuevo producto)
 */
function abrirModalCrearProducto() {
    abrirModalEditar(null);
}

/**
 * Configurar visibilidad de campos según rol
 * @param {boolean} esEncargado - Si es encargado
 * @param {boolean} modoCrear - Si está creando producto
 * @param {Object} producto - Datos del producto (opcional)
 */
function configurarCamposModalSegunRol(esEncargado, modoCrear, producto) {
    const stockMinimoGroup = document.getElementById('editStockMinimoGroup');
    const nombreGroup = document.getElementById('editNombreGroup');
    const proveedorGroup = document.getElementById('editProveedorGroup');
    const categoriaGroup = document.getElementById('editCategoriaGroup');
    const precioGroup = document.getElementById('editPrecioGroup');
    const codigoBarrasGroup = document.getElementById('editCodigoBarrasGroup');
    const titulo = document.getElementById('tituloModalProducto');

    if (!esEncargado && !modoCrear) {
        // VENDEDOR: Solo puede actualizar stock
        titulo.textContent = '📦 Actualizar Stock - ' + producto.nombre;
        
        proveedorGroup.style.display = 'none';
        categoriaGroup.style.display = 'none';
        precioGroup.style.display = 'none';
        codigoBarrasGroup.style.display = 'none';
        stockMinimoGroup.style.display = 'none';
        
        nombreGroup.style.display = 'block';
        document.getElementById('editNombre').setAttribute('readonly', 'readonly');
        document.getElementById('editNombre').style.backgroundColor = 'hsl(var(--muted))';
        document.getElementById('editNombre').style.cursor = 'not-allowed';
    } else {
        // ENCARGADO: Acceso completo
        nombreGroup.style.display = 'block';
        proveedorGroup.style.display = 'block';
        categoriaGroup.style.display = 'block';
        precioGroup.style.display = 'block';
        codigoBarrasGroup.style.display = 'block';
        stockMinimoGroup.style.display = 'block';
        
        document.getElementById('editNombre').removeAttribute('readonly');
        document.getElementById('editNombre').style.backgroundColor = '';
        document.getElementById('editNombre').style.cursor = '';
        document.getElementById('editProveedor').removeAttribute('disabled');
        document.getElementById('editCategoria').removeAttribute('disabled');
        document.getElementById('editPrecio').removeAttribute('readonly');
        document.getElementById('editCodigoBarras').removeAttribute('readonly');
    }
}

/**
 * Llenar formulario con datos del producto
 * @param {Object} producto - Datos del producto
 */
function llenarFormularioProducto(producto) {
    document.getElementById('editNombre').value = producto.nombre;
    document.getElementById('editProveedor').value = producto.proveedor || '';
    
    // Establecer categoría
    const categoriaSelect = document.getElementById('editCategoria');
    const categoriaProducto = producto.categoria || '';
    
    let categoriaExiste = false;
    for (let option of categoriaSelect.options) {
        if (option.value === categoriaProducto) {
            categoriaExiste = true;
            break;
        }
    }
    
    categoriaSelect.value = categoriaExiste ? categoriaProducto : '';
    
    document.getElementById('editPrecio').value = producto.precio;
    document.getElementById('editStock').value = producto.stock;
    document.getElementById('editCodigoBarras').value = producto.codigo_barras || '';
    document.getElementById('editStockMinimo').value = producto.stock_minimo_sacos || '';
}

/**
 * Limpiar formulario para creación de producto
 */
function limpiarFormularioProducto() {
    document.getElementById('editNombre').value = '';
    document.getElementById('editProveedor').value = '';
    document.getElementById('editCategoria').value = '';
    document.getElementById('editPrecio').value = '';
    document.getElementById('editStock').value = '0';
    document.getElementById('editCodigoBarras').value = '';
    document.getElementById('editStockMinimo').value = '3';
}

function abrirModalEditar(producto) {
    productoEditando = producto;
    cerrarEscaner();

    const esEncargado = currentUserRole === 'encargado';
    const modoCrear = !producto;

    // Actualizar dropdowns
    actualizarSelectProveedores();
    actualizarSelectCategorias();
    
    if (categoriasActuales.length === 0) {
        inicializarCategorias();
    }

    // Configurar título y botones
    const titulo = document.getElementById('tituloModalProducto');
    const btnGuardar = document.getElementById('btnGuardarProducto');
    const btnEliminar = document.getElementById('btnEliminarProducto');

    if (modoCrear) {
        titulo.textContent = '➕ Crear Producto';
        btnGuardar.textContent = 'Guardar Producto';
        btnEliminar.style.display = 'none';
        limpiarFormularioProducto();
    } else {
        titulo.textContent = '✏️ Editar Producto';
        btnGuardar.textContent = 'Guardar Cambios';
        btnEliminar.style.display = esEncargado ? 'inline-flex' : 'none';
        llenarFormularioProducto(producto);
    }

    // Configurar visibilidad según rol
    configurarCamposModalSegunRol(esEncargado, modoCrear, producto);

    // Mostrar modal
    const modal = document.getElementById('modalEditarProducto');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

function cerrarModalEditar() {
    const modal = document.getElementById('modalEditarProducto');
    modal.style.display = 'none';
    modal.classList.remove('show');
    productoEditando = null;
}

async function guardarEdicion() {
    const esEncargado = currentUserRole === 'encargado';
    const modoCrear = !productoEditando;
    
    // Solo vendedor puede editar, no crear
    if (!esEncargado && modoCrear) {
        mostrarNotificacion('No tienes permisos para crear productos', 'error');
        return;
    }

    const nuevoStock = parseFloat(document.getElementById('editStock').value);

    if (isNaN(nuevoStock)) {
        mostrarNotificacion('Valor de stock inválido', 'error');
        return;
    }

    // PERMITE STOCK NEGATIVO: Útil para ajustes manuales y correcciones
    // No validamos que sea >= 0

    try {
        let productData = { stock: nuevoStock };

        // Si es encargado, puede actualizar todos los campos
        if (esEncargado) {
            const nuevoNombre = document.getElementById('editNombre').value.trim();
            const nuevoProveedor = document.getElementById('editProveedor').value;
            const nuevaCategoria = document.getElementById('editCategoria').value;
            const nuevoPrecio = parseFloat(document.getElementById('editPrecio').value);
            const nuevoCodigoBarras = document.getElementById('editCodigoBarras').value.trim();
            const nuevoStockMinimo = document.getElementById('editStockMinimo').value;

            if (!nuevoNombre) {
                mostrarNotificacion('El nombre del producto es requerido', 'error');
                return;
            }

            if (isNaN(nuevoPrecio)) {
                mostrarNotificacion('Valor de precio inválido', 'error');
                return;
            }

            if (nuevoPrecio < 0) {
                mostrarNotificacion('El precio no puede ser negativo', 'error');
                return;
            }

            productData = {
                nombre: nuevoNombre,
                proveedor: nuevoProveedor || null,
                categoria: nuevaCategoria,
                precio: nuevoPrecio,
                stock: nuevoStock,
                codigo_barras: nuevoCodigoBarras || null
            };

            // Solo establecer tipo si estamos CREANDO un producto nuevo
            // Al EDITAR, preservamos el tipo original para evitar errores de validación
            if (modoCrear) {
                productData.tipo = 'empacado'; // Tipo por defecto para productos nuevos
                
                // Auto-detectar si es producto granel por el nombre
                if (nuevoNombre.toLowerCase().includes('(granel)')) {
                    productData.tipo = 'granel';
                }
            }
            // Al editar, si queremos cambiar el tipo basado en el nombre, lo hacemos
            else if (nuevoNombre.toLowerCase().includes('(granel)') && productoEditando.tipo !== 'granel') {
                productData.tipo = 'granel';
            }

            // Agregar stock mínimo solo si tiene valor
            if (nuevoStockMinimo !== '' && !isNaN(nuevoStockMinimo)) {
                productData.stock_minimo_sacos = parseInt(nuevoStockMinimo);
            }
        }

        if (modoCrear) {
            // Si no es granel, obtener el tipo de un producto normal existente
            if (productData.tipo !== 'granel') {
                const { data: productoEjemplo } = await window.supabaseClient
                    .from('productos')
                    .select('tipo')
                    .neq('tipo', 'granel')
                    .limit(1)
                    .single();
                
                if (productoEjemplo && productoEjemplo.tipo) {
                    productData.tipo = productoEjemplo.tipo;
                }
            }
            
            // CREAR nuevo producto
            const { error } = await window.supabaseClient
                .from('productos')
                .insert([productData]);
            
            if (error) throw error;
                
            mostrarNotificacion('✅ Producto creado exitosamente', 'success');
        } else {
            // ACTUALIZAR producto existente
            const { error } = await window.supabaseClient
                .from('productos')
                .update(productData)
                .eq('id', productoEditando.id);
            
            if (error) throw error;
            
            mostrarNotificacion('✅ Producto actualizado exitosamente', 'success');
        }

        cerrarModalEditar();
        await cargarProductos();

        // Si estamos en la vista de inventario, recargarla
        if (currentView === 'inventario') {
            await cargarInventario();
        }

    } catch (error) {
        manejarError(error, {
            contexto: 'Guardar producto',
            mensajeUsuario: 'No se pudo guardar el producto. Intenta nuevamente.',
            esErrorCritico: false
        });
    }
}

async function eliminarProducto() {
    // Validar permisos de administrador
    if (!requireAdminRole('Eliminar productos')) {
        return;
    }

    if (!productoEditando) return;

    const nombreProducto = productoEditando.nombre;

    // Confirmar eliminación
    const confirmar = confirm(`¿Estás seguro de que deseas eliminar el producto "${nombreProducto}"?\n\nEsta acción no se puede deshacer.`);

    if (!confirmar) return;

    try {
        const { error } = await window.supabaseClient
            .from('productos')
            .delete()
            .eq('id', productoEditando.id);

        if (error) throw error;

        mostrarNotificacion(`✅ Producto "${nombreProducto}" eliminado exitosamente`, 'success');
        cerrarModalEditar();
        await cargarProductos();

        // Si estamos en la vista de inventario, recargarla
        if (currentView === 'inventario') {
            await cargarInventario();
        }

    } catch (error) {
        manejarError(error, {
            contexto: 'eliminarProducto',
            mensajeUsuario: 'Error al eliminar el producto'
        });
    }
}

async function eliminarProductoDirecto(id) {
    const producto = productos.find(p => p.id === id);

    if (!producto) {
        mostrarNotificacion('Producto no encontrado', 'error');
        return;
    }

    const nombreProducto = producto.nombre;

    // Confirmar eliminación
    const confirmar = confirm(`¿Estás seguro de que deseas eliminar el producto "${nombreProducto}"?\n\nEsta acción no se puede deshacer.`);

    if (!confirmar) return;

    try {
        const { error } = await window.supabaseClient
            .from('productos')
            .delete()
            .eq('id', id);

        if (error) throw error;

        mostrarNotificacion(`✅ Producto "${nombreProducto}" eliminado exitosamente`, 'success');
        await cargarProductos();

        // Si estamos en la vista de inventario, recargarla
        if (currentView === 'inventario') {
            await cargarInventario();
        }

    } catch (error) {
        manejarError(error, {
            contexto: 'Eliminar producto',
            mensajeUsuario: `No se pudo eliminar "${nombreProducto}". Verifica tus permisos.`,
            esErrorCritico: false
        });
    }
}

// ===================================
// MÓDULO: CAJA Y GASTOS
// ===================================

// Variables globales para caja
let gastosDelDia = [];
let pagosPersonalDelDia = []; // Nueva variable para pagos al personal
let sencilloInicial = 0; // Efectivo inicial del día
let ventasDelDia = {
    efectivo: 0,
    transbank: 0,
    transferencia: 0,
    total: 0
};
let repartoDelDia = {
    efectivo: 0,
    tarjetas: 0,
    transferencias: 0,
    transferencias_pendientes: 0,
    total: 0
};

/**
 * Cargar datos de caja al entrar a la vista
 */
async function cargarDatosCaja() {
    console.log('📊 Cargando datos de caja...');

    // Actualizar fecha en el panel
    const hoy = new Date();
    const fechaFormateada = hoy.toLocaleDateString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('cajaFechaHoy').textContent = fechaFormateada;

    const fechaHoy = hoy.toISOString().split('T')[0];

    // Cargar sencillo inicial
    cargarSencilloInicial();

    // Cargar ventas del día
    await cargarVentasDelDia();

    // Cargar gastos del día
    await cargarGastosDelDia();

    // Cargar pagos al personal del día
    await cargarPagosPersonalDelDia();

    // Cargar datos del reparto
    await cargarDatosReparto();

    // Actualizar totales
    actualizarTotalesCaja();
    
    // Cargar ajustes de caja (nuevo)
    await cargarAjustesCaja(fechaHoy);
}

/**
 * Cargar ventas del día desde Supabase
 */
async function cargarVentasDelDia() {
    try {
        console.log('🔍 Iniciando carga de ventas del día...');

        // Validar que supabaseClient existe
        if (!window.supabaseClient) {
            console.error('❌ Supabase no está configurado');
            mostrarNotificacion('Error: Supabase no está configurado', 'error');
            return;
        }

        const hoy = new Date();
        const fechaHoy = hoy.toISOString().split('T')[0]; // Solo YYYY-MM-DD

        console.log('📅 Buscando ventas del día:', fechaHoy);

        const { data, error } = await window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('fecha', fechaHoy);

        if (error) {
            console.error('❌ Error en la consulta:', error);
            throw error;
        }

        console.log('📊 Ventas encontradas:', data);

        // Calcular totales por método de pago
        ventasDelDia = {
            efectivo: 0,
            transbank: 0,
            transferencia: 0,
            transferencia_pendiente: 0, // Transferencias sin boletear
            total: 0
        };
        
        let transferenciasBoleteadas = 0;
        let transferenciasPendientes = 0;

        if (!data || data.length === 0) {
            console.log('ℹ️ No hay ventas registradas hoy');
        } else {
            data.forEach(venta => {
                // Verificar ambos nombres de campo (pagos_detalle y detalle_pagos)
                let detallePagos = venta.pagos_detalle || venta.detalle_pagos || venta.metodo_pago;

                console.log('💳 Procesando venta:', {
                    total: venta.total,
                    metodo: venta.metodo_pago,
                    detallePagos: detallePagos,
                    boleteada: venta.boleteada
                });

                // Si es string JSON, parsearlo
                if (typeof detallePagos === 'string' && detallePagos.startsWith('[')) {
                    try {
                        detallePagos = JSON.parse(detallePagos);
                    } catch (e) {
                        console.warn('⚠️ No se pudo parsear JSON:', e);
                    }
                }

                if (typeof detallePagos === 'string') {
                    // Formato antiguo: string simple
                    if (detallePagos === 'Efectivo') {
                        ventasDelDia.efectivo += venta.total;
                    } else if (detallePagos === 'Tarjeta' || detallePagos === 'Transbank') {
                        ventasDelDia.transbank += venta.total;
                    } else if (detallePagos === 'Transferencia') {
                        // Siempre cuenta en el total (la plata ya entró)
                        ventasDelDia.transferencia += venta.total;
                        if (venta.boleteada) {
                            transferenciasBoleteadas += venta.total;
                        } else {
                            // Sin boleta: suma al badge de pendientes pero ya está en el total
                            ventasDelDia.transferencia_pendiente += venta.total;
                            transferenciasPendientes += venta.total;
                        }
                    }
                } else if (Array.isArray(detallePagos)) {
                    // Formato nuevo: array de pagos (para pagos mixtos)
                    detallePagos.forEach(pago => {
                        if (pago.metodo === 'Efectivo') {
                            ventasDelDia.efectivo += pago.monto;
                        } else if (pago.metodo === 'Tarjeta' || pago.metodo === 'Transbank') {
                            ventasDelDia.transbank += pago.monto;
                        } else if (pago.metodo === 'Transferencia') {
                            // Siempre cuenta en el total (la plata ya entró)
                            ventasDelDia.transferencia += pago.monto;
                            if (venta.boleteada) {
                                transferenciasBoleteadas += pago.monto;
                            } else {
                                // Sin boleta: suma al badge de pendientes pero ya está en el total
                                ventasDelDia.transferencia_pendiente += pago.monto;
                                transferenciasPendientes += pago.monto;
                            }
                        }
                    });
                }

                ventasDelDia.total += venta.total;
            });
        }
        
        console.log('📊 Transferencias POS:', {
            boleteadas: transferenciasBoleteadas,
            pendientes: transferenciasPendientes,
            total: transferenciasBoleteadas + transferenciasPendientes
        });

        // Actualizar UI
        document.getElementById('ventasEfectivo').textContent = '$' + formatoMoneda(ventasDelDia.efectivo);
        document.getElementById('ventasTransbank').textContent = '$' + formatoMoneda(ventasDelDia.transbank);
        document.getElementById('ventasTransferencia').textContent = '$' + formatoMoneda(ventasDelDia.transferencia);
        document.getElementById('ventasTotal').textContent = '$' + formatoMoneda(ventasDelDia.total);

        console.log('✅ Ventas del día cargadas:', ventasDelDia);

    } catch (error) {
        manejarError(error, {
            contexto: 'Cargar ventas del día',
            mensajeUsuario: 'Error al cargar ventas del día',
            esErrorCritico: false
        });
    }
}

/**
 * Cargar gastos del día desde Supabase
 */
async function cargarGastosDelDia() {
    try {
        if (!window.supabaseClient) {
            console.warn('⚠️ Supabase no configurado, omitiendo gastos');
            gastosDelDia = [];
            renderGastosDelDia();
            return;
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        const { data, error } = await window.supabaseClient
            .from('gastos')
            .select('*')
            .gte('fecha', hoy.toISOString())
            .lt('fecha', manana.toISOString())
            .order('fecha', { ascending: false });

        if (error) {
            console.error('❌ Error consultando gastos:', error);
            throw error;
        }

        gastosDelDia = data || [];
        renderGastosDelDia();

        console.log(`✅ ${gastosDelDia.length} gastos del día cargados`);

    } catch (error) {
        manejarError(error, {
            contexto: 'Cargar gastos del día',
            mensajeUsuario: 'Error al cargar gastos',
            mostrarNotificacion: false,
            esErrorCritico: false
        });
        gastosDelDia = [];
        renderGastosDelDia();
        // Notificación deshabilitada para evitar múltiples errores
    }
}

/**
 * Renderizar lista de gastos
 */
function renderGastosDelDia() {
    const container = document.getElementById('gastosLista');

    if (gastosDelDia.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="opacity: 0.3; margin: 0 auto 16px;">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p>No hay gastos registrados hoy</p>
            </div>
        `;
        return;
    }

    // Separar gastos por categoría
    const gastosFijos = gastosDelDia.filter(g => ['Combustible', 'Peaje', 'Aseo', 'Bolsas'].includes(g.categoria || g.descripcion));
    const gastosOtros = gastosDelDia.filter(g => !['Combustible', 'Peaje', 'Aseo', 'Bolsas'].includes(g.categoria || g.descripcion));

    let html = '';

    // Mostrar Gastos Fijos si existen
    if (gastosFijos.length > 0) {
        html += '<div class="gastos-seccion"><h4 style="font-size: 14px; font-weight: 600; color: hsl(var(--muted-foreground)); margin-bottom: 12px;">📌 Gastos Fijos</h4>';
        
        html += gastosFijos.map(gasto => {
            const fecha = new Date(gasto.fecha);
            const hora = fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="gasto-item" style="border-left: 4px solid hsl(var(--primary));">
                    <div class="gasto-info">
                        <p class="gasto-descripcion">${gasto.categoria || gasto.descripcion}</p>
                        <div class="gasto-meta">
                            <span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
                                    <circle cx="12" cy="8" r="3" stroke="currentColor" stroke-width="2"/>
                                    <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="currentColor" stroke-width="2"/>
                                </svg>
                                ${gasto.asignado_a}
                            </span>
                            <span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                                    <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2"/>
                                </svg>
                                ${hora}
                            </span>
                        </div>
                    </div>
                    <span class="gasto-monto">$${formatoMoneda(gasto.monto)}</span>
                    <div class="gasto-actions">
                        <button class="btn-icon btn-delete" onclick="eliminarGasto(${gasto.id})" title="Eliminar">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        html += '</div>';
    }

    // Mostrar Otros Gastos si existen
    if (gastosOtros.length > 0) {
        html += '<div class="gastos-seccion" style="margin-top: 24px;"><h4 style="font-size: 14px; font-weight: 600; color: hsl(var(--muted-foreground)); margin-bottom: 12px;">📋 Otros Gastos</h4>';
        
        html += gastosOtros.map(gasto => {
            const fecha = new Date(gasto.fecha);
            const hora = fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="gasto-item">
                    <div class="gasto-info">
                        <p class="gasto-descripcion">${gasto.descripcion}</p>
                        <div class="gasto-meta">
                            <span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
                                    <circle cx="12" cy="8" r="3" stroke="currentColor" stroke-width="2"/>
                                    <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="currentColor" stroke-width="2"/>
                                </svg>
                                ${gasto.asignado_a}
                            </span>
                            <span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                                    <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2"/>
                                </svg>
                                ${hora}
                            </span>
                        </div>
                    </div>
                    <span class="gasto-monto">$${formatoMoneda(gasto.monto)}</span>
                    <div class="gasto-actions">
                        <button class="btn-icon btn-delete" onclick="eliminarGasto(${gasto.id})" title="Eliminar">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        html += '</div>';
    }

    container.innerHTML = html;
}

/**
 * Registrar nuevo gasto
 */
/**
 * Toggle para mostrar/ocultar input de descripción personalizada
 */
function toggleDescripcionPersonalizada() {
    const categoria = document.getElementById('gastoCategoria').value;
    const grupoPersonalizado = document.getElementById('descripcionPersonalizadaGroup');
    const inputPersonalizado = document.getElementById('gastoDescripcionPersonalizada');
    
    if (categoria === 'Otro') {
        grupoPersonalizado.style.display = 'block';
        inputPersonalizado.required = true;
    } else {
        grupoPersonalizado.style.display = 'none';
        inputPersonalizado.required = false;
        inputPersonalizado.value = '';
    }
}

/**
 * Registrar gasto con categoría predeterminada o personalizada
 */
async function registrarGasto(event) {
    event.preventDefault();

    // Validar autenticación
    if (!requireAuthentication('Registrar gasto')) {
        return;
    }

    const monto = parseFloat(document.getElementById('gastoMonto').value);
    const categoria = document.getElementById('gastoCategoria').value;
    const descripcionPersonalizada = document.getElementById('gastoDescripcionPersonalizada').value.trim();
    const asignado = document.getElementById('gastoAsignado').value;

    // Determinar descripción y categoría final
    let descripcion, categoriaFinal;
    
    if (categoria === 'Otro') {
        if (!descripcionPersonalizada) {
            mostrarNotificacion('Ingresa una descripción personalizada', 'warning');
            return;
        }
        descripcion = descripcionPersonalizada;
        categoriaFinal = 'Otros';
    } else {
        descripcion = categoria;
        categoriaFinal = categoria;
    }

    if (!monto || !categoria || !asignado) {
        mostrarNotificacion('Completa todos los campos', 'warning');
        return;
    }

    if (monto <= 0) {
        mostrarNotificacion('El monto debe ser mayor a 0', 'warning');
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('gastos')
            .insert([{
                monto: monto,
                descripcion: descripcion,
                asignado_a: asignado,
                categoria: categoriaFinal,
                registrado_por: currentUser,
                fecha: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        mostrarNotificacion('✅ Gasto registrado exitosamente', 'success');

        // Limpiar formulario
        document.getElementById('formGasto').reset();
        toggleDescripcionPersonalizada(); // Ocultar input personalizado

        // Recargar gastos
        await cargarGastosDelDia();
        actualizarTotalesCaja();

    } catch (error) {
        manejarError(error, {
            contexto: 'Registrar gasto',
            mensajeUsuario: 'Error al registrar el gasto. Intenta nuevamente.',
            esErrorCritico: false
        });
        mostrarNotificacion('Error al registrar gasto', 'error');
    }
}

/**
 * Eliminar gasto
 */
async function eliminarGasto(gastoId) {
    // Validar permisos de administrador
    if (!requireAdminRole('Eliminar gastos')) {
        return;
    }

    if (!confirm('¿Eliminar este gasto?')) return;

    try {
        const { error } = await window.supabaseClient
            .from('gastos')
            .delete()
            .eq('id', gastoId);

        if (error) throw error;

        mostrarNotificacion('Gasto eliminado', 'success');

        // Recargar gastos
        await cargarGastosDelDia();
        actualizarTotalesCaja();

    } catch (error) {
        manejarError(error, {
            contexto: 'Eliminar gasto',
            mensajeUsuario: 'No se pudo eliminar el gasto',
            esErrorCritico: false
        });
    }
}

/**
 * Actualizar totales de caja
 */
function actualizarTotalesCaja() {
    // Calcular total de gastos operacionales
    const totalGastos = gastosDelDia.reduce((sum, gasto) => sum + parseFloat(gasto.monto), 0);
    document.getElementById('gastosTotal').textContent = '$' + formatoMoneda(totalGastos);

    // Calcular total de pagos al personal
    const totalPagosPersonal = pagosPersonalDelDia.reduce((sum, pago) => sum + parseFloat(pago.total_pago), 0);

    // Obtener efectivo del reparto con limpieza robusta
    const repartoEfectivoText = document.getElementById('repartoEfectivo')?.textContent || '$0';
    const limpiarMoneda = (texto) => {
        return parseFloat(texto.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.')) || 0;
    };
    const repartoEfectivo = limpiarMoneda(repartoEfectivoText);

    // Calcular efectivo esperado (POS + Reparto - gastos - pagos personal)
    const efectivoEsperado = ventasDelDia.efectivo + repartoEfectivo - totalGastos - totalPagosPersonal;
    document.getElementById('efectivoEsperado').textContent = '$' + formatoMoneda(efectivoEsperado);

    // Recalcular diferencia si hay efectivo real ingresado
    calcularDiferenciaCaja();
    
    // Actualizar totales consolidados (POS + Reparto)
    actualizarTotalesConsolidados();
}

/**
 * Actualizar totales consolidados (POS + Reparto)
 * Esta función suma las ventas del POS con las del sistema de reparto
 */
function actualizarTotalesConsolidados() {
    // Obtener valores del POS
    const posEfectivo = ventasDelDia.efectivo || 0;
    const posTarjetas = ventasDelDia.transbank || 0;
    const posTransferencias = ventasDelDia.transferencia || 0;
    const posTransferenciasPendientes = ventasDelDia.transferencia_pendiente || 0;
    const posTotal = ventasDelDia.total || 0;

    // Obtener valores del Reparto (desde variable global)
    const repartoEfectivo = repartoDelDia.efectivo || 0;
    const repartoTarjetas = repartoDelDia.tarjetas || 0;
    const repartoTransferencias = repartoDelDia.transferencias || 0;
    const repartoTransferenciasPendientes = repartoDelDia.transferencias_pendientes || 0;
    const repartoTotal = repartoDelDia.total || 0;

    // Calcular consolidados
    const consolidadoEfectivo = posEfectivo + repartoEfectivo;
    const consolidadoTarjetas = posTarjetas + repartoTarjetas;
    const consolidadoTransferencias = posTransferencias + repartoTransferencias;
    const consolidadoTotal = posTotal + repartoTotal;
    const totalTransferenciasPendientes = posTransferenciasPendientes + repartoTransferenciasPendientes;

    console.log('📊 Actualizando totales consolidados:', {
        POS: { efectivo: posEfectivo, tarjetas: posTarjetas, transferencias: posTransferencias, pendientes: posTransferenciasPendientes, total: posTotal },
        Reparto: { efectivo: repartoEfectivo, tarjetas: repartoTarjetas, transferencias: repartoTransferencias, pendientes: repartoTransferenciasPendientes, total: repartoTotal },
        Consolidado: { efectivo: consolidadoEfectivo, tarjetas: consolidadoTarjetas, transferencias: consolidadoTransferencias, pendientes: totalTransferenciasPendientes, total: consolidadoTotal }
    });

    // Actualizar UI - Totales consolidados
    document.getElementById('consolidadoEfectivo').textContent = '$' + formatoMoneda(consolidadoEfectivo);
    document.getElementById('consolidadoTarjetas').textContent = '$' + formatoMoneda(consolidadoTarjetas);
    document.getElementById('consolidadoTransferencias').textContent = '$' + formatoMoneda(consolidadoTransferencias);
    document.getElementById('totalGeneralConsolidado').textContent = '$' + formatoMoneda(consolidadoTotal);

    // OPCIÓN B: Mostrar transferencias combinadas (POS + Reparto) en la sección Local POS
    const elVentasTransf = document.getElementById('ventasTransferencia');
    if (elVentasTransf) elVentasTransf.textContent = '$' + formatoMoneda(consolidadoTransferencias);
    
    const elDesgloseBloque = document.getElementById('desgloseTranferenciaReparto');
    if (elDesgloseBloque) {
        if (repartoTransferencias > 0) {
            elDesgloseBloque.style.display = 'flex';
            document.getElementById('transferenciaLocal').textContent = '$' + formatoMoneda(posTransferencias);
            document.getElementById('transferenciaReparto').textContent = '$' + formatoMoneda(repartoTransferencias);
        } else {
            elDesgloseBloque.style.display = 'none';
        }
    }

    // Actualizar desglose POS
    document.getElementById('consolidadoEfectivoPOS').textContent = '$' + formatoMoneda(posEfectivo);
    document.getElementById('consolidadoTarjetasPOS').textContent = '$' + formatoMoneda(posTarjetas);
    document.getElementById('consolidadoTransferenciasPOS').textContent = '$' + formatoMoneda(posTransferencias);
    document.getElementById('consolidadoTotalPOS').textContent = '$' + formatoMoneda(posTotal);

    // Actualizar desglose Reparto
    document.getElementById('consolidadoEfectivoRep').textContent = '$' + formatoMoneda(repartoEfectivo);
    document.getElementById('consolidadoTarjetasRep').textContent = '$' + formatoMoneda(repartoTarjetas);
    document.getElementById('consolidadoTransferenciasRep').textContent = '$' + formatoMoneda(repartoTransferencias);
    document.getElementById('consolidadoTotalReparto').textContent = '$' + formatoMoneda(repartoTotal);
    
    // Mostrar badge de transferencias pendientes (POS + Reparto) si hay
    const badgePendientesRep = document.getElementById('badgePendientesReparto');
    if (badgePendientesRep) {
        if (totalTransferenciasPendientes > 0) {
            badgePendientesRep.style.display = 'block';
            let textoDesglose = '⏳ ';
            if (posTransferenciasPendientes > 0 && repartoTransferenciasPendientes > 0) {
                textoDesglose += `$${formatoMoneda(totalTransferenciasPendientes)} pendientes (POS: $${formatoMoneda(posTransferenciasPendientes)} + Reparto: $${formatoMoneda(repartoTransferenciasPendientes)})`;
            } else if (posTransferenciasPendientes > 0) {
                textoDesglose += `$${formatoMoneda(posTransferenciasPendientes)} pendientes (POS)`;
            } else {
                textoDesglose += `$${formatoMoneda(repartoTransferenciasPendientes)} pendientes (Reparto)`;
            }
            badgePendientesRep.textContent = textoDesglose;
        } else {
            badgePendientesRep.style.display = 'none';
        }
    }
}

/**
 * Calcular diferencia entre efectivo real y esperado
 */
function calcularDiferenciaCaja() {
    const efectivoRealInput = document.getElementById('efectivoReal');
    const efectivoReal = parseFloat(efectivoRealInput.value) || 0;

    if (efectivoReal === 0) {
        document.getElementById('diferenciaContainer').style.display = 'none';
        return;
    }

    const totalGastos = gastosDelDia.reduce((sum, gasto) => sum + parseFloat(gasto.monto), 0);
    const totalPagosPersonal = pagosPersonalDelDia.reduce((sum, pago) => sum + parseFloat(pago.total_pago), 0);
    
    // Obtener efectivo del reparto
    const repartoEfectivoText = document.getElementById('repartoEfectivo')?.textContent || '$0';
    const limpiarMoneda = (texto) => {
        return parseFloat(texto.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.')) || 0;
    };
    const repartoEfectivo = limpiarMoneda(repartoEfectivoText);
    
    const efectivoEsperado = ventasDelDia.efectivo + repartoEfectivo - totalGastos - totalPagosPersonal;
    const diferencia = efectivoReal - efectivoEsperado;

    // Mostrar container
    const container = document.getElementById('diferenciaContainer');
    container.style.display = 'flex';

    // Actualizar valores
    const label = document.getElementById('diferenciaLabel');
    const monto = document.getElementById('diferenciaMonto');

    if (diferencia > 0) {
        // Sobrante
        container.classList.remove('faltante');
        container.classList.add('sobrante');
        label.textContent = '✅ Sobrante:';
        monto.textContent = '$' + formatoMoneda(diferencia);
    } else if (diferencia < 0) {
        // Faltante
        container.classList.remove('sobrante');
        container.classList.add('faltante');
        label.textContent = '⚠️ Faltante:';
        monto.textContent = '$' + formatoMoneda(Math.abs(diferencia));
    } else {
        // Cuadrado
        container.classList.remove('sobrante', 'faltante');
        label.textContent = '✅ Cuadrado:';
        monto.textContent = '$0';
    }
}

/**
 * Cerrar caja diaria (guardar en base de datos)
 */
async function cerrarCajaDiaria() {
    const efectivoReal = parseFloat(document.getElementById('efectivoReal').value);

    if (!efectivoReal && efectivoReal !== 0) {
        mostrarNotificacion('Ingresa el efectivo real en caja', 'warning');
        document.getElementById('efectivoReal').focus();
        return;
    }

    const totalGastos = gastosDelDia.reduce((sum, gasto) => sum + parseFloat(gasto.monto), 0);
    const totalPagosPersonal = pagosPersonalDelDia.reduce((sum, pago) => sum + parseFloat(pago.total_pago), 0);
    
    // Obtener efectivo del reparto
    const repartoEfectivoText = document.getElementById('repartoEfectivo')?.textContent || '$0';
    const limpiarMoneda = (texto) => {
        return parseFloat(texto.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.')) || 0;
    };
    const repartoEfectivo = limpiarMoneda(repartoEfectivoText);
    
    const efectivoEsperado = ventasDelDia.efectivo + repartoEfectivo - totalGastos - totalPagosPersonal;
    const diferencia = efectivoReal - efectivoEsperado;

    // Confirmación
    const confirmMsg = `¿Confirmar cierre de caja?

📊 Resumen:
• Total Ventas: $${formatoMoneda(ventasDelDia.total)}
• Gastos Operacionales: $${formatoMoneda(totalGastos)}
• Pagos al Personal: $${formatoMoneda(totalPagosPersonal)}
• Efectivo Esperado: $${formatoMoneda(efectivoEsperado)}
• Efectivo Real: $${formatoMoneda(efectivoReal)}
• Diferencia: $${formatoMoneda(Math.abs(diferencia))} ${diferencia >= 0 ? '(Sobrante)' : '(Faltante)'}`;

    if (!confirm(confirmMsg)) return;

    try {
        const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Preparar detalle de gastos operacionales
        const detalleGastos = gastosDelDia.map(g => ({
            id: g.id,
            monto: g.monto,
            descripcion: g.descripcion,
            asignado_a: g.asignado_a,
            hora: new Date(g.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        }));

        // Preparar detalle de pagos al personal
        const detallePagosPersonal = pagosPersonalDelDia.map(p => ({
            id: p.id,
            empleado: p.nombre_empleado,
            puesto: p.puesto,
            turno: p.turno,
            pago_jornada: p.pago_jornada,
            pago_almuerzo: p.pago_almuerzo,
            total: p.total_pago
        }));

        // Insertar o actualizar cierre diario
        const { data, error } = await window.supabaseClient
            .from('cierres_diarios')
            .upsert({
                fecha: hoy,
                total_ventas: ventasDelDia.total,
                ventas_efectivo: ventasDelDia.efectivo,
                ventas_transferencia: ventasDelDia.transferencia,
                ventas_transbank: ventasDelDia.transbank,
                total_gastos: totalGastos,
                detalle_gastos_json: {
                    gastos_operacionales: detalleGastos,
                    pagos_personal: detallePagosPersonal,
                    total_pagos_personal: totalPagosPersonal
                },
                efectivo_esperado: efectivoEsperado,
                efectivo_real: efectivoReal,
                diferencia: diferencia,
                cerrado_por: currentUser,
                cerrado_at: new Date().toISOString(),
                notas: `Gastos Operacionales: $${formatoMoneda(totalGastos)} | Pagos Personal: $${formatoMoneda(totalPagosPersonal)}`
            }, {
                onConflict: 'fecha'
            })
            .select();

        if (error) throw error;

        mostrarNotificacion('✅ Caja cerrada exitosamente', 'success');

        // Limpiar campo de efectivo real
        document.getElementById('efectivoReal').value = '';
        document.getElementById('diferenciaContainer').style.display = 'none';

        console.log('✅ Cierre guardado:', data);

    } catch (error) {
        manejarError(error, {
            contexto: 'cerrarCajaDiaria',
            mensajeUsuario: 'Error al cerrar caja'
        });
    }
}

// ===================================
// MÓDULO: AJUSTE DE CAJA
// ===================================

let ajusteCajaActual = {
    metodo: '',
    fecha: '',
    montoCalculado: 0
};

/**
 * Abrir modal de ajuste de caja
 */
async function abrirModalAjusteCaja(metodoPago) {
    // Solo encargado puede ajustar
    if (currentUserRole !== 'encargado') {
        mostrarNotificacion('⚠️ Solo el encargado puede ajustar la caja', 'warning');
        return;
    }
    
    console.log(`💰 Abriendo modal de ajuste para: ${metodoPago}`);
    
    // Obtener fecha actual o la fecha seleccionada en el filtro
    const hoy = new Date();
    const fechaSeleccionada = hoy.toISOString().split('T')[0];
    
    // Obtener monto calculado según el método
    let montoCalculado = 0;
    if (metodoPago === 'Efectivo') {
        montoCalculado = ventasDelDia.efectivo;
    } else if (metodoPago === 'Tarjeta') {
        montoCalculado = ventasDelDia.transbank;
    } else if (metodoPago === 'Transferencia') {
        montoCalculado = ventasDelDia.transferencia;
    }
    
    // Guardar datos actuales
    ajusteCajaActual = {
        metodo: metodoPago,
        fecha: fechaSeleccionada,
        montoCalculado: montoCalculado
    };
    
    // Llenar datos en el modal
    document.getElementById('ajusteCajaMetodo').textContent = metodoPago;
    document.getElementById('ajusteCajaFecha').textContent = new Date(fechaSeleccionada).toLocaleDateString('es-CL');
    document.getElementById('ajusteCajaMontoCalculado').textContent = '$' + formatoMoneda(montoCalculado);
    
    // Resetear campos
    document.getElementById('ajusteCajaMontoReal').value = '';
    document.getElementById('ajusteCajaMotivo').value = '';
    document.getElementById('ajusteCajaDiferencia').style.display = 'none';
    
    // Verificar si ya existe un ajuste para este método y fecha
    await verificarAjusteExistente(metodoPago, fechaSeleccionada);
    
    // Mostrar modal
    const modal = document.getElementById('modalAjusteCaja');
    modal.style.display = 'flex';
    modal.classList.add('show');
    
    // Auto-focus en el input
    setTimeout(() => {
        document.getElementById('ajusteCajaMontoReal').focus();
    }, 200);
}

/**
 * Verificar si ya existe un ajuste para este método y fecha
 */
async function verificarAjusteExistente(metodoPago, fecha) {
    try {
        const { data, error } = await window.supabaseClient
            .from('caja_ajustes')
            .select('*')
            .eq('fecha', fecha)
            .eq('metodo_pago', metodoPago)
            .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
            console.error('Error al verificar ajuste:', error);
            return;
        }
        
        if (data) {
            // Ya existe un ajuste, prellenar los campos
            document.getElementById('ajusteCajaMontoReal').value = data.monto_ajustado;
            document.getElementById('ajusteCajaMotivo').value = data.motivo;
            calcularDiferenciaAjuste();
            
            mostrarNotificacion('ℹ️ Ya existe un ajuste para este método. Puedes modificarlo.', 'info', 4000);
        }
    } catch (error) {
        console.error('Error verificando ajuste:', error);
    }
}

/**
 * Calcular diferencia al ingresar monto real
 */
function calcularDiferenciaAjuste() {
    const montoReal = parseFloat(document.getElementById('ajusteCajaMontoReal').value) || 0;
    const montoCalculado = ajusteCajaActual.montoCalculado;
    
    if (montoReal === 0) {
        document.getElementById('ajusteCajaDiferencia').style.display = 'none';
        return;
    }
    
    const diferencia = montoReal - montoCalculado;
    const container = document.getElementById('ajusteCajaDiferencia');
    const valorElement = document.getElementById('ajusteCajaDiferenciaValor');
    
    container.style.display = 'block';
    
    if (diferencia > 0) {
        // Sobrante (verde)
        container.style.background = 'hsl(142 76% 36% / 0.1)';
        container.style.borderColor = 'hsl(142 76% 36%)';
        valorElement.style.color = 'hsl(142 76% 36%)';
        valorElement.textContent = '+$' + formatoMoneda(diferencia);
    } else if (diferencia < 0) {
        // Faltante (rojo)
        container.style.background = 'hsl(0 84% 60% / 0.1)';
        container.style.borderColor = 'hsl(0 84% 60%)';
        valorElement.style.color = 'hsl(0 84% 60%)';
        valorElement.textContent = '-$' + formatoMoneda(Math.abs(diferencia));
    } else {
        // Cuadrado (azul)
        container.style.background = 'hsl(217 91% 60% / 0.1)';
        container.style.borderColor = 'hsl(217 91% 60%)';
        valorElement.style.color = 'hsl(217 91% 60%)';
        valorElement.textContent = '$0 (Cuadrado ✅)';
    }
}

/**
 * Guardar ajuste de caja
 */
async function guardarAjusteCaja() {
    const montoReal = parseFloat(document.getElementById('ajusteCajaMontoReal').value);
    const motivo = document.getElementById('ajusteCajaMotivo').value.trim();
    
    // Validaciones
    if (!montoReal && montoReal !== 0) {
        mostrarNotificacion('⚠️ Ingresa el monto real contado', 'warning');
        document.getElementById('ajusteCajaMontoReal').focus();
        return;
    }
    
    if (!motivo) {
        mostrarNotificacion('⚠️ Indica el motivo del ajuste', 'warning');
        document.getElementById('ajusteCajaMotivo').focus();
        return;
    }
    
    const diferencia = montoReal - ajusteCajaActual.montoCalculado;
    
    // Confirmar ajuste
    const confirmar = confirm(
        `💰 Guardar Ajuste de Caja\n\n` +
        `Método: ${ajusteCajaActual.metodo}\n` +
        `Fecha: ${new Date(ajusteCajaActual.fecha).toLocaleDateString('es-CL')}\n` +
        `Calculado: $${formatoMoneda(ajusteCajaActual.montoCalculado)}\n` +
        `Real: $${formatoMoneda(montoReal)}\n` +
        `Diferencia: ${diferencia >= 0 ? '+' : ''}$${formatoMoneda(diferencia)}\n` +
        `Motivo: ${motivo}\n\n` +
        `¿Confirmar ajuste?`
    );
    
    if (!confirmar) return;
    
    try {
        console.log('💾 Guardando ajuste de caja...');
        
        const ajusteData = {
            fecha: ajusteCajaActual.fecha,
            metodo_pago: ajusteCajaActual.metodo,
            monto_calculado: ajusteCajaActual.montoCalculado,
            monto_ajustado: montoReal,
            diferencia: diferencia,
            motivo: motivo,
            ajustado_por: currentUser,
            created_at: new Date().toISOString()
        };
        
        // Upsert (insertar o actualizar si ya existe)
        const { data, error } = await window.supabaseClient
            .from('caja_ajustes')
            .upsert(ajusteData, {
                onConflict: 'fecha,metodo_pago'
            })
            .select();
        
        if (error) {
            console.error('❌ Error al guardar ajuste:', error);
            throw error;
        }
        
        console.log('✅ Ajuste guardado:', data);
        
        mostrarNotificacion('✅ Ajuste de caja guardado correctamente', 'success');
        
        // Cerrar modal
        cerrarModalAjusteCaja();
        
        // Recargar datos de caja para mostrar los ajustes
        await cargarDatosCaja();
        await cargarAjustesCaja(ajusteCajaActual.fecha);
        
    } catch (error) {
        console.error('❌ Error en guardarAjusteCaja:', error);
        
        manejarError(error, {
            contexto: 'guardarAjusteCaja',
            mensajeUsuario: `Error al guardar ajuste: ${error.message}`
        });
    }
}

/**
 * Cerrar modal de ajuste de caja
 */
function cerrarModalAjusteCaja() {
    const modal = document.getElementById('modalAjusteCaja');
    modal.style.display = 'none';
    modal.classList.remove('show');
    
    ajusteCajaActual = {
        metodo: '',
        fecha: '',
        montoCalculado: 0
    };
}

/**
 * Cargar ajustes de caja para una fecha específica
 */
async function cargarAjustesCaja(fecha) {
    try {
        const { data, error } = await window.supabaseClient
            .from('caja_ajustes')
            .select('*')
            .eq('fecha', fecha);
        
        if (error) {
            console.error('Error cargando ajustes:', error);
            return;
        }
        
        // Ocultar todos los indicadores primero
        document.getElementById('indicadorAjusteEfectivo').style.display = 'none';
        document.getElementById('indicadorAjusteTarjeta').style.display = 'none';
        document.getElementById('indicadorAjusteTransferencia').style.display = 'none';
        
        if (!data || data.length === 0) {
            return;
        }
        
        // Mostrar indicadores para los métodos ajustados
        data.forEach(ajuste => {
            const metodo = ajuste.metodo_pago;
            let indicador = null;
            let valorElement = null;
            
            if (metodo === 'Efectivo') {
                indicador = document.getElementById('indicadorAjusteEfectivo');
                valorElement = document.getElementById('ventasEfectivo');
            } else if (metodo === 'Tarjeta') {
                indicador = document.getElementById('indicadorAjusteTarjeta');
                valorElement = document.getElementById('ventasTransbank');
            } else if (metodo === 'Transferencia') {
                indicador = document.getElementById('indicadorAjusteTransferencia');
                valorElement = document.getElementById('ventasTransferencia');
            }
            
            if (indicador && valorElement) {
                indicador.style.display = 'inline-block';
                indicador.title = `Ajustado: $${formatoMoneda(ajuste.monto_ajustado)} (Dif: ${ajuste.diferencia >= 0 ? '+' : ''}$${formatoMoneda(ajuste.diferencia)}) - ${ajuste.motivo}`;
                
                // Actualizar el valor mostrado con el monto ajustado
                valorElement.textContent = '$' + formatoMoneda(ajuste.monto_ajustado);
            }
        });
        
        console.log(`✅ ${data.length} ajustes de caja cargados`);
        
    } catch (error) {
        console.error('Error en cargarAjustesCaja:', error);
    }
}

// ===================================
// MÓDULO: TRANSFERENCIAS BOLETEADAS
// ===================================

/**
 * Abrir modal de detalle de transferencias
 */
async function abrirModalDetalleTransferencias() {
    const modal = document.getElementById('modalDetalleTransferencias');
    modal.style.display = 'flex';
    modal.classList.add('show');
    
    // Establecer fecha por defecto (hoy)
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('filtroFechaTransferencias').value = hoy;
    
    // Restablecer filtros
    document.getElementById('filtroEstadoTransferencias').value = 'todas';
    document.getElementById('filtroOrigenTransferencias').value = 'todas';
    
    // Cargar transferencias
    await cargarListaTransferencias();
}

/**
 * Cerrar modal de detalle de transferencias
 */
function cerrarModalDetalleTransferencias() {
    const modal = document.getElementById('modalDetalleTransferencias');
    modal.style.display = 'none';
    modal.classList.remove('show');
}

/**
 * Cargar lista de transferencias desde POS y Reparto
 */
async function cargarListaTransferencias() {
    try {
        const fecha = document.getElementById('filtroFechaTransferencias').value;
        const filtroEstado = document.getElementById('filtroEstadoTransferencias').value;
        const filtroOrigen = document.getElementById('filtroOrigenTransferencias').value;
        
        if (!fecha) {
            console.warn('⚠️ No hay fecha seleccionada');
            return;
        }
        
        console.log(`🔄 Cargando transferencias para: ${fecha}`);
        console.log(`   Filtro Estado: ${filtroEstado}`);
        console.log(`   Filtro Origen: ${filtroOrigen}`);
        
        let transferencias = [];
        
        // Cargar desde POS (ventas)
        if (filtroOrigen === 'todas' || filtroOrigen === 'pos') {
            console.log('📊 Consultando ventas POS con Transferencia...');
            
            const { data: ventasPOS, error: errorPOS } = await window.supabaseClient
                .from('ventas')
                .select('*')
                .eq('metodo_pago', 'Transferencia')
                .eq('fecha', fecha)
                .order('created_at', { ascending: false });
            
            if (errorPOS) {
                console.error('❌ Error al cargar ventas POS:', errorPOS);
            } else {
                console.log(`✅ ${ventasPOS?.length || 0} ventas POS encontradas`);
                const ventasFormateadas = ventasPOS.map(v => ({
                    id: v.id,
                    origen: 'POS',
                    cliente: v.cliente || 'Cliente general',
                    monto: parseFloat(v.total || 0),
                    fecha: v.created_at || v.fecha,
                    hora: v.created_at 
                        ? new Date(v.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                        : '00:00',
                    vendedor: v.vendedor_nombre || v.vendedor || 'Sin vendedor',
                    productos: v.productos || [],
                    metodoPago: 'Transferencia',
                    boleteada: v.boleteada || false,
                    numeroBoleta: v.numero_boleta || '',
                    fechaBoleta: v.fecha_boleta || null
                }));
                transferencias.push(...ventasFormateadas);
            }
        }
        
        // Cargar desde Reparto (pedidos)
        if (filtroOrigen === 'todas' || filtroOrigen === 'reparto') {
            console.log('🚚 Consultando pedidos de Reparto vía RPC...');
            console.log(`   Fecha seleccionada: ${fecha}`);
            
            // VERIFICAR CONEXIÓN
            if (!window.supabaseClient) {
                console.error('❌ window.supabaseClient NO está inicializado');
                alert('ERROR: Supabase no está conectado. Recarga la página.');
            } else {
                console.log('✅ Cliente Supabase conectado');
                
                try {
                    // LLAMAR A FUNCIÓN RPC SEGURA (bypasea políticas RLS)
                    console.log('📡 Llamando función RPC: obtener_transferencias_dia');
                    console.log('   Parámetro fecha:', fecha);
                    
                    const { data: pedidosRPC, error: errorRPC } = await window.supabaseClient
                        .rpc('obtener_transferencias_dia', { fecha_consulta: fecha });
                    
                    console.log('📡 RPC completada');
                    console.log('   Error:', errorRPC);
                    console.log('   Data recibida:', pedidosRPC?.length || 0, 'registros');
                    
                    if (errorRPC) {
                        console.error('❌ Error en RPC:', errorRPC);
                        console.error('   Código:', errorRPC.code);
                        console.error('   Mensaje:', errorRPC.message);
                        console.error('   Hint:', errorRPC.hint);
                        
                        // Si la función no existe, mostrar instrucciones
                        if (errorRPC.code === '42883' || errorRPC.message?.includes('function')) {
                            alert('⚠️ CONFIGURACIÓN PENDIENTE:\n\n' +
                                  'Debes ejecutar el script SQL:\n' +
                                  'CREAR_FUNCION_RPC_PEDIDOS.sql\n\n' +
                                  'en el SQL Editor de Supabase.\n\n' +
                                  '✅ Esto NO afecta el sistema de Reparto.');
                        } else {
                            alert(`ERROR al cargar pedidos de Reparto: ${errorRPC.message}`);
                        }
                    } else {
                        const totalPedidos = pedidosRPC?.length || 0;
                        console.log(`📦 Total pedidos encontrados: ${totalPedidos}`);
                        
                        if (totalPedidos > 0) {
                            // Procesar y formatear pedidos encontrados
                            const pedidosFormateados = pedidosRPC.map(p => {
                                const metodoPago = p.metodo_pago || 'Transferencia';
                                let metodoPagoTexto = 'Transferencia';
                                
                                if (metodoPago === 'TP') metodoPagoTexto = 'Transferencia Pendiente';
                                else if (metodoPago === 'TG') metodoPagoTexto = 'Transferencia Pagada';
                                else if (metodoPago.includes('TRANSF')) metodoPagoTexto = 'Transferencia';
                                
                                // Usar created_at para timestamp
                                const fechaTimestamp = p.created_at || p.fecha;
                                const hora = fechaTimestamp 
                                    ? new Date(fechaTimestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                                    : '00:00';
                                
                                // Los productos están en items
                                const productos = p.items || [];
                                
                                console.log(`✅ Pedido: ${p.nombre}, Método: ${metodoPago}, Total: $${p.total}`);
                                
                                return {
                                    id: p.id,
                                    origen: 'Reparto',
                                    cliente: p.nombre || 'Cliente',
                                    monto: parseFloat(p.total || 0),
                                    fecha: fechaTimestamp,
                                    hora: hora,
                                    vendedor: p.asignado_a || 'Sin asignar',
                                    productos: productos,
                                    metodoPago: metodoPagoTexto,
                                    boleteada: p.boleteada || false,
                                    numeroBoleta: p.numero_boleta || '',
                                    fechaBoleta: p.fecha_boleta || null
                                };
                            });
                            
                            transferencias.push(...pedidosFormateados);
                            console.log(`✅ ${pedidosFormateados.length} pedidos de Reparto agregados`);
                        }
                    }
                } catch (errorQuery) {
                    console.error('❌ Error en bloque try de pedidos:', errorQuery);
                    console.error('   Stack:', errorQuery.stack);
                }
            }
        }
        
        // Aplicar filtro de estado
        if (filtroEstado === 'pendientes') {
            transferencias = transferencias.filter(t => !t.boleteada);
        } else if (filtroEstado === 'boleteadas') {
            transferencias = transferencias.filter(t => t.boleteada);
        }
        
        // Ordenar por fecha (más reciente primero)
        transferencias.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        console.log(`✅ ${transferencias.length} transferencias cargadas`);
        
        // Renderizar lista
        renderizarListaTransferencias(transferencias);
        
        // Actualizar resumen
        actualizarResumenTransferencias(transferencias);
        
        // Actualizar badge en la tarjeta principal
        actualizarBadgePendientes(transferencias);
        
    } catch (error) {
        console.error('❌ Error en cargarListaTransferencias:', error);
        manejarError(error, {
            contexto: 'cargarListaTransferencias',
            mensajeUsuario: 'Error al cargar transferencias'
        });
    }
}

/**
 * Renderizar lista de transferencias en el DOM
 */
function renderizarListaTransferencias(transferencias) {
    const container = document.getElementById('listaTransferencias');
    
    if (!transferencias || transferencias.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: hsl(var(--muted-foreground));">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 16px; opacity: 0.3;">
                    <path d="M9 11L12 14L22 4M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p style="font-size: 16px; font-weight: 600; margin: 0 0 8px;">No hay transferencias</p>
                <p style="font-size: 14px; margin: 0;">No se encontraron transferencias para los filtros seleccionados</p>
            </div>
        `;
        return;
    }
    
    let html = '<div style="padding: 16px;">';
    
    transferencias.forEach(t => {
        const productosTexto = Array.isArray(t.productos) && t.productos.length > 0 
            ? t.productos.map(p => `${p.nombre || p.producto} (${p.cantidad})`).join(', ')
            : 'Sin detalle de productos';
        
        const estadoColor = t.boleteada ? 'hsl(var(--success))' : 'hsl(38 92% 50%)';
        const estadoIcono = t.boleteada ? '✅' : '⏳';
        const estadoTexto = t.boleteada ? 'Boleteada' : 'Sin boletear';
        
        html += `
            <div style="background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 12px; padding: 16px; margin-bottom: 12px; ${t.boleteada ? 'opacity: 0.7;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-weight: 700; font-size: 18px; color: hsl(var(--primary));">$${formatoMoneda(t.monto)}</span>
                            <span style="background: ${t.origen === 'POS' ? 'hsl(var(--primary) / 0.1)' : 'hsl(217 91% 60% / 0.1)'}; color: ${t.origen === 'POS' ? 'hsl(var(--primary))' : 'hsl(217 91% 60%)'}; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 600;">${t.origen}</span>
                        </div>
                        <p style="font-size: 14px; font-weight: 600; margin: 0 0 4px; color: hsl(var(--foreground));">👤 ${t.cliente}</p>
                        <p style="font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0;">
                            🕐 ${t.hora} • 👨‍💼 ${t.vendedor}
                        </p>
                        <p style="font-size: 11px; color: hsl(var(--muted-foreground)); margin: 8px 0 0; line-height: 1.4;">
                            📦 ${productosTexto}
                        </p>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                        <span style="background: ${estadoColor}15; color: ${estadoColor}; padding: 4px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; white-space: nowrap;">
                            ${estadoIcono} ${estadoTexto}
                        </span>
                        ${!t.boleteada ? `
                            <button onclick="marcarComoBoleteada('${t.id}', '${t.origen}')" class="btn btn-sm btn-primary" style="font-size: 11px; padding: 6px 12px;">
                                Marcar Boleteada
                            </button>
                        ` : t.numeroBoleta ? `
                            <p style="font-size: 10px; color: hsl(var(--muted-foreground)); margin: 0; text-align: right;">
                                N° Boleta: <strong>${t.numeroBoleta}</strong><br>
                                ${t.fechaBoleta ? new Date(t.fechaBoleta).toLocaleDateString('es-CL') : ''}
                            </p>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * Actualizar resumen de transferencias (cards superiores)
 */
function actualizarResumenTransferencias(transferencias) {
    const total = transferencias.reduce((sum, t) => sum + t.monto, 0);
    const boleteadas = transferencias.filter(t => t.boleteada);
    const totalBoleteadas = boleteadas.reduce((sum, t) => sum + t.monto, 0);
    const pendientes = transferencias.filter(t => !t.boleteada);
    const totalPendientes = pendientes.reduce((sum, t) => sum + t.monto, 0);
    
    document.getElementById('resumenTotalTransferencias').textContent = '$' + formatoMoneda(total);
    document.getElementById('resumenCantidadTotal').textContent = `${transferencias.length} transferencia${transferencias.length !== 1 ? 's' : ''}`;
    
    document.getElementById('resumenBoleteadas').textContent = '$' + formatoMoneda(totalBoleteadas);
    document.getElementById('resumenCantidadBoleteadas').textContent = `${boleteadas.length} transferencia${boleteadas.length !== 1 ? 's' : ''}`;
    
    document.getElementById('resumenPendientes').textContent = '$' + formatoMoneda(totalPendientes);
    document.getElementById('resumenCantidadPendientes').textContent = `${pendientes.length} transferencia${pendientes.length !== 1 ? 's' : ''}`;
}

/**
 * Actualizar badge de pendientes en la tarjeta principal
 */
function actualizarBadgePendientes(transferencias) {
    const pendientes = transferencias.filter(t => !t.boleteada);
    const badge = document.getElementById('badgePendientesBoletear');
    
    if (pendientes.length > 0) {
        badge.textContent = `${pendientes.length} sin boletear`;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Marcar una transferencia como boleteada
 */
async function marcarComoBoleteada(id, origen) {
    try {
        // Preguntar por número de boleta (opcional)
        const numeroBoleta = prompt('Número de boleta (opcional):');
        
        // Confirmar acción
        const confirmar = confirm('¿Marcar esta transferencia como boleteada?');
        if (!confirmar) return;
        
        const tabla = origen === 'POS' ? 'ventas' : 'pedidos';
        const fechaBoleta = new Date().toISOString();
        
        const updateData = {
            boleteada: true,
            fecha_boleta: fechaBoleta
        };
        
        if (numeroBoleta && numeroBoleta.trim() !== '') {
            updateData.numero_boleta = numeroBoleta.trim();
        }
        
        const { error } = await window.supabaseClient
            .from(tabla)
            .update(updateData)
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        console.log(`✅ Transferencia ${id} marcada como boleteada`);
        
        // Recargar lista
        await cargarListaTransferencias();
        
        // Mostrar notificación
        mostrarNotificacion('✅ Transferencia marcada como boleteada', 'success');
        
    } catch (error) {
        console.error('❌ Error al marcar como boleteada:', error);
        manejarError(error, {
            contexto: 'marcarComoBoleteada',
            mensajeUsuario: 'Error al marcar transferencia como boleteada'
        });
    }
}

/**
 * Exportar transferencias a Excel/CSV
 */
function exportarTransferencias() {
    try {
        const fecha = document.getElementById('filtroFechaTransferencias').value;
        const tabla = document.getElementById('listaTransferencias');
        const transferencias = Array.from(tabla.querySelectorAll('[style*="background: hsl"]'));
        
        if (transferencias.length === 0) {
            alert('No hay transferencias para exportar');
            return;
        }
        
        // Crear CSV
        let csv = 'Fecha,Hora,Origen,Cliente,Monto,Vendedor,Estado,N° Boleta\n';
        
        // Aquí necesitaríamos acceder a los datos originales
        // Por ahora mostrar mensaje
        alert('Función de exportación en desarrollo. Próximamente podrás exportar a Excel.');
        
        console.log('📊 Exportar transferencias para fecha:', fecha);
        
    } catch (error) {
        console.error('❌ Error al exportar:', error);
        alert('Error al exportar transferencias');
    }
}

// ===================================
// MÓDULO: CIERRE AUTOMÁTICO
// ===================================

/**
 * Inicializar sistema de cierre automático
 */
function inicializarSistemaCierreAutomatico() {
    // Cargar preferencia de localStorage (por defecto habilitado)
    const habilitado = localStorage.getItem('cierre_automatico_habilitado');
    if (habilitado === 'false') {
        document.getElementById('toggleCierreAutomatico').checked = false;
    }
    
    // Limpiar interval anterior si existe
    if (intervalVerificacionCierre) {
        clearInterval(intervalVerificacionCierre);
    }
    
    // Verificar cada minuto si es hora de mostrar recordatorio o ejecutar cierre
    intervalVerificacionCierre = setInterval(() => {
        verificarHorariosCierre();
    }, 60000); // Cada 60 segundos
    
    // Verificar inmediatamente al iniciar
    verificarHorariosCierre();
    
    console.log('✅ Sistema de cierre automático inicializado');
}

/**
 * Verificar si es hora de mostrar recordatorio o ejecutar cierre
 * MEJORADO: Incluye retry y detección de omisión
 */
function verificarHorariosCierre() {
    const ahora = new Date();
    const horas = ahora.getHours();
    const minutos = ahora.getMinutes();
    
    // Verificar si el cierre automático está habilitado
    const habilitado = localStorage.getItem('cierre_automatico_habilitado') !== 'false';
    
    if (!habilitado) {
        return; // No hacer nada si está deshabilitado
    }
    
    // Primera notificación a las 19:30 (1.5 horas antes del cierre)
    if (horas === 19 && minutos === 30 && !notificacionTempranaMostrada) {
        mostrarNotificacionTempranaCierre();
        notificacionTempranaMostrada = true;
    }
    
    // Recordatorio principal a las 20:00 (1 hora antes del cierre)
    if (horas === 20 && minutos === 0 && !recordatorioMostrado) {
        mostrarRecordatorioCierreCaja();
        recordatorioMostrado = true;
    }
    
    // Resetear flags de notificaciones al día siguiente
    if (horas === 0 && minutos === 1) {
        recordatorioMostrado = false;
        notificacionTempranaMostrada = false;
    }
    
    // MEJORADO: Ventana de ejecución del cierre (21:00 a 21:05)
    // Cierre a las 9:00 PM - Más práctico para verificar mientras están en el local
    if (horas === 21 && minutos <= 5) {
        const ultimoIntento = localStorage.getItem('ultimo_intento_cierre_auto');
        const hoy = new Date().toISOString().split('T')[0];
        
        // Solo ejecutar si no se ha intentado hoy
        if (ultimoIntento !== hoy) {
            localStorage.setItem('ultimo_intento_cierre_auto', hoy);
            ejecutarCierreAutomatico();
        }
    }
    
    // Verificación adicional a las 22:00 por si falló a las 21:00
    if (horas === 22 && minutos === 0) {
        const ultimoIntento = localStorage.getItem('ultimo_intento_cierre_auto');
        const hoy = new Date().toISOString().split('T')[0];
        
        // Si no se intentó hoy, hay un problema
        if (ultimoIntento !== hoy) {
            console.warn('⚠️ Cierre automático omitido a las 21:00, intentando recuperación...');
            ejecutarCierreAutomatico();
        }
    }
}

/**
 * Mostrar notificación temprana a las 19:30 (1.5 horas antes)
 */
function mostrarNotificacionTempranaCierre() {
    // Solo mostrar si es encargado
    if (currentUserRole !== 'encargado') {
        return;
    }
    
    mostrarNotificacion(
        '⏰ Recordatorio: Cierre en 1.5 horas\n\n' +
        'El cierre automático se ejecutará a las 21:00.\n' +
        'Prepárate para hacer el arqueo del día.',
        'info',
        8000
    );
    
    console.log('⏰ Notificación temprana de cierre mostrada (19:30)');
}

/**
 * Mostrar recordatorio principal para cerrar la caja a las 20:00
 */
function mostrarRecordatorioCierreCaja() {
    // Solo mostrar si es encargado
    if (currentUserRole !== 'encargado') {
        return;
    }
    
    // Crear notificación persistente
    const notif = document.createElement('div');
    notif.id = 'recordatorioCierreCaja';
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        padding: 24px;
        background: linear-gradient(135deg, hsl(38 92% 50% / 0.95), hsl(38 92% 45% / 0.95));
        color: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        z-index: 10001;
        animation: slideInRight 0.5s ease-out, pulse 2s ease-in-out infinite;
        backdrop-filter: blur(10px);
    `;
    
    notif.innerHTML = `
        <div style="display: flex; align-items: start; gap: 16px;">
            <div style="font-size: 32px; animation: bell-ring 1s ease-in-out infinite;">🔔</div>
            <div style="flex: 1;">
                <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 700;">Recordatorio: Cierre en 1 hora</h3>
                <p style="margin: 0 0 16px; font-size: 14px; opacity: 0.95;">El cierre automático se ejecutará a las 21:00. Es momento de preparar el arqueo del día.</p>
                <div style="display: flex; gap: 8px;">
                    <button onclick="irACaja(); cerrarRecordatorio();" style="padding: 8px 16px; background: white; color: hsl(38 92% 45%); border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px;">
                        Ir a Caja
                    </button>
                    <button onclick="cerrarRecordatorio();" style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border: 1px solid white; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notif);
    notificacionRecordatorio = notif;
    
    // Auto-cerrar después de 5 minutos
    setTimeout(() => {
        cerrarRecordatorio();
    }, 5 * 60 * 1000);
    
    // Agregar animación de campana
    const style = document.createElement('style');
    style.textContent = `
        @keyframes bell-ring {
            0%, 100% { transform: rotate(0deg); }
            10%, 30% { transform: rotate(-10deg); }
            20%, 40% { transform: rotate(10deg); }
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Cerrar recordatorio de caja
 */
function cerrarRecordatorio() {
    if (notificacionRecordatorio) {
        notificacionRecordatorio.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (notificacionRecordatorio && notificacionRecordatorio.parentNode) {
                notificacionRecordatorio.remove();
                notificacionRecordatorio = null;
            }
        }, 300);
    }
}

/**
 * Ir rápido a la vista de caja
 */
function irACaja() {
    cambiarVista('caja');
}

/**
 * Ejecutar cierre automático a medianoche
 */
async function ejecutarCierreAutomatico() {
    try {
        console.log('🤖 Ejecutando cierre automático...');
        
        // MEJORA 1: Verificar conexión a internet
        if (!navigator.onLine) {
            console.warn('⚠️ Sin conexión a internet, cierre automático pendiente');
            const erroresAnteriores = JSON.parse(localStorage.getItem('errores_cierre_automatico') || '[]');
            erroresAnteriores.push({
                fecha: new Date().toISOString(),
                error: 'Sin conexión a internet',
                tipo: 'network'
            });
            localStorage.setItem('errores_cierre_automatico', JSON.stringify(erroresAnteriores.slice(-10)));
            return;
        }
        
        // Verificar si el cierre automático está habilitado
        const habilitado = localStorage.getItem('cierre_automatico_habilitado') !== 'false';
        if (!habilitado) {
            console.log('⏸️ Cierre automático deshabilitado');
            return;
        }
        
        if (!window.supabaseClient) {
            console.warn('⚠️ Supabase no disponible para cierre automático');
            return;
        }
        
        // Obtener fecha de HOY (cierre se hace a las 21:00 del mismo día)
        const hoy = new Date();
        const fechaHoy = hoy.toISOString().split('T')[0];
        
        // Verificar si ya existe un cierre para hoy
        const { data: cierreExistente, error: errorConsulta } = await window.supabaseClient
            .from('cierres_diarios')
            .select('id')
            .eq('fecha', fechaHoy)
            .single();
        
        if (cierreExistente) {
            console.log('✅ Ya existe cierre para hoy, saltando cierre automático');
            return;
        }
        
        // Cargar ventas de HOY (desde las 00:00 hasta ahora)
        const inicioHoy = new Date(fechaHoy);
        inicioHoy.setHours(0, 0, 0, 0);
        const finHoy = new Date(); // Hasta ahora (21:00)
        
        const { data: ventasHoy, error: errorVentas } = await window.supabaseClient
            .from('ventas')
            .select('*')
            .gte('fecha', inicioHoy.toISOString())
            .lte('fecha', finHoy.toISOString());
        
        if (errorVentas) throw errorVentas;
        
        // Calcular totales de ventas
        let totalVentas = 0;
        let ventasEfectivo = 0;
        let ventasTransbank = 0;
        let ventasTransferencia = 0;
        
        if (ventasHoy && ventasHoy.length > 0) {
            ventasHoy.forEach(venta => {
                totalVentas += venta.total;
                
                let detallePagos = venta.pagos_detalle || venta.detalle_pagos || venta.metodo_pago;
                if (typeof detallePagos === 'string' && detallePagos.startsWith('[')) {
                    const pagos = JSON.parse(detallePagos);
                    pagos.forEach(pago => {
                        if (pago.metodo === 'Efectivo') ventasEfectivo += pago.monto;
                        else if (pago.metodo === 'Tarjeta' || pago.metodo === 'Transbank') ventasTransbank += pago.monto;
                        else if (pago.metodo === 'Transferencia') ventasTransferencia += pago.monto;
                    });
                } else if (typeof detallePagos === 'string') {
                    if (detallePagos === 'Efectivo') ventasEfectivo += venta.total;
                    else if (detallePagos === 'Tarjeta' || detallePagos === 'Transbank') ventasTransbank += venta.total;
                    else if (detallePagos === 'Transferencia') ventasTransferencia += venta.total;
                }
            });
        }
        
        // Cargar gastos de HOY
        const { data: gastosHoy, error: errorGastos } = await window.supabaseClient
            .from('gastos')
            .select('*')
            .gte('fecha', inicioHoy.toISOString())
            .lte('fecha', finHoy.toISOString());
        
        if (errorGastos) throw errorGastos;
        
        const totalGastos = gastosHoy ? gastosHoy.reduce((sum, g) => sum + parseFloat(g.monto), 0) : 0;
        
        // Cargar pagos al personal de HOY
        const { data: pagosPersonalHoy, error: errorPagos } = await window.supabaseClient
            .from('pagos_personal')
            .select('*')
            .gte('fecha', inicioHoy.toISOString())
            .lte('fecha', finHoy.toISOString());
        
        if (errorPagos) throw errorPagos;
        
        const totalPagosPersonal = pagosPersonalHoy ? pagosPersonalHoy.reduce((sum, p) => sum + parseFloat(p.total_pago), 0) : 0;
        
        // NUEVO: Cargar datos de reparto de HOY
        let repartoEfectivo = 0;
        let repartoTarjetas = 0;
        let repartoTransferencias = 0;
        let repartoTotal = 0;
        
        try {
            const { data: pedidosReparto, error: errorReparto } = await window.supabaseClient
                .rpc('obtener_pedidos_dia', { fecha_consulta: fechaHoy });
            
            if (!errorReparto && pedidosReparto && pedidosReparto.length > 0) {
                pedidosReparto.forEach(pedido => {
                    const metodo = pedido.metodo_pago;
                    const monto = parseFloat(pedido.total) || 0;
                    
                    // Solo contar pedidos confirmados/entregados
                    const esTransferencia = metodo === 'TP' || metodo === 'TG' || metodo === 'T';
                    const fechaContabilizar = new Date(pedido.fecha);
                    
                    if (esTransferencia && pedido.boleteada && pedido.fecha_boleta) {
                        fechaContabilizar.setTime(new Date(pedido.fecha_boleta).getTime());
                    } else if (metodo === 'TG') {
                        fechaContabilizar.setTime(pedido.fecha_boleta ? new Date(pedido.fecha_boleta).getTime() : new Date(pedido.fecha).getTime());
                    } else if (metodo === 'TP') {
                        // TP sin boletear: cuenta en fecha del pedido (igual que actualizarResumenReparto)
                        fechaContabilizar.setTime(new Date(pedido.fecha + 'T00:00:00').getTime());
                    }
                    
                    const fechaContabilizar_str = fechaContabilizar.toISOString().split('T')[0];
                    if (fechaContabilizar_str === fechaHoy) {
                        repartoTotal += monto;
                        if (metodo === 'E') repartoEfectivo += monto;
                        else if (metodo === 'DC') repartoTarjetas += monto;
                        else if (esTransferencia) repartoTransferencias += monto;
                    }
                });
            }
        } catch (errorReparto) {
            console.warn('⚠️ No se pudieron cargar datos de reparto:', errorReparto);
            // Continuar sin datos de reparto
        }
        
        // CONSOLIDAR: Sumar POS + Reparto en las columnas existentes
        const efectivoConsolidado = ventasEfectivo + repartoEfectivo;
        const transbankConsolidado = ventasTransbank + repartoTarjetas;
        const transferenciaConsolidada = ventasTransferencia + repartoTransferencias;
        const totalVentasConsolidado = totalVentas + repartoTotal;
        
        // Calcular efectivo esperado con reparto incluido
        const efectivoEsperado = efectivoConsolidado - totalGastos - totalPagosPersonal;
        
        // Preparar detalles para JSON
        const detalleGastosCompleto = {
            gastos_operacionales: gastosHoy || [],
            pagos_personal: pagosPersonalHoy || [],
            total_pagos_personal: totalPagosPersonal,
            // Desglose de ventas por origen
            desglose_ventas: {
                pos: {
                    efectivo: ventasEfectivo,
                    transbank: ventasTransbank,
                    transferencia: ventasTransferencia,
                    total: totalVentas,
                    cantidad_ventas: ventasHoy ? ventasHoy.length : 0
                },
                reparto: {
                    efectivo: repartoEfectivo,
                    tarjetas: repartoTarjetas,
                    transferencias: repartoTransferencias,
                    total: repartoTotal,
                    cantidad_pedidos: 0 // Se actualizará si hay datos
                }
            }
        };
        
        // Crear cierre automático con datos consolidados
        const { data: cierreNuevo, error: errorCierre } = await window.supabaseClient
            .from('cierres_diarios')
            .insert({
                fecha: fechaHoy,
                total_ventas: totalVentasConsolidado,
                ventas_efectivo: efectivoConsolidado,
                ventas_transferencia: transferenciaConsolidada,
                ventas_transbank: transbankConsolidado,
                total_gastos: totalGastos,
                detalle_gastos_json: detalleGastosCompleto,
                efectivo_esperado: efectivoEsperado,
                efectivo_real: null,
                diferencia: null,
                cerrado_por: 'Sistema Automático',
                cerrado_at: new Date().toISOString(),
                notas: `🤖 Cierre automático a las 21:00 - Requiere revisión de arqueo

📊 RESUMEN CONSOLIDADO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 VENTAS TOTAL: $${formatoMoneda(totalVentasConsolidado)}

🏪 POS LOCAL: $${formatoMoneda(totalVentas)}
   • Efectivo: $${formatoMoneda(ventasEfectivo)}
   • Tarjetas: $${formatoMoneda(ventasTransbank)}
   • Transferencias: $${formatoMoneda(ventasTransferencia)}
   • Ventas registradas: ${ventasHoy ? ventasHoy.length : 0}

🚚 DELIVERY/REPARTO: $${formatoMoneda(repartoTotal)}
   • Efectivo: $${formatoMoneda(repartoEfectivo)}
   • Tarjetas: $${formatoMoneda(repartoTarjetas)}
   • Transferencias: $${formatoMoneda(repartoTransferencias)}

💸 SALIDAS:
   • Gastos Operacionales: $${formatoMoneda(totalGastos)}
   • Pagos Personal: $${formatoMoneda(totalPagosPersonal)}

💵 EFECTIVO ESPERADO EN CAJA: $${formatoMoneda(efectivoEsperado)}
   (Efectivo POS + Delivery - Gastos - Pagos)

⚠️ PENDIENTE: Ingresar efectivo real para completar arqueo`,
                cierre_automatico: true
            })
            .select();
        
        if (errorCierre) throw errorCierre;
        
        console.log('✅ Cierre automático ejecutado exitosamente para', fechaHoy);
        console.log('📊 Consolidado:', {
            total: totalVentasConsolidado,
            pos: totalVentas,
            reparto: repartoTotal,
            efectivoEsperado: efectivoEsperado
        });
        
        // Guardar en localStorage el último cierre automático exitoso
        localStorage.setItem('ultimo_cierre_automatico', JSON.stringify({
            fecha: fechaHoy,
            timestamp: new Date().toISOString(),
            exito: true,
            totales: {
                ventas: totalVentasConsolidado,
                efectivo_esperado: efectivoEsperado
            }
        }));
        
        // MEJORA 2: Notificación al encargado sobre cierre exitoso
        if (currentUserRole === 'encargado') {
            // Esperar 2 segundos para asegurar que el cierre se guardó
            setTimeout(() => {
                mostrarNotificacion(
                    `✅ Cierre automático completado para ${new Date(fechaHoy).toLocaleDateString('es-CL')}\n\n` +
                    `💰 Total ventas: $${formatoMoneda(totalVentasConsolidado)}\n` +
                    `💵 Efectivo esperado: $${formatoMoneda(efectivoEsperado)}\n\n` +
                    `⏳ Pendiente: Completar arqueo de efectivo real`,
                    'success',
                    12000
                );
            }, 2000);
        }
        
    } catch (error) {
        console.error('❌ Error en cierre automático:', error);
        
        // Guardar error en localStorage para debugging
        const erroresAnteriores = JSON.parse(localStorage.getItem('errores_cierre_automatico') || '[]');
        erroresAnteriores.push({
            fecha: new Date().toISOString(),
            fechaIntento: new Date().toISOString().split('T')[0],
            error: error.message,
            stack: error.stack
        });
        // Mantener solo últimos 10 errores
        if (erroresAnteriores.length > 10) {
            erroresAnteriores.shift();
        }
        localStorage.setItem('errores_cierre_automatico', JSON.stringify(erroresAnteriores));
        
        manejarError(error, {
            contexto: 'ejecutarCierreAutomatico',
            mensajeUsuario: 'Error en cierre automático del día',
            mostrarNotificacion: false,
            esErrorCritico: true
        });
    }
}

/**
 * NUEVO: Recuperar cierres perdidos (días sin cierre registrado)
 */
async function recuperarCierresPerdidos() {
    try {
        if (!window.supabaseClient) {
            return;
        }
        
        console.log('🔍 Verificando cierres perdidos...');
        
        // Revisar últimos 7 días
        const hoy = new Date();
        const hace7Dias = new Date();
        hace7Dias.setDate(hoy.getDate() - 7);
        
        // Obtener todos los cierres de los últimos 7 días
        const { data: cierresExistentes, error: errorCierres } = await window.supabaseClient
            .from('cierres_diarios')
            .select('fecha')
            .gte('fecha', hace7Dias.toISOString().split('T')[0])
            .lt('fecha', hoy.toISOString().split('T')[0]);
        
        if (errorCierres) throw errorCierres;
        
        const fechasConCierre = new Set(cierresExistentes?.map(c => c.fecha) || []);
        
        // Detectar días sin cierre
        const diasSinCierre = [];
        for (let i = 1; i <= 7; i++) {
            const fecha = new Date();
            fecha.setDate(hoy.getDate() - i);
            const fechaStr = fecha.toISOString().split('T')[0];
            
            if (!fechasConCierre.has(fechaStr)) {
                diasSinCierre.push(fechaStr);
            }
        }
        
        if (diasSinCierre.length === 0) {
            console.log('✅ No hay cierres perdidos');
            return;
        }
        
        console.warn(`⚠️ Se encontraron ${diasSinCierre.length} día(s) sin cierre:`, diasSinCierre);
        
        // Crear cierres para días perdidos
        for (const fechaPerdida of diasSinCierre) {
            try {
                await crearCierreRecuperado(fechaPerdida);
                console.log(`✅ Cierre recuperado para ${fechaPerdida}`);
            } catch (errorRecuperacion) {
                console.error(`❌ No se pudo recuperar cierre de ${fechaPerdida}:`, errorRecuperacion);
            }
        }
        
        // Notificar al encargado si hay cierres recuperados
        if (currentUserRole === 'encargado' && diasSinCierre.length > 0) {
            mostrarNotificacion(
                `Se recuperaron ${diasSinCierre.length} cierre(s) perdido(s). 
                Revisa el historial para completar arqueos pendientes.`,
                'warning',
                8000
            );
        }
        
    } catch (error) {
        console.error('❌ Error en recuperación de cierres:', error);
    }
}

/**
 * NUEVO: Crear cierre recuperado para una fecha específica
 */
async function crearCierreRecuperado(fecha) {
    try {
        const inicioDia = new Date(fecha);
        inicioDia.setHours(0, 0, 0, 0);
        const finDia = new Date(fecha);
        finDia.setHours(23, 59, 59, 999);
        
        // Cargar ventas
        const { data: ventas, error: errorVentas } = await window.supabaseClient
            .from('ventas')
            .select('*')
            .gte('fecha', inicioDia.toISOString())
            .lte('fecha', finDia.toISOString());
        
        if (errorVentas) throw errorVentas;
        
        let totalVentas = 0;
        let ventasEfectivo = 0;
        let ventasTransbank = 0;
        let ventasTransferencia = 0;
        
        if (ventas && ventas.length > 0) {
            ventas.forEach(venta => {
                totalVentas += venta.total;
                let detallePagos = venta.pagos_detalle || venta.detalle_pagos || venta.metodo_pago;
                if (typeof detallePagos === 'string' && detallePagos.startsWith('[')) {
                    const pagos = JSON.parse(detallePagos);
                    pagos.forEach(pago => {
                        if (pago.metodo === 'Efectivo') ventasEfectivo += pago.monto;
                        else if (pago.metodo === 'Tarjeta' || pago.metodo === 'Transbank') ventasTransbank += pago.monto;
                        else if (pago.metodo === 'Transferencia') ventasTransferencia += pago.monto;
                    });
                } else if (typeof detallePagos === 'string') {
                    if (detallePagos === 'Efectivo') ventasEfectivo += venta.total;
                    else if (detallePagos === 'Tarjeta' || detallePagos === 'Transbank') ventasTransbank += venta.total;
                    else if (detallePagos === 'Transferencia') ventasTransferencia += venta.total;
                }
            });
        }
        
        // Cargar gastos
        const { data: gastos, error: errorGastos } = await window.supabaseClient
            .from('gastos')
            .select('*')
            .gte('fecha', inicioDia.toISOString())
            .lte('fecha', finDia.toISOString());
        
        if (errorGastos) throw errorGastos;
        const totalGastos = gastos ? gastos.reduce((sum, g) => sum + parseFloat(g.monto), 0) : 0;
        
        // Cargar pagos personal
        const { data: pagosPersonal, error: errorPagos } = await window.supabaseClient
            .from('pagos_personal')
            .select('*')
            .gte('fecha', inicioDia.toISOString())
            .lte('fecha', finDia.toISOString());
        
        if (errorPagos) throw errorPagos;
        const totalPagosPersonal = pagosPersonal ? pagosPersonal.reduce((sum, p) => sum + parseFloat(p.total_pago), 0) : 0;
        
        // Cargar reparto
        let repartoEfectivo = 0;
        let repartoTarjetas = 0;
        let repartoTransferencias = 0;
        let repartoTotal = 0;
        let cantidadPedidosReparto = 0;
        
        try {
            const { data: pedidosReparto, error: errorReparto } = await window.supabaseClient
                .rpc('obtener_pedidos_dia', { fecha_consulta: fecha });
            
            if (!errorReparto && pedidosReparto && pedidosReparto.length > 0) {
                cantidadPedidosReparto = pedidosReparto.length;
                pedidosReparto.forEach(pedido => {
                    const metodo = pedido.metodo_pago;
                    const monto = parseFloat(pedido.total) || 0;
                    const esTransferencia = metodo === 'TP' || metodo === 'TG' || metodo === 'T';
                    const fechaContabilizar = new Date(pedido.fecha);
                    
                    if (esTransferencia && pedido.boleteada && pedido.fecha_boleta) {
                        fechaContabilizar.setTime(new Date(pedido.fecha_boleta).getTime());
                    } else if (metodo === 'TG') {
                        fechaContabilizar.setTime(pedido.fecha_boleta ? new Date(pedido.fecha_boleta).getTime() : new Date(pedido.fecha).getTime());
                    } else if (metodo === 'TP') {
                        // TP sin boletear: cuenta en fecha del pedido (igual que actualizarResumenReparto)
                        fechaContabilizar.setTime(new Date(pedido.fecha + 'T00:00:00').getTime());
                    }
                    
                    const fechaContabilizar_str = fechaContabilizar.toISOString().split('T')[0];
                    if (fechaContabilizar_str === fecha) {
                        repartoTotal += monto;
                        if (metodo === 'E') repartoEfectivo += monto;
                        else if (metodo === 'DC') repartoTarjetas += monto;
                        else if (esTransferencia) repartoTransferencias += monto;
                    }
                });
            }
        } catch (errorReparto) {
            console.warn('⚠️ No se pudieron cargar datos de reparto para recuperación:', errorReparto);
        }
        
        const totalVentasConsolidado = totalVentas + repartoTotal;
        const efectivoEsperado = ventasEfectivo + repartoEfectivo - totalGastos - totalPagosPersonal;
        
        // Preparar detalles formateados para JSON
        const detalleGastos = gastos ? gastos.map(g => ({
            id: g.id,
            monto: g.monto,
            descripcion: g.descripcion,
            asignado_a: g.asignado_a,
            hora: new Date(g.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        })) : [];

        const detallePagosPersonal = pagosPersonal ? pagosPersonal.map(p => ({
            id: p.id,
            empleado: p.nombre_empleado,
            puesto: p.puesto,
            turno: p.turno,
            pago_jornada: p.pago_jornada,
            pago_almuerzo: p.pago_almuerzo,
            total: p.total_pago
        })) : [];
        
        // Consolidar POS + Reparto en columnas existentes (igual que ejecutarCierreAutomatico)
        const efectivoConsolidado = ventasEfectivo + repartoEfectivo;
        const transbankConsolidado = ventasTransbank + repartoTarjetas;
        const transferenciaConsolidada = ventasTransferencia + repartoTransferencias;

        // Insertar cierre recuperado
        const { error: errorInsert } = await window.supabaseClient
            .from('cierres_diarios')
            .insert({
                fecha: fecha,
                total_ventas: totalVentasConsolidado,
                ventas_efectivo: efectivoConsolidado,
                ventas_transferencia: transferenciaConsolidada,
                ventas_transbank: transbankConsolidado,
                total_gastos: totalGastos,
                detalle_gastos_json: {
                    gastos_operacionales: detalleGastos,
                    pagos_personal: detallePagosPersonal,
                    total_pagos_personal: totalPagosPersonal,
                    desglose_ventas: {
                        pos: {
                            efectivo: ventasEfectivo,
                            transbank: ventasTransbank,
                            transferencia: ventasTransferencia,
                            total: totalVentas
                        },
                        reparto: {
                            efectivo: repartoEfectivo,
                            tarjetas: repartoTarjetas,
                            transferencias: repartoTransferencias,
                            total: repartoTotal,
                            cantidad_pedidos: cantidadPedidosReparto
                        }
                    }
                },
                efectivo_esperado: efectivoEsperado,
                efectivo_real: null,
                diferencia: null,
                cerrado_por: 'Sistema de Recuperación',
                cerrado_at: new Date().toISOString(),
                notas: `🔄 Cierre recuperado automáticamente - Requiere revisión

📅 Fecha original: ${fecha}
🕐 Recuperado: ${new Date().toLocaleString('es-CL')}

📊 Datos recuperados:
• Ventas Local: $${formatoMoneda(totalVentas)} (${ventas ? ventas.length : 0} ventas)
• Reparto: $${formatoMoneda(repartoTotal)} (${cantidadPedidosReparto} pedidos)
  - Efectivo: $${formatoMoneda(repartoEfectivo)}
  - Tarjetas: $${formatoMoneda(repartoTarjetas)}
  - Transferencias: $${formatoMoneda(repartoTransferencias)}
• TOTAL CONSOLIDADO: $${formatoMoneda(totalVentasConsolidado)}
• Gastos: $${formatoMoneda(totalGastos)} (${detalleGastos.length} registros)
• Pagos Personal: $${formatoMoneda(totalPagosPersonal)} (${detallePagosPersonal.length} empleados)
• Efectivo Esperado: $${formatoMoneda(efectivoEsperado)}

⚠️ IMPORTANTE: Este cierre fue creado automáticamente porque no existía registro.
Verifica que los datos sean correctos y completa el arqueo de efectivo real.`,
                cierre_automatico: true
            });
        
        if (errorInsert) throw errorInsert;
        
        return true;
        
    } catch (error) {
        throw error;
    }
}

/**
 * NUEVO: Recuperación manual de cierres (con UI mejorada)
 * Llamada desde el botón en el modal de historial
 */
async function recuperarCierresManuales() {
    try {
        // Validar conexión
        if (!window.supabaseClient) {
            mostrarNotificacion('Error: No hay conexión a la base de datos', 'error', 5000);
            return;
        }
        
        // Notificación de inicio
        mostrarNotificacion('🔍 Escaneando últimos 7 días en busca de cierres perdidos...', 'info', 3000);
        
        console.log('🔍 Recuperación manual iniciada por usuario');
        
        // Revisar últimos 7 días
        const hoy = new Date();
        const hace7Dias = new Date();
        hace7Dias.setDate(hoy.getDate() - 7);
        
        // Obtener todos los cierres de los últimos 7 días
        const { data: cierresExistentes, error: errorCierres } = await window.supabaseClient
            .from('cierres_diarios')
            .select('fecha')
            .gte('fecha', hace7Dias.toISOString().split('T')[0])
            .lt('fecha', hoy.toISOString().split('T')[0]);
        
        if (errorCierres) {
            console.error('❌ Error al consultar cierres:', errorCierres);
            mostrarNotificacion('Error al verificar cierres: ' + errorCierres.message, 'error', 6000);
            return;
        }
        
        const fechasConCierre = new Set(cierresExistentes?.map(c => c.fecha) || []);
        
        // Detectar días sin cierre
        const diasSinCierre = [];
        for (let i = 1; i <= 7; i++) {
            const fecha = new Date();
            fecha.setDate(hoy.getDate() - i);
            const fechaStr = fecha.toISOString().split('T')[0];
            
            if (!fechasConCierre.has(fechaStr)) {
                diasSinCierre.push(fechaStr);
            }
        }
        
        // Si no hay cierres perdidos
        if (diasSinCierre.length === 0) {
            console.log('✅ No se encontraron cierres perdidos');
            mostrarNotificacion('✅ No se encontraron cierres perdidos en los últimos 7 días', 'success', 5000);
            return;
        }
        
        console.warn(`⚠️ Se encontraron ${diasSinCierre.length} día(s) sin cierre:`, diasSinCierre);
        
        // Notificación de progreso
        mostrarNotificacion(`📦 Recuperando ${diasSinCierre.length} cierre(s)... Por favor espera.`, 'info', 4000);
        
        let recuperados = 0;
        let fallidos = 0;
        
        // Crear cierres para días perdidos
        for (const fechaPerdida of diasSinCierre) {
            try {
                await crearCierreRecuperado(fechaPerdida);
                console.log(`✅ Cierre recuperado para ${fechaPerdida}`);
                recuperados++;
            } catch (errorRecuperacion) {
                console.error(`❌ No se pudo recuperar cierre de ${fechaPerdida}:`, errorRecuperacion);
                fallidos++;
            }
        }
        
        // Notificación de resultados
        if (recuperados > 0) {
            mostrarNotificacion(
                `✅ Se recuperaron ${recuperados} cierre(s) exitosamente. ${fallidos > 0 ? `(${fallidos} fallaron)` : ''}\n\nRevisa el historial para completar los arqueos pendientes.`,
                recuperados > 0 && fallidos === 0 ? 'success' : 'warning',
                8000
            );
            
            // Recargar historial si está abierto
            if (document.getElementById('modalHistorialCaja').style.display === 'flex') {
                console.log('🔄 Recargando historial...');
                cargarHistorialCaja();
            }
        } else {
            mostrarNotificacion(
                `❌ No se pudo recuperar ningún cierre. Revisa la consola para más detalles.`,
                'error',
                6000
            );
        }
        
    } catch (error) {
        console.error('❌ Error en recuperación manual de cierres:', error);
        mostrarNotificacion('Error inesperado: ' + error.message, 'error', 6000);
    }
}

/**
 * Verificar si hay cierres automáticos pendientes de revisión
 */
async function verificarCierresAutomaticosPendientes() {
    try {
        // Solo para encargado
        if (currentUserRole !== 'encargado') {
            return;
        }
        
        if (!window.supabaseClient) {
            return;
        }
        
        // Buscar cierres automáticos con efectivo_real null (últimos 7 días)
        const hace7Dias = new Date();
        hace7Dias.setDate(hace7Dias.getDate() - 7);
        
        const { data: cierresPendientes, error } = await window.supabaseClient
            .from('cierres_diarios')
            .select('*')
            .eq('cierre_automatico', true)
            .is('efectivo_real', null)
            .gte('fecha', hace7Dias.toISOString().split('T')[0])
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        
        if (cierresPendientes && cierresPendientes.length > 0) {
            // Mostrar alerta de cierres pendientes
            mostrarAlertaCierrePendiente(cierresPendientes);
        }
        
    } catch (error) {
        manejarError(error, {
            contexto: 'verificarCierresAutomaticosPendientes',
            mensajeUsuario: 'Error verificando cierres pendientes',
            mostrarNotificacion: false // Función del sistema, silenciosa
        });
    }
}

/**
 * Mostrar alerta de cierre automático pendiente
 */
function mostrarAlertaCierrePendiente(cierresPendientes) {
    const alerta = document.getElementById('alertaCierreAutomatico');
    const mensaje = document.getElementById('mensajeAlertaCierre');
    
    if (cierresPendientes.length === 1) {
        const cierre = cierresPendientes[0];
        const fecha = new Date(cierre.fecha);
        const fechaTexto = fecha.toLocaleDateString('es-CL', { 
            weekday: 'long', 
            day: '2-digit', 
            month: 'long' 
        });
        mensaje.textContent = `El día ${fechaTexto} fue cerrado automáticamente. Se requiere completar el arqueo con el efectivo real.`;
    } else {
        mensaje.textContent = `Hay ${cierresPendientes.length} cierres automáticos pendientes de revisión. Se requiere completar los arqueos.`;
    }
    
    alerta.style.display = 'block';
    
    // Guardar en variable global para acceso rápido
    window.cierresPendientesGlobal = cierresPendientes;
}

/**
 * Cerrar alerta de cierre automático
 */
function cerrarAlertaCierre() {
    document.getElementById('alertaCierreAutomatico').style.display = 'none';
}

/**
 * Abrir historial directo al cierre pendiente
 */
function abrirHistorialCierrePendiente() {
    abrirHistorialCaja();
    cerrarAlertaCierre();
    
    // Cargar últimos 7 días para mostrar el cierre pendiente
    setTimeout(() => {
        document.getElementById('filtroRapidoHistorial').value = '7';
        aplicarFiltroRapido();
    }, 500);
}

/**
 * Toggle para habilitar/deshabilitar cierre automático
 */
function toggleCierreAutomatico() {
    const toggle = document.getElementById('toggleCierreAutomatico');
    const habilitado = toggle.checked;
    
    localStorage.setItem('cierre_automatico_habilitado', habilitado.toString());
    
    if (habilitado) {
        mostrarNotificacion('Cierre automático activado (12:00 AM)', 'success');
        console.log('✅ Cierre automático habilitado');
    } else {
        mostrarNotificacion('Cierre automático desactivado', 'info');
        console.log('⏸️ Cierre automático deshabilitado');
    }
}

// ===================================
// MÓDULO: HISTORIAL DE CAJA
// ===================================

let chartHistorialVentas = null;
let datosHistorialCaja = [];

/**
 * Abrir modal de historial de caja
 */
function abrirHistorialCaja() {
    const modal = document.getElementById('modalHistorialCaja');
    modal.style.display = 'flex';
    
    // Agregar clase show con un pequeño delay para la animación
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    // Establecer fechas por defecto (últimos 7 días) solo si están vacías
    const fechaDesdeInput = document.getElementById('fechaDesde');
    const fechaHastaInput = document.getElementById('fechaHasta');
    
    if (!fechaDesdeInput.value || !fechaHastaInput.value) {
        const hoy = new Date();
        const hace7Dias = new Date();
        hace7Dias.setDate(hoy.getDate() - 7);
        
        fechaHastaInput.value = hoy.toISOString().split('T')[0];
        fechaDesdeInput.value = hace7Dias.toISOString().split('T')[0];
    }
    
    // Establecer select al valor por defecto
    const filtroSelect = document.getElementById('filtroRapidoHistorial');
    if (filtroSelect && !filtroSelect.value) {
        filtroSelect.value = '7'; // Últimos 7 días por defecto
    }
    
    // Cargar historial con pequeño delay para asegurar que el canvas esté renderizado
    setTimeout(() => {
        aplicarFiltroRapido();
    }, 100);
}

/**
 * Cerrar modal de historial
 */
function cerrarHistorialCaja() {
    const modal = document.getElementById('modalHistorialCaja');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 200);
}

/**
 * Aplicar filtro rápido mejorado
 */
function aplicarFiltroRapido() {
    const filtro = document.getElementById('filtroRapidoHistorial').value;
    const contenedorPersonalizado = document.getElementById('filtroPersonalizadoContainer');
    
    if (filtro === 'custom') {
        contenedorPersonalizado.style.display = 'block';
        // Auto-focus en el primer campo
        setTimeout(() => document.getElementById('fechaDesde')?.focus(), 100);
        return;
    } else {
        contenedorPersonalizado.style.display = 'none';
    }
    
    // Calcular fechas según filtro
    const hoy = new Date();
    let desde = new Date();
    
    if (filtro === 'thisMonth') {
        // Este mes: desde el día 1 hasta hoy
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else if (filtro === '0') {
        // Solo hoy
        desde = new Date(hoy);
    } else {
        // Días hacia atrás
        desde.setDate(hoy.getDate() - parseInt(filtro));
    }
    
    document.getElementById('fechaHasta').value = hoy.toISOString().split('T')[0];
    document.getElementById('fechaDesde').value = desde.toISOString().split('T')[0];
    
    // Cargar datos automáticamente
    cargarHistorialCaja();
}

/**
 * Cargar historial de cierres desde Supabase
 */
async function cargarHistorialCaja() {
    try {
        if (!window.supabaseClient) {
            mostrarNotificacion('Error: Supabase no está configurado', 'error');
            return;
        }
        
        const fechaDesde = document.getElementById('fechaDesde').value;
        const fechaHasta = document.getElementById('fechaHasta').value;
        
        if (!fechaDesde || !fechaHasta) {
            mostrarNotificacion('Selecciona un rango de fechas', 'warning');
            return;
        }
        
        // Ajustar fechas para incluir todo el día
        const desde = new Date(fechaDesde);
        desde.setHours(0, 0, 0, 0);
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        
        const { data, error } = await window.supabaseClient
            .from('cierres_diarios')
            .select('*')
            .gte('fecha', desde.toISOString().split('T')[0])
            .lte('fecha', hasta.toISOString().split('T')[0])
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        
        datosHistorialCaja = data || [];
        
        // Renderizar KPIs, gráfico y tabla
        renderKPIsHistorial();
        renderChartHistorial();
        renderTablaHistorialCaja();
        
        console.log(`✅ ${datosHistorialCaja.length} cierres cargados`);
        
    } catch (error) {
        manejarError(error, {
            contexto: 'cargarHistorialCaja',
            mensajeUsuario: 'Error al cargar historial de caja'
        });
    }
}

/**
 * Calcular y renderizar KPIs del historial
 */
function renderKPIsHistorial() {
    const container = document.getElementById('kpisHistorialCaja');
    
    if (!container) {
        console.warn('⚠️ Contenedor de KPIs no encontrado');
        return;
    }
    
    if (datosHistorialCaja.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: hsl(var(--muted-foreground));">
                <p>No hay datos para calcular estadísticas</p>
            </div>
        `;
        return;
    }
    
    // Calcular KPIs
    const totalVentas = datosHistorialCaja.reduce((sum, d) => sum + (d.total_ventas || 0), 0);
    const totalGastos = datosHistorialCaja.reduce((sum, d) => sum + (d.total_gastos || 0), 0);
    const promedioDiario = totalVentas / datosHistorialCaja.length;
    
    // Mejor y peor día
    let mejorDia = datosHistorialCaja[0];
    let peorDia = datosHistorialCaja[0];
    
    datosHistorialCaja.forEach(dia => {
        if ((dia.total_ventas || 0) > (mejorDia.total_ventas || 0)) mejorDia = dia;
        if ((dia.total_ventas || 0) < (peorDia.total_ventas || 0)) peorDia = dia;
    });
    
    // Calcular tendencia (comparar primera mitad vs segunda mitad)
    let tendencia = 0;
    let tendenciaTexto = 'Sin cambios';
    let tendenciaIcon = '➡️';
    let tendenciaColor = 'hsl(var(--muted-foreground))';
    
    if (datosHistorialCaja.length >= 4) {
        const mitad = Math.floor(datosHistorialCaja.length / 2);
        const segundaMitad = datosHistorialCaja.slice(0, mitad);
        const primeraMitad = datosHistorialCaja.slice(mitad);
        
        const promedioReciente = segundaMitad.reduce((sum, d) => sum + (d.total_ventas || 0), 0) / segundaMitad.length;
        const promedioAnterior = primeraMitad.reduce((sum, d) => sum + (d.total_ventas || 0), 0) / primeraMitad.length;
        
        if (promedioAnterior > 0) {
            tendencia = ((promedioReciente - promedioAnterior) / promedioAnterior) * 100;
            
            if (tendencia > 5) {
                tendenciaTexto = `+${tendencia.toFixed(1)}% vs período anterior`;
                tendenciaIcon = '📈';
                tendenciaColor = 'hsl(142 76% 36%)';
            } else if (tendencia < -5) {
                tendenciaTexto = `${tendencia.toFixed(1)}% vs período anterior`;
                tendenciaIcon = '📉';
                tendenciaColor = 'hsl(0 84% 60%)';
            } else {
                tendenciaTexto = 'Estable';
                tendenciaIcon = '➡️';
            }
        }
    }
    
    // Días cuadrados vs con diferencia
    const diasCuadrados = datosHistorialCaja.filter(d => (d.diferencia || 0) === 0).length;
    const diasConDiferencia = datosHistorialCaja.length - diasCuadrados;
    const porcentajeCuadrados = (diasCuadrados / datosHistorialCaja.length) * 100;
    
    // Formatear fechas
    const formatearFecha = (fechaStr) => {
        const fecha = new Date(fechaStr);
        return fecha.toLocaleDateString('es-CL', { 
            weekday: 'short', 
            day: '2-digit', 
            month: 'short' 
        });
    };
    
    // HTML de KPIs
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
            
            <!-- Total Vendido -->
            <div style="background: linear-gradient(135deg, hsl(142 76% 36% / 0.1), hsl(142 76% 36% / 0.05)); border: 2px solid hsl(142 76% 36% / 0.3); border-radius: 12px; padding: 20px; position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.1;">💰</div>
                <p style="margin: 0; font-size: 13px; color: hsl(var(--muted-foreground)); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Vendido</p>
                <p style="margin: 8px 0 4px; font-size: 32px; font-weight: 900; color: hsl(142 76% 36%); line-height: 1;">$${formatoMoneda(totalVentas)}</p>
                <p style="margin: 0; font-size: 12px; color: hsl(var(--muted-foreground));">
                    en ${datosHistorialCaja.length} día${datosHistorialCaja.length !== 1 ? 's' : ''}
                </p>
            </div>
            
            <!-- Promedio Diario -->
            <div style="background: linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05)); border: 2px solid hsl(var(--primary) / 0.3); border-radius: 12px; padding: 20px; position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.1;">📊</div>
                <p style="margin: 0; font-size: 13px; color: hsl(var(--muted-foreground)); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Promedio Diario</p>
                <p style="margin: 8px 0 4px; font-size: 32px; font-weight: 900; color: hsl(var(--primary)); line-height: 1;">$${formatoMoneda(promedioDiario)}</p>
                <p style="margin: 0; font-size: 12px; color: hsl(var(--muted-foreground));">
                    Gastos: $${formatoMoneda(totalGastos / datosHistorialCaja.length)}
                </p>
            </div>
            
            <!-- Mejor Día -->
            <div style="background: linear-gradient(135deg, hsl(38 92% 50% / 0.15), hsl(38 92% 50% / 0.05)); border: 2px solid hsl(38 92% 50% / 0.3); border-radius: 12px; padding: 20px; position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.1;">🏆</div>
                <p style="margin: 0; font-size: 13px; color: hsl(var(--muted-foreground)); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Mejor Día</p>
                <p style="margin: 8px 0 4px; font-size: 32px; font-weight: 900; color: hsl(38 92% 50%); line-height: 1;">$${formatoMoneda(mejorDia.total_ventas || 0)}</p>
                <p style="margin: 0; font-size: 12px; color: hsl(var(--muted-foreground));">
                    ${formatearFecha(mejorDia.fecha)}
                </p>
            </div>
            
            <!-- Tendencia -->
            <div style="background: linear-gradient(135deg, ${tendencia >= 0 ? 'hsl(142 76% 36% / 0.1)' : 'hsl(0 84% 60% / 0.1)'}, transparent); border: 2px solid ${tendencia >= 0 ? 'hsl(142 76% 36% / 0.3)' : 'hsl(0 84% 60% / 0.3)'}; border-radius: 12px; padding: 20px; position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; font-size: 60px; opacity: 0.1;">${tendenciaIcon}</div>
                <p style="margin: 0; font-size: 13px; color: hsl(var(--muted-foreground)); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Tendencia</p>
                <p style="margin: 8px 0 4px; font-size: 24px; font-weight: 900; color: ${tendenciaColor}; line-height: 1;">${tendenciaIcon} ${tendenciaTexto}</p>
                <p style="margin: 0; font-size: 12px; color: hsl(var(--muted-foreground));">
                    ${diasCuadrados} día${diasCuadrados !== 1 ? 's' : ''} cuadrado${diasCuadrados !== 1 ? 's' : ''} (${porcentajeCuadrados.toFixed(0)}%)
                </p>
            </div>
            
        </div>
    `;
}

/**
 * Búsqueda inteligente en historial
 */
function buscarEnHistorial() {
    const query = document.getElementById('busquedaInteligente').value.toLowerCase().trim();
    
    if (!query) {
        // Si está vacío, mostrar todos
        renderTablaHistorialCaja();
        return;
    }
    
    const hoy = new Date();
    let filtrados = [...datosHistorialCaja];
    
    // Búsqueda por día de semana
    const diasSemana = {
        'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
        'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6, 'domingo': 0
    };
    
    if (diasSemana.hasOwnProperty(query)) {
        const diaNum = diasSemana[query];
        filtrados = datosHistorialCaja.filter(cierre => {
            const fecha = new Date(cierre.fecha);
            return fecha.getDay() === diaNum;
        });
    }
    // Búsqueda por "semana pasada"
    else if (query.includes('semana pasada') || query.includes('semana anterior')) {
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay() - 6); // Lunes de semana pasada
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6); // Domingo de semana pasada
        
        filtrados = datosHistorialCaja.filter(cierre => {
            const fecha = new Date(cierre.fecha);
            return fecha >= inicioSemana && fecha <= finSemana;
        });
    }
    // Búsqueda por "esta semana"
    else if (query.includes('esta semana') || query.includes('semana actual')) {
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1); // Lunes de esta semana
        
        filtrados = datosHistorialCaja.filter(cierre => {
            const fecha = new Date(cierre.fecha);
            return fecha >= inicioSemana;
        });
    }
    // Búsqueda por número (día del mes)
    else if (/^\d{1,2}$/.test(query)) {
        const dia = parseInt(query);
        filtrados = datosHistorialCaja.filter(cierre => {
            const fecha = new Date(cierre.fecha);
            return fecha.getDate() === dia;
        });
    }
    // Búsqueda por estado
    else if (query.includes('cuadrado') || query.includes('cuadrados')) {
        filtrados = datosHistorialCaja.filter(cierre => (cierre.diferencia || 0) === 0);
    }
    else if (query.includes('sobrante') || query.includes('sobrantes')) {
        filtrados = datosHistorialCaja.filter(cierre => (cierre.diferencia || 0) > 0);
    }
    else if (query.includes('faltante') || query.includes('faltantes')) {
        filtrados = datosHistorialCaja.filter(cierre => (cierre.diferencia || 0) < 0);
    }
    else if (query.includes('pendiente') || query.includes('pendientes')) {
        filtrados = datosHistorialCaja.filter(cierre => 
            cierre.cierre_automatico === true && 
            (cierre.efectivo_real === null || cierre.efectivo_real === undefined)
        );
    }
    // Búsqueda por texto en fecha
    else {
        filtrados = datosHistorialCaja.filter(cierre => {
            const fecha = new Date(cierre.fecha);
            const fechaStr = fecha.toLocaleDateString('es-CL', { 
                weekday: 'long', 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
            }).toLowerCase();
            return fechaStr.includes(query);
        });
    }
    
    // Actualizar resultados
    const badge = document.getElementById('resultadosBusqueda');
    if (badge) {
        if (filtrados.length === datosHistorialCaja.length) {
            badge.style.display = 'none';
        } else {
            badge.style.display = 'inline-block';
            badge.textContent = `${filtrados.length} resultado${filtrados.length !== 1 ? 's' : ''}`;
        }
    }
    
    // Renderizar tabla filtrada
    const temp = datosHistorialCaja;
    datosHistorialCaja = filtrados;
    renderTablaHistorialCaja();
    datosHistorialCaja = temp;
    
    // Mostrar mensaje si no hay resultados
    if (filtrados.length === 0) {
        const container = document.getElementById('tablaHistorialCaja');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: hsl(var(--muted-foreground));">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="opacity: 0.3; margin: 0 auto 16px;">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p style="font-size: 16px; font-weight: 600; margin: 0 0 8px;">No se encontraron resultados</p>
                <p style="margin: 0;">Intenta con: "lunes", "semana pasada", "15", "cuadrados"</p>
            </div>
        `;
    }
}

/**
 * Renderizar gráfico de historial (con validación mejorada)
 */
function renderChartHistorial() {
    const canvas = document.getElementById('chartHistorialVentas');
    
    // Validación robusta del canvas
    if (!canvas) {
        console.warn('⚠️ Canvas no encontrado en el DOM');
        return;
    }
    
    // Verificar Chart.js
    if (typeof Chart === 'undefined') {
        console.warn('⚠️ Chart.js no disponible');
        const parent = canvas.parentElement;
        if (parent) {
            parent.innerHTML = '<p style="text-align: center; color: hsl(var(--muted-foreground)); padding: 40px;">📊 Gráfico no disponible</p>';
        }
        return;
    }
    
    // Obtener contexto 2D de forma segura
    let ctx;
    try {
        ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('❌ No se pudo obtener el contexto 2D del canvas');
            return;
        }
    } catch (error) {
        console.error('❌ Error al obtener contexto del canvas:', error);
        return;
    }
    
    // Destruir gráfico anterior si existe
    if (chartHistorialVentas) {
        chartHistorialVentas.destroy();
    }
    
    if (datosHistorialCaja.length === 0) {
        const parent = canvas.parentElement;
        if (parent) {
            parent.innerHTML = '<p style="text-align: center; color: hsl(var(--muted-foreground)); padding: 40px;">📭 No hay datos para mostrar en el período seleccionado</p>';
        }
        return;
    }
    
    // Preparar datos (invertir para mostrar cronológicamente)
    const datosOrdenados = [...datosHistorialCaja].reverse();
    const labels = datosOrdenados.map(d => {
        const fecha = new Date(d.fecha);
        return fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
    });
    const ventas = datosOrdenados.map(d => d.total_ventas || 0);
    const gastos = datosOrdenados.map(d => d.total_gastos || 0);
    
    chartHistorialVentas = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ventas Totales',
                    data: ventas,
                    borderColor: 'hsl(142 76% 36%)',
                    backgroundColor: 'hsl(142 76% 36% / 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: 'white',
                    pointBorderWidth: 2
                },
                {
                    label: 'Gastos',
                    data: gastos,
                    borderColor: 'hsl(0 84% 60%)',
                    backgroundColor: 'hsl(0 84% 60% / 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'white',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 13,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += '$' + formatoMoneda(context.parsed.y);
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + formatoMoneda(value);
                        },
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: 'hsl(var(--border) / 0.3)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renderizar tabla de historial de caja
 */
function renderTablaHistorialCaja() {
    const container = document.getElementById('tablaHistorialCaja');
    
    if (datosHistorialCaja.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: hsl(var(--muted-foreground));">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="opacity: 0.3; margin: 0 auto 16px; display:block;">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2"/>
                </svg>
                <p>No hay cierres registrados en este período</p>
            </div>
        `;
        return;
    }
    
    let html = `<div style="display: flex; flex-direction: column; gap: 12px;">`;

    // Helper: extraer datos consolidados del JSON
    const obtenerDatosConsolidados = (cierre) => {
        const desglose = cierre.detalle_gastos_json?.desglose_ventas;
        return {
            reparto_efectivo: cierre.reparto_efectivo || desglose?.reparto?.efectivo || 0,
            reparto_tarjetas: cierre.reparto_tarjetas || desglose?.reparto?.tarjetas || 0,
            reparto_transferencias: cierre.reparto_transferencias || desglose?.reparto?.transferencias || 0,
            pagos_personal: cierre.pagos_personal || cierre.detalle_gastos_json?.total_pagos_personal || 0
        };
    };

    datosHistorialCaja.forEach((cierre, index) => {
        const datos = obtenerDatosConsolidados(cierre);

        // Fecha formateada
        const fecha = new Date(cierre.fecha + 'T12:00:00');
        const fechaCorta = fecha.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

        const esAutomatico = cierre.cierre_automatico === true;
        const esPendiente = cierre.efectivo_real === null || cierre.efectivo_real === undefined;
        const diferencia = cierre.diferencia || 0;

        // Estado
        let estadoBg, estadoColor, estadoTexto, estadoIcon;
        if (esAutomatico && esPendiente) {
            estadoBg = 'hsl(38 92% 50% / 0.12)';
            estadoColor = 'hsl(38 92% 40%)';
            estadoTexto = 'Pendiente arqueo';
            estadoIcon = '⏳';
        } else if (diferencia === 0) {
            estadoBg = 'hsl(142 76% 36% / 0.1)';
            estadoColor = 'hsl(142 76% 36%)';
            estadoTexto = 'Cuadrado';
            estadoIcon = '✅';
        } else if (diferencia > 0) {
            estadoBg = 'hsl(199 89% 48% / 0.1)';
            estadoColor = 'hsl(199 89% 40%)';
            estadoTexto = `Sobrante +$${formatoMoneda(diferencia)}`;
            estadoIcon = '📈';
        } else {
            estadoBg = 'hsl(0 84% 60% / 0.1)';
            estadoColor = 'hsl(0 84% 50%)';
            estadoTexto = `Faltante -$${formatoMoneda(Math.abs(diferencia))}`;
            estadoIcon = '⚠️';
        }

        // Borde izquierdo según estado
        const borderColor = esAutomatico && esPendiente ? 'hsl(38 92% 50%)' :
                            diferencia === 0 ? 'hsl(142 76% 36%)' :
                            diferencia > 0 ? 'hsl(199 89% 48%)' : 'hsl(0 84% 60%)';

        html += `
        <!-- TARJETA DÍA ${index} -->
        <div style="background: white; border-radius: 12px; border: 1px solid hsl(var(--border)); border-left: 5px solid ${borderColor}; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
            
            <!-- CABECERA DE LA TARJETA (siempre visible) -->
            <div style="display: flex; align-items: center; gap: 16px; padding: 16px 20px; cursor: pointer;"
                 onclick="verDetallesCierre(${index})">
                
                <!-- Fecha + tipo -->
                <div style="flex: 0 0 auto; min-width: 130px;">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                        ${esAutomatico ? `<span title="Cierre automático" style="font-size:16px;">🤖</span>` : `<span style="font-size:16px;">📋</span>`}
                        <span style="font-weight: 700; font-size: 14px;">${fechaCorta}</span>
                    </div>
                    <span style="font-size: 11px; color: hsl(var(--muted-foreground));">
                        ${cierre.cerrado_at ? new Date(cierre.cerrado_at).toLocaleTimeString('es-CL', {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                        · ${esAutomatico ? 'Automático' : (cierre.cerrado_por || 'Manual')}
                    </span>
                </div>

                <!-- Total ventas (protagonista) -->
                <div style="flex: 1; text-align: center;">
                    <div style="font-size: 11px; color: hsl(var(--muted-foreground)); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Ventas</div>
                    <div style="font-size: 26px; font-weight: 900; color: hsl(142 76% 36%); line-height: 1.2;">
                        $${formatoMoneda(cierre.total_ventas || 0)}
                    </div>
                </div>

                <!-- Gastos -->
                <div style="flex: 0 0 auto; text-align: right; min-width: 90px; display: none;" class="col-gastos-historial">
                    <div style="font-size: 11px; color: hsl(var(--muted-foreground)); font-weight: 600; text-transform: uppercase;">Gastos</div>
                    <div style="font-size: 15px; font-weight: 700; color: hsl(0 84% 60%);">-$${formatoMoneda(cierre.total_gastos || 0)}</div>
                </div>

                <!-- Estado badge -->
                <div style="flex: 0 0 auto;">
                    <span style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; background: ${estadoBg}; color: ${estadoColor}; border-radius: 20px; font-size: 13px; font-weight: 700; white-space: nowrap;">
                        ${estadoIcon} ${estadoTexto}
                    </span>
                </div>

                <!-- Chevron -->
                <div id="chevron-${index}" style="flex: 0 0 auto; color: hsl(var(--muted-foreground)); transition: transform 0.2s;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
            </div>

            <!-- DETALLE EXPANDIBLE -->
            <div id="detalles-${index}" style="display: none; border-top: 1px solid hsl(var(--border)); padding: 20px; background: hsl(var(--muted) / 0.2);">
                
                <!-- FILA 1: Ventas por método -->
                <div style="margin-bottom: 16px;">
                    <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: 0.5px;">💰 Ingresos del día</p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
                        <div style="background: white; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid hsl(var(--border));">
                            <div style="font-size: 11px; color: hsl(var(--muted-foreground)); margin-bottom: 4px;">💵 Efectivo</div>
                            <div style="font-size: 16px; font-weight: 700;">$${formatoMoneda((cierre.ventas_efectivo || 0) + datos.reparto_efectivo)}</div>
                            ${datos.reparto_efectivo > 0 ? `<div style="font-size: 10px; color: hsl(var(--muted-foreground)); margin-top: 2px;">Local $${formatoMoneda(cierre.ventas_efectivo||0)} + Rep. $${formatoMoneda(datos.reparto_efectivo)}</div>` : ''}
                        </div>
                        <div style="background: white; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid hsl(var(--border));">
                            <div style="font-size: 11px; color: hsl(var(--muted-foreground)); margin-bottom: 4px;">💳 Tarjeta</div>
                            <div style="font-size: 16px; font-weight: 700;">$${formatoMoneda((cierre.ventas_transbank || 0) + datos.reparto_tarjetas)}</div>
                            ${datos.reparto_tarjetas > 0 ? `<div style="font-size: 10px; color: hsl(var(--muted-foreground)); margin-top: 2px;">Local $${formatoMoneda(cierre.ventas_transbank||0)} + Rep. $${formatoMoneda(datos.reparto_tarjetas)}</div>` : ''}
                        </div>
                        <div style="background: white; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid hsl(var(--border));">
                            <div style="font-size: 11px; color: hsl(var(--muted-foreground)); margin-bottom: 4px;">🏦 Transferencia</div>
                            <div style="font-size: 16px; font-weight: 700;">$${formatoMoneda((cierre.ventas_transferencia || 0) + datos.reparto_transferencias)}</div>
                            ${datos.reparto_transferencias > 0 ? `<div style="font-size: 10px; color: hsl(var(--muted-foreground)); margin-top: 2px;">Local $${formatoMoneda(cierre.ventas_transferencia||0)} + Rep. $${formatoMoneda(datos.reparto_transferencias)}</div>` : ''}
                        </div>
                        <div style="background: hsl(142 76% 36% / 0.08); border-radius: 8px; padding: 12px; text-align: center; border: 2px solid hsl(142 76% 36% / 0.3);">
                            <div style="font-size: 11px; color: hsl(142 76% 36%); font-weight: 700; margin-bottom: 4px;">📊 TOTAL</div>
                            <div style="font-size: 18px; font-weight: 900; color: hsl(142 76% 36%);">$${formatoMoneda(cierre.total_ventas || 0)}</div>
                        </div>
                    </div>
                </div>

                <!-- FILA 2: Gastos + Arqueo en línea -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: ${(esAutomatico && esPendiente) ? '16px' : '0'};">
                    
                    <!-- Gastos -->
                    <div style="background: white; border-radius: 8px; padding: 14px; border: 1px solid hsl(var(--border));">
                        <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: 0.5px;">💸 Salidas</p>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                            <span>Gastos operac.</span>
                            <strong style="color: hsl(0 84% 55%);">-$${formatoMoneda(cierre.total_gastos || 0)}</strong>
                        </div>
                        ${datos.pagos_personal > 0 ? `
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                            <span>Pagos personal</span>
                            <strong style="color: hsl(0 84% 55%);">-$${formatoMoneda(datos.pagos_personal)}</strong>
                        </div>` : ''}
                        <div style="display: flex; justify-content: space-between; font-size: 13px; padding-top: 8px; border-top: 1px solid hsl(var(--border)); margin-top: 4px;">
                            <strong>Total salidas</strong>
                            <strong style="color: hsl(0 84% 55%);">-$${formatoMoneda((cierre.total_gastos || 0) + datos.pagos_personal)}</strong>
                        </div>
                    </div>
                    
                    <!-- Arqueo -->
                    <div style="background: white; border-radius: 8px; padding: 14px; border: 1px solid hsl(var(--border));">
                        <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: 0.5px;">🔍 Arqueo de caja</p>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                            <span>Esperado</span>
                            <strong>$${formatoMoneda(cierre.efectivo_esperado || 0)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                            <span>Real contado</span>
                            <strong>${esPendiente ? `<span style="color:hsl(38 92% 50%);">Sin registrar</span>` : `$${formatoMoneda(cierre.efectivo_real || 0)}`}</strong>
                        </div>
                        <div style="padding: 8px 12px; background: ${estadoBg}; border-radius: 6px; text-align: center;">
                            <span style="font-size: 13px; font-weight: 700; color: ${estadoColor};">${estadoIcon} ${estadoTexto}</span>
                        </div>
                    </div>
                </div>

                <!-- COMPLETAR ARQUEO (solo si es automático y pendiente) -->
                ${esAutomatico && esPendiente ? `
                <div style="background: linear-gradient(135deg, hsl(38 92% 50% / 0.12), hsl(38 92% 50% / 0.04)); border: 2px solid hsl(38 92% 50%); border-radius: 10px; padding: 18px;">
                    <p style="margin: 0 0 6px; font-size: 14px; font-weight: 700; color: hsl(38 92% 40%);">⏳ Completar arqueo pendiente</p>
                    <p style="margin: 0 0 12px; font-size: 12px; color: hsl(var(--muted-foreground));">💾 Se guarda como borrador automáticamente mientras escribes.</p>
                    <div style="display: flex; gap: 10px; align-items: flex-end;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 5px; font-size: 12px; font-weight: 600;">💵 Efectivo real contado:</label>
                            <input id="efectivoRealArqueo-${index}" type="number" placeholder="Ej: 950000"
                                   style="width: 100%; padding: 10px 12px; border: 2px solid hsl(var(--border)); border-radius: 8px; font-size: 14px; box-sizing: border-box;"
                                   oninput="guardarBorradorArqueo('${cierre.fecha}', ${index}, ${cierre.efectivo_esperado || 0})">
                        </div>
                        <button onclick="completarArqueoPendiente('${cierre.fecha}', ${index})"
                                style="padding: 10px 20px; background: hsl(38 92% 50%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px; white-space: nowrap;">
                            ✓ Confirmar
                        </button>
                    </div>
                    <div id="previaDiferencia-${index}" style="display:none; margin-top: 10px; padding: 8px 12px; border-radius: 6px; border-left: 4px solid hsl(var(--primary));">
                        <span id="diferenciaMonto-${index}" style="font-size: 14px; font-weight: 700;"></span>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

/**
 * Ver/ocultar detalles de un cierre especifico
 */
function verDetallesCierre(index) {
    const detallesDiv = document.getElementById(`detalles-${index}`);
    if (!detallesDiv) return;
    const isVisible = detallesDiv.style.display !== 'none';

    // Colapsar todos los abiertos y resetear chevrons
    document.querySelectorAll('[id^="detalles-"]').forEach(div => {
        div.style.display = 'none';
    });
    document.querySelectorAll('[id^="chevron-"]').forEach(ch => {
        ch.style.transform = 'rotate(0deg)';
    });

    // Toggle del seleccionado
    if (!isVisible) {
        detallesDiv.style.display = 'block';
        const chevron = document.getElementById(`chevron-${index}`);
        if (chevron) chevron.style.transform = 'rotate(180deg)';

        // Recuperar borrador si aplica
        const cierre = datosHistorialCaja[index];
        if (cierre && cierre.cierre_automatico && !cierre.efectivo_real) {
            setTimeout(() => {
                recuperarBorradorArqueo(cierre.fecha, index, cierre.efectivo_esperado || 0);
            }, 100);
        }
    }
}

/**
 * Guardar borrador de arqueo en localStorage y calcular diferencia
 */
function guardarBorradorArqueo(fecha, index, efectivoEsperado) {
    const input = document.getElementById(`efectivoRealArqueo-${index}`);
    const efectivoReal = parseFloat(input.value) || 0;
    
    // Guardar como borrador en localStorage
    if (efectivoReal > 0) {
        const claveBorrador = `borrador_arqueo_${fecha}`;
        localStorage.setItem(claveBorrador, efectivoReal.toString());
        console.log('­ƒÆ¥ Borrador guardado:', { fecha, efectivoReal });
    }
    
    // Calcular y mostrar diferencia
    calcularDiferenciaArqueo(index, efectivoEsperado, efectivoReal);
}

/**
 * Recuperar borrador de arqueo desde localStorage
 */
function recuperarBorradorArqueo(fecha, index, efectivoEsperado) {
    const claveBorrador = `borrador_arqueo_${fecha}`;
    const borradorGuardado = localStorage.getItem(claveBorrador);
    
    if (borradorGuardado) {
        const input = document.getElementById(`efectivoRealArqueo-${index}`);
        if (input) {
            input.value = borradorGuardado;
            // Mostrar diferencia con el valor recuperado
            calcularDiferenciaArqueo(index, efectivoEsperado, parseFloat(borradorGuardado));
            console.log('­ƒôé Borrador recuperado:', { fecha, valor: borradorGuardado });
            
            // Mostrar notificación al usuario
            setTimeout(() => {
                mostrarNotificacion(
                    `­ƒôé Borrador recuperado\n\nSe encontró un valor previo: $${formatoMoneda(parseFloat(borradorGuardado))}\n\nRevísalo y haz clic en "Completar Arqueo" para confirmar.`,
                    'info',
                    6000
                );
            }, 500);
        }
    }
}

/**
 * Limpiar borrador de arqueo de localStorage
 */
function limpiarBorradorArqueo(fecha) {
    const claveBorrador = `borrador_arqueo_${fecha}`;
    localStorage.removeItem(claveBorrador);
    console.log('­ƒùæ´©Å Borrador eliminado:', { fecha });
}

/**
 * Calcular diferencia en tiempo real al ingresar efectivo real
 */
function calcularDiferenciaArqueo(index, efectivoEsperado, efectivoRealParam) {
    // Usar el parámetro si se proporciona, sino leer del input
    const efectivoReal = efectivoRealParam !== undefined ? efectivoRealParam : (parseFloat(document.getElementById(`efectivoRealArqueo-${index}`)?.value) || 0);
    
    if (efectivoReal === 0) {
        document.getElementById(`previaDiferencia-${index}`).style.display = 'none';
        return;
    }
    
    const diferencia = efectivoReal - efectivoEsperado;
    const container = document.getElementById(`previaDiferencia-${index}`);
    const montoElement = document.getElementById(`diferenciaMonto-${index}`);
    
    container.style.display = 'block';
    
    if (diferencia === 0) {
        // Cuadrado (verde)
        container.style.borderLeftColor = 'hsl(142 76% 36%)';
        container.style.background = 'hsl(142 76% 36% / 0.1)';
        montoElement.style.color = 'hsl(142 76% 36%)';
        montoElement.textContent = 'Ô£à ¡Cuadrado! ($0)';
    } else if (diferencia > 0) {
        // Sobrante (azul)
        container.style.borderLeftColor = 'hsl(199 89% 48%)';
        container.style.background = 'hsl(199 89% 48% / 0.1)';
        montoElement.style.color = 'hsl(199 89% 48%)';
        montoElement.textContent = '­ƒôê Sobrante: +$' + formatoMoneda(diferencia);
    } else {
        // Faltante (rojo)
        container.style.borderLeftColor = 'hsl(0 84% 60%)';
        container.style.background = 'hsl(0 84% 60% / 0.1)';
        montoElement.style.color = 'hsl(0 84% 60%)';
        montoElement.textContent = 'ÔÜá´©Å Faltante: -$' + formatoMoneda(Math.abs(diferencia));
    }
}

/**
 * Completar arqueo pendiente de cierre automático
 */
async function completarArqueoPendiente(fecha, index) {
    try {
        const input = document.getElementById(`efectivoRealArqueo-${index}`);
        const efectivoReal = parseFloat(input.value);
        
        // Validaciones
        if (!efectivoReal && efectivoReal !== 0) {
            mostrarNotificacion('ÔÜá´©Å Ingresa el efectivo real contado en caja', 'warning', 4000);
            input.focus();
            return;
        }
        
        if (efectivoReal < 0) {
            mostrarNotificacion('ÔÜá´©Å El efectivo real no puede ser negativo', 'warning', 4000);
            return;
        }
        
        // Obtener cierre actual
        const cierre = datosHistorialCaja[index];
        const efectivoEsperado = cierre.efectivo_esperado || 0;
        const diferencia = efectivoReal - efectivoEsperado;
        
        // Confirmación
        let estadoTexto = '';
        if (diferencia === 0) estadoTexto = 'Ô£à Cuadrado';
        else if (diferencia > 0) estadoTexto = '­ƒôê Sobrante: +$' + formatoMoneda(diferencia);
        else estadoTexto = 'ÔÜá´©Å Faltante: -$' + formatoMoneda(Math.abs(diferencia));
        
        const confirmar = confirm(
            `¿Confirmar arqueo del cierre automático?\\n\\n` +
            `­ƒôà Fecha: ${new Date(fecha).toLocaleDateString('es-CL')}\\n` +
            `­ƒÆ░ Total Ventas: $${formatoMoneda(cierre.total_ventas || 0)}\\n\\n` +
            `­ƒÆÁ Efectivo Esperado: $${formatoMoneda(efectivoEsperado)}\\n` +
            `­ƒÆÁ Efectivo Real: $${formatoMoneda(efectivoReal)}\\n` +
            `­ƒôè Diferencia: ${estadoTexto}\\n\\n` +
            `Esta acción completará el cierre automático.`
        );
        
        if (!confirmar) return;
        
        // Actualizar en la base de datos
        const { data, error } = await window.supabaseClient
            .from('cierres_diarios')
            .update({
                efectivo_real: efectivoReal,
                diferencia: diferencia,
                notas: (cierre.notas || '') + `\\n\\nÔ£à Arqueo completado manualmente el ${new Date().toLocaleString('es-CL')} por ${currentUser}`
            })
            .eq('fecha', fecha)
            .select();
        
        if (error) throw error;
        
        // Limpiar borrador de localStorage
        limpiarBorradorArqueo(fecha);
        
        mostrarNotificacion(
            `Ô£à Arqueo completado exitosamente\\n\\n` +
            `${estadoTexto}`,
            diferencia === 0 ? 'success' : (diferencia > 0 ? 'info' : 'warning'),
            6000
        );
        
        // Recargar historial para reflejar cambios
        await cargarHistorialCaja();
        
        console.log('Ô£à Arqueo completado:', { fecha, efectivoReal, diferencia });
        
    } catch (error) {
        console.error('ÔØî Error completando arqueo:', error);
        mostrarNotificacion('ÔØî Error al completar arqueo: ' + error.message, 'error', 5000);
    }
}

// ===================================
// MÓDULO: PAGOS AL PERSONAL
// ===================================

/**
 * Calcular el lunes de la semana actual
 */
function obtenerLunesSemana(fecha = new Date()) {
    const dia = fecha.getDay();
    const diff = fecha.getDate() - dia + (dia === 0 ? -6 : 1); // Ajustar si es domingo
    const lunes = new Date(fecha);
    lunes.setDate(diff);
    lunes.setHours(0, 0, 0, 0);
    return lunes;
}

/**
 * Abrir modal de pago personal
 */
function abrirModalPagoPersonal() {
    // Limpiar formulario
    document.getElementById('formPagoPersonal').reset();
    document.getElementById('totalPagoDisplay').textContent = '$0';

    // Abrir modal
    const modal = document.getElementById('modalPagoPersonal');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

/**
 * Cerrar modal de pago personal
 */
function cerrarModalPagoPersonal() {
    const modal = document.getElementById('modalPagoPersonal');
    modal.style.display = 'none';
    modal.classList.remove('show');
}

/**
 * Calcular total de pago (jornada + almuerzo)
 */
function calcularTotalPago() {
    const jornada = parseFloat(document.getElementById('pagoJornada').value) || 0;
    const almuerzo = parseFloat(document.getElementById('pagoAlmuerzo').value) || 0;
    const total = jornada + almuerzo;

    document.getElementById('totalPagoDisplay').textContent = '$' + formatoMoneda(total);
}

/**
 * Registrar pago al personal
 */
async function registrarPagoPersonal(event) {
    event.preventDefault();

    // Validar permisos de administrador
    if (!requireAdminRole('Registrar pagos al personal')) {
        return;
    }

    const empleado = document.getElementById('pagoEmpleado').value;
    const puesto = document.getElementById('pagoPuesto').value;
    const turno = document.getElementById('pagoTurno').value || 'completo';
    const pagoJornada = parseFloat(document.getElementById('pagoJornada').value);
    const pagoAlmuerzo = parseFloat(document.getElementById('pagoAlmuerzo').value);
    const diasSemana = parseInt(document.getElementById('pagoDiasSemana').value) || 1;
    const notas = document.getElementById('pagoNotas').value.trim();

    // Validaciones
    if (!empleado || !puesto || isNaN(pagoJornada) || isNaN(pagoAlmuerzo)) {
        mostrarNotificacion('Completa todos los campos obligatorios', 'warning');
        return;
    }

    if (pagoJornada < 0 || pagoAlmuerzo < 0) {
        mostrarNotificacion('Los montos no pueden ser negativos', 'warning');
        return;
    }

    const totalPago = pagoJornada + pagoAlmuerzo;

    if (totalPago === 0) {
        mostrarNotificacion('El total a pagar debe ser mayor a 0', 'warning');
        return;
    }

    // Confirmar pago
    const confirmar = confirm(
        `¿Registrar pago al personal?\n\n` +
        `­ƒæñ Empleado: ${empleado}\n` +
        `­ƒÆ╝ Puesto: ${puesto}\n` +
        `­ƒòÉ Turno: ${turno}\n` +
        `­ƒÆÁ Pago Jornada: $${formatoMoneda(pagoJornada)}\n` +
        `­ƒì¢´©Å Pago Almuerzo: $${formatoMoneda(pagoAlmuerzo)}\n` +
        `­ƒÆ░ Total: $${formatoMoneda(totalPago)}`
    );

    if (!confirmar) return;

    try {
        const lunesSemana = obtenerLunesSemana();

        const { data, error } = await window.supabaseClient
            .from('pagos_personal')
            .insert([{
                fecha: new Date().toISOString().split('T')[0], // Solo la fecha YYYY-MM-DD
                nombre_empleado: empleado,
                puesto: puesto,
                turno: turno,
                pago_jornada: pagoJornada,
                pago_almuerzo: pagoAlmuerzo,
                total_pago: totalPago,
                dias_trabajados_semana: diasSemana,
                semana_inicio: lunesSemana.toISOString().split('T')[0],
                registrado_por: currentUser,
                notas: notas || null
            }])
            .select();

        if (error) throw error;

        mostrarNotificacion(`Ô£à Pago registrado exitosamente para ${empleado}`, 'success');

        // Cerrar modal
        cerrarModalPagoPersonal();

        // Recargar pagos del día
        await cargarPagosPersonalDelDia();
        actualizarTotalesCaja();

    } catch (error) {
        manejarError(error, {
            contexto: 'registrarPagoPersonal',
            mensajeUsuario: 'Error al registrar el pago'
        });
    }
}

/**
 * Cargar pagos al personal del día
 */
async function cargarPagosPersonalDelDia() {
    try {
        if (!window.supabaseClient) {
            console.warn('ÔÜá´©Å Supabase no configurado, omitiendo pagos personal');
            pagosPersonalDelDia = [];
            actualizarResumenPagosPersonal();
            return;
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hoySinHora = hoy.toISOString().split('T')[0]; // YYYY-MM-DD

        const { data, error } = await window.supabaseClient
            .from('pagos_personal')
            .select('*')
            .eq('fecha', hoySinHora)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('ÔØî Error consultando pagos personal:', error);
            throw error;
        }

        pagosPersonalDelDia = data || [];
        console.log(`Ô£à ${pagosPersonalDelDia.length} pagos al personal hoy`);

        // Actualizar el panel de resumen
        actualizarResumenPagosPersonal();

    } catch (error) {
        manejarError(error, {
            contexto: 'cargarPagosPersonalDelDia',
            mensajeUsuario: 'Error cargando pagos al personal',
            mostrarNotificacion: false,
            callback: () => {
                pagosPersonalDelDia = [];
                actualizarResumenPagosPersonal();
            }
        });
    }
}

/**
 * Actualizar resumen de pagos al personal en el panel izquierdo
 */
function actualizarResumenPagosPersonal() {
    const cantidadEmpleados = new Set(pagosPersonalDelDia.map(p => p.nombre_empleado)).size;
    const totalJornadas = pagosPersonalDelDia.reduce((sum, p) => sum + parseFloat(p.pago_jornada), 0);
    const totalAlmuerzos = pagosPersonalDelDia.reduce((sum, p) => sum + parseFloat(p.pago_almuerzo), 0);
    const totalPagado = pagosPersonalDelDia.reduce((sum, p) => sum + parseFloat(p.total_pago), 0);

    document.getElementById('cantidadEmpleadosPagados').textContent = cantidadEmpleados;
    document.getElementById('totalJornadas').textContent = '$' + formatoMoneda(totalJornadas);
    document.getElementById('totalAlmuerzos').textContent = '$' + formatoMoneda(totalAlmuerzos);
    document.getElementById('totalPagadoPersonal').textContent = '$' + formatoMoneda(totalPagado);
}

/**
 * Cargar datos del sistema de reparto/delivery del día
 */
async function cargarDatosReparto() {
    try {
        console.log('­ƒÜÜ Cargando datos de reparto con lógica de contabilización...');

        if (!window.supabaseClient) {
            console.warn('ÔÜá´©Å Supabase no configurado, omitiendo datos de reparto');
            actualizarResumenReparto(null);
            return;
        }

        const hoy = new Date();
        const fechaHoy = hoy.toISOString().split('T')[0]; // YYYY-MM-DD

        console.log(`­ƒôà Consultando pedidos del día vía RPC...`);
        console.log(`   Fecha: ${fechaHoy}`);

        // USAR FUNCIÓN RPC (bypasea políticas RLS, igual que obtener_transferencias_dia)
        const { data: pedidos, error } = await window.supabaseClient
            .rpc('obtener_pedidos_dia', { fecha_consulta: fechaHoy });

        if (error) {
            console.error('ÔØî Error en RPC obtener_pedidos_dia:', error);
            
            // Si la función no existe, mostrar instrucciones claras
            if (error.code === '42883' || error.message?.includes('function')) {
                console.error('ÔÜá´©Å CONFIGURACIÓN PENDIENTE:');
                console.error('   Debes ejecutar el script SQL:');
                console.error('   CREAR_FUNCION_RPC_OBTENER_PEDIDOS_DIA.sql');
                console.error('   en el SQL Editor de Supabase.');
                mostrarNotificacion('Configuración pendiente: Ejecuta script SQL en Supabase', 'warning');
            } else {
                console.error('   Código:', error.code);
                console.error('   Mensaje:', error.message);
            }
            
            actualizarResumenReparto(null);
            return;
        }

        if (!pedidos || pedidos.length === 0) {
            console.log('Ôä╣´©Å No hay pedidos relevantes para hoy');
            actualizarResumenReparto([], fechaHoy);
            return;
        }

        console.log(`Ô£à ${pedidos.length} pedidos encontrados vía RPC (filtrando para ${fechaHoy})`);
        actualizarResumenReparto(pedidos, fechaHoy);

    } catch (error) {
        console.error('ÔØî Error en cargarDatosReparto:', error);
        manejarError(error, {
            contexto: 'cargarDatosReparto',
            mensajeUsuario: 'Error cargando datos de reparto',
            mostrarNotificacion: false,
            callback: () => actualizarResumenReparto(null)
        });
    }
}

/**
 * Actualizar resumen de reparto en el panel con lógica de contabilización
 */
function actualizarResumenReparto(pedidos, fechaHoy) {
    if (pedidos === null) {
        // Error o no disponible
        document.getElementById('totalRecaudadoReparto').textContent = 'N/A';
        document.getElementById('repartoEfectivo').textContent = 'N/A';
        document.getElementById('repartoTarjetas').textContent = 'N/A';
        document.getElementById('repartoPendientesCantidad').textContent = '0';
        document.getElementById('repartoPendientesMonto').textContent = '$0';
        document.getElementById('repartoPagadasCantidad').textContent = '0';
        document.getElementById('repartoPagadasMonto').textContent = '$0';
        return;
    }

    if (!pedidos || pedidos.length === 0) {
        // No hay pedidos
        document.getElementById('totalRecaudadoReparto').textContent = '$0';
        document.getElementById('repartoEfectivo').textContent = '$0';
        document.getElementById('repartoTarjetas').textContent = '$0';
        document.getElementById('repartoPendientesCantidad').textContent = '0';
        document.getElementById('repartoPendientesMonto').textContent = '$0';
        document.getElementById('repartoPagadasCantidad').textContent = '0';
        document.getElementById('repartoPagadasMonto').textContent = '$0';
        return;
    }

    // Calcular estadísticas con lógica de contabilización
    let efectivo = 0;
    let tarjetas = 0;
    let transferencias = 0;
    let pendientes = [];
    let contabilizadosHoy = [];

    const hoy = fechaHoy ? new Date(fechaHoy + 'T00:00:00') : new Date();
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    console.log('­ƒôà Fecha de contabilización:', hoy.toLocaleDateString('es-CL'));
    console.log(`­ƒöì Procesando ${pedidos.length} pedidos para filtrar...`);

    pedidos.forEach(pedido => {
       // Solo contar pedidos entregados Y NO anulados
        if (!pedido.entregado || pedido.estado === 'ANULADO') {
            if (!pedido.entregado) {
                pendientes.push(pedido);
            }
            return;
        }

        const total = pedido.total || 0;
        const metodo = pedido.metodo_pago || pedido.metodo || 'E';

        console.log(`­ƒöÄ Evaluando: ${pedido.nombre} | Método: ${metodo} | Total: $${total} | Entregado: ${pedido.entregado} | Boleteada: ${pedido.boleteada}`);

        // ============================================================
        // LÓGICA DE FECHA DE CONTABILIZACIÓN (IGUAL QUE EN REPARTO)
        // ============================================================
        let fechaContabilizar;
        const esTransferencia = ['TP', 'TG', 'T', 'P'].includes(metodo) || metodo.includes('TRANSF');

        if (esTransferencia && pedido.boleteada && pedido.fecha_boleta) {
            // CASO 1: TPÔåÆTG (confirmada) ÔåÆ cuenta día de CONFIRMACIÓN
            fechaContabilizar = new Date(pedido.fecha_boleta);
            console.log(`­ƒÆ░ Transferencia CONFIRMADA: ${pedido.nombre} - $${total} cuenta para ${fechaContabilizar.toLocaleDateString('es-CL')}`);
        } else if (metodo === 'TG' || metodo.includes('TRANSF')) {
            // CASO 2: TG (Transferencia Pagada) ÔåÆ cuenta día de ENTREGA (si está entregado)
            if (pedido.fecha_boleta) {
                fechaContabilizar = new Date(pedido.fecha_boleta);
                console.log(`Ô£à Transferencia PAGADA con fecha_boleta: ${pedido.nombre} - $${total} cuenta para ${fechaContabilizar.toLocaleDateString('es-CL')}`);
            } else if (pedido.fecha) {
                fechaContabilizar = new Date(pedido.fecha + 'T00:00:00');
                console.log(`Ô£à Transferencia PAGADA entregada: ${pedido.nombre} - $${total} cuenta para ${fechaContabilizar.toLocaleDateString('es-CL')}`);
            } else {
                fechaContabilizar = new Date(pedido.created_at);
                console.log(`Ô£à Transferencia PAGADA desde inicio: ${pedido.nombre} - $${total} cuenta para ${fechaContabilizar.toLocaleDateString('es-CL')}`);
            }
        } else if (metodo === 'TP' || metodo === 'T') {
            // CASO 3: TP (Transferencia Pendiente) ÔåÆ SÍ CUENTA usando fecha del pedido
            fechaContabilizar = new Date(pedido.fecha + 'T00:00:00');
            console.log(`­ƒÆ© Transferencia PENDIENTE (sin boleta): ${pedido.nombre} - $${total} cuenta para ${fechaContabilizar.toLocaleDateString('es-CL')}`);
        } else {
            // CASO 4: Otros métodos (E, DC) ÔåÆ cuenta día de ENTREGA
            fechaContabilizar = new Date(pedido.fecha + 'T00:00:00');
        }

        // Verificar si cuenta para HOY
        if (fechaContabilizar >= hoy && fechaContabilizar < manana) {
            contabilizadosHoy.push(pedido);

            // Contabilizar por método de pago (IGUAL QUE EN REPARTO)
            if (metodo === 'E' || metodo.toLowerCase().includes('efectivo')) {
                efectivo += total;
            } else if (metodo === 'DC' || metodo.toLowerCase().includes('tarjeta') || metodo.toLowerCase().includes('debito') || metodo.toLowerCase().includes('credito')) {
                tarjetas += total;
            } else if (esTransferencia) {
                transferencias += total;
            } else {
                // Por defecto contar como efectivo
                efectivo += total;
            }

            console.log(`Ô£à CUENTA HOY: ${pedido.nombre} - ${metodo} - $${total}`);
        } else {
            console.log(`ÔÅ¡´©Å NO cuenta hoy (fecha: ${fechaContabilizar ? fechaContabilizar.toLocaleDateString('es-CL') : 'N/A'}): ${pedido.nombre} - ${metodo} - $${total}`);
        }
    });

    const totalRecaudado = efectivo + tarjetas + transferencias;
    const montoPendientes = pendientes.reduce((sum, p) => sum + (p.total || 0), 0);
    
    // Calcular transferencias pendientes del total de pendientes
    const transferenciasPendientes = pendientes.filter(p => {
        const metodo = p.metodo_pago || p.metodo || 'E';
        return ['TP', 'TG', 'T', 'P'].includes(metodo) || metodo.includes('TRANSF');
    }).reduce((sum, p) => sum + (p.total || 0), 0);

    console.log('ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ');
    console.log(`­ƒôè RESUMEN REPARTO CONTABILIZACIÓN:`);
    console.log(`   ­ƒôÑ Pedidos recibidos: ${pedidos.length}`);
    console.log(`   Ô£à Contabilizados HOY: ${contabilizadosHoy.length}`);
    console.log(`   ÔÅ│ Pendientes: ${pendientes.length}`);
    console.log(`   ­ƒÆÁ Efectivo: $${efectivo.toLocaleString('es-CL')}`);
    console.log(`   ­ƒÆ│ Tarjetas: $${tarjetas.toLocaleString('es-CL')}`);
    console.log(`   ­ƒÅª Transferencias: $${transferencias.toLocaleString('es-CL')}`);
    console.log(`   ÔÅ│ Transf. Pendientes: $${transferenciasPendientes.toLocaleString('es-CL')}`);
    console.log(`   ­ƒÆ░ TOTAL RECAUDADO: $${totalRecaudado.toLocaleString('es-CL')}`);
    console.log('ÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉÔòÉ');
    
    // Guardar en variable global
    repartoDelDia = {
        efectivo,
        tarjetas,
        transferencias,
        transferencias_pendientes: transferenciasPendientes,
        total: totalRecaudado
    };

    // Actualizar UI
    document.getElementById('totalRecaudadoReparto').textContent = '$' + formatoMoneda(totalRecaudado);
    document.getElementById('repartoEfectivo').textContent = '$' + formatoMoneda(efectivo);
    document.getElementById('repartoTarjetas').textContent = '$' + formatoMoneda(tarjetas);
    const elRepartoTransf = document.getElementById('repartoTransferencias');
    if (elRepartoTransf) elRepartoTransf.textContent = '$' + formatoMoneda(transferencias);
    document.getElementById('repartoPendientesCantidad').textContent = pendientes.length;
    document.getElementById('repartoPendientesMonto').textContent = '$' + formatoMoneda(montoPendientes);
    document.getElementById('repartoPagadasCantidad').textContent = contabilizadosHoy.length;
    document.getElementById('repartoPagadasMonto').textContent = '$' + formatoMoneda(totalRecaudado);

    console.log('­ƒôè Resumen reparto actualizado:', {
        total: totalRecaudado,
        efectivo,
        tarjetas,
        transferencias,
        transferencias_pendientes: transferenciasPendientes,
        pendientes: pendientes.length,
        contabilizadosHoy: contabilizadosHoy.length
    });
    
    // Actualizar totales consolidados (POS + Reparto)
    if (typeof actualizarTotalesConsolidados === 'function') {
        actualizarTotalesConsolidados();
    }
}

/**
 * Abrir modal de editar pagos al personal
 */
function abrirModalEditarPagosPersonal() {
    // Solo encargado puede editar
    if (currentUserRole !== 'encargado') {
        mostrarNotificacion('Solo el encargado puede editar pagos al personal', 'warning');
        return;
    }

    if (pagosPersonalDelDia.length === 0) {
        mostrarNotificacion('No hay pagos registrados hoy', 'info');
        return;
    }

    // Renderizar lista
    renderListaPagosEditar();

    // Abrir modal
    const modal = document.getElementById('modalEditarPagosPersonal');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

/**
 * Cerrar modal de editar pagos
 */
function cerrarModalEditarPagosPersonal() {
    const modal = document.getElementById('modalEditarPagosPersonal');
    modal.style.display = 'none';
    modal.classList.remove('show');
}

/**
 * Renderizar lista de pagos editables
 */
function renderListaPagosEditar() {
    const lista = document.getElementById('listaPagosPersonalEditar');

    if (pagosPersonalDelDia.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: hsl(var(--muted-foreground));">No hay pagos registrados hoy</p>';
        return;
    }

    const html = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: hsl(var(--secondary)); border-bottom: 2px solid hsl(var(--border));">
                        <th style="padding: 12px; text-align: left; font-weight: 600;">Empleado</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600;">Puesto</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">Pago Jornada</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">Pago Almuerzo</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">Total</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${pagosPersonalDelDia.map(pago => `
                        <tr style="border-bottom: 1px solid hsl(var(--border));" id="row-pago-${pago.id}">
                            <td style="padding: 12px; font-weight: 500;">${pago.nombre_empleado}</td>
                            <td style="padding: 12px; text-transform: capitalize;">${pago.puesto}</td>
                            <td style="padding: 12px; text-align: center;">
                                <input 
                                    type="number" 
                                    class="form-input" 
                                    id="jornada-${pago.id}"
                                    value="${pago.pago_jornada}"
                                    min="0"
                                    step="100"
                                    style="width: 120px; text-align: center;"
                                    onchange="calcularTotalPagoEditar(${pago.id})"
                                >
                            </td>
                            <td style="padding: 12px; text-align: center;">
                                <input 
                                    type="number" 
                                    class="form-input" 
                                    id="almuerzo-${pago.id}"
                                    value="${pago.pago_almuerzo}"
                                    min="0"
                                    step="100"
                                    style="width: 120px; text-align: center;"
                                    onchange="calcularTotalPagoEditar(${pago.id})"
                                >
                            </td>
                            <td style="padding: 12px; text-align: center; font-weight: 700; color: hsl(var(--success));" id="total-${pago.id}">
                                $${formatoMoneda(pago.total_pago)}
                            </td>
                            <td style="padding: 12px; text-align: center;">
                                <button 
                                    class="btn btn-primary" 
                                    onclick="guardarPagoEditado(${pago.id})"
                                    style="padding: 8px 16px; font-size: 14px;"
                                >
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style="margin-right: 4px;">
                                        <path d="M5 10l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    Guardar
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    lista.innerHTML = html;
}

/**
 * Calcular total al editar pago
 */
function calcularTotalPagoEditar(pagoId) {
    const jornada = parseFloat(document.getElementById(`jornada-${pagoId}`).value) || 0;
    const almuerzo = parseFloat(document.getElementById(`almuerzo-${pagoId}`).value) || 0;
    const total = jornada + almuerzo;

    document.getElementById(`total-${pagoId}`).textContent = '$' + formatoMoneda(total);
}

/**
 * Guardar pago editado
 */
async function guardarPagoEditado(pagoId) {
    const nuevoJornada = parseFloat(document.getElementById(`jornada-${pagoId}`).value);
    const nuevoAlmuerzo = parseFloat(document.getElementById(`almuerzo-${pagoId}`).value);

    if (isNaN(nuevoJornada) || isNaN(nuevoAlmuerzo)) {
        mostrarNotificacion('Valores inválidos', 'error');
        return;
    }

    if (nuevoJornada < 0 || nuevoAlmuerzo < 0) {
        mostrarNotificacion('Los montos no pueden ser negativos', 'error');
        return;
    }

    const nuevoTotal = nuevoJornada + nuevoAlmuerzo;

    try {
        const { error } = await window.supabaseClient
            .from('pagos_personal')
            .update({
                pago_jornada: nuevoJornada,
                pago_almuerzo: nuevoAlmuerzo,
                total_pago: nuevoTotal
            })
            .eq('id', pagoId);

        if (error) throw error;

        mostrarNotificacion('Ô£à Pago actualizado correctamente', 'success');

        // Actualizar en la lista local
        const pagoIndex = pagosPersonalDelDia.findIndex(p => p.id === pagoId);
        if (pagoIndex !== -1) {
            pagosPersonalDelDia[pagoIndex].pago_jornada = nuevoJornada;
            pagosPersonalDelDia[pagoIndex].pago_almuerzo = nuevoAlmuerzo;
            pagosPersonalDelDia[pagoIndex].total_pago = nuevoTotal;
        }

        // Actualizar resumen en panel izquierdo
        actualizarResumenPagosPersonal();
        actualizarTotalesCaja();

    } catch (error) {
        manejarError(error, {
            contexto: 'actualizarPagoPersonal',
            mensajeUsuario: 'Error al actualizar el pago'
        });
    }
}

// ===================================
// GESTIÓN DE PROVEEDORES (Encargado)
// ===================================

let proveedoresActuales = [];
let proveedorEditando = null;

/**
 * Inicializar proveedores desde localStorage
 * FUSIONA proveedores guardados con los del HTML (sin duplicar)
 */
async function inicializarProveedores() {
    try {
        if (!window.supabaseClient) {
            console.error('supabaseClient no está definido');
            proveedoresActuales = [];
            return;
        }
        
        // Cargar proveedores desde Supabase
        const { data, error } = await window.supabaseClient
            .from('proveedores')
            .select('nombre')
            .eq('activo', true)
            .order('nombre', { ascending: true });
        
        if (error) {
            console.error('Error cargando proveedores:', error);
            mostrarNotificacion('Error al cargar proveedores', 'error');
            proveedoresActuales = [];
            return;
        }
        
        if (!data || data.length === 0) {
            console.warn('No hay proveedores activos en la base de datos');
            proveedoresActuales = [];
        } else {
            proveedoresActuales = data.map(p => p.nombre);
            console.log('Ô£à Proveedores cargados:', proveedoresActuales.length);
        }
        
    } catch (error) {
        manejarError(error, {
            contexto: 'inicializarProveedores',
            mensajeUsuario: 'Error al inicializar proveedores'
        });
        proveedoresActuales = [];
    }
    
    // Actualizar todos los select de la aplicación
    actualizarSelectProveedores();
    actualizarSelectCategorias();
    
    // Inicializar categorías si no están cargadas
    if (categoriasActuales.length === 0) {
        inicializarCategorias();
    }
}

/**
 * Recargar proveedores desde Supabase
 */
async function recargarProveedores() {
    try {
        const { data, error } = await window.supabaseClient
            .from('proveedores')
            .select('nombre')
            .eq('activo', true)
            .order('nombre', { ascending: true });
        
        if (error) throw error;
        
        proveedoresActuales = data.map(p => p.nombre);
        actualizarSelectProveedores();
        
    } catch (error) {
        manejarError(error, {
            contexto: 'recargarProveedores',
            mensajeUsuario: 'Error recargando proveedores',
            mostrarNotificacion: false // Función interna, no interrumpir UX
        });
    }
}

/**
 * Actualizar todos los select de proveedores en la aplicación
 */
function actualizarSelectProveedores() {
    // Ordenar alfabéticamente para mejor UX
    const proveedoresOrdenados = [...proveedoresActuales].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const opcionesProveedor = proveedoresOrdenados.map(p => `<option value="${p}">${p}</option>`).join('');
    
    // Select de filtro de inventario
    const filtroProveedor = document.getElementById('filtroProveedor');
    
    if (filtroProveedor) {
        const valorActual = filtroProveedor.value;
        filtroProveedor.innerHTML = `
            <option value="">Todos los proveedores</option>
            <option value="Sin proveedor">Sin proveedor</option>
            ${opcionesProveedor}
        `;
        filtroProveedor.value = valorActual;
    }
    
    // Select del modal de editar producto
    const editProveedor = document.getElementById('editProveedor');
    if (editProveedor) {
        const valorActualEdit = editProveedor.value;
        editProveedor.innerHTML = `
            <option value="">Sin proveedor</option>
            ${opcionesProveedor}
        `;
        editProveedor.value = valorActualEdit;
    }
    
    // Select del modal de nuevo producto
    const nuevoProveedor = document.getElementById('nuevoProveedor');
    if (nuevoProveedor) {
        const valorActualNuevo = nuevoProveedor.value;
        nuevoProveedor.innerHTML = `
            <option value="">Sin proveedor</option>
            ${opcionesProveedor}
        `;
        nuevoProveedor.value = valorActualNuevo;
    }
}

/**
 * Actualizar el select de categorías en el inventario
 */
function actualizarSelectCategorias() {
    // Asegurar que las categorías estén inicializadas
    if (categoriasActuales.length === 0) {
        inicializarCategorias();
    }
    
    // Ordenar alfabéticamente
    const categoriasOrdenadas = [...categoriasActuales].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const opcionesCategorias = categoriasOrdenadas.map(c => `<option value="${c}">${c}</option>`).join('');
    
    // Select de filtro de inventario
    const filtroCategoria = document.getElementById('filtroCategoria');
    if (filtroCategoria) {
        const valorActual = filtroCategoria.value;
        filtroCategoria.innerHTML = `
            <option value="">Todas las categorías</option>
            ${opcionesCategorias}
        `;
        filtroCategoria.value = valorActual;
    }
    
    // Select del modal de editar producto
    const editCategoria = document.getElementById('editCategoria');
    if (editCategoria) {
        const valorActualEdit = editCategoria.value;
        editCategoria.innerHTML = `
            <option value="">Seleccionar categoría</option>
            ${opcionesCategorias}
        `;
        editCategoria.value = valorActualEdit;
    }
    
    // Select del modal de nuevo producto
    const nuevoCategoria = document.getElementById('nuevoCategoria');
    if (nuevoCategoria) {
        const valorActualNuevo = nuevoCategoria.value;
        nuevoCategoria.innerHTML = `
            <option value="">Seleccionar categoría</option>
            ${opcionesCategorias}
        `;
        nuevoCategoria.value = valorActualNuevo;
    }
}

/**
 * Abrir modal de gestión de proveedores
 */
async function abrirModalProveedores() {
    if (currentUserRole !== 'encargado') {
        mostrarNotificacion('Solo el encargado puede gestionar proveedores', 'warning');
        return;
    }
    
    // Recargar proveedores desde Supabase para tener datos actualizados
    await recargarProveedores();
    
    proveedorEditando = null;
    document.getElementById('inputNombreProveedor').value = '';
    document.getElementById('tituloFormProveedor').textContent = 'Ô×ò Agregar Proveedor';
    document.getElementById('textoBotonProveedor').textContent = 'Agregar';
    document.getElementById('btnCancelarEditProveedor').style.display = 'none';
    
    renderizarListaProveedores();
    
    const modal = document.getElementById('modalProveedores');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

/**
 * Cerrar modal de proveedores
 */
function cerrarModalProveedores() {
    const modal = document.getElementById('modalProveedores');
    modal.style.display = 'none';
    modal.classList.remove('show');
    proveedorEditando = null;
}

/**
 * Renderizar lista de proveedores
 */
function renderizarListaProveedores() {
    const lista = document.getElementById('listaProveedores');
    
    if (!proveedoresActuales || proveedoresActuales.length === 0) {
        lista.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <p>No hay proveedores registrados</p>
                <p style="font-size: 14px; margin-top: 10px;">Agrega el primer proveedor usando el formulario arriba</p>
            </div>
        `;
        return;
    }
    
    const proveedoresOrdenados = [...proveedoresActuales].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    
    const html = proveedoresOrdenados.map((proveedor, index) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; background: white; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 8px;">
            <div style="flex: 1;">
                <strong style="font-size: 15px;">${proveedor}</strong>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm btn-primary" onclick="editarProveedor('${proveedor.replace(/'/g, "\\'")}')">
                    Ô£Å´©Å Editar
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarProveedor('${proveedor.replace(/'/g, "\\'")}')">
                    ­ƒùæ´©Å Eliminar
                </button>
            </div>
        </div>
    `).join('');
    
    lista.innerHTML = html;
}

/**
 * Guardar proveedor (crear o actualizar)
 */
async function guardarProveedor() {
    // Validar permisos de administrador
    if (!requireAdminRole('Gestionar proveedores')) {
        return;
    }

    const input = document.getElementById('inputNombreProveedor');
    const nombreProveedor = input.value.trim();
    
    if (!nombreProveedor) {
        mostrarNotificacion('Por favor ingresa el nombre del proveedor', 'warning');
        input.focus();
        return;
    }
    
    try {
        if (proveedorEditando !== null) {
            // Editar proveedor existente
            if (nombreProveedor !== proveedorEditando) {
                // Verificar si el nuevo nombre ya existe
                const { data: existente } = await window.supabaseClient
                    .from('proveedores')
                    .select('id')
                    .eq('nombre', nombreProveedor)
                    .eq('activo', true)
                    .single();
                
                if (existente) {
                    mostrarNotificacion('Ya existe un proveedor con ese nombre', 'warning');
                    return;
                }
                
                // Actualizar nombre del proveedor
                const { error } = await window.supabaseClient
                    .from('proveedores')
                    .update({ 
                        nombre: nombreProveedor,
                        updated_at: new Date().toISOString()
                    })
                    .eq('nombre', proveedorEditando);
                
                if (error) throw error;
            }
            
            mostrarNotificacion('Proveedor actualizado exitosamente', 'success');
        } else {
            // Agregar nuevo proveedor
            const { error } = await window.supabaseClient
                .from('proveedores')
                .insert([{ nombre: nombreProveedor }]);
            
            if (error) {
                if (error.code === '23505') { // Duplicate key
                    mostrarNotificacion('Ya existe un proveedor con ese nombre', 'warning');
                } else {
                    throw error;
                }
                return;
            }
            
            mostrarNotificacion('Proveedor agregado exitosamente', 'success');
        }
        
        // Recargar lista desde Supabase
        await recargarProveedores();
        renderizarListaProveedores();
        
        // Limpiar formulario
        input.value = '';
        proveedorEditando = null;
        document.getElementById('tituloFormProveedor').textContent = 'Ô×ò Agregar Proveedor';
        document.getElementById('textoBotonProveedor').textContent = 'Agregar';
        document.getElementById('btnCancelarEditProveedor').style.display = 'none';
        
    } catch (error) {
        manejarError(error, {
            contexto: 'guardarProveedor',
            mensajeUsuario: 'Error al guardar proveedor'
        });
    }
}

/**
 * Editar proveedor
 */
function editarProveedor(nombreProveedor) {
    proveedorEditando = nombreProveedor;
    
    document.getElementById('inputNombreProveedor').value = nombreProveedor;
    document.getElementById('tituloFormProveedor').textContent = 'Ô£Å´©Å Editar Proveedor';
    document.getElementById('textoBotonProveedor').textContent = 'Guardar Cambios';
    document.getElementById('btnCancelarEditProveedor').style.display = 'inline-block';
    
    // Scroll al formulario
    document.getElementById('inputNombreProveedor').focus();
}

/**
 * Cancelar edición de proveedor
 */
function cancelarEditarProveedor() {
    proveedorEditando = null;
    
    document.getElementById('inputNombreProveedor').value = '';
    document.getElementById('tituloFormProveedor').textContent = 'Ô×ò Agregar Proveedor';
    document.getElementById('textoBotonProveedor').textContent = 'Agregar';
    document.getElementById('btnCancelarEditProveedor').style.display = 'none';
}

/**
 * Eliminar proveedor (desactivar)
 */
async function eliminarProveedor(nombreProveedor) {
    // Validar permisos de administrador
    if (!requireAdminRole('Eliminar proveedores')) {
        return;
    }

    if (!confirm(`¿Estás seguro de eliminar el proveedor "${nombreProveedor}"?\n\nEsta acción no afectará los productos existentes.`)) {
        return;
    }
    
    try {
        // Desactivar proveedor (soft delete)
        const { error } = await window.supabaseClient
            .from('proveedores')
            .update({ 
                activo: false,
                updated_at: new Date().toISOString()
            })
            .eq('nombre', nombreProveedor);
        
        if (error) throw error;
        
        // Recargar lista desde Supabase
        await recargarProveedores();
        renderizarListaProveedores();
        
        mostrarNotificacion('Proveedor eliminado exitosamente', 'success');
        
    } catch (error) {
        manejarError(error, {
            contexto: 'eliminarProveedor',
            mensajeUsuario: 'Error al eliminar proveedor'
        });
    }
}

// ===================================
// GESTIÓN DE CATEGORÍAS (Encargado)
// ===================================

let categoriasActuales = [];
let categoriaEditando = null;

/**
 * Inicializar categorías desde localStorage
 * FUSIONA categorías guardadas con las base (sin duplicar)
 */
function inicializarCategorias() {
    // Categorías base (siempre deben estar)
    const categoriasBase = [
        'Perro Adulto', 'Cachorro', 'Senior', 'Gato Adulto', 'Gato Kitten',
        'Gatito', 'Arena', 'Snacks', 'Accesorios', 'Otros',
        'Super Premium Gato', 'Super Premium Perro', 'Veterinario Gato', 'Veterinario Perro'
    ];

    const categoriasGuardadas = localStorage.getItem('categorias_sabrofood');
    
    if (categoriasGuardadas) {
        try {
            const guardadas = JSON.parse(categoriasGuardadas);
            
            // Fusionar: primero las guardadas, luego agregar las que falten de la base
            categoriasActuales = [...guardadas];
            
            // Agregar categorías base que no estén en guardadas
            categoriasBase.forEach(cat => {
                if (!categoriasActuales.includes(cat)) {
                    categoriasActuales.push(cat);
                }
            });
            
            guardarCategoriasEnStorage();
            
        } catch (e) {
            console.error('Error al parsear categorías guardadas:', e);
            categoriasActuales = categoriasBase;
        }
    } else {
        // Primera vez: usar categorías base
        categoriasActuales = categoriasBase;
        guardarCategoriasEnStorage();
    }
    
    // Actualizar todos los select de la aplicación
    actualizarSelectCategorias();
    
    console.log('Ô£à Categorías inicializadas:', categoriasActuales.length);
}

/**
 * Guardar categorías en localStorage
 */
function guardarCategoriasEnStorage() {
    localStorage.setItem('categorias_sabrofood', JSON.stringify(categoriasActuales));
}

/**
 * Abrir modal de gestión de categorías
 */
function abrirModalCategorias() {
    if (currentUserRole !== 'encargado') {
        mostrarNotificacion('Solo el encargado puede gestionar categorías', 'warning');
        return;
    }
    
    // Re-inicializar categorías para asegurar que estén cargadas
    if (categoriasActuales.length === 0) {
        inicializarCategorias();
    }
    
    renderizarListaCategorias();
    
    const modal = document.getElementById('modalCategorias');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

/**
 * Cerrar modal de gestión de categorías
 */
function cerrarModalCategorias() {
    const modal = document.getElementById('modalCategorias');
    modal.style.display = 'none';
    modal.classList.remove('show');
    
    // Limpiar formulario
    document.getElementById('inputNombreCategoria').value = '';
    cancelarEditarCategoria();
}

/**
 * Renderizar lista de categorías
 */
function renderizarListaCategorias() {
    const lista = document.getElementById('listaCategorias');
    
    if (!categoriasActuales || categoriasActuales.length === 0) {
        lista.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <p>No hay categorías registradas</p>
                <p style="font-size: 14px; margin-top: 10px;">Agrega la primera categoría usando el formulario arriba</p>
            </div>
        `;
        return;
    }
    
    const categoriasOrdenadas = [...categoriasActuales].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    
    const html = categoriasOrdenadas.map((categoria, index) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; background: white; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 8px;">
            <div style="flex: 1;">
                <strong style="font-size: 15px;">${categoria}</strong>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm btn-primary" onclick="editarCategoria('${categoria.replace(/'/g, "\\'")}')">
                    Ô£Å´©Å Editar
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarCategoria('${categoria.replace(/'/g, "\\'")}')">
                    ­ƒùæ´©Å Eliminar
                </button>
            </div>
        </div>
    `).join('');
    
    lista.innerHTML = html;
}

/**
 * Guardar nueva categoría o editar existente
 */
function guardarCategoria() {
    // Validar permisos de administrador
    if (!requireAdminRole('Gestionar categorías')) {
        return;
    }

    const input = document.getElementById('inputNombreCategoria');
    const nombreCategoria = input.value.trim();
    
    if (!nombreCategoria) {
        mostrarNotificacion('Debes ingresar un nombre de categoría', 'warning');
        input.focus();
        return;
    }
    
    // Modo editar
    if (categoriaEditando !== null) {
        const index = categoriasActuales.indexOf(categoriaEditando);
        
        // Validar que no exista otra categoría con ese nombre
        if (nombreCategoria !== categoriaEditando && categoriasActuales.includes(nombreCategoria)) {
            mostrarNotificacion('Ya existe una categoría con ese nombre', 'warning');
            return;
        }
        
        if (index !== -1) {
            categoriasActuales[index] = nombreCategoria;
            mostrarNotificacion('Categoría actualizada exitosamente', 'success');
        }
    } 
    // Modo agregar
    else {
        // Validar que no exista
        if (categoriasActuales.includes(nombreCategoria)) {
            mostrarNotificacion('Esa categoría ya existe', 'warning');
            return;
        }
        
        categoriasActuales.push(nombreCategoria);
        mostrarNotificacion('Categoría agregada exitosamente', 'success');
    }
    
    guardarCategoriasEnStorage();
    actualizarSelectCategorias();
    renderizarListaCategorias();
    
    // Limpiar formulario
    input.value = '';
    cancelarEditarCategoria();
}

/**
 * Editar categoría existente
 */
function editarCategoria(nombreCategoria) {
    categoriaEditando = nombreCategoria;
    
    document.getElementById('inputNombreCategoria').value = nombreCategoria;
    document.getElementById('tituloFormCategoria').textContent = 'Ô£Å´©Å Editar Categoría';
    document.getElementById('textoBotonCategoria').textContent = 'Guardar';
    document.getElementById('btnCancelarEditCategoria').style.display = 'inline-block';
    document.getElementById('inputNombreCategoria').focus();
}

/**
 * Cancelar edición de categoría
 */
function cancelarEditarCategoria() {
    categoriaEditando = null;
    
    document.getElementById('inputNombreCategoria').value = '';
    document.getElementById('tituloFormCategoria').textContent = 'Ô×ò Agregar Categoría';
    document.getElementById('textoBotonCategoria').textContent = 'Agregar';
    document.getElementById('btnCancelarEditCategoria').style.display = 'none';
}

/**
 * Eliminar categoría
 */
function eliminarCategoria(nombreCategoria) {
    // Validar permisos de administrador
    if (!requireAdminRole('Eliminar categorías')) {
        return;
    }

    if (!confirm(`¿Estás seguro de eliminar la categoría "${nombreCategoria}"?\n\nEsta acción no afectará los productos existentes.`)) {
        return;
    }
    
    const index = categoriasActuales.indexOf(nombreCategoria);
    if (index !== -1) {
        categoriasActuales.splice(index, 1);
        guardarCategoriasEnStorage();
        actualizarSelectCategorias();
        renderizarListaCategorias();
        mostrarNotificacion('Categoría eliminada exitosamente', 'success');
    }
}

// ===================================
// GESTIÓN DE MARCAS (Solo Encargado)
// ===================================

let marcasActuales = [];
let marcaEditando = null;

/**
 * Inicializar marcas desde localStorage
 * FUSIONA marcas guardadas con las base (sin duplicar)
 */
/**
 * Inicializar marcas desde Supabase
 * Patrón copiado de proveedores
 */
async function inicializarMarcas() {
    try {
        if (!window.supabaseClient) {
            console.error('supabaseClient no está definido');
            marcasActuales = [];
            return;
        }
        
        // Cargar marcas desde Supabase
        const { data, error } = await window.supabaseClient
            .from('marcas')
            .select('nombre')
            .eq('activo', true)
            .order('nombre', { ascending: true });
        
        if (error) {
            console.error('Error cargando marcas:', error);
            mostrarNotificacion('Error al cargar marcas', 'error');
            marcasActuales = [];
            return;
        }
        
        if (!data || data.length === 0) {
            console.warn('No hay marcas activas en la base de datos');
            marcasActuales = [];
        } else {
            marcasActuales = data.map(m => m.nombre);
            console.log('Ô£à Marcas cargadas desde Supabase:', marcasActuales.length);
        }
        
    } catch (error) {
        manejarError(error, {
            contexto: 'inicializarMarcas',
            mensajeUsuario: 'Error al inicializar marcas'
        });
        marcasActuales = [];
    }
    
    // Actualizar select de marcas
    actualizarSelectMarcas();
}

/**
 * Recargar marcas desde Supabase
 */
async function recargarMarcas() {
    try {
        const { data, error } = await window.supabaseClient
            .from('marcas')
            .select('nombre')
            .eq('activo', true)
            .order('nombre', { ascending: true });
        
        if (error) throw error;
        
        marcasActuales = data.map(m => m.nombre);
        actualizarSelectMarcas();
        
    } catch (error) {
        manejarError(error, {
            contexto: 'recargarMarcas',
            mensajeUsuario: 'Error recargando marcas',
            mostrarNotificacion: false // Función interna, no interrumpir UX
        });
    }
}

/**
 * Abrir modal de gestión de marcas
 */
async function abrirModalMarcas() {
    if (currentUserRole !== 'encargado') {
        mostrarNotificacion('Solo el encargado puede gestionar marcas', 'warning');
        return;
    }
    
    // Recargar marcas desde Supabase para tener datos actualizados
    await recargarMarcas();
    
    marcaEditando = null;
    document.getElementById('inputNombreMarca').value = '';
    document.getElementById('tituloFormMarca').textContent = 'Ô×ò Agregar Marca';
    document.getElementById('textoBotonMarca').textContent = 'Agregar';
    document.getElementById('btnCancelarEditMarca').style.display = 'none';
    
    renderizarListaMarcas();
    
    const modal = document.getElementById('modalMarcas');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

/**
 * Cerrar modal de gestión de marcas
 */
function cerrarModalMarcas() {
    const modal = document.getElementById('modalMarcas');
    modal.style.display = 'none';
    modal.classList.remove('show');
    
    // Limpiar formulario
    document.getElementById('inputNombreMarca').value = '';
    cancelarEditarMarca();
}

/**
 * Renderizar lista de marcas
 */
function renderizarListaMarcas() {
    const lista = document.getElementById('listaMarcas');
    
    if (!marcasActuales || marcasActuales.length === 0) {
        lista.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <p>No hay marcas registradas</p>
                <p style="font-size: 14px; margin-top: 10px;">Agrega la primera marca usando el formulario arriba</p>
            </div>
        `;
        return;
    }
    
    const marcasOrdenadas = [...marcasActuales].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    
    const html = marcasOrdenadas.map((marca, index) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; background: white; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 8px;">
            <div style="flex: 1;">
                <strong style="font-size: 15px;">${marca}</strong>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm btn-primary" onclick="editarMarca('${marca.replace(/'/g, "\\'")}')">
                    Ô£Å´©Å Editar
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarMarca('${marca.replace(/'/g, "\\'")}')">
                    ­ƒùæ´©Å Eliminar
                </button>
            </div>
        </div>
    `).join('');
    
    lista.innerHTML = html;
}

/**
 * Guardar marca (crear o actualizar)
 */
async function guardarMarca() {
    // Validar permisos de administrador
    if (!requireAdminRole('Gestionar marcas')) {
        return;
    }

    const input = document.getElementById('inputNombreMarca');
    const nombreMarca = input.value.trim();
    
    if (!nombreMarca) {
        mostrarNotificacion('Por favor ingresa el nombre de la marca', 'warning');
        input.focus();
        return;
    }
    
    try {
        if (marcaEditando !== null) {
            // Editar marca existente
            if (nombreMarca !== marcaEditando) {
                // Verificar si el nuevo nombre ya existe
                const { data: existente } = await window.supabaseClient
                    .from('marcas')
                    .select('id')
                    .eq('nombre', nombreMarca)
                    .eq('activo', true)
                    .single();
                
                if (existente) {
                    mostrarNotificacion('Ya existe una marca con ese nombre', 'warning');
                    return;
                }
                
                // Actualizar nombre de la marca
                const { error } = await window.supabaseClient
                    .from('marcas')
                    .update({ 
                        nombre: nombreMarca,
                        updated_at: new Date().toISOString()
                    })
                    .eq('nombre', marcaEditando);
                
                if (error) throw error;
            }
            
            mostrarNotificacion('Marca actualizada exitosamente', 'success');
        } else {
            // Agregar nueva marca
            const { error } = await window.supabaseClient
                .from('marcas')
                .insert([{ nombre: nombreMarca }]);
            
            if (error) {
                if (error.code === '23505') { // Duplicate key
                    mostrarNotificacion('Ya existe una marca con ese nombre', 'warning');
                } else {
                    throw error;
                }
                return;
            }
            
            mostrarNotificacion('Marca agregada exitosamente', 'success');
        }
        
        // Recargar lista desde Supabase
        await recargarMarcas();
        renderizarListaMarcas();
        
        // Limpiar formulario
        input.value = '';
        marcaEditando = null;
        document.getElementById('tituloFormMarca').textContent = 'Ô×ò Agregar Marca';
        document.getElementById('textoBotonMarca').textContent = 'Agregar';
        document.getElementById('btnCancelarEditMarca').style.display = 'none';
        
    } catch (error) {
        manejarError(error, {
            contexto: 'guardarMarca',
            mensajeUsuario: 'Error al guardar marca'
        });
    }
}

/**
 * Editar marca existente
 */
function editarMarca(nombreMarca) {
    marcaEditando = nombreMarca;
    
    document.getElementById('inputNombreMarca').value = nombreMarca;
    document.getElementById('tituloFormMarca').textContent = 'Ô£Å´©Å Editar Marca';
    document.getElementById('textoBotonMarca').textContent = 'Guardar Cambios';
    document.getElementById('btnCancelarEditMarca').style.display = 'inline-block';
    
    // Scroll al formulario
    document.getElementById('inputNombreMarca').focus();
}

/**
 * Cancelar edición de marca
 */
function cancelarEditarMarca() {
    marcaEditando = null;
    
    document.getElementById('inputNombreMarca').value = '';
    document.getElementById('tituloFormMarca').textContent = 'Ô×ò Agregar Marca';
    document.getElementById('textoBotonMarca').textContent = 'Agregar';
    document.getElementById('btnCancelarEditMarca').style.display = 'none';
}

/**
 * Eliminar marca (desactivar)
 */
async function eliminarMarca(nombreMarca) {
    // Validar permisos de administrador
    if (!requireAdminRole('Eliminar marcas')) {
        return;
    }

    if (!confirm(`¿Estás seguro de eliminar la marca "${nombreMarca}"?\n\nEsta acción no afectará los productos existentes.`)) {
        return;
    }
    
    try {
        // Desactivar marca (soft delete)
        const { error } = await window.supabaseClient
            .from('marcas')
            .update({ 
                activo: false,
                updated_at: new Date().toISOString()
            })
            .eq('nombre', nombreMarca);
        
        if (error) throw error;
        
        // Recargar lista desde Supabase
        await recargarMarcas();
        renderizarListaMarcas();
        
        mostrarNotificacion('Marca eliminada exitosamente', 'success');
        
    } catch (error) {
        manejarError(error, {
            contexto: 'eliminarMarca',
            mensajeUsuario: 'Error al eliminar marca'
        });
    }
}

// ===================================
// MODAL NUEVO PRODUCTO (Encargado)
// ===================================

function abrirModalNuevo(codigoBarra) {
    cerrarEscaner();

    document.getElementById('nuevoCodigoBarra').value = codigoBarra;
    document.getElementById('nuevoNombre').value = '';
    document.getElementById('nuevoMarca').value = '';
    document.getElementById('nuevoPrecio').value = '';
    document.getElementById('nuevoStock').value = '';

    const modal = document.getElementById('modalNuevoProducto');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

function cerrarModalNuevo() {
    const modal = document.getElementById('modalNuevoProducto');
    modal.style.display = 'none';
    modal.classList.remove('show');
}

async function guardarNuevoProducto() {
    const codigoBarra = document.getElementById('nuevoCodigoBarra').value;
    const nombre = document.getElementById('nuevoNombre').value;
    const marca = document.getElementById('nuevoMarca').value;
    const proveedor = document.getElementById('nuevoProveedor').value;
    const categoria = document.getElementById('nuevoCategoria').value;
    const precio = parseFloat(document.getElementById('nuevoPrecio').value);
    const stock = parseFloat(document.getElementById('nuevoStock').value);
    const stockMin = parseFloat(document.getElementById('nuevoStockMin').value);

    if (!nombre || !marca || isNaN(precio) || isNaN(stock)) {
        mostrarNotificacion('Completa todos los campos obligatorios', 'error');
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('productos')
            .insert([{
                codigo_barras: codigoBarra,
                nombre: nombre,
                marca: marca,
                proveedor: proveedor || null,
                categoria: categoria,
                precio: precio,
                stock: stock,
                stock_minimo: stockMin,
                tipo: 'unidad'
            }])
            .select();

        if (error) throw error;

        mostrarNotificacion('Ô£à Producto registrado exitosamente', 'success');
        cerrarModalNuevo();
        await cargarProductos();

    } catch (error) {
        manejarError(error, {
            contexto: 'guardarNuevoProducto',
            mensajeUsuario: error.code === '23505' 
                ? 'Este código de barras ya existe' 
                : 'Error al registrar producto'
        });
    }
}

// ===================================
// ASIGNAR CÓDIGOS DE BARRAS
// ===================================

let productoSeleccionado = null; // Producto al que se asignará el código
let productosSinCodigo = [];

async function cargarProductosSinCodigo() {
    try {
        console.log('­ƒôª Cargando productos sin código de barras...');

        const { data, error } = await window.supabaseClient
            .from('productos')
            .select('*')
            .or('codigo_barras.is.null,codigo_barras.eq.')
            .order('nombre')
            .limit(5000);

        if (error) throw error;

        productosSinCodigo = data;
        console.log(`Ô£à Encontrados ${productosSinCodigo.length} productos sin código`);

        renderProductosSinCodigo(productosSinCodigo);

    } catch (error) {
        manejarError(error, {
            contexto: 'cargarProductosSinCodigo',
            mensajeUsuario: 'Error cargando productos'
        });
    }
}

function renderProductosSinCodigo(productos) {
    const container = document.getElementById('listaProductosAsignar');

    if (productos.length === 0) {
        container.innerHTML = `
            <div class="alert-info" style="padding: 24px; text-align: center;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 12px; opacity: 0.5;">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <h3 style="margin-bottom: 8px;">¡Todos los productos tienen código!</h3>
                <p>No hay productos sin código de barras asignado.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = productos.map(p => `
        <div class="product-row" style="display: flex; align-items: center; gap: 16px; padding: 16px; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 12px; cursor: pointer; transition: all 0.2s;" onclick="seleccionarProductoParaCodigo(${p.id})">
            <div style="flex: 1;">
                <h4 style="font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">${p.nombre}</h4>
                <p style="font-size: 13px; color: hsl(var(--muted-foreground)); margin: 0;">
                    ${p.marca} ÔÇó ${p.categoria} ÔÇó Stock: ${p.stock}
                </p>
            </div>
            <button class="btn-primary" style="padding: 10px 20px; white-space: nowrap;" onclick="event.stopPropagation(); seleccionarProductoParaCodigo(${p.id})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="margin-right: 6px;">
                    <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M7 9h2M7 12h2M7 15h2M11 9h6M11 12h6M11 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                Asignar Código
            </button>
        </div>
    `).join('');
}

function filtrarProductosAsignar() {
    const query = document.getElementById('buscarAsignar').value.toLowerCase();

    const filtrados = productosSinCodigo.filter(p =>
        p.nombre.toLowerCase().includes(query) ||
        p.marca.toLowerCase().includes(query) ||
        p.categoria.toLowerCase().includes(query)
    );

    renderProductosSinCodigo(filtrados);
}

function seleccionarProductoParaCodigo(productoId) {
    productoSeleccionado = productosSinCodigo.find(p => p.id === productoId);

    if (!productoSeleccionado) {
        mostrarNotificacion('Error seleccionando producto', 'error');
        return;
    }

    console.log('­ƒô▒ Producto seleccionado:', productoSeleccionado.nombre);

    // Abrir escáner en modo asignación
    abrirEscanerAsignacion();
}

function abrirEscanerAsignacion() {
    const modal = document.getElementById('modalEscaner');
    const rolMensaje = document.getElementById('rolMensaje');

    rolMensaje.innerHTML = `
        <strong>­ƒÄ» Asignando código a:</strong><br>
        <span style="font-size: 16px; color: hsl(var(--primary));">${productoSeleccionado.nombre}</span><br>
        <small style="opacity: 0.7;">Escanea el código de barras del producto físico</small>
    `;

    modal.style.display = 'flex';
    modal.classList.add('show');

    // Iniciar escáner en modo asignación
    iniciarEscanerAsignacion();
}

function iniciarEscanerAsignacion() {
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777778,
        videoConstraints: {
            facingMode: "environment"
        }
    };

    html5QrCode = new Html5Qrcode("reader");

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
            console.log(`Ô£à Código escaneado: ${decodedText}`);
            asignarCodigoAProducto(decodedText);
        },
        (errorMessage) => {
            // Errores normales de escaneo
        }
    ).catch((err) => {
        console.error('ÔØî Error iniciando escáner:', err);
        mostrarNotificacion('Error al acceder a la cámara', 'error');
    });
}

async function asignarCodigoAProducto(codigoBarra) {
    // Detener escáner
    await detenerEscaner();
    reproducirBeep();

    if (!productoSeleccionado) {
        mostrarNotificacion('Error: No hay producto seleccionado', 'error');
        cerrarEscaner();
        return;
    }

    try {
        // Verificar si el código ya existe
        const { data: existente } = await window.supabaseClient
            .from('productos')
            .select('nombre')
            .eq('codigo_barras', codigoBarra)
            .single();

        if (existente) {
            mostrarNotificacion(`ÔÜá´©Å Este código ya está asignado a: ${existente.nombre}`, 'error');
            cerrarEscaner();
            return;
        }

        // Asignar código al producto
        const { error } = await window.supabaseClient
            .from('productos')
            .update({ codigo_barras: codigoBarra })
            .eq('id', productoSeleccionado.id);

        if (error) throw error;

        mostrarNotificacion(`Ô£à Código asignado a ${productoSeleccionado.nombre}`, 'success');

        cerrarEscaner();

        // Recargar lista
        await cargarProductosSinCodigo();

        productoSeleccionado = null;

    } catch (error) {
        manejarError(error, {
            contexto: 'asignarCodigoAProducto',
            mensajeUsuario: 'Error al asignar código',
            callback: () => cerrarEscaner()
        });
    }
}

// ===================================
// DASHBOARD Y GRÁFICOS
// ===================================
// Chart variables are now declared globally near the top of the file

// ===================================
// GESTIÓN MASIVA DE PRECIOS
// ===================================
// (Funciones eliminadas: modal de administración de precios no se utiliza)

// ==========================================
// SISTEMA DE ASISTENCIA
// ==========================================

// Cargar estado actual de asistencia del usuario
async function cargarEstadoActual() {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        const { data, error } = await window.supabaseClient
            .from('asistencias')
            .select('*')
            .eq('username', currentUser)
            .eq('fecha', hoy)
            .single();

        const estadoContent = document.getElementById('estadoContent');

        if (error && error.code !== 'PGRST116') { // PGRST116 es "no rows returned"
            throw error;
        }

        if (!data) {
            // No hay registro de hoy
            estadoContent.innerHTML = `
                <div style="text-align: center; color: hsl(var(--muted-foreground));">
                    <p style="margin: 0;">No has marcado entrada hoy</p>
                    <p style="margin: 8px 0 0 0; font-size: 14px;">Presiona "Marcar Entrada" para comenzar</p>
                </div>
            `;
            actualizarBotonesAsistencia(null);
            return;
        }

        // Formatear horas
        const formatHora = (timestamp) => {
            if (!timestamp) return '-';
            return new Date(timestamp).toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Santiago'
            });
        };

        const horasTrabajadas = data.horas_trabajadas ?
            `${Math.floor(data.horas_trabajadas)}h ${Math.round((data.horas_trabajadas % 1) * 60)}m` :
            'Calculando...';

        let estadoTexto = '';
        let estadoColor = '';

        if (data.estado === 'Completo') {
            estadoTexto = 'Ô£à Jornada Completa';
            estadoColor = 'hsl(var(--success))';
        } else if (data.estado === 'En almuerzo') {
            estadoTexto = '­ƒì¢´©Å En Almuerzo';
            estadoColor = 'hsl(var(--warning))';
        } else if (data.estado === 'Trabajando') {
            estadoTexto = '­ƒƒó Trabajando';
            estadoColor = 'hsl(var(--success))';
        } else {
            estadoTexto = 'ÔÜá´©Å Incompleto';
            estadoColor = 'hsl(var(--destructive))';
        }

        estadoContent.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
                <div>
                    <div style="font-size: 12px; color: hsl(var(--muted-foreground)); margin-bottom: 4px;">Entrada</div>
                    <div style="font-size: 20px; font-weight: 600;">${formatHora(data.hora_entrada)}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: hsl(var(--muted-foreground)); margin-bottom: 4px;">Inicio Almuerzo</div>
                    <div style="font-size: 20px; font-weight: 600;">${formatHora(data.hora_inicio_almuerzo)}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: hsl(var(--muted-foreground)); margin-bottom: 4px;">Fin Almuerzo</div>
                    <div style="font-size: 20px; font-weight: 600;">${formatHora(data.hora_fin_almuerzo)}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: hsl(var(--muted-foreground)); margin-bottom: 4px;">Salida</div>
                    <div style="font-size: 20px; font-weight: 600;">${formatHora(data.hora_salida)}</div>
                </div>
            </div>
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid hsl(var(--border)); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 12px; color: hsl(var(--muted-foreground));">Horas Trabajadas</div>
                    <div style="font-size: 24px; font-weight: 700; color: hsl(var(--primary));">${horasTrabajadas}</div>
                </div>
                <div style="padding: 8px 16px; background: ${estadoColor}15; border: 1px solid ${estadoColor}; border-radius: 8px; color: ${estadoColor}; font-weight: 600;">
                    ${estadoTexto}
                </div>
            </div>
        `;

        actualizarBotonesAsistencia(data);

    } catch (error) {
        manejarError(error, {
            contexto: 'cargarEstadoAsistencia',
            mensajeUsuario: 'Error al cargar el estado',
            mostrarNotificacion: false,
            callback: () => {
                document.getElementById('estadoContent').innerHTML = `
                    <div style="text-align: center; color: hsl(var(--destructive));">
                        <p style="margin: 0;">Error al cargar el estado</p>
                    </div>
                `;
            }
        });
    }
}

// Actualizar estado de botones según el registro actual
function actualizarBotonesAsistencia(data) {
    const btnEntrada = document.getElementById('btnMarcarEntrada');
    const btnInicioAlmuerzo = document.getElementById('btnIniciarAlmuerzo');
    const btnFinAlmuerzo = document.getElementById('btnTerminarAlmuerzo');
    const btnSalida = document.getElementById('btnMarcarSalida');

    if (!data) {
        // No hay registro, solo permitir marcar entrada
        btnEntrada.disabled = false;
        btnInicioAlmuerzo.disabled = true;
        btnFinAlmuerzo.disabled = true;
        btnSalida.disabled = true;
        return;
    }

    // Ya marcó entrada
    btnEntrada.disabled = true;

    // Puede iniciar almuerzo si no lo ha hecho
    btnInicioAlmuerzo.disabled = !!data.hora_inicio_almuerzo;

    // Puede terminar almuerzo si ya lo inició y no lo ha terminado
    btnFinAlmuerzo.disabled = !data.hora_inicio_almuerzo || !!data.hora_fin_almuerzo;

    // Puede marcar salida si ya terminó almuerzo (o si nunca almorzó) y no ha marcado salida
    btnSalida.disabled = (!data.hora_fin_almuerzo && data.hora_inicio_almuerzo) || !!data.hora_salida;
}

// Marcar evento de asistencia
async function marcarEvento(tipo) {
    try {
        const ahora = new Date();
        const hoy = ahora.toISOString().split('T')[0];
        const horaActual = ahora.toISOString();

        // Obtener registro actual del día
        const { data: registroActual, error: errorCheck } = await window.supabaseClient
            .from('asistencias')
            .select('*')
            .eq('username', currentUser)
            .eq('fecha', hoy)
            .single();

        if (errorCheck && errorCheck.code !== 'PGRST116') {
            throw errorCheck;
        }

        let mensaje = '';
        let updateData = {};

        if (tipo === 'entrada') {
            if (registroActual) {
                mostrarNotificacion('Ya marcaste entrada hoy', 'warning');
                return;
            }

            // Obtener usuario_id
            const { data: userData } = await window.supabaseClient
                .from('usuarios')
                .select('id')
                .eq('username', currentUser)
                .single();

            // Crear nuevo registro
            const { error } = await window.supabaseClient
                .from('asistencias')
                .insert({
                    usuario_id: userData.id,
                    username: currentUser,
                    fecha: hoy,
                    hora_entrada: horaActual
                });

            if (error) throw error;
            mensaje = 'Entrada marcada correctamente';

        } else {
            if (!registroActual) {
                mostrarNotificacion('Debes marcar entrada primero', 'warning');
                return;
            }

            switch(tipo) {
                case 'inicio_almuerzo':
                    if (registroActual.hora_inicio_almuerzo) {
                        mostrarNotificacion('Ya iniciaste almuerzo', 'warning');
                        return;
                    }
                    updateData = { hora_inicio_almuerzo: horaActual };
                    mensaje = 'Inicio de almuerzo marcado';
                    break;

                case 'fin_almuerzo':
                    if (!registroActual.hora_inicio_almuerzo) {
                        mostrarNotificacion('Debes iniciar almuerzo primero', 'warning');
                        return;
                    }
                    if (registroActual.hora_fin_almuerzo) {
                        mostrarNotificacion('Ya terminaste el almuerzo', 'warning');
                        return;
                    }
                    updateData = { hora_fin_almuerzo: horaActual };
                    mensaje = 'Fin de almuerzo marcado';
                    break;

                case 'salida':
                    if (registroActual.hora_inicio_almuerzo && !registroActual.hora_fin_almuerzo) {
                        mostrarNotificacion('Debes terminar el almuerzo primero', 'warning');
                        return;
                    }
                    if (registroActual.hora_salida) {
                        mostrarNotificacion('Ya marcaste salida', 'warning');
                        return;
                    }
                    updateData = { hora_salida: horaActual };
                    mensaje = 'Salida marcada correctamente';
                    break;
            }

            const { error } = await window.supabaseClient
                .from('asistencias')
                .update(updateData)
                .eq('id', registroActual.id);

            if (error) throw error;
        }

        mostrarNotificacion(mensaje, 'success');
        cargarEstadoActual();
        cargarAsistencias();

    } catch (error) {
        manejarError(error, {
            contexto: 'marcarEvento',
            mensajeUsuario: 'Error al registrar la acción'
        });
    }
}

// Cargar historial de asistencias
async function cargarAsistencias() {
    try {
        const tbody = document.getElementById('tablaAsistencias');
        tbody.innerHTML = '<tr><td colspan="9" class="text-center"><div class="spinner"></div></td></tr>';

        let query = window.supabaseClient
            .from('asistencias')
            .select('*')
            .order('fecha', { ascending: false })
            .order('hora_entrada', { ascending: false });

        // Si es vendedor, solo mostrar sus registros
        if (currentUserRole === 'vendedor') {
            query = query.eq('username', currentUser);
        } else {
            // Si es admin, aplicar filtros
            const filtroVendedor = document.getElementById('filtroVendedor')?.value;
            const filtroFecha = document.getElementById('filtroFecha')?.value;

            if (filtroVendedor) {
                query = query.eq('username', filtroVendedor);
            }
            if (filtroFecha) {
                query = query.eq('fecha', filtroFecha);
            }
        }

        const { data, error } = await query;

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center" style="padding: 40px; color: hsl(var(--muted-foreground));">
                        No hay registros de asistencia
                    </td>
                </tr>
            `;
            return;
        }

        const formatHora = (timestamp) => {
            if (!timestamp) return '<span style="color: hsl(var(--muted-foreground));">-</span>';
            return new Date(timestamp).toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Santiago'
            });
        };

        const formatFecha = (fecha) => {
            return new Date(fecha + 'T00:00:00').toLocaleDateString('es-CL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        };

        tbody.innerHTML = data.map(registro => {
            const horasTrabajadas = registro.horas_trabajadas ?
                `${Math.floor(registro.horas_trabajadas)}h ${Math.round((registro.horas_trabajadas % 1) * 60)}m` :
                '-';

            let estadoBadge = '';
            if (registro.estado === 'Completo') {
                estadoBadge = '<span class="status-badge status-completed">Completo</span>';
            } else if (registro.estado === 'En almuerzo') {
                estadoBadge = '<span class="status-badge status-pending">En almuerzo</span>';
            } else if (registro.estado === 'Trabajando') {
                estadoBadge = '<span class="status-badge status-pending">Trabajando</span>';
            } else {
                estadoBadge = '<span class="status-badge status-canceled">Incompleto</span>';
            }

            const btnEditar = currentUserRole === 'encargado' ?
                `<button class="btn-icon" onclick="abrirModalEditarAsistencia(${registro.id})" title="Editar">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M11.3333 2L14 4.66667L4.66667 14H2V11.3333L11.3333 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>` :
                '-';

            return `
                <tr>
                    <td>${formatFecha(registro.fecha)}</td>
                    <td><strong>${registro.username}</strong></td>
                    <td>${formatHora(registro.hora_entrada)}</td>
                    <td>${formatHora(registro.hora_inicio_almuerzo)}</td>
                    <td>${formatHora(registro.hora_fin_almuerzo)}</td>
                    <td>${formatHora(registro.hora_salida)}</td>
                    <td><strong>${horasTrabajadas}</strong></td>
                    <td>${estadoBadge}</td>
                    <td class="text-center">${btnEditar}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        manejarError(error, {
            contexto: 'cargarAsistencias',
            mensajeUsuario: 'Error cargando asistencias',
            mostrarNotificacion: false,
            callback: () => {
                document.getElementById('tablaAsistencias').innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center" style="padding: 40px; color: hsl(var(--destructive));">
                            Error al cargar registros
                        </td>
                    </tr>
                `;
            }
        });
    }
}

// Abrir modal para editar asistencia (solo admin)
async function abrirModalEditarAsistencia(id) {
    // Validar permisos de administrador
    if (!requireAdminRole('Editar asistencias')) {
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('asistencias')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const formatParaInput = (timestamp) => {
            if (!timestamp) return '';
            // Convertir a hora local en formato HH:MM
            const date = new Date(timestamp);
            return date.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Santiago'
            });
        };

        const modalHTML = `
            <div class="modal-overlay" id="modalEditarAsistencia" onclick="cerrarModalEditarAsistencia()">
                <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>Ô£Å´©Å Editar Asistencia</h3>
                        <button class="modal-close" onclick="cerrarModalEditarAsistencia()">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="background: hsl(var(--muted)); padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                            <strong>${data.username}</strong> - ${new Date(data.fecha + 'T00:00:00').toLocaleDateString('es-CL')}
                        </div>
                        <div class="form-group">
                            <label>Hora de Entrada</label>
                            <input type="time" id="editEntrada" class="form-input" value="${formatParaInput(data.hora_entrada)}">
                        </div>
                        <div class="form-group">
                            <label>Inicio Almuerzo</label>
                            <input type="time" id="editInicioAlmuerzo" class="form-input" value="${formatParaInput(data.hora_inicio_almuerzo)}">
                        </div>
                        <div class="form-group">
                            <label>Fin Almuerzo</label>
                            <input type="time" id="editFinAlmuerzo" class="form-input" value="${formatParaInput(data.hora_fin_almuerzo)}">
                        </div>
                        <div class="form-group">
                            <label>Hora de Salida</label>
                            <input type="time" id="editSalida" class="form-input" value="${formatParaInput(data.hora_salida)}">
                        </div>
                        <div class="form-group">
                            <label>Notas</label>
                            <textarea id="editNotas" class="form-input" rows="3" placeholder="Agregar nota sobre la edición...">${data.notas || ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="cerrarModalEditarAsistencia()">Cancelar</button>
                        <button class="btn btn-primary" onclick="guardarEdicionAsistencia(${id}, '${data.fecha}')">Guardar Cambios</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

    } catch (error) {
        manejarError(error, {
            contexto: 'abrirModalEditarAsistencia',
            mensajeUsuario: 'Error al cargar los datos'
        });
    }
}

function cerrarModalEditarAsistencia() {
    const modal = document.getElementById('modalEditarAsistencia');
    if (modal) modal.remove();
}

async function guardarEdicionAsistencia(id, fecha) {
    try {
        const entrada = document.getElementById('editEntrada').value;
        const inicioAlmuerzo = document.getElementById('editInicioAlmuerzo').value;
        const finAlmuerzo = document.getElementById('editFinAlmuerzo').value;
        const salida = document.getElementById('editSalida').value;
        const notas = document.getElementById('editNotas').value;

        // Construir timestamps completos
        const construirTimestamp = (hora) => {
            if (!hora) return null;
            return `${fecha}T${hora}:00-03:00`; // -03:00 es timezone de Chile
        };

        const updateData = {
            hora_entrada: entrada ? construirTimestamp(entrada) : null,
            hora_inicio_almuerzo: inicioAlmuerzo ? construirTimestamp(inicioAlmuerzo) : null,
            hora_fin_almuerzo: finAlmuerzo ? construirTimestamp(finAlmuerzo) : null,
            hora_salida: salida ? construirTimestamp(salida) : null,
            notas: notas || null,
            editado_por: currentUser
        };

        const { error } = await window.supabaseClient
            .from('asistencias')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;

        mostrarNotificacion('Asistencia actualizada correctamente', 'success');
        cerrarModalEditarAsistencia();
        
        // Limpiar filtros para mostrar todos los registros después de editar
        const filtroVendedor = document.getElementById('filtroVendedor');
        const filtroFecha = document.getElementById('filtroFecha');
        if (filtroVendedor) filtroVendedor.value = '';
        if (filtroFecha) filtroFecha.value = '';
        
        cargarAsistencias();

        // Si estamos editando el día actual del usuario logueado, actualizar estado
        const hoy = new Date().toISOString().split('T')[0];
        if (fecha === hoy) {
            cargarEstadoActual();
        }

    } catch (error) {
        manejarError(error, {
            contexto: 'guardarEdicionAsistencia',
            mensajeUsuario: 'Error al guardar los cambios'
        });
    }
}

// Verificar si olvidó marcar salida antes de cerrar sesión
async function verificarSalidaPendiente() {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        const { data, error } = await window.supabaseClient
            .from('asistencias')
            .select('hora_salida')
            .eq('username', currentUser)
            .eq('fecha', hoy)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // Si hay registro y no marcó salida, preguntar
        if (data && !data.hora_salida) {
            return confirm('ÔÜá´©Å No has marcado tu hora de salida.\n\n¿Deseas marcarla ahora antes de cerrar sesión?');
        }

        return false;

    } catch (error) {
        manejarError(error, {
            contexto: 'verificarSalidaPendiente',
            mensajeUsuario: 'Error verificando salida',
            mostrarNotificacion: false
        });
        return false;
    }
}

// Marcar entrada automática al iniciar sesión
async function marcarEntradaAutomatica() {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        // Verificar si ya marcó entrada hoy
        const { data: registroExistente, error: errorCheck } = await window.supabaseClient
            .from('asistencias')
            .select('hora_entrada')
            .eq('username', currentUser)
            .eq('fecha', hoy)
            .single();

        // Si ya existe registro, no hacer nada
        if (registroExistente) {
            console.log('ÔÅ░ Ya hay registro de entrada para hoy');
            return;
        }

        // Si el error es diferente a "no hay filas", lanzar error
        if (errorCheck && errorCheck.code !== 'PGRST116') {
            throw errorCheck;
        }

        // Obtener usuario_id
        const { data: userData, error: userError } = await window.supabaseClient
            .from('usuarios')
            .select('id')
            .eq('username', currentUser)
            .single();

        if (userError) throw userError;

        // Crear registro de entrada
        const ahora = new Date().toISOString();
        const { error } = await window.supabaseClient
            .from('asistencias')
            .insert({
                usuario_id: userData.id,
                username: currentUser,
                fecha: hoy,
                hora_entrada: ahora
            });

        if (error) throw error;

        console.log('Ô£à Entrada marcada automáticamente');

    } catch (error) {
        manejarError(error, {
            contexto: 'marcarEntradaAutomatica',
            mensajeUsuario: 'Error marcando entrada automática',
            mostrarNotificacion: false // No molestar al usuario durante el login
        });
    }
}

// Cargar lista de vendedores para filtro (solo admin)
async function cargarVendedoresParaFiltro() {
    try {
        const { data, error } = await window.supabaseClient
            .from('usuarios')
            .select('username')
            .eq('activo', true)
            .order('username');

        if (error) throw error;

        const select = document.getElementById('filtroVendedor');
        if (!select) return;

        // Mantener la opción "Todos"
        select.innerHTML = '<option value="">Todos los vendedores</option>';

        data.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            select.appendChild(option);
        });

    } catch (error) {
        manejarError(error, {
            contexto: 'cargarVendedoresParaFiltro',
            mensajeUsuario: 'Error cargando vendedores para filtro',
            mostrarNotificacion: false
        });
    }
}

// ===================================
// CONTROL DE ASISTENCIA POR ADMIN
// ===================================

/**
 * Cargar usuarios disponibles para control de admin
 */
async function cargarUsuariosParaAdmin() {
    try {
        const { data, error } = await window.supabaseClient
            .from('usuarios')
            .select('username, nombre_completo')
            .eq('activo', true)
            .order('username');

        if (error) throw error;

        const select = document.getElementById('adminSelectUsuario');
        if (!select) return;

        // Limpiar y agregar opción por defecto
        select.innerHTML = '<option value="">-- Selecciona un empleado --</option>';

        data.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.nombre_completo || user.username;
            select.appendChild(option);
        });

    } catch (error) {
        manejarError(error, {
            contexto: 'cargarUsuariosParaAdmin',
            mensajeUsuario: 'Error cargando lista de empleados'
        });
    }
}

/**
 * Cargar estado del usuario seleccionado por el admin
 */
async function cargarEstadoUsuarioAdmin() {
    try {
        const select = document.getElementById('adminSelectUsuario');
        const username = select?.value;
        
        const estadoDiv = document.getElementById('adminEstadoUsuario');
        const contentDiv = document.getElementById('adminEstadoContent');
        const botonesDiv = document.getElementById('adminBotonesControl');

        if (!username) {
            estadoDiv.style.display = 'none';
            botonesDiv.style.display = 'none';
            return;
        }

        // Mostrar estado y botones
        estadoDiv.style.display = 'block';
        botonesDiv.style.display = 'block';

        const hoy = new Date().toISOString().split('T')[0];

        const { data, error } = await window.supabaseClient
            .from('asistencias')
            .select('*')
            .eq('username', username)
            .eq('fecha', hoy)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        const formatHora = (timestamp) => {
            if (!timestamp) return '-';
            return new Date(timestamp).toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Santiago'
            });
        };

        if (!data) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 12px; color: hsl(var(--muted-foreground));">
                    <p style="margin: 0; font-size: 14px;">No ha marcado entrada hoy</p>
                </div>
            `;
            actualizarBotonesAsistenciaAdmin(null);
            return;
        }

        const horasTrabajadas = data.horas_trabajadas ?
            `${Math.floor(data.horas_trabajadas)}h ${Math.round((data.horas_trabajadas % 1) * 60)}m` :
            'Calculando...';

        let estadoTexto = '';
        let estadoColor = '';

        if (data.estado === 'Completo') {
            estadoTexto = 'Ô£à Jornada Completa';
            estadoColor = 'hsl(var(--success))';
        } else if (data.estado === 'En almuerzo') {
            estadoTexto = '­ƒì¢´©Å En Almuerzo';
            estadoColor = 'hsl(var(--warning))';
        } else if (data.estado === 'Trabajando') {
            estadoTexto = '­ƒƒó Trabajando';
            estadoColor = 'hsl(var(--success))';
        } else {
            estadoTexto = 'ÔÜá´©Å Incompleto';
            estadoColor = 'hsl(var(--destructive))';
        }

        contentDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px;">
                <div>
                    <div style="font-size: 11px; color: hsl(var(--muted-foreground)); margin-bottom: 2px;">Entrada</div>
                    <div style="font-size: 16px; font-weight: 600;">${formatHora(data.hora_entrada)}</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: hsl(var(--muted-foreground)); margin-bottom: 2px;">Salida</div>
                    <div style="font-size: 16px; font-weight: 600;">${formatHora(data.hora_salida)}</div>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid hsl(var(--border));">
                <div>
                    <div style="font-size: 11px; color: hsl(var(--muted-foreground));">Horas</div>
                    <div style="font-size: 18px; font-weight: 700; color: hsl(var(--primary));">${horasTrabajadas}</div>
                </div>
                <div style="padding: 6px 12px; background: ${estadoColor}15; border: 1px solid ${estadoColor}; border-radius: 6px; color: ${estadoColor}; font-weight: 600; font-size: 13px;">
                    ${estadoTexto}
                </div>
            </div>
        `;

        actualizarBotonesAsistenciaAdmin(data);

    } catch (error) {
        manejarError(error, {
            contexto: 'cargarEstadoUsuarioAdmin',
            mensajeUsuario: 'Error al cargar estado',
            mostrarNotificacion: false,
            callback: () => {
                document.getElementById('adminEstadoContent').innerHTML = `
                    <div style="text-align: center; color: hsl(var(--destructive)); padding: 12px;">
                        <p style="margin: 0; font-size: 13px;">Error al cargar estado</p>
                    </div>
                `;
            }
        });
    }
}

/**
 * Actualizar estado de botones de admin según el registro del usuario
 */
function actualizarBotonesAsistenciaAdmin(data) {
    const btnEntrada = document.getElementById('adminBtnEntrada');
    const btnInicioAlmuerzo = document.getElementById('adminBtnInicioAlmuerzo');
    const btnFinAlmuerzo = document.getElementById('adminBtnFinAlmuerzo');
    const btnSalida = document.getElementById('adminBtnSalida');

    if (!data) {
        btnEntrada.disabled = false;
        btnInicioAlmuerzo.disabled = true;
        btnFinAlmuerzo.disabled = true;
        btnSalida.disabled = true;
        return;
    }

    btnEntrada.disabled = true;
    btnInicioAlmuerzo.disabled = !!data.hora_inicio_almuerzo;
    btnFinAlmuerzo.disabled = !data.hora_inicio_almuerzo || !!data.hora_fin_almuerzo;
    btnSalida.disabled = (!data.hora_fin_almuerzo && data.hora_inicio_almuerzo) || !!data.hora_salida;
}

/**
 * Marcar evento de asistencia para otro usuario (solo admin)
 */
async function marcarEventoAdmin(tipo) {
    try {
        // Verificar que sea encargado
        if (currentUserRole !== 'encargado') {
            mostrarNotificacion('Solo el encargado puede realizar esta acción', 'error');
            return;
        }

        const select = document.getElementById('adminSelectUsuario');
        const targetUsername = select?.value;

        if (!targetUsername) {
            mostrarNotificacion('Selecciona un empleado primero', 'warning');
            return;
        }

        const confirmacion = confirm(
            `¿Marcar ${tipo.replace('_', ' ')} para ${targetUsername}?\n\n` +
            'Esta acción se registrará con la hora actual.'
        );

        if (!confirmacion) return;

        const ahora = new Date();
        const hoy = ahora.toISOString().split('T')[0];
        const horaActual = ahora.toISOString();

        // Obtener usuario_id del empleado
        const { data: userData, error: userError } = await window.supabaseClient
            .from('usuarios')
            .select('id')
            .eq('username', targetUsername)
            .single();

        if (userError) throw userError;

        // Obtener registro actual del día
        const { data: registroActual, error: errorCheck } = await window.supabaseClient
            .from('asistencias')
            .select('*')
            .eq('username', targetUsername)
            .eq('fecha', hoy)
            .single();

        if (errorCheck && errorCheck.code !== 'PGRST116') {
            throw errorCheck;
        }

        let updateData = {};
        let mensaje = '';

        if (tipo === 'entrada') {
            if (registroActual) {
                mostrarNotificacion(`${targetUsername} ya marcó entrada hoy`, 'warning');
                return;
            }

            const { error } = await window.supabaseClient
                .from('asistencias')
                .insert({
                    usuario_id: userData.id,
                    username: targetUsername,
                    fecha: hoy,
                    hora_entrada: horaActual
                });

            if (error) throw error;
            mensaje = `Ô£à Entrada marcada para ${targetUsername}`;

        } else {
            if (!registroActual) {
                mostrarNotificacion(`${targetUsername} debe marcar entrada primero`, 'warning');
                return;
            }

            switch(tipo) {
                case 'inicio_almuerzo':
                    if (registroActual.hora_inicio_almuerzo) {
                        mostrarNotificacion(`${targetUsername} ya inició almuerzo`, 'warning');
                        return;
                    }
                    updateData = { hora_inicio_almuerzo: horaActual };
                    mensaje = `Ô£à Inicio de almuerzo marcado para ${targetUsername}`;
                    break;

                case 'fin_almuerzo':
                    if (!registroActual.hora_inicio_almuerzo) {
                        mostrarNotificacion(`${targetUsername} debe iniciar almuerzo primero`, 'warning');
                        return;
                    }
                    if (registroActual.hora_fin_almuerzo) {
                        mostrarNotificacion(`${targetUsername} ya terminó el almuerzo`, 'warning');
                        return;
                    }
                    updateData = { hora_fin_almuerzo: horaActual };
                    mensaje = `Ô£à Fin de almuerzo marcado para ${targetUsername}`;
                    break;

                case 'salida':
                    if (registroActual.hora_inicio_almuerzo && !registroActual.hora_fin_almuerzo) {
                        mostrarNotificacion(`${targetUsername} debe terminar el almuerzo primero`, 'warning');
                        return;
                    }
                    if (registroActual.hora_salida) {
                        mostrarNotificacion(`${targetUsername} ya marcó salida`, 'warning');
                        return;
                    }
                    updateData = { hora_salida: horaActual };
                    mensaje = `Ô£à Salida marcada para ${targetUsername}`;
                    break;
            }

            const { error } = await window.supabaseClient
                .from('asistencias')
                .update(updateData)
                .eq('id', registroActual.id);

            if (error) throw error;
        }

        mostrarNotificacion(mensaje, 'success');
        cargarEstadoUsuarioAdmin();
        cargarAsistencias();

    } catch (error) {
        manejarError(error, {
            contexto: 'marcarEventoParaUsuario',
            mensajeUsuario: 'Error al registrar la acción'
        });
    }
}

// ===================================
// MÓDULO: SENCILLO INICIAL Y GASTOS FIJOS
// ===================================

/**
 * Cargar sencillo inicial del día desde localStorage
 */
function cargarSencilloInicial() {
    const hoy = new Date().toISOString().split('T')[0];
    const key = `sencillo_inicial_${hoy}`;
    const guardado = localStorage.getItem(key);
    
    sencilloInicial = guardado ? parseFloat(guardado) : 0;
    document.getElementById('sencilloInicial').textContent = '$' + formatoMoneda(sencilloInicial);
    
    console.log(`­ƒÆÁ Sencillo inicial cargado: $${formatoMoneda(sencilloInicial)}`);
}

/**
 * Editar sencillo inicial
 */
async function editarSencilloInicial() {
    const montoActual = sencilloInicial;
    const nuevoMonto = prompt(`Ingresa el sencillo inicial del día:\n\nActual: $${formatoMoneda(montoActual)}`, montoActual);
    
    if (nuevoMonto === null) return; // Cancelado
    
    const monto = parseFloat(nuevoMonto);
    
    if (isNaN(monto) || monto < 0) {
        mostrarNotificacion('Monto inválido', 'warning');
        return;
    }
    
    // Guardar en localStorage
    const hoy = new Date().toISOString().split('T')[0];
    const key = `sencillo_inicial_${hoy}`;
    localStorage.setItem(key, monto.toString());
    
    sencilloInicial = monto;
    document.getElementById('sencilloInicial').textContent = '$' + formatoMoneda(sencilloInicial);
    
    mostrarNotificacion('Ô£à Sencillo inicial actualizado', 'success');
    console.log(`­ƒÆÁ Sencillo inicial actualizado: $${formatoMoneda(sencilloInicial)}`);
}

// ===================================
// MÓDULO: DEVOLUCIONES DE PRODUCTOS
// ===================================

// Variables globales para devoluciones
let ventaDevolucion = null;
let productosDevolucion = [];

function esProductoGranelDevolucion(producto) {
    if (!producto) return false;

    if (producto.es_granel === true || producto.esGranel === true) {
        return true;
    }

    const nombre = (producto.producto_nombre || producto.nombre || '').toString().toLowerCase();
    const categoria = (producto.categoria || '').toString().toLowerCase();

    return nombre.includes('granel') || categoria.includes('granel');
}

/**
 * Abrir modal de devolución para una venta específica
 */
async function abrirModalDevolucion(ventaId) {
    try {
        // Validar permisos de administrador
        if (!requireAdminRole('Procesar devoluciones')) {
            return;
        }
        
        console.log('­ƒöä Abriendo modal de devolución para venta:', ventaId);
        
        // Cargar detalles de la venta
        const { data: venta, error: errorVenta } = await window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('id', ventaId)
            .single();
        
        if (errorVenta) throw errorVenta;
        
        if (!venta) {
            mostrarNotificacion('Venta no encontrada', 'error');
            return;
        }
        
        // Cargar items de la venta
        const { data: items, error: errorItems } = await window.supabaseClient
            .from('ventas_items')
            .select('*')
            .eq('venta_id', ventaId);
        
        if (errorItems) throw errorItems;
        
        if (!items || items.length === 0) {
            mostrarNotificacion('Esta venta no tiene productos registrados', 'warning');
            return;
        }
        
        // Guardar en variables globales
        ventaDevolucion = venta;
        productosDevolucion = items.map(item => ({
            ...item,
            cantidad_devolucion: 0,
            seleccionado: false
        }));
        
        // Mostrar modal PRIMERO
        const modal = document.getElementById('modalDevolucion');
        if (!modal) {
            console.error('ÔØî Modal de devolución no encontrado en el DOM');
            mostrarNotificacion('Error: Modal no disponible', 'error');
            return;
        }
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
        
        // LUEGO actualizar UI del modal (después de que sea visible)
        setTimeout(() => {
            const ventaIdElem = document.getElementById('devolucionVentaId');
            const fechaElem = document.getElementById('devolucionFecha');
            const vendedorElem = document.getElementById('devolucionVendedor');
            const totalElem = document.getElementById('devolucionTotalOriginal');
            
            if (ventaIdElem) ventaIdElem.textContent = `#${venta.id}`;
            if (fechaElem) fechaElem.textContent = new Date(venta.created_at || venta.fecha).toLocaleDateString('es-CL', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            if (vendedorElem) vendedorElem.textContent = venta.vendedor_nombre || venta.vendedor || 'Sin asignar';
            if (totalElem) totalElem.textContent = '$' + formatoMoneda(venta.total);
            
            // Renderizar lista de productos
            renderProductosDevolucion();
            
            // Resetear formulario
            const motivoElem = document.getElementById('devolucionMotivo');
            const notasElem = document.getElementById('devolucionNotas');
            const notasGroupElem = document.getElementById('devolucionNotasGroup');
            const resumenElem = document.getElementById('devolucionResumen');
            const btnConfirmar = document.getElementById('btnConfirmarDevolucion');
            
            if (motivoElem) motivoElem.value = '';
            if (notasElem) notasElem.value = '';
            if (notasGroupElem) notasGroupElem.style.display = 'none';
            if (resumenElem) resumenElem.style.display = 'none';
            if (btnConfirmar) btnConfirmar.disabled = true;
            
            document.querySelectorAll('input[name="tipoReembolso"]').forEach(radio => radio.checked = false);
            document.querySelectorAll('.radio-card').forEach(card => card.classList.remove('selected'));
        }, 50);
        
    } catch (error) {
        manejarError(error, {
            contexto: 'abrirModalDevolucion',
            mensajeUsuario: 'Error al cargar datos de la venta'
        });
    }
}

/**
 * Cerrar modal de devolución
 */
function cerrarModalDevolucion() {
    const modal = document.getElementById('modalDevolucion');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        ventaDevolucion = null;
        productosDevolucion = [];
    }, 200);
}

/**
 * Renderizar lista de productos disponibles para devolución
 */
function renderProductosDevolucion() {
    const container = document.getElementById('devolucionProductosLista');
    
    if (!productosDevolucion || productosDevolucion.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: hsl(var(--muted-foreground));">
                <p>No hay productos en esta venta</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = productosDevolucion.map((item, index) => `
        <div class="producto-devolucion-item" style="border: 2px solid ${item.seleccionado ? 'hsl(var(--primary))' : 'hsl(var(--border))'}; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: ${item.seleccionado ? 'hsl(var(--primary) / 0.05)' : 'white'}; transition: all 0.2s;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <!-- Checkbox -->
                <input type="checkbox" 
                    id="producto_dev_${index}" 
                    ${item.seleccionado ? 'checked' : ''} 
                    onchange="toggleProductoDevolucion(${index})"
                    style="width: 20px; height: 20px; cursor: pointer;">
                
                <!-- Info del producto -->
                <div style="flex: 1;">
                    <label for="producto_dev_${index}" style="cursor: pointer; display: block;">
                        <p style="font-weight: 700; margin: 0;">${item.producto_nombre}</p>
                        <p style="font-size: 13px; color: hsl(var(--muted-foreground)); margin: 4px 0 0;">
                            Cantidad vendida: ${item.cantidad} × $${formatoMoneda(item.precio_unitario)} = $${formatoMoneda(item.subtotal)}
                        </p>
                    </label>
                </div>
                
                <!-- Cantidad a devolver -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 13px; color: hsl(var(--muted-foreground));">Devolver:</label>
                    <input type="number" 
                        id="cantidad_dev_${index}"
                        min="1" 
                        max="${item.cantidad}" 
                        value="${item.cantidad_devolucion || item.cantidad}"
                        ${!item.seleccionado ? 'disabled' : ''}
                        onchange="actualizarCantidadDevolucion(${index})"
                        style="width: 70px; padding: 8px; border: 1px solid hsl(var(--border)); border-radius: 6px; text-align: center; font-weight: 700;">
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Toggle selección de producto para devolución
 */
function toggleProductoDevolucion(index) {
    productosDevolucion[index].seleccionado = !productosDevolucion[index].seleccionado;
    
    if (productosDevolucion[index].seleccionado) {
        productosDevolucion[index].cantidad_devolucion = productosDevolucion[index].cantidad;
    } else {
        productosDevolucion[index].cantidad_devolucion = 0;
    }
    
    renderProductosDevolucion();
    calcularTotalDevolucion();
}

/**
 * Actualizar cantidad a devolver de un producto
 */
function actualizarCantidadDevolucion(index) {
    const input = document.getElementById(`cantidad_dev_${index}`);
    let cantidad = parseInt(input.value);
    
    if (isNaN(cantidad) || cantidad < 1) {
        cantidad = 1;
    }
    
    if (cantidad > productosDevolucion[index].cantidad) {
        cantidad = productosDevolucion[index].cantidad;
    }
    
    productosDevolucion[index].cantidad_devolucion = cantidad;
    input.value = cantidad;
    
    calcularTotalDevolucion();
}

/**
 * Calcular total de la devolución
 */
function calcularTotalDevolucion() {
    const productosSeleccionados = productosDevolucion.filter(p => p.seleccionado);
    
    if (productosSeleccionados.length === 0) {
        document.getElementById('devolucionResumen').style.display = 'none';
        document.getElementById('btnConfirmarDevolucion').disabled = true;
        return;
    }
    
    const totalReembolso = productosSeleccionados.reduce((sum, item) => {
        return sum + (item.precio_unitario * item.cantidad_devolucion);
    }, 0);
    
    const cantidadItems = productosSeleccionados.reduce((sum, item) => sum + item.cantidad_devolucion, 0);
    
    // Actualizar UI
    document.getElementById('devolucionTotalReembolso').textContent = '$' + formatoMoneda(totalReembolso);
    document.getElementById('devolucionCantidadItems').textContent = `${cantidadItems} producto${cantidadItems > 1 ? 's' : ''}`;
    
    // Mostrar resumen
    document.getElementById('devolucionResumen').style.display = 'block';
    
    // Validar si puede confirmar
    validarFormularioDevolucion();
}

/**
 * Toggle para mostrar notas si motivo es "Otro"
 */
function toggleNotasDevolucion() {
    const motivo = document.getElementById('devolucionMotivo').value;
    const notasGroup = document.getElementById('devolucionNotasGroup');
    
    if (motivo === 'Otro') {
        notasGroup.style.display = 'block';
    } else {
        notasGroup.style.display = 'none';
        document.getElementById('devolucionNotas').value = '';
    }
    
    validarFormularioDevolucion();
}

/**
 * Seleccionar tipo de reembolso
 */
function seleccionarTipoReembolso(tipo) {
    // Marcar radio
    document.getElementById(`reembolso${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`).checked = true;
    
    // Actualizar estilos de cards
    document.querySelectorAll('.radio-card').forEach(card => card.classList.remove('selected'));
    document.querySelector(`input[value="${tipo}"]`).closest('.radio-card').classList.add('selected');
    
    // Actualizar texto en resumen
    const textos = {
        'efectivo': '­ƒÆÁ Reembolso en efectivo',
        'vale': '­ƒÄ½ Vale para próxima compra',
        'cambio': '­ƒöä Cambio por otro producto'
    };
    document.getElementById('devolucionMetodoReembolso').textContent = textos[tipo];
    
    validarFormularioDevolucion();
}

/**
 * Validar que todos los campos estén completos
 */
function validarFormularioDevolucion() {
    const motivo = document.getElementById('devolucionMotivo').value;
    const tipoReembolso = document.querySelector('input[name="tipoReembolso"]:checked');
    const productosSeleccionados = productosDevolucion.filter(p => p.seleccionado);
    
    let valido = true;
    
    // Validar productos seleccionados
    if (productosSeleccionados.length === 0) {
        valido = false;
    }
    
    // Validar motivo
    if (!motivo) {
        valido = false;
    }
    
    // Si motivo es "Otro", validar notas
    if (motivo === 'Otro') {
        const notas = document.getElementById('devolucionNotas').value.trim();
        if (!notas) {
            valido = false;
        }
    }
    
    // Validar tipo de reembolso
    if (!tipoReembolso) {
        valido = false;
    }
    
    document.getElementById('btnConfirmarDevolucion').disabled = !valido;
}

/**
 * Confirmar y procesar la devolución
 */
async function confirmarDevolucion() {
    try {
        const motivo = document.getElementById('devolucionMotivo').value;
        const notas = document.getElementById('devolucionNotas').value.trim();
        const tipoReembolso = document.querySelector('input[name="tipoReembolso"]:checked').value;
        const productosSeleccionados = productosDevolucion.filter(p => p.seleccionado);
        
        if (productosSeleccionados.length === 0) {
            mostrarNotificacion('Selecciona al menos un producto', 'warning');
            return;
        }
        
        // Calcular total
        const totalReembolso = productosSeleccionados.reduce((sum, item) => {
            return sum + (item.precio_unitario * item.cantidad_devolucion);
        }, 0);
        
        // Confirmar con el usuario
        const motivoFinal = motivo === 'Otro' ? notas : motivo;
        const tipoTexto = {
            'efectivo': 'Devolución en Efectivo',
            'vale': 'Vale para próxima compra',
            'cambio': 'Cambio por otro producto'
        }[tipoReembolso];
        
        const confirmMsg = `¿Confirmar devolución de venta #${ventaDevolucion.id}?

­ƒôª Productos: ${productosSeleccionados.length}
­ƒÆ░ Total a reembolsar: $${formatoMoneda(totalReembolso)}
­ƒôï Motivo: ${motivoFinal}
­ƒöä Tipo: ${tipoTexto}

ÔÜá´©Å Esta acción:
    ÔÇó Restaurará stock solo de productos con control de stock (no granel)
ÔÇó ${tipoReembolso === 'efectivo' ? 'Restará efectivo de la caja del día' : 'Registrará el ' + tipoTexto.toLowerCase()}
ÔÇó Quedará registrada en el historial`;
        
        if (!confirm(confirmMsg)) return;
        
        // Deshabilitar botón
        const btnConfirmar = document.getElementById('btnConfirmarDevolucion');
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<span>Procesando...</span>';
        
        // Procesar devolución
        await procesarDevolucion({
            ventaId: ventaDevolucion.id,
            productos: productosSeleccionados.map(p => ({
                producto_id: p.producto_id,
                producto_nombre: p.producto_nombre,
                cantidad: p.cantidad_devolucion,
                precio_unitario: p.precio_unitario,
                subtotal: p.precio_unitario * p.cantidad_devolucion,
                es_granel: esProductoGranelDevolucion(p)
            })),
            totalReembolso,
            motivo: motivoFinal,
            tipoReembolso,
            procesadoPor: currentUser
        });
        
        btnConfirmar.innerHTML = '<span>Procesar Devolución</span>';
        
    } catch (error) {
        manejarError(error, {
            contexto: 'confirmarDevolucion',
            mensajeUsuario: 'Error al procesar devolución',
            callback: () => {
                document.getElementById('btnConfirmarDevolucion').disabled = false;
                document.getElementById('btnConfirmarDevolucion').innerHTML = '<span>Procesar Devolución</span>';
            }
        });
    }
}

/**
 * Procesar devolución en backend
 */
async function procesarDevolucion(datosDevolucion) {
    try {
        console.log('­ƒöä Procesando devolución:', datosDevolucion);
        
        // 1. Registrar devolución en tabla
        const { data: devolucion, error: errorDevolucion } = await window.supabaseClient
            .from('devoluciones')
            .insert({
                venta_id: datosDevolucion.ventaId,
                productos_devueltos: datosDevolucion.productos,
                total_devuelto: datosDevolucion.totalReembolso,
                motivo: datosDevolucion.motivo,
                tipo_reembolso: datosDevolucion.tipoReembolso,
                procesado_por: datosDevolucion.procesadoPor,
                notas: `Devolución procesada. Productos: ${datosDevolucion.productos.map(p => `${p.producto_nombre} (${p.cantidad})`).join(', ')}`
            })
            .select()
            .single();
        
        if (errorDevolucion) throw errorDevolucion;
        
        console.log('Ô£à Devolución registrada:', devolucion);
        
        // 2. Restaurar stock de productos (excepto granel)
        for (const producto of datosDevolucion.productos) {
            if (!producto.producto_id) continue;

            if (esProductoGranelDevolucion(producto)) {
                console.log(`Ôä╣´©Å Producto granel sin control de stock: ${producto.producto_nombre}`);
                continue;
            }
            
            // Obtener stock actual
            const { data: prodActual, error: errorProd } = await window.supabaseClient
                .from('productos')
                .select('stock')
                .eq('id', producto.producto_id)
                .single();
            
            if (errorProd) {
                console.warn(`ÔÜá´©Å No se pudo obtener stock del producto ${producto.producto_id}`);
                continue;
            }
            
            // Sumar cantidad devuelta
            const nuevoStock = prodActual.stock + producto.cantidad;
            
            const { error: errorUpdate } = await window.supabaseClient
                .from('productos')
                .update({ stock: nuevoStock })
                .eq('id', producto.producto_id);
            
            if (errorUpdate) {
                console.warn(`ÔÜá´©Å No se pudo actualizar stock del producto ${producto.producto_id}`);
            } else {
                console.log(`Ô£à Stock restaurado: ${producto.producto_nombre} +${producto.cantidad} = ${nuevoStock}`);
            }
        }
        
        // 3. Registrar en gastos si es reembolso en efectivo (para ajustar caja)
        if (datosDevolucion.tipoReembolso === 'efectivo') {
            const { error: errorGasto } = await window.supabaseClient
                .from('gastos')
                .insert({
                    monto: datosDevolucion.totalReembolso,
                    descripcion: `Devolución venta #${datosDevolucion.ventaId}`,
                    categoria: 'Devolución',
                    asignado_a: datosDevolucion.procesadoPor,
                    registrado_por: datosDevolucion.procesadoPor,
                    fecha: new Date().toISOString()
                });
            
            if (errorGasto) {
                console.warn('ÔÜá´©Å No se pudo registrar gasto de devolución:', errorGasto);
            } else {
                console.log('Ô£à Gasto de devolución registrado en caja');
            }
        }
        
        // 4. Mostrar éxito
        mostrarNotificacion(`Ô£à Devolución procesada exitosamente - $${formatoMoneda(datosDevolucion.totalReembolso)}`, 'success');
        
        // 5. Cerrar modal
        cerrarModalDevolucion();
        
        // 6. Recargar ventas si estamos en esa vista
        if (currentView === 'sales') {
            await cargarVentas();
            await cargarHistorialDevoluciones(); // Recargar también devoluciones
        }
        
        // 7. Recargar inventario si cambió stock
        if (currentView === 'inventory') {
            await cargarInventario();
        }
        
        // 8. Recargar caja si es la vista actual
        if (currentView === 'caja') {
            await cargarDatosCaja();
        }
        
    } catch (error) {
        manejarError(error, {
            contexto: 'procesarDevolucion',
            mensajeUsuario: 'Error al procesar la devolución',
            esErrorCritico: true
        });
        throw error;
    }
}

/**
 * Cargar historial de devoluciones
 */
async function cargarHistorialDevoluciones() {
    try {
        console.log('­ƒöä Cargando historial de devoluciones...');

        const seccionDevoluciones = document.getElementById('historialDevoluciones');

        // Solo encargado puede ver esta sección
        if (currentUserRole !== 'encargado') {
            if (seccionDevoluciones) {
                seccionDevoluciones.style.display = 'none';
            }
            return;
        }

        if (seccionDevoluciones) {
            seccionDevoluciones.style.display = 'block';
        }
        
        if (!window.supabaseClient) {
            console.warn('ÔÜá´©Å Supabase no disponible');
            return;
        }
        
        // Obtener período actual (mismo que ventas)
        const periodo = parseInt(document.getElementById('periodoVentas')?.value, 10) || 30;
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - periodo);
        const fechaInicioStr = fechaInicio.toISOString();
        
        // Consultar devoluciones con JOIN a ventas (solo no eliminadas)
        const { data: devoluciones, error } = await window.supabaseClient
            .from('devoluciones')
            .select(`
                *,
                ventas:venta_id (
                    id,
                    vendedor_nombre,
                    created_at
                )
            `)
            .is('deleted_at', null)
            .gte('created_at', fechaInicioStr)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error cargando devoluciones:', error);
            throw error;
        }
        
        console.log(`Ô£à ${devoluciones?.length || 0} devoluciones cargadas`);
        
        // Renderizar tabla
        renderTablaDevoluciones(devoluciones || []);
        
    } catch (error) {
        manejarError(error, {
            contexto: 'cargarHistorialDevoluciones',
            mensajeUsuario: 'Error al cargar historial de devoluciones',
            callback: () => {
                const container = document.getElementById('tablaDevoluciones');
                if (container) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: hsl(var(--destructive));">
                            <p>ÔØî Error al cargar devoluciones</p>
                            <small>${error.message}</small>
                        </div>
                    `;
                }
            }
        });
    }
}

/**
 * Renderizar tabla de devoluciones
 */
function renderTablaDevoluciones(devoluciones) {
    const container = document.getElementById('tablaDevoluciones');
    const esAdmin = currentUserRole === 'encargado';
    
    if (!container) return;
    
    if (devoluciones.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: hsl(var(--muted-foreground));">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="opacity: 0.3; margin: 0 auto 16px;">
                    <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" stroke="currentColor" stroke-width="2"/>
                </svg>
                <p>No hay devoluciones en este período</p>
                <small>Las devoluciones procesadas aparecerán aquí</small>
            </div>
        `;
        return;
    }
    
    // Crear tabla
    let html = `
        <div style="overflow-x: auto;">
            <table class="sales-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: hsl(var(--muted) / 0.5); border-bottom: 2px solid hsl(var(--border));">
                        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px;">ID Dev.</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px;">Fecha Devolución</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px;">Venta Original</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px;">Productos Devueltos</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600; font-size: 13px;">Total Devuelto</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px;">Motivo</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px;">Tipo Reembolso</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 13px;">Procesado Por</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600; font-size: 13px;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    devoluciones.forEach(dev => {
        const fecha = new Date(dev.created_at || dev.fecha);
        const fechaTexto = fecha.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Parsear productos devueltos
        let productosDevueltos = [];
        try {
            productosDevueltos = typeof dev.productos_devueltos === 'string' 
                ? JSON.parse(dev.productos_devueltos) 
                : dev.productos_devueltos || [];
        } catch (e) {
            productosDevueltos = [];
        }
        
        // Formatear lista de productos
        const productosTexto = productosDevueltos.length > 0
            ? productosDevueltos.map(p => `${p.producto_nombre || p.nombre} (${p.cantidad})`).join(', ')
            : 'Sin detalles';
        
        // Icono y color según tipo de reembolso
        const tipoReembolso = {
            'efectivo': { icon: '­ƒÆÁ', text: 'Efectivo', color: 'hsl(142 76% 36%)' },
            'vale': { icon: '­ƒÄ½', text: 'Vale', color: 'hsl(199 89% 48%)' },
            'cambio': { icon: '­ƒöä', text: 'Cambio', color: 'hsl(38 92% 50%)' }
        }[dev.tipo_reembolso] || { icon: 'ÔØô', text: dev.tipo_reembolso, color: 'hsl(var(--muted-foreground))' };
        
        html += `
            <tr style="border-bottom: 1px solid hsl(var(--border));">
                <td style="padding: 12px;"><strong>#${dev.id}</strong></td>
                <td style="padding: 12px; font-size: 13px;">${fechaTexto}</td>
                <td style="padding: 12px;">
                    <a href="#" onclick="verDetalleVenta(${dev.venta_id}); return false;" style="color: hsl(var(--primary)); text-decoration: none; font-weight: 600;">
                        #${dev.venta_id}
                    </a>
                </td>
                <td style="padding: 12px; font-size: 13px; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${productosTexto}">
                    ${productosTexto}
                </td>
                <td style="padding: 12px; text-align: right;">
                    <strong style="color: hsl(var(--destructive)); font-size: 15px;">-$${formatoMoneda(dev.total_devuelto)}</strong>
                </td>
                <td style="padding: 12px; font-size: 13px; max-width: 200px;">
                    <span title="${dev.motivo}">${dev.motivo.length > 40 ? dev.motivo.substring(0, 40) + '...' : dev.motivo}</span>
                </td>
                <td style="padding: 12px;">
                    <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; background: ${tipoReembolso.color}15; color: ${tipoReembolso.color}; border-radius: 6px; font-size: 12px; font-weight: 600;">
                        ${tipoReembolso.icon} ${tipoReembolso.text}
                    </span>
                </td>
                <td style="padding: 12px; font-size: 13px;">${dev.procesado_por}</td>
                <td style="padding: 12px; text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button class="btn-icon" onclick="verDetalleDevolucion(${dev.id})" title="Ver detalles completos">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
                                <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        ${esAdmin ? `
                        <button class="btn-icon" onclick="eliminarDevolucion(${dev.id})" title="Eliminar devolución" style="color: hsl(var(--destructive));">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <path d="M3 5h14M8 5V3h4v2M9 9v6m2-6v6M6 5v12a2 2 0 002 2h4a2 2 0 002-2V5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Eliminar una devolución del historial
 */
async function eliminarDevolucion(devolucionId) {
    // Validar permisos de administrador
    if (!requireAdminRole('Eliminar devoluciones')) {
        return;
    }
    
    // Obtener detalles de la devolución antes de eliminar
    let devolucion;
    try {
        const { data, error } = await window.supabaseClient
            .from('devoluciones')
            .select('*')
            .eq('id', devolucionId)
            .is('deleted_at', null)
            .single();
        
        if (error) throw error;
        devolucion = data;
        
        console.log('­ƒôï Devolución a eliminar:', devolucion);
    } catch (error) {
        manejarError(error, {
            contexto: 'obtenerDevolucion',
            mensajeUsuario: 'Error al obtener datos de la devolución'
        });
        return;
    }
    
    // Confirmar eliminación
    const confirmar = confirm(
        'ÔÜá´©Å ELIMINAR DEVOLUCIÓN\n\n' +
        `¿Está seguro que desea eliminar la devolución #${devolucionId}?\n` +
        `Venta relacionada: #${devolucion.venta_id}\n\n` +
        'ÔÜá´©Å Esta acción NO ES REVERSIBLE.\n\n' +
        'Se revertirán los siguientes cambios:\n' +
        'ÔÇó El stock se reducirá (se restará lo que se había devuelto)\n' +
        'ÔÇó La venta volverá a aparecer normal (sin etiqueta "Devuelto")\n' +
        (devolucion.tipo_reembolso === 'efectivo' ? 'ÔÇó El gasto de reembolso en caja se eliminará\n' : '') +
        '\n¿Desea continuar?'
    );
    
    if (!confirmar) return;
    
    console.log(`­ƒùæ´©Å Eliminando devolución #${devolucionId}...`);
    
    try {
        // Parsear productos devueltos
        let productosDevueltos = [];
        try {
            productosDevueltos = typeof devolucion.productos_devueltos === 'string' 
                ? JSON.parse(devolucion.productos_devueltos) 
                : devolucion.productos_devueltos || [];
        } catch (e) {
            console.warn('ÔÜá´©Å No se pudieron parsear productos devueltos');
        }

        // 1) VALIDAR si se puede revertir stock antes de tocar nada (excepto granel)
        const bloqueosReversion = [];
        const stockActualPorProducto = new Map();
        let modoExcepcionalSinReversionStock = false;

        for (const producto of productosDevueltos) {
            if (!producto.producto_id) continue;

            if (esProductoGranelDevolucion(producto)) {
                continue;
            }

            const { data: prodActual, error: errorProd } = await window.supabaseClient
                .from('productos')
                .select('id, nombre, stock')
                .eq('id', producto.producto_id)
                .single();

            if (errorProd || !prodActual) {
                bloqueosReversion.push(`${producto.producto_nombre || `ID ${producto.producto_id}`}: no se pudo leer stock actual`);
                continue;
            }

            const stockActual = Number(prodActual.stock || 0);
            const cantidadARevertir = Number(producto.cantidad || 0);
            const stockResultante = stockActual - cantidadARevertir;

            stockActualPorProducto.set(producto.producto_id, {
                nombre: prodActual.nombre || producto.producto_nombre || `ID ${producto.producto_id}`,
                stockActual,
                cantidadARevertir,
                stockResultante
            });

            if (stockResultante < 0) {
                bloqueosReversion.push(
                    `${prodActual.nombre || producto.producto_nombre || `ID ${producto.producto_id}`}: ` +
                    `stock actual ${stockActual}, se necesita revertir ${cantidadARevertir}`
                );
            }
        }

        if (bloqueosReversion.length > 0) {
            console.warn('Ôøö No se puede eliminar la devolución por falta de stock para revertir:', bloqueosReversion);
            const confirmarExcepcional = confirm(
                'ÔÜá´©Å No hay stock suficiente para revertir esta devolución.\n\n' +
                'Puedes usar MODO EXCEPCIONAL para:\n' +
                'ÔÇó Eliminar el registro de devolución\n' +
                'ÔÇó Eliminar el gasto de caja (si fue efectivo)\n' +
                'ÔÇó NO tocar stock de productos\n\n' +
                '¿Quieres continuar en modo excepcional?'
            );

            if (!confirmarExcepcional) {
                mostrarNotificacion(
                    'No se eliminó: faltan unidades para revertir stock. Revisa consola para detalle.',
                    'warning'
                );
                return;
            }

            modoExcepcionalSinReversionStock = true;
            console.warn('ÔÜá´©Å Eliminación en modo excepcional: sin reversión de stock');
        }
        
        // 2. Revertir stock de productos (restar lo que se había sumado, excepto granel)
        if (!modoExcepcionalSinReversionStock) {
            for (const producto of productosDevueltos) {
                if (!producto.producto_id) continue;

                if (esProductoGranelDevolucion(producto)) {
                    continue;
                }

                const stockInfo = stockActualPorProducto.get(producto.producto_id);
                if (!stockInfo) continue;

                const { error: errorUpdate } = await window.supabaseClient
                    .from('productos')
                    .update({ stock: stockInfo.stockResultante })
                    .eq('id', producto.producto_id);

                if (errorUpdate) {
                    throw new Error(
                        `No se pudo revertir stock de ${stockInfo.nombre}: ${errorUpdate.message || 'error de base de datos'}`
                    );
                }

                console.log(`Ô£à Stock revertido: ${stockInfo.nombre} -${stockInfo.cantidadARevertir} = ${stockInfo.stockResultante}`);
            }
        }
        
        // 3. Eliminar gasto asociado si fue reembolso en efectivo
        if (devolucion.tipo_reembolso === 'efectivo') {
            try {
                const fechaDevolucion = new Date(devolucion.created_at);
                const fechaInicio = new Date(fechaDevolucion.getTime() - 60000); // 1 minuto antes
                const fechaFin = new Date(fechaDevolucion.getTime() + 60000); // 1 minuto después
                
                const { error: errorGasto } = await window.supabaseClient
                    .from('gastos')
                    .delete()
                    .eq('monto', devolucion.total_devuelto)
                    .eq('categoria', 'Devolución')
                    .like('descripcion', `%venta #${devolucion.venta_id}%`)
                    .gte('fecha', fechaInicio.toISOString())
                    .lte('fecha', fechaFin.toISOString());
                
                if (errorGasto) {
                    console.warn('ÔÜá´©Å No se pudo eliminar el gasto asociado:', errorGasto);
                } else {
                    console.log('Ô£à Gasto de devolución eliminado de caja');
                }
            } catch (error) {
                console.warn('ÔÜá´©Å Error al eliminar gasto:', error);
            }
        }
        
        // 4. Marcar la devolución como eliminada (soft delete usando RPC)
        const { data: result, error } = await window.supabaseClient
            .rpc('eliminar_devolucion', { p_devolucion_id: devolucionId });
        
        if (error) throw error;

        if (!result || !result.success) {
            throw new Error(result?.message || 'No se pudo marcar la devolución como eliminada.');
        }
        
        console.log(`Ô£à Devolución #${devolucionId} eliminada correctamente`);
        if (modoExcepcionalSinReversionStock) {
            mostrarNotificacion('Devolución eliminada en modo excepcional (sin reversión de stock)', 'warning');
        } else {
            mostrarNotificacion('Devolución eliminada y cambios revertidos correctamente', 'success');
        }
        
        // 5. Recargar vistas necesarias (primero ventas, luego devoluciones)
        // para que desaparezca de inmediato el badge "Devuelto" en historial de transacciones
        if (currentView === 'sales') {
            await cargarVentas();
            await cargarHistorialDevoluciones();
        } else {
            await cargarHistorialDevoluciones();
        }
        
        // Recargar inventario si estamos en esa vista
        if (currentView === 'inventory') {
            await cargarInventario();
        }
        
        // Recargar caja si estamos en esa vista
        if (currentView === 'caja') {
            await cargarDatosCaja();
        }
        
    } catch (error) {
        manejarError(error, {
            contexto: 'eliminarDevolucion',
            mensajeUsuario: 'Error al eliminar la devolución: ' + error.message
        });
    }
}

/**
 * Ver detalles completos de una devolución
 */
async function verDetalleDevolucion(devolucionId) {
    try {
        const { data: devolucion, error } = await window.supabaseClient
            .from('devoluciones')
            .select(`
                *,
                ventas:venta_id (
                    id,
                    vendedor_nombre,
                    created_at,
                    total,
                    metodo_pago
                )
            `)
            .eq('id', devolucionId)
            .is('deleted_at', null)
            .single();
        
        if (error) throw error;
        
        // Parsear productos
        let productosDevueltos = [];
        try {
            productosDevueltos = typeof devolucion.productos_devueltos === 'string' 
                ? JSON.parse(devolucion.productos_devueltos) 
                : devolucion.productos_devueltos || [];
        } catch (e) {
            productosDevueltos = [];
        }
        
        const fecha = new Date(devolucion.created_at || devolucion.fecha);
        const fechaTexto = fecha.toLocaleDateString('es-CL', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const tipoTexto = {
            'efectivo': '­ƒÆÁ Reembolso en Efectivo',
            'vale': '­ƒÄ½ Vale para próxima compra',
            'cambio': '­ƒöä Cambio por otro producto'
        }[devolucion.tipo_reembolso] || devolucion.tipo_reembolso;
        
        const detalleHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px; max-width: 600px;">
                <h3 style="margin: 0 0 20px; display: flex; align-items: center; gap: 8px;">
                    ­ƒöä Detalle de Devolución #${devolucion.id}
                </h3>
                
                <div style="display: grid; gap: 16px; margin-bottom: 20px;">
                    <div style="background: hsl(var(--muted) / 0.3); padding: 12px; border-radius: 8px;">
                        <p style="font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0;">Fecha de Devolución</p>
                        <p style="font-weight: 600; margin: 4px 0 0;">${fechaTexto}</p>
                    </div>
                    
                    <div style="background: hsl(var(--muted) / 0.3); padding: 12px; border-radius: 8px;">
                        <p style="font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0;">Venta Original</p>
                        <p style="font-weight: 600; margin: 4px 0 0;">#${devolucion.venta_id}</p>
                    </div>
                    
                    <div style="background: hsl(var(--muted) / 0.3); padding: 12px; border-radius: 8px;">
                        <p style="font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0;">Motivo</p>
                        <p style="font-weight: 600; margin: 4px 0 0;">${devolucion.motivo}</p>
                    </div>
                    
                    <div style="background: hsl(var(--muted) / 0.3); padding: 12px; border-radius: 8px;">
                        <p style="font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0;">Tipo de Reembolso</p>
                        <p style="font-weight: 600; margin: 4px 0 0;">${tipoTexto}</p>
                    </div>
                    
                    <div style="background: hsl(var(--destructive) / 0.1); padding: 12px; border-radius: 8px;">
                        <p style="font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0;">Total Devuelto</p>
                        <p style="font-weight: 700; font-size: 24px; color: hsl(var(--destructive)); margin: 4px 0 0;">$${formatoMoneda(devolucion.total_devuelto)}</p>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <p style="font-weight: 600; margin: 0 0 8px;">Productos Devueltos:</p>
                    <ul style="margin: 0; padding-left: 20px;">
                        ${productosDevueltos.map(p => `
                            <li>${p.producto_nombre || p.nombre} - Cantidad: ${p.cantidad} × $${formatoMoneda(p.precio_unitario)} = $${formatoMoneda(p.subtotal)}</li>
                        `).join('')}
                    </ul>
                </div>
                
                <div style="padding: 12px; background: hsl(var(--muted) / 0.2); border-radius: 8px; font-size: 13px;">
                    <p style="margin: 0;"><strong>Procesado por:</strong> ${devolucion.procesado_por}</p>
                    ${devolucion.notas ? `<p style="margin: 8px 0 0;"><strong>Notas:</strong> ${devolucion.notas}</p>` : ''}
                </div>
            </div>
        `;

        const modal = document.getElementById('modalDetalleVenta');
        const content = document.getElementById('detalleVentaContent');
        const title = modal?.querySelector('.modal-header h3');
        const printButton = modal?.querySelector('.modal-footer .btn.btn-primary');

        if (!modal || !content) {
            throw new Error('Modal de detalle no disponible');
        }

        if (title) {
            title.textContent = `­ƒöä Detalle de Devolución #${devolucion.id}`;
        }

        if (printButton) {
            printButton.style.display = 'none';
        }

        content.innerHTML = detalleHTML;
        modal.style.display = 'flex';
        modal.classList.add('show');
        
    } catch (error) {
        manejarError(error, {
            contexto: 'verDetalleDevolucion',
            mensajeUsuario: 'Error al cargar detalles'
        });
    }
}


// ============================================
// MÓDULO: EDITAR MÉTODO DE PAGO Y ELIMINAR VENTA
// ============================================

let ventaEditarMetodoPago = null;

/**
 * Abrir modal para editar método de pago
 */
async function abrirModalEditarMetodoPago(ventaId) {
    try {
        console.log(`­ƒÆ│ Abriendo modal para editar método de pago de venta #${ventaId}`);
        
        // Obtener datos de la venta
        const { data: venta, error } = await window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('id', ventaId)
            .single();
        
        if (error) throw error;
        
        if (!venta) {
            mostrarNotificacion('Venta no encontrada', 'error');
            return;
        }
        
        // Guardar venta actual
        ventaEditarMetodoPago = venta;
        
        // Llenar información en el modal
        document.getElementById('editMetodoPagoVentaId').textContent = `#${venta.id}`;
        document.getElementById('editMetodoPagoTotal').textContent = `$${formatoMoneda(venta.total)}`;
        document.getElementById('editMetodoPagoFecha').textContent = new Date(venta.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago' });
        document.getElementById('editMetodoPagoActual').textContent = venta.metodo_pago;
        
        // Resetear campos
        document.getElementById('nuevoMetodoPago').value = '';
        document.getElementById('motivoCambioMetodo').value = '';
        
        // Mostrar modal
        const modal = document.getElementById('modalEditarMetodoPago');
        modal.style.display = 'flex';
        modal.classList.add('show');
        
    } catch (error) {
        manejarError(error, {
            contexto: 'abrirModalEditarMetodoPago',
            mensajeUsuario: 'Error al abrir modal de edición'
        });
    }
}

/**
 * Cerrar modal de editar método de pago
 */
function cerrarModalEditarMetodoPago() {
    const modal = document.getElementById('modalEditarMetodoPago');
    modal.style.display = 'none';
    modal.classList.remove('show');
    ventaEditarMetodoPago = null;
}

/**
 * Guardar nuevo método de pago
 */
async function guardarNuevoMetodoPago() {
    const nuevoMetodo = document.getElementById('nuevoMetodoPago').value;
    const motivo = document.getElementById('motivoCambioMetodo').value.trim();
    
    if (!nuevoMetodo) {
        mostrarNotificacion('Selecciona el nuevo método de pago', 'warning');
        return;
    }
    
    if (!ventaEditarMetodoPago) {
        mostrarNotificacion('Error: Venta no cargada', 'error');
        return;
    }
    
    // Validar que sea diferente al actual
    if (nuevoMetodo === ventaEditarMetodoPago.metodo_pago) {
        mostrarNotificacion('El método seleccionado es el mismo que el actual', 'warning');
        return;
    }
    
    // Confirmar cambio
    const confirmar = confirm(
        `¿Cambiar método de pago?\n\n` +
        `Venta: #${ventaEditarMetodoPago.id}\n` +
        `Método actual: ${ventaEditarMetodoPago.metodo_pago}\n` +
        `Nuevo método: ${nuevoMetodo}\n` +
        (motivo ? `Motivo: ${motivo}\n` : '') +
        `\n¿Continuar?`
    );
    
    if (!confirmar) return;
    
    try {
        console.log(`­ƒÆ│ Actualizando método de pago de venta #${ventaEditarMetodoPago.id}...`);
        console.log(`   Método anterior: ${ventaEditarMetodoPago.metodo_pago}`);
        console.log(`   Método nuevo: ${nuevoMetodo}`);
        console.log(`   Motivo: ${motivo || 'Sin especificar'}`);
        
        // Actualizar solo el método de pago en la base de datos
        const { error } = await window.supabaseClient
            .from('ventas')
            .update({
                metodo_pago: nuevoMetodo
            })
            .eq('id', ventaEditarMetodoPago.id);
        
        if (error) {
            console.error('ÔØî Error al actualizar:', error);
            throw error;
        }
        
        console.log('Ô£à Método de pago actualizado correctamente');
        
        mostrarNotificacion(`Ô£à Método de pago actualizado a: ${nuevoMetodo}`, 'success');
        
        // Cerrar modal
        cerrarModalEditarMetodoPago();
        
        // Recargar ventas
        await cargarVentas();
        
    } catch (error) {
        console.error('ÔØî Error en guardarNuevoMetodoPago:', error);
        
        manejarError(error, {
            contexto: 'guardarNuevoMetodoPago',
            mensajeUsuario: `Error al actualizar método de pago: ${error.message}`
        });
    }
}

/**
 * Confirmar eliminación de venta
 */
function confirmarEliminarVenta(ventaId) {
    // Doble confirmación por seguridad
    const confirmar1 = confirm(
        `ÔÜá´©Å ELIMINAR VENTA #${ventaId}\n\n` +
        `Esta acción eliminará PERMANENTEMENTE:\n\n` +
        `Ô£ô El registro de la venta\n` +
        `Ô£ô Los items vendidos\n` +
        `Ô£ô Se restaurará el stock de los productos\n\n` +
        `ÔÜá´©Å IMPORTANTE: Esta es una eliminación PERMANENTE.\n` +
        `No se puede deshacer.\n\n` +
        `¿Está seguro de continuar?`
    );
    
    if (!confirmar1) return;
    
    const confirmar2 = confirm(
        `ÔÜá´©Å ÚLTIMA CONFIRMACIÓN\n\n` +
        `Venta #${ventaId} será ELIMINADA PERMANENTEMENTE.\n\n` +
        `Esta acción NO SE PUEDE DESHACER.\n\n` +
        `¿Confirma que desea eliminar?`
    );
    
    if (confirmar2) {
        eliminarVenta(ventaId);
    }
}

/**
 * Eliminar venta permanentemente
 */
async function eliminarVenta(ventaId) {
    try {
        console.log(`­ƒùæ´©Å Eliminando venta #${ventaId}...`);
        
        // 1. Obtener datos completos de la venta
        const { data: venta, error: ventaError } = await window.supabaseClient
            .from('ventas')
            .select('*')
            .eq('id', ventaId)
            .single();
        
        if (ventaError) {
            console.error('Error al obtener venta:', ventaError);
            throw new Error(`Error al buscar la venta: ${ventaError.message}`);
        }
        
        if (!venta) {
            mostrarNotificacion('Venta no encontrada', 'error');
            return;
        }
        
        console.log('Ô£à Venta encontrada:', venta);
        
        // 2. Obtener items de la venta
        const { data: items, error: itemsError } = await window.supabaseClient
            .from('ventas_items')
            .select('*')
            .eq('venta_id', ventaId);
        
        if (itemsError) {
            console.warn('ÔÜá´©Å Error al obtener items:', itemsError);
        } else {
            console.log(`Ô£à Items encontrados: ${items?.length || 0}`);
        }
        
        // 3. Restaurar stock de los productos (solo si no son a granel)
        if (items && items.length > 0) {
            console.log('­ƒöä Restaurando stock...');
            
            for (const item of items) {
                try {
                    // Obtener producto para verificar si es a granel
                    const { data: producto, error: prodError } = await window.supabaseClient
                        .from('productos')
                        .select('es_granel, stock, nombre')
                        .eq('id', item.producto_id)
                        .single();
                    
                    if (prodError) {
                        console.error(`ÔØî Error al obtener producto ${item.producto_id}:`, prodError);
                        continue;
                    }
                    
                    if (producto && !producto.es_granel) {
                        const nuevoStock = producto.stock + item.cantidad;
                        
                        console.log(`­ƒôª Restaurando stock de "${producto.nombre}": ${producto.stock} + ${item.cantidad} = ${nuevoStock}`);
                        
                        const { error: stockError } = await window.supabaseClient
                            .from('productos')
                            .update({ stock: nuevoStock })
                            .eq('id', item.producto_id);
                        
                        if (stockError) {
                            console.error(`ÔØî Error al restaurar stock del producto ${item.producto_id}:`, stockError);
                        } else {
                            console.log(`Ô£à Stock restaurado exitosamente`);
                        }
                    } else if (producto && producto.es_granel) {
                        console.log(`ÔÅ¡´©Å Producto "${producto.nombre}" es a granel, no se restaura stock`);
                    }
                } catch (prodError) {
                    console.error(`ÔØî Error procesando producto ${item.producto_id}:`, prodError);
                }
            }
        }
        
        // 4. Eliminar items de la venta primero (para evitar problemas de FK)
        if (items && items.length > 0) {
            console.log('­ƒùæ´©Å Eliminando items de la venta...');
            
            const { error: deleteItemsError } = await window.supabaseClient
                .from('ventas_items')
                .delete()
                .eq('venta_id', ventaId);
            
            if (deleteItemsError) {
                console.error('ÔØî Error al eliminar items:', deleteItemsError);
                throw new Error(`Error al eliminar items: ${deleteItemsError.message}`);
            }
            
            console.log('Ô£à Items eliminados correctamente');
        }
        
        // 5. Eliminar la venta
        console.log('­ƒùæ´©Å Eliminando registro de venta...');
        
        const { error: deleteError } = await window.supabaseClient
            .from('ventas')
            .delete()
            .eq('id', ventaId);
        
        if (deleteError) {
            console.error('ÔØî Error al eliminar venta:', deleteError);
            throw new Error(`Error al eliminar venta: ${deleteError.message}`);
        }
        
        console.log('Ô£àÔ£àÔ£à Venta eliminada exitosamente');
        
        mostrarNotificacion(`Ô£à Venta #${ventaId} eliminada correctamente`, 'success');
        
        // 6. Recargar ventas y otras vistas
        await cargarVentas();
        
        if (currentView === 'caja') {
            await cargarDatosCaja();
        }
        
        if (currentView === 'inventory') {
            await cargarInventario();
        }
        
    } catch (error) {
        console.error('ÔØîÔØîÔØî ERROR CRÍTICO al eliminar venta:', error);
        
        manejarError(error, {
            contexto: 'eliminarVenta',
            mensajeUsuario: `Error al eliminar la venta: ${error.message}`,
            esErrorCritico: true
        });
    }
}


// ============================================
// MÓDULO: MERMAS Y PÉRDIDAS
// ============================================

let productoMermaSeleccionado = null;
let productosDisponiblesMerma = [];

/**
 * Abrir modal para registrar merma
 */
async function abrirModalMerma() {
    console.log('­ƒùæ´©Å Abriendo modal de mermas...');
    
    const modal = document.getElementById('modalMerma');
    if (!modal) {
        console.error('ÔØî Modal de mermas no encontrado');
        return;
    }
    
    // Mostrar modal
    modal.style.display = 'flex';
    
    // Limpiar formulario
    limpiarSeleccionMerma();
    document.getElementById('mermaBuscadorProducto').value = '';
    document.getElementById('mermaCantidad').value = '';
    document.getElementById('mermaMotivo').value = '';
    document.getElementById('mermaNotas').value = '';
    document.getElementById('mermaNotasContainer').style.display = 'none';
    document.getElementById('mermaResumen').style.display = 'none';
    document.getElementById('mermaResultadosBusqueda').style.display = 'none';
    document.getElementById('mermaCantidad').disabled = true;
    productoMermaSeleccionado = null;
    
    // Cargar productos disponibles
    try {
        const { data: productos, error } = await window.supabaseClient
            .from('productos')
            .select('id, nombre, stock, categoria')
            .order('nombre');
        
        if (error) throw error;
        
        productosDisponiblesMerma = productos || [];
        console.log('Ô£à Productos cargados para búsqueda:', productosDisponiblesMerma.length);
        
    } catch (error) {
        manejarError(error, {
            contexto: 'cargarProductosParaMerma',
            mensajeUsuario: 'Error al cargar productos'
        });
        productosDisponiblesMerma = [];
    }
    
    // Focus en el buscador
    setTimeout(() => {
        document.getElementById('mermaBuscadorProducto')?.focus();
    }, 100);
    
    validarFormularioMerma();
}

/**
 * Buscar productos en tiempo real
 */
function buscarProductoMerma() {
    const input = document.getElementById('mermaBuscadorProducto');
    const resultadosDiv = document.getElementById('mermaResultadosBusqueda');
    const query = input.value.toLowerCase().trim();
    
    // Si no hay query, ocultar resultados
    if (query.length === 0) {
        resultadosDiv.style.display = 'none';
        return;
    }
    
    // Filtrar productos que coincidan
    const resultados = productosDisponiblesMerma.filter(p => {
        const nombreMatch = p.nombre.toLowerCase().includes(query);
        const categoriaMatch = p.categoria && p.categoria.toLowerCase().includes(query);
        return nombreMatch || categoriaMatch;
    }).slice(0, 8); // Máximo 8 resultados
    
    // Mostrar resultados
    if (resultados.length === 0) {
        resultadosDiv.innerHTML = `
            <div style="padding: 16px; text-align: center; color: hsl(var(--muted-foreground));">
                <p style="margin: 0; font-size: 14px;">No se encontraron productos</p>
            </div>
        `;
        resultadosDiv.style.display = 'block';
    } else {
        let html = '';
        resultados.forEach((p, index) => {
            const stockColor = p.stock === 0 ? 'hsl(var(--destructive))' : p.stock <= 5 ? 'hsl(38 92% 50%)' : 'hsl(142 76% 36%)';
            const stockIcon = p.stock === 0 ? 'ÔØî' : p.stock <= 5 ? 'ÔÜá´©Å' : 'Ô£à';
            
            html += `
                <div 
                    onclick="seleccionarProductoBuscadorMerma(${p.id}, '${p.nombre.replace(/'/g, "\\'")}', ${p.stock})" 
                    style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid hsl(var(--border)); transition: background 0.2s;"
                    onmouseover="this.style.background='hsl(var(--muted) / 0.5)'"
                    onmouseout="this.style.background='transparent'"
                >
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <p style="margin: 0; font-weight: 600; font-size: 14px;">${escapeHtml(p.nombre)}</p>
                            ${p.categoria ? `<p style="margin: 4px 0 0; font-size: 12px; color: hsl(var(--muted-foreground));">${escapeHtml(p.categoria)}</p>` : ''}
                        </div>
                        <div style="text-align: right; margin-left: 12px;">
                            <p style="margin: 0; font-weight: 700; color: ${stockColor}; font-size: 14px;">${stockIcon} ${p.stock}</p>
                            <p style="margin: 2px 0 0; font-size: 11px; color: hsl(var(--muted-foreground));">Stock</p>
                        </div>
                    </div>
                </div>
            `;
        });
        
        resultadosDiv.innerHTML = html;
        resultadosDiv.style.display = 'block';
    }
}

/**
 * Mostrar resultados al hacer focus
 */
function mostrarResultadosBusqueda() {
    const input = document.getElementById('mermaBuscadorProducto');
    if (input.value.trim().length > 0) {
        buscarProductoMerma();
    }
}

/**
 * Seleccionar producto desde el buscador
 */
function seleccionarProductoBuscadorMerma(id, nombre, stock) {
    productoMermaSeleccionado = {
        id: id,
        nombre: nombre,
        stock: stock
    };
    
    // Ocultar buscador y resultados
    document.getElementById('mermaBuscadorProducto').style.display = 'none';
    document.getElementById('mermaResultadosBusqueda').style.display = 'none';
    
    // Mostrar producto seleccionado
    const seleccionadoDiv = document.getElementById('mermaProductoSeleccionado');
    document.getElementById('mermaProductoNombre').textContent = nombre;
    
    const stockActualElem = document.getElementById('mermaStockActual');
    stockActualElem.textContent = `Stock actual: ${stock} unidades`;
    stockActualElem.style.color = stock > 0 ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))';
    
    seleccionadoDiv.style.display = 'block';
    
    // Configurar campo de cantidad
    const cantidadInput = document.getElementById('mermaCantidad');
    const hint = document.getElementById('mermaCantidadHint');
    cantidadInput.max = stock;
    
    if (stock === 0) {
        cantidadInput.disabled = true;
        cantidadInput.value = '';
        if (hint) {
            hint.textContent = 'Este producto no tiene stock disponible';
            hint.style.color = 'hsl(var(--destructive))';
        }
        mostrarNotificacion('Este producto no tiene stock disponible', 'warning');
    } else {
        cantidadInput.disabled = false;
        cantidadInput.focus();
        if (hint) {
            hint.textContent = `Máximo: ${stock} unidades disponibles`;
            hint.style.color = 'hsl(142 76% 36%)';
        }
    }
    
    validarFormularioMerma();
}

/**
 * Limpiar selección y volver al buscador
 */
function limpiarSeleccionMerma() {
    productoMermaSeleccionado = null;
    
    // Mostrar buscador
    const buscador = document.getElementById('mermaBuscadorProducto');
    if (buscador) {
        buscador.style.display = 'block';
        buscador.value = '';
    }
    
    // Ocultar producto seleccionado
    const seleccionado = document.getElementById('mermaProductoSeleccionado');
    if (seleccionado) seleccionado.style.display = 'none';
    
    // Ocultar resultados
    const resultados = document.getElementById('mermaResultadosBusqueda');
    if (resultados) resultados.style.display = 'none';
    
    // Deshabilitar cantidad y resetear hint
    const cantidadInput = document.getElementById('mermaCantidad');
    if (cantidadInput) {
        cantidadInput.disabled = true;
        cantidadInput.value = '';
    }
    
    const hint = document.getElementById('mermaCantidadHint');
    if (hint) {
        hint.textContent = 'Selecciona primero un producto del buscador';
        hint.style.color = '';
    }
    
    // Limpiar selección de motivo
    document.querySelectorAll('.merma-motivo-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.getElementById('mermaMotivo').value = '';
    
    validarFormularioMerma();
}

/**
 * Cerrar modal de mermas
 */
function cerrarModalMerma() {
    const modal = document.getElementById('modalMerma');
    if (modal) {
        modal.style.display = 'none';
    }
    productoMermaSeleccionado = null;
}

/**
 * Seleccionar motivo de merma desde tarjeta
 */
function seleccionarMotivoMerma(motivo, elemento) {
    // Remover selección previa
    document.querySelectorAll('.merma-motivo-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Seleccionar nueva tarjeta
    elemento.classList.add('selected');
    
    // Actualizar input hidden
    document.getElementById('mermaMotivo').value = motivo;
    
    // Mostrar/ocultar notas
    toggleNotasMerma();
}

/**
 * Mostrar/ocultar campo de notas según motivo
 */
function toggleNotasMerma() {
    const motivo = document.getElementById('mermaMotivo').value;
    const notasContainer = document.getElementById('mermaNotasContainer');
    
    if (motivo === 'Otro') {
        notasContainer.style.display = 'block';
    } else {
        notasContainer.style.display = 'none';
        document.getElementById('mermaNotas').value = '';
    }
    
    validarFormularioMerma();
}

/**
 * Validar formulario y habilitar/deshabilitar botón
 */
function validarFormularioMerma() {
    const cantidad = parseInt(document.getElementById('mermaCantidad').value, 10);
    const motivo = document.getElementById('mermaMotivo').value;
    const notas = document.getElementById('mermaNotas').value.trim();
    const btnConfirmar = document.getElementById('btnConfirmarMerma');
    const resumen = document.getElementById('mermaResumen');
    const textoResumen = document.getElementById('mermaTextoResumen');
    
    let valido = true;
    
    // Validar producto seleccionado
    if (!productoMermaSeleccionado) {
        valido = false;
    }
    
    // Validar cantidad
    if (!cantidad || cantidad <= 0 || (productoMermaSeleccionado && cantidad > productoMermaSeleccionado.stock)) {
        valido = false;
    }
    
    // Validar motivo
    if (!motivo) {
        valido = false;
    }
    
    // Si motivo es "Otro", validar notas
    if (motivo === 'Otro' && !notas) {
        valido = false;
    }
    
    // Habilitar/deshabilitar botón
    btnConfirmar.disabled = !valido;
    
    // Mostrar resumen si hay producto y cantidad
    if (productoMermaSeleccionado && cantidad > 0 && cantidad <= productoMermaSeleccionado.stock) {
        const nuevoStock = productoMermaSeleccionado.stock - cantidad;
        resumen.style.display = 'block';
        textoResumen.textContent = `Se dará de baja ${cantidad} unidad(es) de "${productoMermaSeleccionado.nombre}". Stock resultante: ${nuevoStock}`;
    } else {
        resumen.style.display = 'none';
    }
}

/**
 * Confirmar y mostrar diálogo de confirmación
 */
function confirmarMerma() {
    // Validar autenticación
    if (!requireAuthentication('Registrar merma')) {
        return;
    }

    if (!productoMermaSeleccionado) return;
    
    const cantidad = parseInt(document.getElementById('mermaCantidad').value, 10);
    const motivo = document.getElementById('mermaMotivo').value;
    const notas = document.getElementById('mermaNotas').value.trim();
    
    const nuevoStock = productoMermaSeleccionado.stock - cantidad;
    
    const mensajeConfirmacion = `
ÔÜá´©Å CONFIRMAR REGISTRO DE MERMA

Producto: ${productoMermaSeleccionado.nombre}
Cantidad: ${cantidad} unidad(es)
Motivo: ${motivo}
${motivo === 'Otro' && notas ? `\nDetalle: ${notas}` : ''}

Stock actual: ${productoMermaSeleccionado.stock}
Stock resultante: ${nuevoStock}

ÔÜá´©Å Esta acción reducirá el stock automáticamente.
¿Desea continuar?
    `;
    
    if (confirm(mensajeConfirmacion)) {
        procesarMerma({
            producto_id: productoMermaSeleccionado.id,
            producto_nombre: productoMermaSeleccionado.nombre,
            cantidad: cantidad,
            motivo: motivo === 'Otro' ? notas : motivo,
            notas: motivo === 'Otro' ? null : (notas || null),
            registrado_por: currentUser
        });
    }
}

/**
 * Procesar merma y actualizar stock
 */
async function procesarMerma(datosMerma) {
    console.log('­ƒùæ´©Å Procesando merma:', datosMerma);
    
    const btnConfirmar = document.getElementById('btnConfirmarMerma');
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<span>Procesando...</span>';
    
    try {
        // 1. Insertar registro de merma
        const { data: merma, error: errorMerma } = await window.supabaseClient
            .from('mermas')
            .insert([datosMerma])
            .select()
            .single();
        
        if (errorMerma) throw errorMerma;
        
        console.log('Ô£à Merma registrada:', merma);
        
        // 2. Actualizar stock del producto
        const { data: productoActual, error: errorProducto } = await window.supabaseClient
            .from('productos')
            .select('stock')
            .eq('id', datosMerma.producto_id)
            .single();
        
        if (errorProducto) throw errorProducto;
        
        const nuevoStock = productoActual.stock - datosMerma.cantidad;
        
        if (nuevoStock < 0) {
            throw new Error('El stock resultante no puede ser negativo');
        }
        
        const { error: errorUpdate } = await window.supabaseClient
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', datosMerma.producto_id);
        
        if (errorUpdate) throw errorUpdate;
        
        console.log(`Ô£à Stock actualizado: ${productoActual.stock} ÔåÆ ${nuevoStock}`);
        
        // 3. Cerrar modal
        cerrarModalMerma();
        
        // 4. Mostrar notificación
        mostrarNotificacion(`Merma registrada correctamente. Stock actualizado: ${nuevoStock}`, 'success');
        
        // 5. Recargar vistas afectadas
        if (currentView === 'inventory') {
            await cargarInventario();
            await cargarHistorialMermas();
        }
        
    } catch (error) {
        manejarError(error, {
            contexto: 'procesarMerma',
            mensajeUsuario: 'Error al registrar merma: ' + error.message,
            callback: () => {
                // Restaurar botón
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = '<span>Registrar Merma</span>';
            }
        });
    }
}

/**
 * Cargar historial de mermas (últimos 30 días)
 */
async function cargarHistorialMermas() {
    console.log('­ƒôï Cargando historial de mermas...');
    
    try {
        // Calcular fecha de inicio (últimos 30 días)
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 30);
        const fechaInicioStr = fechaInicio.toISOString();
        
        const { data: mermas, error } = await window.supabaseClient
            .from('mermas')
            .select('*')
            .gte('created_at', fechaInicioStr)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        console.log('Ô£à Mermas cargadas:', mermas.length);
        
        renderTablaMermas(mermas || []);
        
    } catch (error) {
        manejarError(error, {
            contexto: 'cargarHistorialMermas',
            mensajeUsuario: 'Error al cargar mermas: ' + error.message,
            mostrarNotificacion: false,
            callback: () => {
                const container = document.getElementById('tablaMermas');
                if (container) {
                    container.innerHTML = `
                        <p style="text-align: center; color: hsl(var(--destructive)); padding: 24px;">
                            ÔØî Error al cargar mermas: ${error.message}
                        </p>
                    `;
                }
            }
        });
    }
}

/**
 * Renderizar tabla de mermas
 */
function renderTablaMermas(mermas) {
    const container = document.getElementById('tablaMermas');
    
    if (!container) {
        console.error('ÔØî Contenedor de mermas no encontrado');
        return;
    }
    
    if (mermas.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 48px; color: hsl(var(--muted-foreground));">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin-bottom: 16px; opacity: 0.3;">
                    <path d="M10 6v4m0 4h.01M6 2l2 2m6-2l-2 2m-6 14h8a2 2 0 002-2V8l-6-6H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p style="font-weight: 600; margin: 0;">No hay mermas registradas</p>
                <p style="font-size: 14px; margin-top: 4px;">Los últimos 30 días</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <table class="sales-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                    <th>Registrado Por</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    mermas.forEach(m => {
        const fecha = new Date(m.created_at).toLocaleString('es-CL', { 
            timeZone: 'America/Santiago',
            dateStyle: 'short',
            timeStyle: 'short'
        });
        
        html += `
            <tr>
                <td><strong>#${m.id}</strong></td>
                <td>${fecha}</td>
                <td>${m.producto_nombre}</td>
                <td style="color: hsl(var(--destructive)); font-weight: 600;">-${m.cantidad}</td>
                <td>
                    <span style="font-size: 13px; color: hsl(var(--muted-foreground));">
                        ${m.motivo}
                    </span>
                    ${m.notas ? `<br><small style="font-size: 11px;">${m.notas}</small>` : ''}
                </td>
                <td>${m.registrado_por}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// ===================================
// FIN DE FUNCIONES DE INVENTARIO
// ===================================