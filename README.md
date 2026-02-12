#  Sabrofood - Sistema POS

Sistema de Punto de Venta (POS) moderno para gestión de restaurantes. Progressive Web App instalable en cualquier dispositivo.

##  Características

-  **Punto de Venta** - Escaneo de productos, carrito optimizado para móvil
-  **Gestión de Pedidos** - Seguimiento en tiempo real de pedidos
-  **Inventario** - Control de stock y productos
-  **Asistencia** - Registro de horarios del personal
-  **PWA** - Instalable como app nativa en móvil/desktop
-  **Tiempo Real** - Sincronización instantánea con Supabase

##  Tecnologías

- Frontend: HTML5, CSS3, JavaScript
- Backend: Supabase (PostgreSQL)
- PWA: Service Worker, Manifest
- Fuentes: Inter (Google Fonts)

##  Instalación

1. Clona el repositorio
2. Crea `supabase-config.js` con tus credenciales de Supabase
3. Ejecuta la app con cualquier servidor web estático
4. Accede desde el navegador

##  Seguridad

- `supabase-config.js` está excluido del repositorio (credenciales privadas)
- Service Worker configurado para no cachear datos sensibles
- RLS (Row Level Security) implementado en Supabase

##  PWA

La aplicación se puede instalar como app nativa:
- **Android/iOS**: Banner de instalación automático
- **Desktop**: Botón en barra de direcciones del navegador
- **Offline**: UI disponible sin conexión

---

**Proyecto privado** - Sabrofood Team  2026
