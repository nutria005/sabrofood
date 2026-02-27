// PWA Installation Handler
// Gestiona el prompt de instalación de la aplicación

let deferredPrompt = null;
let installButton = null;

// ===================================
// DETECTAR EVENTO DE INSTALACIÓN
// ===================================
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📱 PWA: Evento de instalación disponible');

    // Prevenir que el navegador muestre su propio prompt
    e.preventDefault();

    // Guardar el evento para usarlo después
    deferredPrompt = e;

    // Mostrar botón de instalación personalizado
    mostrarBotonInstalar();
});

// ===================================
// DETECTAR SI YA ESTÁ INSTALADA
// ===================================
window.addEventListener('appinstalled', () => {
    console.log('✅ PWA: Aplicación instalada correctamente');
    deferredPrompt = null;
    ocultarBotonInstalar();

    // Mostrar mensaje de éxito (opcional)
    mostrarNotificacion('¡Sabrofood instalada! Ahora puedes abrirla desde tu pantalla de inicio 🎉');
});

// Verificar si ya está instalada (standalone mode)
if (window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true) {
    console.log('✅ PWA: Aplicación ya está instalada y ejecutándose en modo standalone');
}

// ===================================
// CREAR BOTÓN DE INSTALACIÓN
// ===================================
function mostrarBotonInstalar() {
    // Verificar si el botón ya existe
    if (document.getElementById('pwaInstallBtn')) {
        return;
    }

    // Crear botón flotante discreto
    const button = document.createElement('button');
    button.id = 'pwaInstallBtn';
    button.className = 'pwa-install-btn';
    button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Instalar App</span>
        <button class="pwa-install-close" onclick="event.stopPropagation(); cerrarBotonInstalar()">✕</button>
    `;

    // Añadir estilos dinámicos si no existen
    if (!document.getElementById('pwaInstallStyles')) {
        const styles = document.createElement('style');
        styles.id = 'pwaInstallStyles';
        styles.textContent = `
            .pwa-install-btn {
                position: fixed;
                bottom: 24px;
                right: 24px;
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 14px 24px;
                background: linear-gradient(135deg, #42B4E6 0%, #3A9FCC 100%);
                color: white;
                border: none;
                border-radius: 50px;
                font-family: 'Inter', sans-serif;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 8px 24px rgba(66, 180, 230, 0.4);
                z-index: 9998;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                animation: slideUpFade 0.5s ease-out;
            }

            .pwa-install-btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 12px 32px rgba(66, 180, 230, 0.5);
            }

            .pwa-install-btn svg {
                flex-shrink: 0;
            }

            .pwa-install-close {
                position: absolute;
                top: -8px;
                right: -8px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.5);
                color: white;
                border: 2px solid white;
                font-size: 12px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .pwa-install-close:hover {
                background: rgba(220, 53, 69, 0.9);
                transform: scale(1.1);
            }

            @keyframes slideUpFade {
                from {
                    opacity: 0;
                    transform: translateY(100px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @media (max-width: 768px) {
                .pwa-install-btn {
                    bottom: 100px; /* Evitar botón flotante del carrito */
                    left: 50%;
                    right: auto;
                    transform: translateX(-50%);
                    font-size: 14px;
                    padding: 12px 20px;
                }

                .pwa-install-btn:hover {
                    transform: translateX(-50%) translateY(-3px);
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Evento click para instalar
    button.addEventListener('click', instalarPWA);

    // Añadir al DOM
    document.body.appendChild(button);
    installButton = button;
}

// ===================================
// INSTALAR PWA
// ===================================
async function instalarPWA() {
    if (!deferredPrompt) {
        console.warn('⚠️ PWA: No hay evento de instalación disponible');
        return;
    }

    // Mostrar prompt nativo del navegador
    deferredPrompt.prompt();

    // Esperar la decisión del usuario
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`📱 PWA: Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);

    if (outcome === 'accepted') {
        ocultarBotonInstalar();
    }

    // Limpiar el prompt diferido
    deferredPrompt = null;
}

// ===================================
// OCULTAR/CERRAR BOTÓN
// ===================================
function ocultarBotonInstalar() {
    if (installButton) {
        installButton.style.animation = 'slideUpFade 0.3s ease-out reverse';
        setTimeout(() => {
            installButton.remove();
            installButton = null;
        }, 300);
    }
}

function cerrarBotonInstalar() {
    console.log('PWA: Usuario cerró el botón de instalación');
    ocultarBotonInstalar();

    // Recordar que el usuario cerró el botón (no mostrar por 7 días)
    localStorage.setItem('pwa-install-dismissed', Date.now());
}

// ===================================
// VERIFICAR SI MOSTRAR BOTÓN
// ===================================
function verificarMostrarBoton() {
    const dismissed = localStorage.getItem('pwa-install-dismissed');

    if (dismissed) {
        const diasTranscurridos = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);

        if (diasTranscurridos < 7) {
            console.log('PWA: Botón de instalación ocultado por el usuario (mostrar en ' +
                        Math.ceil(7 - diasTranscurridos) + ' días)');
            return false;
        } else {
            // Han pasado 7 días, limpiar
            localStorage.removeItem('pwa-install-dismissed');
        }
    }

    return true;
}

// ===================================
// NOTIFICACIONES
// ===================================
function mostrarNotificacion(mensaje) {
    // Crear notificación simple
    const notif = document.createElement('div');
    notif.className = 'pwa-notification';
    notif.textContent = mensaje;
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #10b981;
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        font-weight: 500;
        box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
        z-index: 10000;
        animation: slideDown 0.4s ease-out;
    `;

    document.body.appendChild(notif);

    // Eliminar después de 4 segundos
    setTimeout(() => {
        notif.style.animation = 'slideDown 0.3s ease-out reverse';
        setTimeout(() => notif.remove(), 300);
    }, 4000);
}

// Añadir animación de notificación
const notifStyle = document.createElement('style');
notifStyle.textContent = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-100px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
`;
document.head.appendChild(notifStyle);

// ===================================
// INICIALIZACIÓN
// ===================================
console.log('🚀 PWA Install Handler cargado');

// Mostrar botón después de 5 segundos si está disponible y no fue cerrado
setTimeout(() => {
    if (deferredPrompt && verificarMostrarBoton()) {
        mostrarBotonInstalar();
    }
}, 5000);
