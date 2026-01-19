// MODERN POS SYSTEM - JavaScript
// ===============================

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

// Roles de usuarios
const ROLES = {
    'Jonathan R.': 'vendedor',
    'Sebastian': 'vendedor',
    'Juan Antonio': 'vendedor',
    'Diego Sr.': 'vendedor',
    'Diego Jr.': 'vendedor',
    'Hugo': 'vendedor',
    'Pablo': 'vendedor',
    'Emil': 'vendedor',
    'Jonathan J.': 'vendedor',
    'Jefe': 'encargado' // Encargado/Admin
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando POS System...');
    initApp();
});

function initApp() {
    // Mostrar pantalla de login
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

// ===================================
// AUTENTICACIÓN
// ===================================

function handleLogin() {
    const username = document.getElementById('loginUsername').value;
    
    if (!username) {
        alert('Por favor selecciona un vendedor');
        return;
    }
    
    currentUser = username;
    currentUserRole = ROLES[username] || 'vendedor';
    
    // Ocultar login y mostrar app
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'grid';
    
    // Actualizar nombre de usuario en la UI
    document.getElementById('sidebarUsername').textContent = username;
    document.getElementById('topUsername').textContent = username;
    
    // Mostrar botón "Asignar Códigos" solo para encargados
    if (currentUserRole === 'encargado') {
        document.getElementById('btnAsignarCodigos').style.display = 'flex';
        document.getElementById('btnAsignarCodigosBottom').style.display = 'flex';
    } else {
        document.getElementById('btnAsignarCodigos').style.display = 'none';
        document.getElementById('btnAsignarCodigosBottom').style.display = 'none';
    }
    
    // Cargar datos
    cargarProductos();
    
    console.log('✅ Login exitoso:', username, '| Rol:', currentUserRole);
}

function handleLogout() {
    if (carrito.length > 0) {
        if (!confirm('Tienes productos en el carrito. ¿Deseas cerrar sesión de todas formas?')) {
            return;
        }
    }
    
    currentUser = '';
    carrito = [];
    
    // Mostrar login
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    
    // Limpiar dropdown
    document.getElementById('loginUsername').value = '';
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
        'asignar': 'asignarView'
    };
    
    document.getElementById(viewMap[vista]).style.display = 'block';
    
    // Actualizar nav items (sidebar y bottom nav)
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === vista) {
            item.classList.add('active');
        }
    });
    
    // Cargar datos según la vista
    if (vista === 'inventory') {
        cargarInventario();
    } else if (vista === 'sales') {
        cargarVentas();
    } else if (vista === 'asignar') {
        cargarProductosSinCodigo();
    }
}

// ===================================
// CARGA DE DATOS
// ===================================

async function cargarProductos() {
    try {
        console.log('📦 Cargando productos desde Supabase...');
        console.log('🔍 Cliente Supabase:', supabaseClient);
        
        if (typeof supabaseClient === 'undefined' || !supabaseClient) {
            console.error('❌ Supabase no está configurado');
            mostrarNotificacion('Error: Supabase no conectado', 'error');
            mostrarProductosMock();
            return;
        }
        
        console.log('🔍 Consultando tabla productos...');
        console.log('📡 URL:', SUPABASE_CONFIG?.url);
        
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*')
            .order('nombre', { ascending: true });
        
        console.log('📊 Respuesta de Supabase:');
        console.log('  - Data:', data ? `${data.length} registros` : 'null');
        console.log('  - Error:', error);
        
        if (error) {
            console.error('❌ Error Supabase:', error);
            console.error('   Código:', error.code);
            console.error('   Mensaje:', error.message);
            console.error('   Detalles:', error.details);
            console.error('   Hint:', error.hint);
            mostrarNotificacion('Error al cargar productos: ' + error.message, 'error');
            mostrarProductosMock();
            return;
        }
        
        if (!data || data.length === 0) {
            console.warn('⚠️ No hay productos en la base de datos');
            mostrarNotificacion('No hay productos en la base de datos', 'warning');
            productos = [];
            renderProductos();
            return;
        }
        
        productos = data;
        console.log(`✅ ${productos.length} productos cargados correctamente`);
        console.log('📋 Primeros 3 productos:', productos.slice(0, 3));
        mostrarNotificacion(`${productos.length} productos cargados`, 'success');
        renderProductos();
        
    } catch (error) {
        console.error('❌ Error crítico:', error);
        console.error('   Stack:', error.stack);
        mostrarNotificacion('Error al cargar productos', 'error');
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
        productosFiltrados = productosFiltrados.filter(p => 
            p.categoria && p.categoria.toLowerCase().includes(categoriaActual.toLowerCase())
        );
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
        
        let stockClass = 'stock-ok';
        let stockText = Math.floor(stock);
        
        if (stockCero) {
            stockClass = 'stock-out';
            stockText = 'Sin stock';
        } else if (stockBajo) {
            stockClass = 'stock-low';
        }
        
        return `
            <div class="product-card" onclick="${stockCero ? '' : 'agregarAlCarrito(' + producto.id + ')'}" ${stockCero ? 'style="opacity: 0.6; cursor: not-allowed;"' : ''}>
                <div class="product-card-header">
                    <div class="product-name">${producto.nombre}</div>
                    <span class="product-stock ${stockClass}">${stockText}</span>
                </div>
                <div class="product-category">${producto.marca || producto.categoria || 'General'}</div>
                <div class="product-price">$${formatoMoneda(producto.precio || 0)}</div>
            </div>
        `;
    }).join('');
}

function agregarAlCarrito(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;
    
    if (producto.stock <= 0) {
        mostrarNotificacion('Producto sin stock', 'error');
        return;
    }
    
    const itemExistente = carrito.find(item => item.id === producto.id);
    
    if (itemExistente) {
        if (itemExistente.cantidad >= producto.stock) {
            mostrarNotificacion('Stock insuficiente', 'warning');
            return;
        }
        itemExistente.cantidad++;
    } else {
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
        return;
    }
    
    totalVenta = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    carritoItems.innerHTML = carrito.map((item, index) => `
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
    `).join('');
    
    totalEl.textContent = '$' + formatoMoneda(totalVenta);
    btnCobrar.disabled = false;
}

function cambiarCantidad(index, delta) {
    const item = carrito[index];
    const newQty = item.cantidad + delta;
    
    if (newQty <= 0) {
        removerDelCarrito(index);
        return;
    }
    
    if (newQty > item.stock) {
        mostrarNotificacion('Stock insuficiente', 'warning');
        return;
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
        inputCodigoBarras.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const codigo = e.target.value.trim();
                if (codigo) {
                    const producto = await buscarPorCodigoBarras(codigo);
                    if (producto) {
                        agregarAlCarrito(producto.id);
                        mostrarNotificacion(`✅ ${producto.nombre} agregado al carrito`, 'success');
                        e.target.value = '';
                    } else {
                        mostrarNotificacion('❌ Código de barras no encontrado', 'error');
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
    
    pagosRegistrados = [];
    metodoPagoSeleccionado = 'Efectivo';
    
    document.getElementById('pagoTotal').textContent = '$' + formatoMoneda(totalVenta);
    document.getElementById('montoEntregado').value = '';
    document.getElementById('vueltoAmount').textContent = '$0';
    
    // Activar método efectivo
    document.querySelectorAll('.payment-method').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('[data-metodo="Efectivo"]').classList.add('active');
    
    const areaEfectivo = document.getElementById('areaEfectivo');
    if (areaEfectivo) {
        areaEfectivo.classList.add('visible');
    }
    
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
    if (metodo === 'Efectivo') {
        areaEfectivo.classList.add('visible');
    } else {
        areaEfectivo.classList.remove('visible');
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

function agregarPagoParcial() {
    mostrarNotificacion('Función en desarrollo', 'info');
}

async function finalizarVenta() {
    if (!currentUser) {
        mostrarNotificacion('Error: No hay vendedor seleccionado', 'error');
        return;
    }
    
    if (carrito.length === 0) return;
    
    // Validar pago según método
    if (metodoPagoSeleccionado === 'Efectivo') {
        const montoEntregado = parseFloat(document.getElementById('montoEntregado').value) || 0;
        if (montoEntregado < totalVenta) {
            mostrarNotificacion('Monto insuficiente', 'error');
            return;
        }
    }
    
    try {
        // Si Supabase está disponible, guardar venta
        if (typeof supabaseClient !== 'undefined') {
            const venta = {
                vendedor: currentUser,
                total: totalVenta,
                metodo_pago: metodoPagoSeleccionado,
                productos: carrito,
                fecha: new Date().toISOString()
            };
            
            const { error } = await supabaseClient
                .from('ventas')
                .insert([venta]);
            
            if (error) {
                console.error('Error guardando venta:', error);
            }
            
            // Actualizar stock
            for (const item of carrito) {
                const { error: stockError } = await supabaseClient
                    .from('productos')
                    .update({ stock: item.stock - item.cantidad })
                    .eq('id', item.id);
                
                if (stockError) {
                    console.error('Error actualizando stock:', stockError);
                }
            }
        }
        
        mostrarNotificacion('¡Venta completada exitosamente!', 'success');
        
        // Limpiar carrito y cerrar modal
        carrito = [];
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
    
    // Tabla
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = productos.map(p => {
        const stockBajo = p.stock <= (p.stock_minimo || 5);
        const stockCero = p.stock === 0;
        
        let estadoBadge = 'badge-success';
        let estadoTexto = 'En Stock';
        if (stockCero) {
            estadoBadge = 'badge-danger';
            estadoTexto = 'Sin Stock';
        } else if (stockBajo) {
            estadoBadge = 'badge-warning';
            estadoTexto = 'Stock Bajo';
        }
        
        // Código de barras status
        let codigoBarrasHTML = '';
        if (p.codigo_barra && p.codigo_barra.trim() !== '') {
            const codigoEscapado = escapeHtml(p.codigo_barra);
            codigoBarrasHTML = `<span class="codigo-asignado">✅ ${codigoEscapado}</span>`;
        } else {
            codigoBarrasHTML = `<span class="sin-codigo">⚠️ Sin código</span>`;
        }
        
        return `
            <tr>
                <td><strong>${p.nombre}</strong></td>
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
                </td>
            </tr>
        `;
    }).join('');
}

function editarProducto(id) {
    mostrarNotificacion('Función en desarrollo', 'info');
}

// ===================================
// VENTAS
// ===================================

async function cargarVentas() {
    try {
        if (typeof supabaseClient === 'undefined') {
            mostrarVentasMock();
            return;
        }
        
        const { data, error } = await supabaseClient
            .from('ventas')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(50);
        
        if (error) {
            console.error('Error:', error);
            mostrarVentasMock();
            return;
        }
        
        renderVentas(data || []);
        
    } catch (error) {
        console.error('Error:', error);
        mostrarVentasMock();
    }
}

function mostrarVentasMock() {
    const ventas = [
        { id: 1, fecha: new Date().toISOString(), vendedor: currentUser || 'Demo', productos: [{ nombre: 'Producto Demo', cantidad: 1 }], total: 10000, metodo_pago: 'Efectivo' }
    ];
    renderVentas(ventas);
}

function renderVentas(ventas) {
    // Estadísticas
    const hoy = new Date().toDateString();
    const ventasHoy = ventas.filter(v => new Date(v.fecha).toDateString() === hoy);
    const totalHoy = ventasHoy.reduce((sum, v) => sum + v.total, 0);
    
    document.getElementById('ventasHoy').textContent = '$' + formatoMoneda(totalHoy);
    document.getElementById('totalTransacciones').textContent = ventas.length;
    
    // Tabla
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = ventas.map(v => `
        <tr>
            <td><strong>#${v.id}</strong></td>
            <td>${new Date(v.fecha).toLocaleString('es-CL')}</td>
            <td>${v.vendedor}</td>
            <td>${v.productos ? v.productos.length : 0} items</td>
            <td><strong>$${formatoMoneda(v.total)}</strong></td>
            <td><span class="badge badge-success">${v.metodo_pago}</span></td>
            <td>
                <button class="btn-icon" onclick="verDetalleVenta(${v.id})" title="Ver detalle">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
                        <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

function verDetalleVenta(id) {
    mostrarNotificacion('Función en desarrollo', 'info');
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
            .eq('codigo_barra', codigoBarra)
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
// MODAL EDITAR PRODUCTO (Encargado)
// ===================================

function abrirModalEditar(producto) {
    productoEditando = producto;
    cerrarEscaner();
    
    document.getElementById('editNombre').value = producto.nombre;
    document.getElementById('editPrecio').value = producto.precio;
    document.getElementById('editStock').value = producto.stock;
    
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
    if (!productoEditando) return;
    
    const nuevoPrecio = parseFloat(document.getElementById('editPrecio').value);
    const nuevoStock = parseFloat(document.getElementById('editStock').value);
    
    if (isNaN(nuevoPrecio) || isNaN(nuevoStock)) {
        mostrarNotificacion('Valores inválidos', 'error');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('productos')
            .update({
                precio: nuevoPrecio,
                stock: nuevoStock
            })
            .eq('id', productoEditando.id);
        
        if (error) throw error;
        
        mostrarNotificacion('✅ Producto actualizado', 'success');
        cerrarModalEditar();
        await cargarProductos();
        
    } catch (error) {
        console.error('Error actualizando:', error);
        mostrarNotificacion('Error al guardar cambios', 'error');
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
                codigo_barra: codigoBarra,
                nombre: nombre,
                marca: marca,
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
            .or('codigo_barra.is.null,codigo_barra.eq.')
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
            .eq('codigo_barra', codigoBarra)
            .single();
        
        if (existente) {
            mostrarNotificacion(`⚠️ Este código ya está asignado a: ${existente.nombre}`, 'error');
            cerrarEscaner();
            return;
        }
        
        // Asignar código al producto
        const { error } = await supabaseClient
            .from('productos')
            .update({ codigo_barra: codigoBarra })
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
