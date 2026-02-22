// MODERN POS SYSTEM - JavaScript
// ===============================

// Versión de la aplicación
const APP_VERSION = '1.1.0-20260119';

// Mostrar versión en consola
console.log(`📱 Sabrofood POS v${APP_VERSION}`);
console.log('🔗 Conectando a Supabase...');

// Estado global
let currentUser = '';
let currentUserRole = ''; // 'vendedor' o 'encargado'
let currentView = 'pos';
let productos = [];
let carrito = [];
let totalVenta = 0;
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

// ===================================
// FORZAR ACTUALIZACIÓN (CACHE BUSTING)
// ===================================

function forzarActualizacion() {
    if (confirm('Esto borrará el caché y recargará la aplicación. ¿Continuar?')) {
        // Borrar localStorage
        localStorage.clear();

        // Borrar sessionStorage
        sessionStorage.clear();

        // Desregistrar Service Workers si existen
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.unregister();
                }
            });
        }

        // Borrar cache API si existe
        if ('caches' in window) {
            caches.keys().then(function(names) {
                for (let name of names) {
                    caches.delete(name);
                }
            });
        }

        // Recargar con timestamp único para evitar caché
        const timestamp = new Date().getTime();
        window.location.href = window.location.origin + window.location.pathname + '?nocache=' + timestamp;
    }
}

// Detectar si la página viene de caché y mostrar notificación
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        console.warn('⚠️ Página cargada desde caché. Puede que no veas la última versión.');
    } else if (window.performance) {
        const navEntries = window.performance.getEntriesByType('navigation');
        if (navEntries.length > 0 && navEntries[0].type === 'back_forward') {
            console.warn('⚠️ Página cargada desde caché de navegación. Puede que no veas la última versión.');
        }
    }
});

// Verificar si hay nueva versión disponible
function verificarVersion() {
    const versionGuardada = localStorage.getItem('app_version');

    if (versionGuardada && versionGuardada !== APP_VERSION) {
        console.log(`🔄 Nueva versión detectada: ${versionGuardada} → ${APP_VERSION}`);

        // Mostrar notificación de actualización
        if (confirm('¡Hay una nueva versión disponible! ¿Deseas actualizar ahora?')) {
            forzarActualizacion();
        }
    }

    localStorage.setItem('app_version', APP_VERSION);
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    verificarVersion();
    console.log('🚀 Iniciando POS System...');
    initApp();
});

async function initApp() {
    console.log('🔧 Inicializando aplicación...');
    
    // Verificar si hay sesión guardada (nuevo sistema con validación de BD)
    const sesionRestaurada = await verificarSesionGuardada();

    if (sesionRestaurada) {
        console.log('✅ Sesión restaurada automáticamente');
        return;
    }

    console.log('ℹ️ No hay sesión guardada - mostrando login');
    
    // Limpiar sesión antigua si existe
    localStorage.removeItem('sabrofood_user');

    // Mostrar pantalla de login
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

// ===================================
// SISTEMA DE SINCRONIZACIÓN REALTIME
// ===================================

/**
 * Inicializar suscripción a cambios en tiempo real
 */
function inicializarRealtime() {
    if (!supabaseClient) {
        console.warn('⚠️ Supabase no disponible, Realtime deshabilitado');
        return;
    }

    console.log('🔴 Iniciando suscripción Realtime...');

    // Crear canal para escuchar cambios en productos
    realtimeChannel = supabaseClient
        .channel('productos-changes')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'productos'
            },
            (payload) => {
                console.log('🔄 Cambio detectado en producto:', payload.new);
                actualizarProductoEnTiempoReal(payload.new);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Suscripción Realtime activa');
                mostrarNotificacion('Sistema en tiempo real activado', 'success');
            }
        });
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

    // Actualizar visualmente en la grilla de productos
    const productCard = document.querySelector(`[data-producto-id="${productoActualizado.id}"]`);
    if (productCard) {
        const stockElement = productCard.querySelector('.product-stock');
        const stock = productoActualizado.stock || 0;

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
    if (!supabaseClient) return true;

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
        const { data: productosActuales, error } = await supabaseClient
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
        console.error('Error validando stock:', error);
        mostrarNotificacion('Error verificando disponibilidad de productos', 'error');
        return false;
    }
}

/**
 * Desconectar Realtime al cerrar sesión
 */
function desconectarRealtime() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
        console.log('🔴 Realtime desconectado');
    }
}

// ===================================
// AUTENTICACIÓN
// ===================================

async function handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const rememberDevice = document.getElementById('rememberDevice').checked;

    if (!username) {
        mostrarNotificacion('Por favor selecciona un vendedor', 'error');
        return;
    }

    if (!password) {
        mostrarNotificacion('Por favor ingresa tu contraseña', 'error');
        return;
    }

    // Deshabilitar botón durante validación
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span>Validando...</span>';

    try {
        // Validar credenciales con Supabase
        const { data, error } = await supabaseClient.rpc('validar_login', {
            p_username: username,
            p_password: password
        });

        if (error) throw error;

        // Si no hay datos, credenciales inválidas
        if (!data || data.length === 0) {
            mostrarNotificacion('Usuario o contraseña incorrectos', 'error');
            loginBtn.disabled = false;
            loginBtn.innerHTML = `
                <span>Iniciar Sesión</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            return;
        }

        const userData = data[0];

        // Verificar si usuario está activo
        if (!userData.activo) {
            mostrarNotificacion('Usuario inactivo. Contacta al administrador', 'error');
            loginBtn.disabled = false;
            loginBtn.innerHTML = `
                <span>Iniciar Sesión</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            return;
        }

        // Login exitoso
        currentUser = userData.username;
        currentUserRole = userData.role;

        // Guardar en localStorage si marcó "recordar"
        if (rememberDevice) {
            const token = btoa(JSON.stringify({
                username: currentUser,
                role: currentUserRole,
                timestamp: Date.now()
            }));
            localStorage.setItem('sabrofood_session', token);
        }

        // Aplicar permisos por rol
        aplicarPermisosRol();

        // Ocultar login y mostrar app
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'grid';

        // Actualizar nombre de usuario en la UI
        document.getElementById('sidebarUsername').textContent = currentUser;
        document.getElementById('topUsername').textContent = currentUser;
        if (document.getElementById('topUsernameAsistencia')) {
            document.getElementById('topUsernameAsistencia').textContent = currentUser;
        }
        if (document.getElementById('topUsernameAsistencia')) {
            document.getElementById('topUsernameAsistencia').textContent = currentUser;
        }

        // Ir al POS
        cambiarVista('pos');

        // Cargar datos
        cargarProductos();
        inicializarRealtime();
        inicializarProveedores(); // Cargar proveedores desde localStorage

        console.log('✅ Login exitoso:', currentUser, '| Rol:', currentUserRole);
        
        // Notificación de bienvenida y recordatorio de asistencia
        mostrarNotificacion(`Bienvenido, ${currentUser}`, 'success');
        
        // Recordar marcar entrada manualmente
        setTimeout(() => {
            mostrarNotificacion('📋 Recuerda marcar tu entrada en la pestaña Asistencia', 'info');
        }, 3000);

    } catch (error) {
        console.error('❌ Error en login:', error);
        mostrarNotificacion('Error al validar credenciales', 'error');
        loginBtn.disabled = false;
        loginBtn.innerHTML = `
            <span>Iniciar Sesión</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }
}

// Función auxiliar para aplicar permisos según rol
function aplicarPermisosRol() {
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

async function handleLogout() {
    if (carrito.length > 0) {
        if (!confirm('Tienes productos en el carrito. ¿Deseas cerrar sesión de todas formas?')) {
            return;
        }
    }

    // Recordatorio: marcar salida manualmente
    // La marca de asistencia ahora es completamente manual

    // Desconectar Realtime
    desconectarRealtime();

    // Limpiar datos
    currentUser = '';
    currentUserRole = '';
    carrito = [];
    productos = [];

    // Limpiar sesión guardada (nuevo sistema)
    localStorage.removeItem('sabrofood_session');
    // Limpiar sesión antigua (por compatibilidad)
    localStorage.removeItem('sabrofood_user');

    // Recargar página para estado limpio
    window.location.reload();
}

// Verificar sesión guardada al cargar
async function verificarSesionGuardada() {
    console.log('🔍 Verificando sesión guardada...');
    const sessionToken = localStorage.getItem('sabrofood_session');

    if (!sessionToken) {
        console.log('ℹ️ No hay token de sesión guardado');
        return false;
    }

    try {
        // Decodificar token
        const sessionData = JSON.parse(atob(sessionToken));
        console.log('✅ Token decodificado:', { username: sessionData.username, timestamp: new Date(sessionData.timestamp) });

        // Verificar que no sea muy antigua (30 días máximo)
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const edad = Date.now() - sessionData.timestamp;
        const diasTranscurridos = Math.floor(edad / (24 * 60 * 60 * 1000));
        
        console.log(`⏱️ Sesión tiene ${diasTranscurridos} días de antigüedad (máximo: 30 días)`);
        
        if (edad > thirtyDays) {
            console.warn('⚠️ Sesión expirada (más de 30 días)');
            localStorage.removeItem('sabrofood_session');
            return false;
        }

        // Verificar que el usuario aún existe y está activo
        console.log('🔄 Verificando usuario en base de datos...');
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('username, role, activo')
            .eq('username', sessionData.username)
            .single();

        if (error) {
            console.error('❌ Error al verificar usuario:', error);
            localStorage.removeItem('sabrofood_session');
            return false;
        }
        
        if (!data) {
            console.warn('⚠️ Usuario no encontrado en BD');
            localStorage.removeItem('sabrofood_session');
            return false;
        }
        
        if (!data.activo) {
            console.warn('⚠️ Usuario inactivo');
            localStorage.removeItem('sabrofood_session');
            return false;
        }

        console.log('✅ Usuario válido y activo:', data.username, '| Rol:', data.role);

        // Restaurar sesión
        currentUser = data.username;
        currentUserRole = data.role;

        // Aplicar permisos
        aplicarPermisosRol();

        // Mostrar app
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'grid';

        // Actualizar UI
        document.getElementById('sidebarUsername').textContent = currentUser;
        document.getElementById('topUsername').textContent = currentUser;
        if (document.getElementById('topUsernameAsistencia')) {
            document.getElementById('topUsernameAsistencia').textContent = currentUser;
        }

        // Ir al POS
        cambiarVista('pos');

        // Cargar datos
        cargarProductos();
        inicializarRealtime();

        console.log('🎉 Sesión restaurada exitosamente:', currentUser);
        return true;

    } catch (error) {
        console.error('❌ Error al verificar sesión:', error);
        localStorage.removeItem('sabrofood_session');
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
        // Si es admin, cargar lista de vendedores para el filtro
        if (currentUserRole === 'encargado') {
            cargarVendedoresParaFiltro();
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
        console.log('📦 Cargando productos desde Supabase...');
        console.log('🔍 Cliente Supabase:', supabaseClient ? '✅ Conectado' : '❌ No conectado');
        console.log('🌐 URL:', window.location.href);
        console.log('📱 App Version:', APP_VERSION);

        if (typeof supabaseClient === 'undefined' || !supabaseClient) {
            console.error('❌ Supabase no está configurado');
            mostrarNotificacion('Error: Supabase no conectado', 'error');
            console.warn('⚠️ Usando productos MOCK de prueba');
            mostrarProductosMock();
            return;
        }

        console.log('🔍 Consultando tabla productos...');
        console.log('📡 Supabase URL:', SUPABASE_CONFIG?.url);

        const { data, error } = await supabaseClient
            .from('productos')
            .select('*')
            .order('nombre', { ascending: true });

        console.log('📊 Respuesta de Supabase:');
        console.log('  - Productos encontrados:', data ? data.length : 0);
        console.log('  - Error:', error);

        if (error) {
            console.error('❌ Error Supabase:', error);
            console.error('   Código:', error.code);
            console.error('   Mensaje:', error.message);
            mostrarNotificacion('Error al cargar productos: ' + error.message, 'error');
            console.warn('⚠️ Usando productos MOCK de prueba');
            mostrarProductosMock();
            return;
        }

        if (!data || data.length === 0) {
            console.warn('⚠️ No hay productos activos en la base de datos');
            mostrarNotificacion('No hay productos activos', 'warning');
            productos = [];
            renderProductos();
            return;
        }

        productos = data;
        console.log(`✅ ${productos.length} productos cargados correctamente`);
        console.log('📋 Primeros 3 productos:', productos.slice(0, 3));
        mostrarNotificacion(`${productos.length} productos cargados de Supabase`, 'success');
        renderProductos();

    } catch (error) {
        console.error('❌ Error crítico:', error);
        console.error('   Stack:', error.stack);
        mostrarNotificacion('Error al cargar productos', 'error');
        console.warn('⚠️ Usando productos MOCK de prueba');
        mostrarProductosMock();
    }
}

function mostrarProductosMock() {
    console.log('📦 Usando productos de demostración');
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
    if (!grid) return;

    let productosFiltrados = productos;

    // Filtrar por categoría
    if (categoriaActual !== 'Todos') {
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
    }

    // Filtrar por búsqueda
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value) {
        const search = searchInput.value.toLowerCase();
        productosFiltrados = productosFiltrados.filter(p =>
            p.nombre.toLowerCase().includes(search) ||
            (p.marca && p.marca.toLowerCase().includes(search)) ||
            (p.categoria && p.categoria.toLowerCase().includes(search))
        );
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
                <div class="product-category">${producto.marca || producto.categoria || 'General'}</div>
                <div class="product-price">$${formatoMoneda(producto.precio || 0)}</div>
                <button class="btn-add-product" onclick="agregarAlCarrito(${producto.id})">+ Agregar</button>
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
    console.log('🛒 Producto agregado:', producto.nombre);
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

// Event listener para búsqueda
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            renderProductos();
        }, 300));
    }

    // Event listener para búsqueda por código de barras
    const inputCodigoBarras = document.getElementById('inputCodigoBarras');
    if (inputCodigoBarras) {
        // Auto-focus al cargar
        inputCodigoBarras.focus();

        // Mostrar/ocultar botón de limpiar
        inputCodigoBarras.addEventListener('input', (e) => {
            const btnClear = document.querySelector('.btn-clear-search');
            if (btnClear) {
                btnClear.style.display = e.target.value ? 'block' : 'none';
            }
        });

        inputCodigoBarras.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const codigo = e.target.value.trim();
                if (codigo) {
                    const producto = await buscarPorCodigoBarras(codigo);
                    if (producto) {
                        agregarAlCarrito(producto.id);
                        mostrarNotificacion(`✅ ${producto.nombre} agregado`, 'success');
                        e.target.value = '';
                        e.target.focus(); // Mantener focus para siguiente escaneo

                        // Ocultar botón limpiar
                        const btnClear = document.querySelector('.btn-clear-search');
                        if (btnClear) btnClear.style.display = 'none';
                    } else {
                        mostrarNotificacion('❌ Código no encontrado. Intenta buscar por nombre', 'warning');
                        // Opcional: mover focus al campo de búsqueda manual
                        setTimeout(() => {
                            const searchInput = document.getElementById('searchInput');
                            if (searchInput) searchInput.focus();
                        }, 1500);
                    }
                }
            }
        });
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

function abrirModalCobro() {
    if (carrito.length === 0) return;

    // Limpiar pagos registrados
    pagosRegistrados = [];
    metodoPagoSeleccionado = 'Efectivo';

    document.getElementById('pagoTotal').textContent = '$' + formatoMoneda(totalVenta);
    document.getElementById('montoEntregado').value = '';
    document.getElementById('montoTarjeta').value = '';
    document.getElementById('montoTransferencia').value = '';
    document.getElementById('vueltoAmount').textContent = '$0';

    // Limpiar campos de pago mixto
    const mixtoEfectivo = document.getElementById('montoMixtoEfectivo');
    const mixtoTarjeta = document.getElementById('montoMixtoTarjeta');
    const mixtoTransferencia = document.getElementById('montoMixtoTransferencia');
    if (mixtoEfectivo) mixtoEfectivo.value = '';
    if (mixtoTarjeta) mixtoTarjeta.value = '';
    if (mixtoTransferencia) mixtoTransferencia.value = '';

    // Limpiar display de pagos
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

    // Activar método efectivo
    document.querySelectorAll('.payment-method').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('[data-metodo="Efectivo"]').classList.add('active');

    // Mostrar solo el área de efectivo
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

    const modal = document.getElementById('modalCobro');
    modal.style.display = 'flex';
    modal.classList.add('show');
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

async function finalizarVenta() {
    if (!currentUser) {
        mostrarNotificacion('Error: No hay vendedor seleccionado', 'error');
        return;
    }

    if (carrito.length === 0) return;

    let metodoPagoFinal;
    let montoPagadoTotal = 0;

    // NUEVO: Si es pago mixto simplificado
    if (metodoPagoSeleccionado === 'Mixto') {
        const efectivo = parseFloat(document.getElementById('montoMixtoEfectivo').value) || 0;
        const tarjeta = parseFloat(document.getElementById('montoMixtoTarjeta').value) || 0;
        const transferencia = parseFloat(document.getElementById('montoMixtoTransferencia').value) || 0;
        
        const totalIngresado = efectivo + tarjeta + transferencia;
        
        if (totalIngresado < totalVenta) {
            mostrarNotificacion(`Falta completar el pago. Ingresado: $${formatoMoneda(totalIngresado)} de $${formatoMoneda(totalVenta)}`, 'error');
            return;
        }
        
        // Construir array de pagos registrados automáticamente
        pagosRegistrados = [];
        if (efectivo > 0) pagosRegistrados.push({ metodo: 'Efectivo', monto: efectivo });
        if (tarjeta > 0) pagosRegistrados.push({ metodo: 'Tarjeta', monto: tarjeta });
        if (transferencia > 0) pagosRegistrados.push({ metodo: 'Transferencia', monto: transferencia });
        
        montoPagadoTotal = totalIngresado;
        metodoPagoFinal = 'Mixto (' + pagosRegistrados.map(p => p.metodo).join(' + ') + ')';
    }
    // Si hay pagos parciales registrados
    else if (pagosRegistrados.length > 0) {
        montoPagadoTotal = pagosRegistrados.reduce((sum, p) => sum + p.monto, 0);

        // Verificar si falta completar el pago
        if (montoPagadoTotal < totalVenta) {
            mostrarNotificacion(`Falta completar el pago. Pendiente: $${formatoMoneda(totalVenta - montoPagadoTotal)}`, 'error');
            return;
        }

        // Si hay múltiples métodos, el método es "Mixto"
        if (pagosRegistrados.length > 1) {
            metodoPagoFinal = 'Mixto (' + pagosRegistrados.map(p => p.metodo).join(' + ') + ')';
        } else {
            metodoPagoFinal = pagosRegistrados[0].metodo;
        }
    } else {
        // Pago único (flujo normal)
        if (!metodoPagoSeleccionado) {
            mostrarNotificacion('Selecciona un método de pago', 'error');
            return;
        }

        // Validar pago según método
        if (metodoPagoSeleccionado === 'Efectivo') {
            const montoEntregado = parseFloat(document.getElementById('montoEntregado').value) || 0;
            if (montoEntregado < totalVenta) {
                mostrarNotificacion('Monto insuficiente', 'error');
                return;
            }
        }

        metodoPagoFinal = metodoPagoSeleccionado;
    }

    // ✅ VALIDACIÓN FINAL DE STOCK EN TIEMPO REAL
    const stockDisponible = await validarStockAntesDeVenta();
    if (!stockDisponible) {
        return; // Detener venta si no hay stock
    }

    try {
        // Si Supabase está disponible, guardar venta
        if (typeof supabaseClient !== 'undefined') {
            const ahora = new Date();
            const venta = {
                vendedor_nombre: currentUser,
                total: totalVenta,
                metodo_pago: metodoPagoFinal,
                fecha: ahora.toISOString().split('T')[0] // Solo fecha YYYY-MM-DD
            };

            // Si es pago mixto, guardar detalle de pagos
            if (pagosRegistrados.length > 0) {
                venta.pagos_detalle = JSON.stringify(pagosRegistrados);
            }

            console.log('💾 Guardando venta:', venta);

            const { data: ventaGuardada, error } = await supabaseClient
                .from('ventas')
                .insert([venta])
                .select();

            if (error) {
                console.error('❌ Error guardando venta:', error);
                mostrarNotificacion('Error al guardar la venta: ' + error.message, 'error');
                return;
            }

            console.log('✅ Venta guardada:', ventaGuardada);

            const ventaId = ventaGuardada[0].id;
            console.log('📦 Guardando items de la venta #' + ventaId);

            // Guardar items en ventas_items
            const items = carrito.map(item => {
                if (item.esGranel) {
                    // Item de granel: guardar monto fijo en lugar de precio * cantidad
                    return {
                        venta_id: ventaId,
                        producto_id: item.id,
                        cantidad: 1, // Siempre 1 para granel
                        precio_unitario: item.montoGranel, // El monto total vendido
                        subtotal: item.montoGranel,
                        producto_nombre: item.nombre + ' (Granel)',
                        es_granel: true, // Marcador para reporting
                        peso_estimado_kg: item.pesoEstimado // Informativo
                    };
                } else {
                    // Item normal
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

            const { error: itemsError } = await supabaseClient
                .from('ventas_items')
                .insert(items);

            if (itemsError) {
                console.error('❌ Error guardando items:', itemsError);
                mostrarNotificacion('Advertencia: Items no guardados - ' + itemsError.message, 'warning');
            } else {
                console.log('✅ Items guardados:', items.length);
            }

            // Actualizar stock SOLO para productos normales (NO granel)
            // PERMITE STOCK NEGATIVO: Si se vende más de lo disponible, el stock queda en negativo
            for (const item of carrito) {
                if (item.esGranel) {
                    // NO descontar stock para productos a granel
                    console.log(`⏭️ Saltando actualización de stock para granel: ${item.nombre}`);
                    continue;
                }

                const nuevoStock = item.stock - item.cantidad; // Permite valores negativos

                const { error: stockError } = await supabaseClient
                    .from('productos')
                    .update({ stock: nuevoStock })
                    .eq('id', item.id);

                if (stockError) {
                    console.error('❌ Error actualizando stock:', stockError);
                } else if (nuevoStock < 0) {
                    console.warn(`⚠️ Stock negativo: ${item.nombre} quedó en ${nuevoStock}`);
                }
            }
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
        console.error('Error:', error);
        mostrarNotificacion('Error al procesar la venta', 'error');
    }
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

async function cargarInventario() {
    if (productos.length === 0) {
        await cargarProductos();
    }

    // Estadísticas
    const totalProductos = productos.length;
    const enStock = productos.filter(p => p.stock > (p.stock_minimo || 5)).length;
    const stockBajo = productos.filter(p => p.stock > 0 && p.stock <= (p.stock_minimo || 5)).length;
    const sinStock = productos.filter(p => p.stock === 0).length;

    document.getElementById('totalProductos').textContent = totalProductos;
    document.getElementById('enStock').textContent = enStock;
    document.getElementById('stockBajo').textContent = stockBajo;
    document.getElementById('sinStock').textContent = sinStock;

    // Filtrar y ordenar productos según filtro activo
    let productosFiltrados = [...productos];

    switch(filtroInventarioActivo) {
        case 'sinstock':
            productosFiltrados = productos.filter(p => p.stock === 0);
            // Ordenar por nombre
            productosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
            break;
        case 'stockbajo':
            productosFiltrados = productos.filter(p => p.stock > 0 && p.stock <= (p.stock_minimo || 5));
            // Ordenar de menor a mayor stock
            productosFiltrados.sort((a, b) => a.stock - b.stock);
            break;
        case 'enstock':
            productosFiltrados = productos.filter(p => p.stock > (p.stock_minimo || 5));
            // Ordenar de mayor a menor stock
            productosFiltrados.sort((a, b) => b.stock - a.stock);
            break;
        case 'todos':
        default:
            // Sin filtro, ordenar por categoría y nombre
            productosFiltrados.sort((a, b) => {
                const categoriaCompare = (a.categoria || '').localeCompare(b.categoria || '');
                return categoriaCompare !== 0 ? categoriaCompare : a.nombre.localeCompare(b.nombre);
            });
            break;
    }

    // Aplicar filtro adicional por proveedor si está seleccionado
    const filtroProveedorSelect = document.getElementById('filtroProveedor');
    if (filtroProveedorSelect) {
        const proveedorSeleccionado = filtroProveedorSelect.value;
        if (proveedorSeleccionado) {
            if (proveedorSeleccionado === 'Sin proveedor') {
                // Filtrar productos sin proveedor (null, '', o 'Sin proveedor')
                productosFiltrados = productosFiltrados.filter(p => 
                    !p.proveedor || p.proveedor === '' || p.proveedor === 'Sin proveedor'
                );
            } else {
                // Filtrar por proveedor específico
                productosFiltrados = productosFiltrados.filter(p => 
                    p.proveedor === proveedorSeleccionado
                );
            }
        }
    }

    // Tabla
    const tbody = document.getElementById('inventoryTableBody');

    // Si no hay productos con el filtro activo
    if (productosFiltrados.length === 0) {
        let mensajeFiltro = 'No hay productos';
        switch(filtroInventarioActivo) {
            case 'sinstock': mensajeFiltro = 'No hay productos sin stock'; break;
            case 'stockbajo': mensajeFiltro = 'No hay productos con stock bajo'; break;
            case 'enstock': mensajeFiltro = 'No hay productos en stock'; break;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #6b7280;">
                    <div style="font-size: 48px; margin-bottom: 12px;">📦</div>
                    <div style="font-size: 16px; font-weight: 600;">${mensajeFiltro}</div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = productosFiltrados.map(p => {
        // Validar que el producto tenga ID válido
        if (!p.id) {
            console.error('Producto sin ID:', p);
            return '';
        }

        // Detectar si es producto granel
        const esGranel = p.nombre && p.nombre.toLowerCase().includes('(granel)') || p.tipo === 'granel';

        const stockBajo = p.stock <= (p.stock_minimo_sacos || 5);
        const stockCero = p.stock === 0;

        let estadoBadge = 'badge-success';
        let estadoTexto = 'En Stock';
        
        // Para productos granel NO mostrar estado de stock
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

        // Código de barras status
        let codigoBarrasHTML = '';
        if (p.codigo_barras && p.codigo_barras.trim() !== '') {
            const codigoEscapado = escapeHtml(p.codigo_barras);
            codigoBarrasHTML = `<span class="codigo-asignado">✅ ${codigoEscapado}</span>`;
        } else {
            codigoBarrasHTML = `<span class="sin-codigo">⚠️ Sin código</span>`;
        }

        // Escapar el nombre del producto para evitar problemas con HTML
        const nombreEscapado = escapeHtml(p.nombre);

        // Botón de eliminar solo para encargado
        const btnEliminar = currentUserRole === 'encargado' ? `
            <button class="btn-icon btn-icon-delete" onclick="eliminarProductoDirecto(${p.id})" title="Eliminar">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M7 3h6M3 5h14M5 5v11a2 2 0 002 2h6a2 2 0 002-2V5M8 9v6M12 9v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        ` : '';

        // Mostrar proveedor, categoria en formato: "Proveedor, Categoria"
        let proveedorCategoria = '';
        if (p.proveedor && p.proveedor !== '' && p.proveedor !== 'Sin proveedor') {
            proveedorCategoria = p.proveedor;
        }
        
        return `
            <tr>
                <td><strong>${nombreEscapado}</strong></td>
                <td>${proveedorCategoria || '-'}</td>
                <td>${p.categoria || '-'}</td>
                <td>$${formatoMoneda(p.precio)}</td>
                <td><strong>${Math.floor(p.stock)}</strong></td>
                <td>${codigoBarrasHTML}</td>
                <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
                <td>
                    <button class="btn-icon" onclick="editarProducto(${p.id})" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                            <path d="M13.5 6.5l-8 8V17h2.5l8-8m-2.5-2.5l2-2 2.5 2.5-2 2m-2.5-2.5l2.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    ${btnEliminar}
                </td>
            </tr>
        `;
    }).join('');
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

async function cargarVentas() {
    const periodo = parseInt(document.getElementById('periodoVentas')?.value, 10) || 30;

    try {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) {
            mostrarVentasMock();
            return;
        }

        // Cargar ventas del período
        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - periodo);
        const fechaInicioStr = fechaInicio.toISOString().split('T')[0]; // Solo YYYY-MM-DD

        // Filtrar por vendedor si no es admin
        const esAdmin = currentUserRole === 'encargado';
        let query = supabaseClient
            .from('ventas')
            .select('*')
            .gte('fecha', fechaInicioStr);

        // Si no es admin, solo mostrar sus ventas
        if (!esAdmin && currentUser) {
            query = query.eq('vendedor_nombre', currentUser);
        }

        const { data: ventas, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Error:', error);
            mostrarVentasMock();
            return;
        }

        // Cargar items con nombres de productos por venta
        if (ventas.length > 0) {
            const ventasIds = ventas.map(v => v.id);
            const { data: items, error: itemsError } = await supabaseClient
                .from('ventas_items')
                .select('venta_id, cantidad, producto_nombre')
                .in('venta_id', ventasIds);

            if (!itemsError && items) {
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

                // Agregar items y conteo a cada venta
                ventas.forEach(venta => {
                    const items = itemsPorVenta[venta.id] || [];
                    venta.productos = items;
                    venta.total_items = items.reduce((sum, item) => sum + item.cantidad, 0);
                });

                console.log('📦 Items por venta cargados');
            }
        }

        // 🔄 CARGAR MOVIMIENTOS DE STOCK (salidas por reparto)
        console.log('🔍 Consultando movimientos de stock desde:', fechaInicioStr);
        
        const { data: movimientos, error: movError } = await supabaseClient
            .from('movimientos_stock')
            .select('*')
            .eq('tipo', 'SALIDA')
            .gte('created_at', fechaInicioStr)
            .order('created_at', { ascending: false });

        if (movError) {
            console.error('❌ Error cargando movimientos de stock:', movError);
        } else {
            console.log(`📦 Movimientos encontrados:`, movimientos?.length || 0);
            
            if (movimientos && movimientos.length > 0) {
                // Obtener nombres de productos
                const productosIds = [...new Set(movimientos.map(m => m.producto_id).filter(Boolean))];
                console.log('🔍 Consultando nombres de productos:', productosIds);
                
                let nombresProductos = {};
                if (productosIds.length > 0) {
                    const { data: prods } = await supabaseClient
                        .from('productos')
                        .select('id, nombre')
                        .in('id', productosIds);
                    
                    if (prods) {
                        nombresProductos = Object.fromEntries(prods.map(p => [p.id, p.nombre]));
                    }
                }
                
                // Obtener nombres de repartidores desde pedidos
                const pedidosIds = [...new Set(movimientos.map(m => m.pedido_id).filter(Boolean))];
                console.log('🔍 Consultando pedidos para obtener repartidores:', pedidosIds.length);
                
                let repartidoresPorPedido = {};
                if (pedidosIds.length > 0) {
                    const { data: pedidos } = await supabaseClient
                        .from('pedidos')
                        .select('id, chofer_asignado')
                        .in('id', pedidosIds);
                    
                    if (pedidos) {
                        repartidoresPorPedido = Object.fromEntries(
                            pedidos.map(p => [p.id, p.chofer_asignado || 'Sin asignar'])
                        );
                        console.log('✅ Repartidores obtenidos:', Object.keys(repartidoresPorPedido).length);
                    }
                }
                
                // Transformar movimientos al formato de "ventas" para la tabla
                const movimientosFormateados = movimientos.map(m => {
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
                        total: esGranel ? m.cantidad : 0, // Si es granel, cantidad = monto en pesos
                        metodo_pago: 'REPARTO',
                        pedido_id: m.pedido_id,
                        tipo_registro: 'movimiento', // Marca para diferenciar
                        motivo: m.motivo,
                        es_granel: esGranel
                    };
                });
                
                console.log('✅ Movimientos formateados:', movimientosFormateados.length);
                
                // Combinar ventas con movimientos en un nuevo array
                const todosLosRegistros = [...ventas, ...movimientosFormateados];
                
                // Reordenar por fecha
                todosLosRegistros.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                console.log('📊 Total registros (ventas + movimientos):', todosLosRegistros.length);
                
                // Calcular KPIs (solo con ventas reales, no movimientos)
                calcularKPIs(ventas);

                // Generar gráficos
                generarGraficoVentasDiarias(ventas, periodo);
                generarGraficoMetodosPago(ventas);
                await generarGraficoTopProductos(periodo);

                // Ranking de vendedores solo para admin
                if (esAdmin) {
                    generarTablaVendedores(ventas);
                    const ranking = document.getElementById('rankingVendedores');
                    if (ranking) ranking.style.display = 'block';
                } else {
                    const ranking = document.getElementById('rankingVendedores');
                    if (ranking) ranking.style.display = 'none';
                }

                // Renderizar tabla de historial (con ventas Y movimientos)
                renderTablaHistorial(todosLosRegistros);
                return; // Salir temprano ya que procesamos todo
            }
        }

        // Si NO hay movimientos, procesar solo ventas
        calcularKPIs(ventas);

        // Generar gráficos
        generarGraficoVentasDiarias(ventas, periodo);
        generarGraficoMetodosPago(ventas);
        await generarGraficoTopProductos(periodo);

        // Ranking de vendedores solo para admin
        if (esAdmin) {
            generarTablaVendedores(ventas);
            const ranking = document.getElementById('rankingVendedores');
            if (ranking) ranking.style.display = 'block';
        } else {
            const ranking = document.getElementById('rankingVendedores');
            if (ranking) ranking.style.display = 'none';
        }

        // Renderizar tabla de historial
        renderTablaHistorial(ventas);

    } catch (error) {
        console.error('Error cargando ventas:', error);
        mostrarNotificacion('Error cargando ventas', 'error');
    }
}

function actualizarVentas() {
    cargarVentas();
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
        const ventaFecha = v.fecha.split('T')[0]; // Extraer solo YYYY-MM-DD
        return ventaFecha === fechaHoy;
    });
    const totalHoy = ventasHoy.reduce((sum, v) => sum + v.total, 0);
    document.getElementById('kpiVentasHoy').textContent = '$' + formatoMoneda(totalHoy);

    console.log('📊 KPI Ventas Hoy:', {
        fechaHoy,
        ventasEncontradas: ventasHoy.length,
        total: totalHoy,
        ventas: ventasHoy
    });

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
        // If Supabase is not available, skip this chart
        if (typeof supabaseClient === 'undefined' || !supabaseClient) {
            console.log('⚠️ Supabase no disponible, omitiendo gráfico de top productos');
            return;
        }

        const fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - periodo);
        const fechaInicioStr = fechaInicio.toISOString().split('T')[0]; // YYYY-MM-DD

        // Obtener ventas del período
        const { data: ventas } = await supabaseClient
            .from('ventas')
            .select('id')
            .gte('fecha', fechaInicioStr);

        if (!ventas || ventas.length === 0) {
            console.log('ℹ️ No hay ventas en el período para productos');
            return;
        }

        const ventasIds = ventas.map(v => v.id);

        // Obtener items vendidos
        const { data: items, error: itemsError } = await supabaseClient
            .from('ventas_items')
            .select('producto_nombre, cantidad')
            .in('venta_id', ventasIds);

        if (itemsError || !items || items.length === 0) {
            console.warn('⚠️ No hay items de ventas en el período');
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

        const ctx = document.getElementById('chartTopProductos');

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
        console.error('Error generando top productos:', error);
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

function renderTablaHistorial(ventas) {
    const tbody = document.getElementById('salesTableBody');

    if (ventas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <p style="padding: 24px; color: hsl(var(--muted-foreground));">No hay ventas en este período</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = ventas.slice(0, 50).map(v => {
        const esMovimiento = v.tipo_registro === 'movimiento';
        
        // Formatear lista de productos
        let productosTexto = '';
        if (v.productos && v.productos.length > 0) {
            if (v.productos.length <= 2) {
                // Mostrar todos si son 2 o menos
                productosTexto = v.productos.map(p => `${p.nombre} (${p.cantidad})`).join(', ');
            } else {
                // Mostrar primeros 2 y agregar contador
                const primeros = v.productos.slice(0, 2).map(p => `${p.nombre} (${p.cantidad})`).join(', ');
                const restantes = v.productos.length - 2;
                productosTexto = `${primeros} <span style="color: hsl(var(--muted-foreground));">(+${restantes} más)</span>`;
            }
        } else {
            productosTexto = `<span style="color: hsl(var(--muted-foreground));">Sin items</span>`;
        }

        // Formatear según tipo de registro
        if (esMovimiento) {
            // MOVIMIENTO DE REPARTO
            // Si es producto granel, mostrar el monto en la columna Total
            const totalCelda = v.es_granel && v.total > 0 
                ? `<strong>$${formatoMoneda(v.total)}</strong>` 
                : '';
            
            return `
                <tr>
                    <td><strong>${v.id}</strong></td>
                    <td>${new Date(v.created_at).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</td>
                    <td>${v.vendedor_nombre}</td>
                    <td>${productosTexto}</td>
                    <td>${totalCelda}</td>
                    <td><span class="badge badge-warning">REPARTO</span></td>
                    <td>
                        <span style="font-size: 12px; color: #6b7280;">${v.motivo || 'Salida por reparto'}</span>
                    </td>
                </tr>
            `;
        } else {
            // VENTA NORMAL
            return `
                <tr>
                    <td><strong>#${v.id}</strong></td>
                    <td>${new Date(v.created_at || v.fecha).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</td>
                    <td>${v.vendedor_nombre || v.vendedor || 'Sin asignar'}</td>
                    <td>${productosTexto}</td>
                    <td><strong>$${formatoMoneda(v.total)}</strong></td>
                    <td><span class="badge badge-success">${v.metodo_pago}</span></td>
                    <td style="display: flex; gap: 4px;">
                        <button class="btn-icon" onclick="verDetalleVenta(${v.id})" title="Ver detalle">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
                                <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="btn-icon" onclick="imprimirBoletaDirecta(${v.id})" title="Imprimir boleta" style="color: hsl(142 76% 36%);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }
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
    renderTablaHistorial(ventas);
}

/**
 * Ver detalle completo de una venta
 */
async function verDetalleVenta(id) {
    const modal = document.getElementById('modalDetalleVenta');
    const content = document.getElementById('detalleVentaContent');

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
        // Consultar venta
        const { data: venta, error: ventaError } = await supabaseClient
            .from('ventas')
            .select('*')
            .eq('id', id)
            .single();

        if (ventaError) throw ventaError;

        // Consultar items de la venta
        const { data: items, error: itemsError } = await supabaseClient
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

        // Renderizar contenido
        content.innerHTML = `
            <div style="display: grid; gap: 20px;">
                <!-- Información General -->
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

                <!-- Método de Pago -->
                <div>
                    <h4 style="font-size: 14px; font-weight: 600; margin: 0 0 12px;">💳 Método de Pago</h4>
                    ${detallesPagos.length > 0 ? `
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
                    `}
                </div>

                <!-- Productos Vendidos -->
                <div>
                    <h4 style="font-size: 14px; font-weight: 600; margin: 0 0 12px;">📦 Productos (${items && items.length > 0 ? items.length : 0} items)</h4>
                    ${items && items.length > 0 ? `
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
                    `}
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error cargando detalle de venta:', error);
        content.innerHTML = `
            <div style="padding: 24px; text-align: center; color: hsl(0 84% 60%);">
                <p style="font-weight: 600; margin: 0 0 8px;">❌ Error al cargar detalle</p>
                <p style="font-size: 14px; margin: 0; color: hsl(var(--muted-foreground));">${error.message}</p>
            </div>
        `;
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
        const { data: venta, error: ventaError } = await supabaseClient
            .from('ventas')
            .select('*')
            .eq('id', id)
            .single();

        if (ventaError) throw ventaError;

        // Consultar items de la venta
        const { data: items, error: itemsError } = await supabaseClient
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
        console.error('Error al preparar boleta:', error);
        mostrarNotificacion('Error al cargar datos de la venta', 'error');
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

function formatoMoneda(numero) {
    return Math.round(numero).toLocaleString('es-CL');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function mostrarNotificacion(mensaje, tipo = 'info') {
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

    if (tipo === 'success') notif.style.borderLeft = '4px solid hsl(142 76% 36%)';
    if (tipo === 'error') notif.style.borderLeft = '4px solid hsl(0 84% 60%)';
    if (tipo === 'warning') notif.style.borderLeft = '4px solid hsl(38 92% 50%)';
    if (tipo === 'info') notif.style.borderLeft = '4px solid hsl(199 89% 48%)';

    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
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
            // Código escaneado exitosamente
            console.log(`✅ Código escaneado: ${decodedText}`);
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
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('codigo_barras', codigoBarra)
            .single();

        if (error) {
            console.log('Producto no encontrado con código:', codigoBarra);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error buscando producto:', error);
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
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('tipo', 'granel')
            .eq('activo', true)
            .order('nombre');

        if (error) throw error;

        productosGranel = data || [];
        mostrarProductosGranel(productosGranel);
    } catch (error) {
        console.error('Error cargando productos granel:', error);
        mostrarNotificacion('Error cargando productos a granel', 'error');
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
            padding: 12px;
            margin-bottom: 8px;
            border: 2px solid ${productoGranelSeleccionado?.id === p.id ? 'hsl(var(--success))' : 'hsl(var(--border))'};
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            background: ${productoGranelSeleccionado?.id === p.id ? 'hsl(var(--success) / 0.1)' : 'white'};
        " onmouseover="this.style.borderColor='hsl(var(--primary))'" onmouseout="this.style.borderColor='${productoGranelSeleccionado?.id === p.id ? 'hsl(var(--success))' : 'hsl(var(--border))'}' ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: hsl(var(--foreground));">${p.nombre}</strong>
                    <div style="font-size: 12px; color: hsl(var(--muted-foreground)); margin-top: 4px;">
                        ${p.categoria || 'Sin categoría'}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: 700; color: hsl(var(--success));">
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

    // Actualizar UI
    mostrarProductosGranel(productosGranel);
    
    // Mostrar sección de monto
    document.getElementById('granelSeleccionado').style.display = 'block';
    document.getElementById('granelNombreSeleccionado').textContent = productoGranelSeleccionado.nombre;
    document.getElementById('granelPrecioKg').textContent = `Precio: $${formatoMoneda(productoGranelSeleccionado.precio)}/kg`;
    document.getElementById('granelMonto').value = '';
    document.getElementById('pesoEstimado').textContent = '0 kg';
    document.getElementById('btnAgregarGranel').disabled = true;
    
    // Focus en input de monto
    setTimeout(() => {
        document.getElementById('granelMonto').focus();
    }, 100);
}

function calcularPesoEstimado() {
    const monto = parseFloat(document.getElementById('granelMonto').value) || 0;
    const precioKg = productoGranelSeleccionado?.precio || 0;
    
    if (monto > 0 && precioKg > 0) {
        const pesoKg = (monto / precioKg).toFixed(2);
        document.getElementById('pesoEstimado').textContent = `${pesoKg} kg`;
        document.getElementById('btnAgregarGranel').disabled = false;
    } else {
        document.getElementById('pesoEstimado').textContent = '0 kg';
        document.getElementById('btnAgregarGranel').disabled = true;
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

function abrirModalGranel() {
    // Resetear estado
    productoGranelSeleccionado = null;
    document.getElementById('searchGranelInput').value = '';
    document.getElementById('granelSeleccionado').style.display = 'none';
    document.getElementById('granelMonto').value = '';
    
    // Cargar productos granel
    cargarProductosGranel();
    
    // Mostrar modal
    const modal = document.getElementById('modalGranel');
    modal.style.display = 'flex';
    modal.classList.add('show');
    
    // Focus en búsqueda
    setTimeout(() => {
        document.getElementById('searchGranelInput').focus();
    }, 100);
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

function abrirModalEditar(producto) {
    productoEditando = producto;
    cerrarEscaner();

    const esEncargado = currentUserRole === 'encargado';
    const modoCrear = !producto; // null = modo crear

    // Cambiar título y botones según modo
    const titulo = document.getElementById('tituloModalProducto');
    const btnGuardar = document.getElementById('btnGuardarProducto');
    const btnEliminar = document.getElementById('btnEliminarProducto');

    if (modoCrear) {
        titulo.textContent = '➕ Crear Producto';
        btnGuardar.textContent = 'Guardar Producto';
        btnEliminar.style.display = 'none';
        
        // Limpiar campos
        document.getElementById('editNombre').value = '';
        document.getElementById('editProveedor').value = '';
        document.getElementById('editCategoria').value = '';
        document.getElementById('editPrecio').value = '';
        document.getElementById('editStock').value = '0';
        document.getElementById('editCodigoBarras').value = '';
        document.getElementById('editStockMinimo').value = '3';
    } else {
        titulo.textContent = '✏️ Editar Producto';
        btnGuardar.textContent = 'Guardar Cambios';
        btnEliminar.style.display = esEncargado ? 'inline-flex' : 'none';
        
        // Llenar campos con datos existentes
        document.getElementById('editNombre').value = producto.nombre;
        document.getElementById('editProveedor').value = producto.proveedor || '';
        
        // Establecer categoría - verificar si existe en el dropdown
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

    // Campo de stock mínimo (solo para encargado)
    const stockMinimoGroup = document.getElementById('editStockMinimoGroup');
    if (esEncargado) {
        stockMinimoGroup.style.display = 'block';
    } else {
        stockMinimoGroup.style.display = 'none';
    }

    // Si es vendedor, solo puede editar el stock (no crear)
    if (!esEncargado && !modoCrear) {
        document.getElementById('editNombre').setAttribute('readonly', 'readonly');
        document.getElementById('editProveedor').setAttribute('disabled', 'disabled');
        document.getElementById('editCategoria').setAttribute('disabled', 'disabled');
        document.getElementById('editPrecio').setAttribute('readonly', 'readonly');
        document.getElementById('editCodigoBarras').setAttribute('readonly', 'readonly');
    } else if (esEncargado) {
        document.getElementById('editNombre').removeAttribute('readonly');
        document.getElementById('editProveedor').removeAttribute('disabled');
        document.getElementById('editCategoria').removeAttribute('disabled');
        document.getElementById('editPrecio').removeAttribute('readonly');
        document.getElementById('editCodigoBarras').removeAttribute('readonly');
    }

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
                codigo_barras: nuevoCodigoBarras || null,
                tipo: 'empacado' // Tipo por defecto para sacos
            };

            // Auto-detectar si es producto granel por el nombre
            if (nuevoNombre.toLowerCase().includes('(granel)')) {
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
                const { data: productoEjemplo } = await supabaseClient
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
            const { error } = await supabaseClient
                .from('productos')
                .insert([productData]);
            
            if (error) throw error;
                
            mostrarNotificacion('✅ Producto creado exitosamente', 'success');
        } else {
            // ACTUALIZAR producto existente
            const { error } = await supabaseClient
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
        console.error('Error guardando producto:', error);
        mostrarNotificacion('Error al guardar el producto', 'error');
    }
}

async function eliminarProducto() {
    if (!productoEditando) return;

    const nombreProducto = productoEditando.nombre;

    // Confirmar eliminación
    const confirmar = confirm(`¿Estás seguro de que deseas eliminar el producto "${nombreProducto}"?\n\nEsta acción no se puede deshacer.`);

    if (!confirmar) return;

    try {
        const { error } = await supabaseClient
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
        console.error('Error eliminando producto:', error);
        mostrarNotificacion('Error al eliminar el producto', 'error');
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
        const { error } = await supabaseClient
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
        console.error('Error eliminando producto:', error);
        mostrarNotificacion('Error al eliminar el producto', 'error');
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

    // Cargar sencillo inicial
    cargarSencilloInicial();

    // Cargar ventas del día
    await cargarVentasDelDia();

    // Cargar gastos del día
    await cargarGastosDelDia();

    // Cargar pagos al personal del día
    await cargarPagosPersonalDelDia();

    // Actualizar totales
    actualizarTotalesCaja();
}

/**
 * Cargar ventas del día desde Supabase
 */
async function cargarVentasDelDia() {
    try {
        console.log('🔍 Iniciando carga de ventas del día...');

        // Validar que supabaseClient existe
        if (typeof supabaseClient === 'undefined' || !supabaseClient) {
            console.error('❌ Supabase no está configurado');
            mostrarNotificacion('Error: Supabase no está configurado', 'error');
            return;
        }

        const hoy = new Date();
        const fechaHoy = hoy.toISOString().split('T')[0]; // Solo YYYY-MM-DD

        console.log('📅 Buscando ventas del día:', fechaHoy);

        const { data, error } = await supabaseClient
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
            total: 0
        };

        if (!data || data.length === 0) {
            console.log('ℹ️ No hay ventas registradas hoy');
        } else {
            data.forEach(venta => {
                // Verificar ambos nombres de campo (pagos_detalle y detalle_pagos)
                let detallePagos = venta.pagos_detalle || venta.detalle_pagos || venta.metodo_pago;

                console.log('💳 Procesando venta:', {
                    total: venta.total,
                    metodo: venta.metodo_pago,
                    detallePagos: detallePagos
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
                        ventasDelDia.transferencia += venta.total;
                    }
                } else if (Array.isArray(detallePagos)) {
                    // Formato nuevo: array de pagos (para pagos mixtos)
                    detallePagos.forEach(pago => {
                        if (pago.metodo === 'Efectivo') {
                            ventasDelDia.efectivo += pago.monto;
                        } else if (pago.metodo === 'Tarjeta' || pago.metodo === 'Transbank') {
                            ventasDelDia.transbank += pago.monto;
                        } else if (pago.metodo === 'Transferencia') {
                            ventasDelDia.transferencia += pago.monto;
                        }
                    });
                }

                ventasDelDia.total += venta.total;
            });
        }

        // Actualizar UI
        document.getElementById('ventasEfectivo').textContent = '$' + formatoMoneda(ventasDelDia.efectivo);
        document.getElementById('ventasTransbank').textContent = '$' + formatoMoneda(ventasDelDia.transbank);
        document.getElementById('ventasTransferencia').textContent = '$' + formatoMoneda(ventasDelDia.transferencia);
        document.getElementById('ventasTotal').textContent = '$' + formatoMoneda(ventasDelDia.total);

        console.log('✅ Ventas del día cargadas:', ventasDelDia);

    } catch (error) {
        console.error('❌ ERROR COMPLETO:', error);
        mostrarNotificacion('Error al cargar ventas del día: ' + error.message, 'error');
    }
}

/**
 * Cargar gastos del día desde Supabase
 */
async function cargarGastosDelDia() {
    try {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) {
            console.warn('⚠️ Supabase no configurado, omitiendo gastos');
            gastosDelDia = [];
            renderGastosDelDia();
            return;
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        const { data, error } = await supabaseClient
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
        console.error('❌ ERROR COMPLETO:', error);
        gastosDelDia = [];
        renderGastosDelDia();
        // No mostrar notificación para no molestar al usuario con múltiples errores
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
        const { data, error } = await supabaseClient
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
        console.error('Error registrando gasto:', error);
        mostrarNotificacion('Error al registrar gasto', 'error');
    }
}

/**
 * Eliminar gasto
 */
async function eliminarGasto(gastoId) {
    if (!confirm('¿Eliminar este gasto?')) return;

    try {
        const { error } = await supabaseClient
            .from('gastos')
            .delete()
            .eq('id', gastoId);

        if (error) throw error;

        mostrarNotificacion('Gasto eliminado', 'success');

        // Recargar gastos
        await cargarGastosDelDia();
        actualizarTotalesCaja();

    } catch (error) {
        console.error('Error eliminando gasto:', error);
        mostrarNotificacion('Error al eliminar gasto', 'error');
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

    // Calcular efectivo esperado (ventas en efectivo - gastos - pagos personal)
    const efectivoEsperado = ventasDelDia.efectivo - totalGastos - totalPagosPersonal;
    document.getElementById('efectivoEsperado').textContent = '$' + formatoMoneda(efectivoEsperado);

    // Recalcular diferencia si hay efectivo real ingresado
    calcularDiferenciaCaja();
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
    const efectivoEsperado = ventasDelDia.efectivo - totalGastos - totalPagosPersonal;
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
    const efectivoEsperado = ventasDelDia.efectivo - totalGastos - totalPagosPersonal;
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
        const { data, error } = await supabaseClient
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
        console.error('Error cerrando caja:', error);
        mostrarNotificacion('Error al cerrar caja', 'error');
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
        `👤 Empleado: ${empleado}\n` +
        `💼 Puesto: ${puesto}\n` +
        `🕐 Turno: ${turno}\n` +
        `💵 Pago Jornada: $${formatoMoneda(pagoJornada)}\n` +
        `🍽️ Pago Almuerzo: $${formatoMoneda(pagoAlmuerzo)}\n` +
        `💰 Total: $${formatoMoneda(totalPago)}`
    );

    if (!confirmar) return;

    try {
        const lunesSemana = obtenerLunesSemana();

        const { data, error } = await supabaseClient
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

        mostrarNotificacion(`✅ Pago registrado exitosamente para ${empleado}`, 'success');

        // Cerrar modal
        cerrarModalPagoPersonal();

        // Recargar pagos del día
        await cargarPagosPersonalDelDia();
        actualizarTotalesCaja();

    } catch (error) {
        console.error('Error registrando pago:', error);
        mostrarNotificacion('Error al registrar el pago', 'error');
    }
}

/**
 * Cargar pagos al personal del día
 */
async function cargarPagosPersonalDelDia() {
    try {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) {
            console.warn('⚠️ Supabase no configurado, omitiendo pagos personal');
            pagosPersonalDelDia = [];
            actualizarResumenPagosPersonal();
            return;
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hoySinHora = hoy.toISOString().split('T')[0]; // YYYY-MM-DD

        const { data, error } = await supabaseClient
            .from('pagos_personal')
            .select('*')
            .eq('fecha', hoySinHora)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Error consultando pagos personal:', error);
            throw error;
        }

        pagosPersonalDelDia = data || [];
        console.log(`✅ ${pagosPersonalDelDia.length} pagos al personal hoy`);

        // Actualizar el panel de resumen
        actualizarResumenPagosPersonal();

    } catch (error) {
        console.error('❌ ERROR COMPLETO:', error);
        pagosPersonalDelDia = [];
        actualizarResumenPagosPersonal();
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
        const { error } = await supabaseClient
            .from('pagos_personal')
            .update({
                pago_jornada: nuevoJornada,
                pago_almuerzo: nuevoAlmuerzo,
                total_pago: nuevoTotal
            })
            .eq('id', pagoId);

        if (error) throw error;

        mostrarNotificacion('✅ Pago actualizado correctamente', 'success');

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
        console.error('Error actualizando pago:', error);
        mostrarNotificacion('Error al actualizar el pago', 'error');
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
function inicializarProveedores() {
    // Proveedores base del HTML (siempre deben estar)
    const proveedoresBase = [
        'Befoods', 'Cruce', 'Argentinos', 'Mya Spa', 'Chile Dog',
        'Brit Care', 'Bravery', 'Dragpharma', 'Fit formula', 'Farmacia',
        'Belcando & Leonardo', 'Wampy', 'Josera', 'Acomer', 'Dockneddy',
        'Topk9', 'Cova', 'Purina'
    ];

    const proveedoresGuardados = localStorage.getItem('proveedores_sabrofood');
    
    if (proveedoresGuardados) {
        try {
            const guardados = JSON.parse(proveedoresGuardados);
            
            // Fusionar: primero los guardados, luego agregar los que falten de la base
            proveedoresActuales = [...guardados];
            
            // Agregar proveedores base que no estén en guardados
            proveedoresBase.forEach(prov => {
                if (!proveedoresActuales.includes(prov)) {
                    proveedoresActuales.push(prov);
                }
            });
            
            // Guardar la fusión actualizada
            guardarProveedoresEnStorage();
            
        } catch (error) {
            console.error('Error cargando proveedores:', error);
            proveedoresActuales = proveedoresBase;
            guardarProveedoresEnStorage();
        }
    } else {
        // Primera vez: usar proveedores base
        proveedoresActuales = proveedoresBase;
        guardarProveedoresEnStorage();
    }
    
    // Actualizar todos los select de la aplicación
    actualizarSelectProveedores();
    
    console.log('✅ Proveedores inicializados:', proveedoresActuales.length);
}

/**
 * Guardar proveedores en localStorage
 */
function guardarProveedoresEnStorage() {
    localStorage.setItem('proveedores_sabrofood', JSON.stringify(proveedoresActuales));
}

/**
 * Actualizar todos los select de proveedores en la aplicación
 */
function actualizarSelectProveedores() {
    // Ordenar alfabéticamente para mejor UX
    const proveedoresOrdenados = [...proveedoresActuales].sort();
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
 * Abrir modal de gestión de proveedores
 */
function abrirModalProveedores() {
    if (currentUserRole !== 'encargado') {
        mostrarNotificacion('Solo el encargado puede gestionar proveedores', 'warning');
        return;
    }
    
    // Re-inicializar proveedores para asegurar que estén cargados
    if (proveedoresActuales.length === 0) {
        inicializarProveedores();
    }
    
    console.log('📋 Proveedores disponibles:', proveedoresActuales.length);
    
    proveedorEditando = null;
    document.getElementById('inputNombreProveedor').value = '';
    document.getElementById('tituloFormProveedor').textContent = '➕ Agregar Proveedor';
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
    
    console.log('🔄 Renderizando proveedores:', proveedoresActuales);
    
    if (!proveedoresActuales || proveedoresActuales.length === 0) {
        lista.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <p>No hay proveedores registrados</p>
                <p style="font-size: 14px; margin-top: 10px;">Agrega el primer proveedor usando el formulario arriba</p>
            </div>
        `;
        return;
    }
    
    const proveedoresOrdenados = [...proveedoresActuales].sort();
    
    const html = proveedoresOrdenados.map((proveedor, index) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; background: white; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 8px;">
            <div style="flex: 1;">
                <strong style="font-size: 15px;">${proveedor}</strong>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm btn-primary" onclick="editarProveedor('${proveedor.replace(/'/g, "\\'")}')">
                    ✏️ Editar
                </button>
                <button class="btn btn-sm btn-danger" onclick="eliminarProveedor('${proveedor.replace(/'/g, "\\'")}')">
                    🗑️ Eliminar
                </button>
            </div>
        </div>
    `).join('');
    
    lista.innerHTML = html;
}

/**
 * Guardar proveedor (crear o actualizar)
 */
function guardarProveedor() {
    const input = document.getElementById('inputNombreProveedor');
    const nombreProveedor = input.value.trim();
    
    if (!nombreProveedor) {
        mostrarNotificacion('Por favor ingresa el nombre del proveedor', 'warning');
        input.focus();
        return;
    }
    
    if (proveedorEditando !== null) {
        // Editar proveedor existente
        const index = proveedoresActuales.indexOf(proveedorEditando);
        
        // Verificar si el nuevo nombre ya existe (excepto si es el mismo)
        if (nombreProveedor !== proveedorEditando && proveedoresActuales.includes(nombreProveedor)) {
            mostrarNotificacion('Ya existe un proveedor con ese nombre', 'warning');
            return;
        }
        
        if (index !== -1) {
            proveedoresActuales[index] = nombreProveedor;
            mostrarNotificacion('Proveedor actualizado exitosamente', 'success');
        }
    } else {
        // Agregar nuevo proveedor
        if (proveedoresActuales.includes(nombreProveedor)) {
            mostrarNotificacion('Ya existe un proveedor con ese nombre', 'warning');
            return;
        }
        
        proveedoresActuales.push(nombreProveedor);
        mostrarNotificacion('Proveedor agregado exitosamente', 'success');
    }
    
    guardarProveedoresEnStorage();
    actualizarSelectProveedores();
    renderizarListaProveedores();
    
    // Limpiar formulario
    input.value = '';
    proveedorEditando = null;
    document.getElementById('tituloFormProveedor').textContent = '➕ Agregar Proveedor';
    document.getElementById('textoBotonProveedor').textContent = 'Agregar';
    document.getElementById('btnCancelarEditProveedor').style.display = 'none';
}

/**
 * Editar proveedor
 */
function editarProveedor(nombreProveedor) {
    proveedorEditando = nombreProveedor;
    
    document.getElementById('inputNombreProveedor').value = nombreProveedor;
    document.getElementById('tituloFormProveedor').textContent = '✏️ Editar Proveedor';
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
    document.getElementById('tituloFormProveedor').textContent = '➕ Agregar Proveedor';
    document.getElementById('textoBotonProveedor').textContent = 'Agregar';
    document.getElementById('btnCancelarEditProveedor').style.display = 'none';
}

/**
 * Eliminar proveedor
 */
function eliminarProveedor(nombreProveedor) {
    if (!confirm(`¿Estás seguro de eliminar el proveedor "${nombreProveedor}"?\n\nEsta acción no afectará los productos existentes.`)) {
        return;
    }
    
    const index = proveedoresActuales.indexOf(nombreProveedor);
    if (index !== -1) {
        proveedoresActuales.splice(index, 1);
        guardarProveedoresEnStorage();
        actualizarSelectProveedores();
        renderizarListaProveedores();
        mostrarNotificacion('Proveedor eliminado exitosamente', 'success');
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
        const { data, error } = await supabaseClient
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

        mostrarNotificacion('✅ Producto registrado exitosamente', 'success');
        cerrarModalNuevo();
        await cargarProductos();

    } catch (error) {
        console.error('Error registrando producto:', error);
        if (error.code === '23505') {
            mostrarNotificacion('Este código de barras ya existe', 'error');
        } else {
            mostrarNotificacion('Error al registrar producto', 'error');
        }
    }
}

// ===================================
// ASIGNAR CÓDIGOS DE BARRAS
// ===================================

let productoSeleccionado = null; // Producto al que se asignará el código
let productosSinCodigo = [];

async function cargarProductosSinCodigo() {
    try {
        console.log('📦 Cargando productos sin código de barras...');

        const { data, error } = await supabaseClient
            .from('productos')
            .select('*')
            .or('codigo_barras.is.null,codigo_barras.eq.')
            .order('nombre');

        if (error) throw error;

        productosSinCodigo = data;
        console.log(`✅ Encontrados ${productosSinCodigo.length} productos sin código`);

        renderProductosSinCodigo(productosSinCodigo);

    } catch (error) {
        console.error('❌ Error cargando productos:', error);
        mostrarNotificacion('Error cargando productos', 'error');
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
                    ${p.marca} • ${p.categoria} • Stock: ${p.stock}
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

    console.log('📱 Producto seleccionado:', productoSeleccionado.nombre);

    // Abrir escáner en modo asignación
    abrirEscanerAsignacion();
}

function abrirEscanerAsignacion() {
    const modal = document.getElementById('modalEscaner');
    const rolMensaje = document.getElementById('rolMensaje');

    rolMensaje.innerHTML = `
        <strong>🎯 Asignando código a:</strong><br>
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
            console.log(`✅ Código escaneado: ${decodedText}`);
            asignarCodigoAProducto(decodedText);
        },
        (errorMessage) => {
            // Errores normales de escaneo
        }
    ).catch((err) => {
        console.error('❌ Error iniciando escáner:', err);
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
        const { data: existente } = await supabaseClient
            .from('productos')
            .select('nombre')
            .eq('codigo_barras', codigoBarra)
            .single();

        if (existente) {
            mostrarNotificacion(`⚠️ Este código ya está asignado a: ${existente.nombre}`, 'error');
            cerrarEscaner();
            return;
        }

        // Asignar código al producto
        const { error } = await supabaseClient
            .from('productos')
            .update({ codigo_barras: codigoBarra })
            .eq('id', productoSeleccionado.id);

        if (error) throw error;

        mostrarNotificacion(`✅ Código asignado a ${productoSeleccionado.nombre}`, 'success');

        cerrarEscaner();

        // Recargar lista
        await cargarProductosSinCodigo();

        productoSeleccionado = null;

    } catch (error) {
        console.error('Error asignando código:', error);
        mostrarNotificacion('Error al asignar código', 'error');
        cerrarEscaner();
    }
}

// ===================================
// DASHBOARD Y GRÁFICOS
// ===================================
// Chart variables are now declared globally near the top of the file

// ===================================
// GESTIÓN MASIVA DE PRECIOS
// ===================================

function abrirModalAdminPrecios() {
    const tbody = document.getElementById('tablaAdminPrecios');

    tbody.innerHTML = productos.map(p => `
        <tr data-producto-id="${p.id}">
            <td style="padding: 12px; border-bottom: 1px solid hsl(var(--border));">
                <strong>${p.nombre}</strong><br>
                <small style="color: hsl(var(--muted-foreground));">${p.marca || '-'}</small>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid hsl(var(--border));">
                ${p.categoria || '-'}
            </td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid hsl(var(--border));">
                <strong>${Math.floor(p.stock)}</strong>
            </td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid hsl(var(--border));">
                <input
                    type="number"
                    class="input-precio-editable"
                    data-producto-id="${p.id}"
                    value="${p.precio}"
                    min="0"
                    step="100"
                    style="width: 120px; padding: 8px 12px; border: 2px solid hsl(var(--border)); border-radius: 8px; text-align: right; font-weight: 600; font-size: 14px; transition: all 0.2s;"
                    onfocus="this.style.borderColor='hsl(var(--primary))'; this.select();"
                    onblur="this.style.borderColor='hsl(var(--border))';"
                >
            </td>
        </tr>
    `).join('');

    const modal = document.getElementById('modalAdminPrecios');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

function cerrarModalAdminPrecios() {
    const modal = document.getElementById('modalAdminPrecios');
    modal.style.display = 'none';
    modal.classList.remove('show');
}

async function guardarCambiosPrecios() {
    const inputs = document.querySelectorAll('.input-precio-editable');
    const cambios = [];

    inputs.forEach(input => {
        const productoId = parseInt(input.dataset.productoId);
        const nuevoPrecio = parseFloat(input.value);
        const productoOriginal = productos.find(p => p.id === productoId);

        // Solo agregar si cambió el precio
        if (productoOriginal && productoOriginal.precio !== nuevoPrecio) {
            cambios.push({
                id: productoId,
                nombre: productoOriginal.nombre,
                precioAnterior: productoOriginal.precio,
                precioNuevo: nuevoPrecio
            });
        }
    });

    if (cambios.length === 0) {
        mostrarNotificacion('No hay cambios para guardar', 'info');
        return;
    }

    if (!confirm(`¿Confirmas actualizar ${cambios.length} precio(s)?`)) {
        return;
    }

    try {
        // Actualizar precios en Supabase
        const promesas = cambios.map(cambio =>
            supabaseClient
                .from('productos')
                .update({ precio: cambio.precioNuevo })
                .eq('id', cambio.id)
        );

        const resultados = await Promise.all(promesas);

        // Verificar errores
        const errores = resultados.filter(r => r.error);
        if (errores.length > 0) {
            throw new Error('Algunos precios no se actualizaron');
        }

        mostrarNotificacion(`✅ ${cambios.length} precio(s) actualizado(s) exitosamente`, 'success');

        // Recargar productos
        await cargarProductos();

        cerrarModalAdminPrecios();

    } catch (error) {
        console.error('Error actualizando precios:', error);
        mostrarNotificacion('Error al guardar cambios', 'error');
    }
}

// ==========================================
// SISTEMA DE ASISTENCIA
// ==========================================

// Cargar estado actual de asistencia del usuario
async function cargarEstadoActual() {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        const { data, error } = await supabaseClient
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
            estadoTexto = '✅ Jornada Completa';
            estadoColor = 'hsl(var(--success))';
        } else if (data.estado === 'En almuerzo') {
            estadoTexto = '🍽️ En Almuerzo';
            estadoColor = 'hsl(var(--warning))';
        } else if (data.estado === 'Trabajando') {
            estadoTexto = '🟢 Trabajando';
            estadoColor = 'hsl(var(--success))';
        } else {
            estadoTexto = '⚠️ Incompleto';
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
        console.error('Error cargando estado:', error);
        document.getElementById('estadoContent').innerHTML = `
            <div style="text-align: center; color: hsl(var(--destructive));">
                <p style="margin: 0;">Error al cargar el estado</p>
            </div>
        `;
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
        const { data: registroActual, error: errorCheck } = await supabaseClient
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
            const { data: userData } = await supabaseClient
                .from('usuarios')
                .select('id')
                .eq('username', currentUser)
                .single();

            // Crear nuevo registro
            const { error } = await supabaseClient
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

            const { error } = await supabaseClient
                .from('asistencias')
                .update(updateData)
                .eq('id', registroActual.id);

            if (error) throw error;
        }

        mostrarNotificacion(mensaje, 'success');
        cargarEstadoActual();
        cargarAsistencias();

    } catch (error) {
        console.error('Error marcando evento:', error);
        mostrarNotificacion('Error al registrar la acción', 'error');
    }
}

// Cargar historial de asistencias
async function cargarAsistencias() {
    try {
        const tbody = document.getElementById('tablaAsistencias');
        tbody.innerHTML = '<tr><td colspan="9" class="text-center"><div class="spinner"></div></td></tr>';

        let query = supabaseClient
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
        console.error('Error cargando asistencias:', error);
        document.getElementById('tablaAsistencias').innerHTML = `
            <tr>
                <td colspan="9" class="text-center" style="padding: 40px; color: hsl(var(--destructive));">
                    Error al cargar registros
                </td>
            </tr>
        `;
    }
}

// Abrir modal para editar asistencia (solo admin)
async function abrirModalEditarAsistencia(id) {
    try {
        const { data, error } = await supabaseClient
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
                        <h3>✏️ Editar Asistencia</h3>
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
        console.error('Error abriendo modal:', error);
        mostrarNotificacion('Error al cargar los datos', 'error');
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

        const { error } = await supabaseClient
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
        console.error('Error guardando edición:', error);
        mostrarNotificacion('Error al guardar los cambios', 'error');
    }
}

// Verificar si olvidó marcar salida antes de cerrar sesión
async function verificarSalidaPendiente() {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        const { data, error } = await supabaseClient
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
            return confirm('⚠️ No has marcado tu hora de salida.\n\n¿Deseas marcarla ahora antes de cerrar sesión?');
        }

        return false;

    } catch (error) {
        console.error('Error verificando salida:', error);
        return false;
    }
}

// Marcar entrada automática al iniciar sesión
async function marcarEntradaAutomatica() {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        // Verificar si ya marcó entrada hoy
        const { data: registroExistente, error: errorCheck } = await supabaseClient
            .from('asistencias')
            .select('hora_entrada')
            .eq('username', currentUser)
            .eq('fecha', hoy)
            .single();

        // Si ya existe registro, no hacer nada
        if (registroExistente) {
            console.log('⏰ Ya hay registro de entrada para hoy');
            return;
        }

        // Si el error es diferente a "no hay filas", lanzar error
        if (errorCheck && errorCheck.code !== 'PGRST116') {
            throw errorCheck;
        }

        // Obtener usuario_id
        const { data: userData, error: userError } = await supabaseClient
            .from('usuarios')
            .select('id')
            .eq('username', currentUser)
            .single();

        if (userError) throw userError;

        // Crear registro de entrada
        const ahora = new Date().toISOString();
        const { error } = await supabaseClient
            .from('asistencias')
            .insert({
                usuario_id: userData.id,
                username: currentUser,
                fecha: hoy,
                hora_entrada: ahora
            });

        if (error) throw error;

        console.log('✅ Entrada marcada automáticamente');

    } catch (error) {
        console.error('Error marcando entrada automática:', error);
        // No mostramos notificación para no molestar al usuario en el login
    }
}

// Cargar lista de vendedores para filtro (solo admin)
async function cargarVendedoresParaFiltro() {
    try {
        const { data, error } = await supabaseClient
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
        console.error('Error cargando vendedores para filtro:', error);
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
    
    console.log(`💵 Sencillo inicial cargado: $${formatoMoneda(sencilloInicial)}`);
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
    
    mostrarNotificacion('✅ Sencillo inicial actualizado', 'success');
    console.log(`💵 Sencillo inicial actualizado: $${formatoMoneda(sencilloInicial)}`);
}

