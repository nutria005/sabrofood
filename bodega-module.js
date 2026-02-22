// ===============================================
// MÓDULO DE BODEGA VIRTUAL Y REPOSICIÓN
// ===============================================
// Sistema de control de inventario por sacos completos
// Permite reposición sin control de gramos individuales

// Variables globales del módulo
let solicitudesReposicion = [];
let productosConStock = []; // Ahora consultamos productos directamente
let productoSacoActual = null;
let realtimeChannelBodega = null;

// ===================================
// INICIALIZACIÓN Y CARGA DE DATOS
// ===================================

/**
 * Cargar todas las solicitudes de reposición pendientes
 */
async function cargarSolicitudesReposicion() {
    try {
        const { data, error } = await supabaseClient
            .from('solicitudes_reposicion')
            .select(`
                *,
                productos:producto_id (
                    id,
                    nombre,
                    categoria,
                    stock,
                    stock_minimo_sacos
                )
            `)
            .eq('estado', 'pendiente')
            .order('fecha_solicitud', { ascending: false });

        if (error) throw error;

        solicitudesReposicion = data || [];
        renderizarSolicitudes();
        actualizarContadorPendientes();

        console.log(`📋 ${solicitudesReposicion.length} solicitudes cargadas`);

    } catch (error) {
        console.error('Error cargando solicitudes:', error);
        mostrarNotificacion('Error al cargar solicitudes de reposición', 'error');
    }
}

/**
 * Renderizar lista de solicitudes con semáforo de stock
 */
function renderizarSolicitudes() {
    const container = document.getElementById('listaSolicitudes');
    if (!container) return;

    if (solicitudesReposicion.length === 0) {
        container.innerHTML = `
            <div class="empty-state ">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" style="opacity: 0.3;">
                    <path d="M9 11l3 3L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" stroke-width="2"/>
                </svg>
                <p>No hay solicitudes pendientes</p>
                <span>¡Todo bajo control! 🎉</span>
            </div>
        `;
        return;
    }

    const html = solicitudesReposicion.map(sol => {
        // Obtener datos del producto del JOIN
        const producto = sol.productos || {};
        const stockActual = producto.stock || 0;
        const stockMinimo = producto.stock_minimo_sacos || 0;

        // Determinar texto de stock
        const stockTexto = stockActual === 0 ? 'Sin Stock' : `${Math.floor(stockActual)} STOCK`;

        // Semáforo de stock
        let estadoStock, colorSemaforo;
        if (stockActual === 0) {
            estadoStock = 'critico';
            colorSemaforo = '🔴'; // Rojo - Sin stock
        } else if (stockMinimo === 0 || stockActual > stockMinimo) {
            estadoStock = 'disponible';
            colorSemaforo = '🟢'; // Verde
        } else if (stockActual === stockMinimo) {
            estadoStock = 'advertencia';
            colorSemaforo = '🟡'; // Amarillo
        } else {
            estadoStock = 'critico';
            colorSemaforo = '🔴'; // Rojo
        }

        return `
            <div class="solicitud-card solicitud-${estadoStock}" data-id="${sol.id}">
                <div class="solicitud-info">
                    <div class="solicitud-header">
                        <h4>${producto.nombre || 'Producto sin nombre'}</h4>
                        <span class="badge badge-${producto.categoria?.toLowerCase() || 'info'}">${producto.categoria || 'Sin categoría'}</span>
                    </div>
                    <div class="solicitud-meta">
                        <span class="meta-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="8" r="3" stroke="currentColor" stroke-width="2"/>
                                <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            ${sol.solicitado_por}
                        </span>
                        <span class="meta-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            ${formatearHora(sol.fecha_solicitud)}
                        </span>
                    </div>
                </div>

                <div class="solicitud-stock">
                    <div class="stock-indicator stock-${estadoStock}">
                        <span class="stock-icon">${colorSemaforo}</span>
                        <div>
                            ${stockActual === 0 
                                ? '<strong>Sin Stock</strong>' 
                                : `<strong>${Math.floor(stockActual)}</strong><span>stock</span>`
                            }
                        </div>
                    </div>
                    <div class="solicitud-actions">
                        <button
                            class="btn btn-success btn-sm"
                            onclick="completarSolicitud(${sol.id})"
                            title="Abrir saco y descontar stock"
                        >
                            📦 Abrir Saco
                        </button>
                        <button
                            class="btn btn-danger btn-sm"
                            onclick="cancelarSolicitud(${sol.id})"
                            title="Cancelar solicitud"
                        >
                            ❌
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * Actualizar contador de solicitudes pendientes
 */
function actualizarContadorPendientes() {
    const contador = document.getElementById('contadorPendientes');
    if (contador) {
        const cantidad = solicitudesReposicion.length;
        contador.textContent = `${cantidad} ${cantidad === 1 ? 'pendiente' : 'pendientes'}`;
        contador.className = `badge badge-${cantidad > 0 ? 'warning' : 'success'}`;
    }
}

/**
 * Cargar productos con información de stock
 * SIMPLIFICADO: Solo campos necesarios para semáforo
 */
async function cargarStockBodega() {
    try {
        const { data, error } = await supabaseClient
            .from('productos')
            .select('id, nombre, categoria, stock, stock_minimo_sacos')
            .in('categoria', ['Adulto', 'Cachorro', 'Senior', 'Gato', 'Gatito', 'Arena'])
            .order('nombre');

        if (error) throw error;

        productosConStock = data || [];
        renderizarSolicitudes(); // Re-renderizar con info de stock

        console.log(`📦 ${productosConStock.length} productos cargados`);

    } catch (error) {
        console.error('Error cargando productos:', error);
        mostrarNotificacion('Error al cargar información de productos', 'error');
    }
}

// ===================================
// SOLICITAR PRODUCTO (Agregar a lista)
// ===================================

/**
 * Mostrar modal para solicitar reposición
 */
function mostrarModalSolicitarProducto() {
    const modal = document.getElementById('modalSolicitarProducto');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('buscarProductoReposicion').focus();
        document.getElementById('buscarProductoReposicion').value = '';
        document.getElementById('resultadosBusquedaReposicion').innerHTML = `
            <div class="empty-state-small">
                <p>Escribe para buscar productos</p>
            </div>
        `;
    }
}

/**
 * Cerrar modal de solicitar producto
 */
function cerrarModalSolicitarProducto() {
    const modal = document.getElementById('modalSolicitarProducto');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Buscar productos para agregar a reposición
 */
async function buscarProductosParaReposicion() {
    const query = document.getElementById('buscarProductoReposicion').value.trim().toLowerCase();
    const container = document.getElementById('resultadosBusquedaReposicion');

    if (!container) return;

    if (query.length < 2) {
        container.innerHTML = `
            <div class="empty-state-small">
                <p>Escribe al menos 2 caracteres</p>
            </div>
        `;
        return;
    }

    try {
        // Buscar en productos a granel (TODAS las categorías de comida para mascotas)
        const { data, error } = await supabaseClient
            .from('productos')
            .select('id, nombre, categoria')
            .in('categoria', [
                'Adulto', 'Cachorro', 'Senior',           // Perros
                'Gato', 'Gatito',                           // Gatos genéricos
                'Gato Adulto', 'Gato Kitten',              // Gatos específicos
                'Perro Adulto', 'Perro Cachorro',          // Perros específicos
                'Arena',                                    // Arena para gatos
                'Granel'                                    // Productos a granel
            ])
            .ilike('nombre', `%${query}%`)
            .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state-small">
                    <p>No se encontraron productos</p>
                </div>
            `;
            return;
        }

        const html = data.map(prod => {
            // Verificar si ya está en la lista de solicitudes
            const yaEnLista = solicitudesReposicion.some(s => s.producto_id === prod.id);
            const btnText = yaEnLista ? '✓ Ya en lista' : '+ Agregar';
            const btnDisabled = yaEnLista ? 'disabled' : '';
            const btnClass = yaEnLista ? 'btn-secondary' : 'btn-primary';

            return `
                <div class="producto-busqueda-item">
                    <div class="producto-info-mini">
                        <strong>${prod.nombre}</strong>
                        <span class="badge badge-${prod.categoria?.toLowerCase()}">${prod.categoria}</span>
                    </div>
                    <button
                        class="btn ${btnClass} btn-sm"
                        onclick="agregarSolicitudReposicion(${prod.id}, '${prod.nombre.replace(/'/g, "\\'")}', '${prod.categoria}')"
                        ${btnDisabled}
                    >
                        ${btnText}
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = html;

    } catch (error) {
        console.error('Error buscando productos:', error);
        container.innerHTML = `
            <div class="empty-state-small">
                <p>Error al buscar productos</p>
            </div>
        `;
    }
}

/**
 * Agregar producto a la lista de solicitudes
 */
async function agregarSolicitudReposicion(productoId, nombreProducto, categoria) {
    try {
        // Insertar solicitud (optimizado: sin campos redundantes)
        const { data, error } = await supabaseClient
            .from('solicitudes_reposicion')
            .insert({
                producto_id: productoId,
                solicitado_por: currentUser,
                estado: 'pendiente'
            })
            .select()
            .single();

        if (error) throw error;

        mostrarNotificacion(`✅ ${nombreProducto} agregado a la lista`, 'success');
        cerrarModalSolicitarProducto();

        // Recargar solicitudes
        await cargarSolicitudesReposicion();

    } catch (error) {
        console.error('Error agregando solicitud:', error);
        mostrarNotificacion('Error al agregar solicitud', 'error');
    }
}

// ===================================
// ABRIR SACO (Descontar stock)
// ===================================

// ===================================
// COMPLETAR SOLICITUDES
// ===================================

/**
 * Marcar solicitud como completada y descontar stock
 */
async function completarSolicitud(solicitudId) {
    const confirmar = confirm('¿Abrir saco? Esto descontará 1 unidad del stock.');
    if (!confirmar) return;

    try {
        // Buscar la solicitud para obtener el producto_id
        const solicitud = solicitudesReposicion.find(s => s.id === solicitudId);
        if (!solicitud) {
            throw new Error('Solicitud no encontrada');
        }

        // Obtener stock actual del producto
        const { data: producto, error: errorProducto } = await supabaseClient
            .from('productos')
            .select('stock')
            .eq('id', solicitud.producto_id)
            .single();

        if (errorProducto) throw errorProducto;

        const nuevoStock = (producto.stock || 0) - 1;

        if (nuevoStock < 0) {
            mostrarNotificacion('⚠️ Stock insuficiente para completar', 'warning');
            return;
        }

        // Actualizar stock del producto
        const { error: errorStock } = await supabaseClient
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', solicitud.producto_id);

        if (errorStock) throw errorStock;

        // Marcar solicitud como completada
        const { error } = await supabaseClient
            .from('solicitudes_reposicion')
            .update({
                estado: 'completada',
                completado_por: currentUser,
                fecha_completado: new Date().toISOString()
            })
            .eq('id', solicitudId);

        if (error) throw error;

        mostrarNotificacion('📦 Saco abierto - Stock descontado', 'success');

        // Recargar todo
        await cargarSolicitudesReposicion();
        await cargarStockBodega();
        await cargarHistorialSacos();

    } catch (error) {
        console.error('Error completando solicitud:', error);
        mostrarNotificacion('Error al completar solicitud', 'error');
    }
}

// ===================================
// CANCELAR SOLICITUDES
// ===================================

/**
 * Cancelar/eliminar una solicitud pendiente
 */
async function cancelarSolicitud(solicitudId) {
    const confirmar = confirm('¿Eliminar esta solicitud de la lista?');
    if (!confirmar) return;

    try {
        // Opción 1: Eliminar permanentemente
        const { error } = await supabaseClient
            .from('solicitudes_reposicion')
            .delete()
            .eq('id', solicitudId);

        if (error) throw error;

        mostrarNotificacion('🗑️ Solicitud eliminada', 'success');
        await cargarSolicitudesReposicion();

    } catch (error) {
        console.error('Error cancelando solicitud:', error);
        mostrarNotificacion('Error al cancelar solicitud', 'error');
    }
}

// ===================================
// HISTORIAL
// ===================================

/**
 * Cargar historial de solicitudes completadas hoy
 */
async function cargarHistorialSacos() {
    const container = document.getElementById('historialSacos');
    if (!container) return;

    try {
        // Obtener fecha de hoy (inicio del día)
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const inicioHoy = hoy.toISOString();

        // Cargar solicitudes completadas hoy
        const { data, error } = await supabaseClient
            .from('solicitudes_reposicion')
            .select('*')
            .eq('estado', 'completada')
            .gte('fecha_completado', inicioHoy)
            .order('fecha_completado', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state-small">
                    <p>No hay registros hoy</p>
                </div>
            `;
            return;
        }

        const html = data.map(sol => {
            const producto = productosConStock.find(p => p.id === sol.producto_id) || {};
            return `
                <div class="historial-item">
                    <div class="historial-info">
                        <strong>${producto.nombre || 'Producto'}</strong>
                        <span class="badge badge-${producto.categoria?.toLowerCase() || 'info'}" style="font-size: 0.7rem;">${producto.categoria || 'N/A'}</span>
                    </div>
                    <div class="historial-meta">
                        <span style="font-size: 0.75rem; color: #6b7280;">✅ ${sol.completado_por || 'Usuario'}</span>
                        <span style="font-size: 0.75rem; color: #9ca3af;">${formatearHora(sol.fecha_completado)}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;

    } catch (error) {
        console.error('Error cargando historial:', error);
        container.innerHTML = `
            <div class="empty-state-small">
                <p>Error al cargar historial</p>
            </div>
        `;
    }
}

// ===================================
// SINCRONIZACIÓN EN TIEMPO REAL
// ===================================

/**
 * Inicializar sincronización en tiempo real para bodega
 * SIMPLIFICADO: Solo solicitudes
 */
function inicializarRealtimeBodega() {
    if (!supabaseClient) {
        console.warn('⚠️ Supabase no disponible para Realtime de bodega');
        return;
    }

    console.log('🔴 Iniciando Realtime para Bodega...');

    // Canal para sincronización
    realtimeChannelBodega = supabaseClient
        .channel('bodega-reposicion')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'solicitudes_reposicion'
            },
            async (payload) => {
                console.log('🔄 Cambio en solicitudes:', payload);
                await cargarSolicitudesReposicion();
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'productos'
            },
            async (payload) => {
                // Solo react if stock changed
                console.log('🔄 Cambio en producto:', payload);
                await cargarStockBodega();
                renderizarSolicitudes();
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime de Bodega activo');
            }
        });
}

/**
 * Desuscribirse de cambios en tiempo real de bodega
 */
function desconectarRealtimeBodega() {
    if (realtimeChannelBodega) {
        supabaseClient.removeChannel(realtimeChannelBodega);
        realtimeChannelBodega = null;
        console.log('❌ Realtime de Bodega desconectado');
    }
}

// ===================================
// INTEGRACIÓN CON SISTEMA PRINCIPAL
// ===================================
// Nota: La función cambiarVista() en script.js ya maneja la vista de bodega correctamente

// ===================================
// UTILIDADES
// ===================================

/**
 * Formatear hora en formato legible
 */
function formatearHora(fecha) {
    if (!fecha) return '';
    const date = new Date(fecha);
    const horas = date.getHours().toString().padStart(2, '0');
    const minutos = date.getMinutes().toString().padStart(2, '0');
    return `${horas}:${minutos}`;
}

console.log('🏭 Módulo de Bodega Virtual cargado (OPTIMIZADO - usa tabla productos directamente)');
