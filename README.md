# 🍕 SabroFood - Sistema POS

Sistema de Punto de Venta (POS) moderno y completo para gestión de restaurantes y locales de comida. Desarrollado con tecnología web moderna y base de datos en tiempo real.

![Estado](https://img.shields.io/badge/Estado-Producción-success)
![Versión](https://img.shields.io/badge/Versión-2.0.0-blue)
![Licencia](https://img.shields.io/badge/Licencia-Privado-red)

## 🌐 Demo en Vivo

**URL:** [https://nutria005.github.io/sabrofood/](https://nutria005.github.io/sabrofood/)

> ⚠️ **Nota:** Necesitas credenciales válidas para acceder al sistema.

---

## ✨ Características Principales

### 📱 Punto de Venta (POS)
- ✅ Interfaz intuitiva y responsive
- ✅ Búsqueda rápida de productos
- ✅ Soporte para escáner de códigos de barras
- ✅ Carrito de compras en tiempo real
- ✅ Múltiples métodos de pago

### 💰 Métodos de Pago
- **Efectivo** - Con cálculo automático de vuelto
- **Transferencia** - Registro de pagos digitales
- **Pago Mixto** - Combinación de efectivo y transferencia

### 📦 Gestión de Inventario
- Control de stock en tiempo real
- Categorización de productos (Comida, Bebestibles, Snacks)
- Búsqueda y filtrado avanzado
- Edición y eliminación de productos
- Gestión de códigos de barras

### 📊 Análisis y Reportes
- Dashboard con KPIs en tiempo real
- Estadísticas de ventas diarias
- Gráficos de tendencias por hora
- Ranking de productos más vendidos
- Análisis de métodos de pago
- Exportación a CSV

### 👥 Control de Usuarios
- Sistema de roles (Encargado/Vendedor)
- Autenticación segura con contraseñas encriptadas
- Sesiones persistentes opcionales (30 días)
- Permisos granulares por rol

### ⏰ Control de Asistencia
- Marcaje automático de entrada al iniciar sesión
- Registro de horarios de almuerzo
- Cálculo automático de horas trabajadas
- Historial completo de asistencias
- Edición manual por encargado

### 💼 Gestión Administrativa
- **Caja y Gastos** - Control financiero completo
- **Asignación de Códigos** - Gestión de códigos de barras
- **Administración de Precios** - Actualización masiva
- **Cierre de Caja** - Balance diario automático

---

## 🛠️ Tecnologías Utilizadas

### Frontend
- **HTML5** - Estructura semántica
- **CSS3** - Diseño moderno con variables CSS
- **JavaScript (ES6+)** - Lógica de aplicación
- **Design System** - Componentes reutilizables

### Backend
- **Supabase** - Base de datos PostgreSQL
- **Realtime Database** - Sincronización en tiempo real
- **Row Level Security (RLS)** - Seguridad a nivel de fila
- **PostgreSQL Functions** - Lógica del servidor

### Características de Seguridad
- 🔒 Contraseñas hasheadas con bcrypt
- 🔒 RLS policies en todas las tablas
- 🔒 Sesiones con tokens encriptados
- 🔒 Validación de permisos por rol

---

## 📋 Funcionalidades por Rol

### 👔 Encargado (Administrador)
- ✅ Acceso completo al sistema
- ✅ Ver todas las ventas de todos los vendedores
- ✅ Dashboard administrativo con KPIs globales
- ✅ Gestión de inventario y precios
- ✅ Control de asistencia de todo el personal
- ✅ Registro y consulta de gastos
- ✅ Cierre de caja
- ✅ Asignación de códigos de barras
- ✅ Edición manual de registros

### 👤 Vendedor
- ✅ Acceso al punto de venta
- ✅ Ver solo sus propias ventas
- ✅ Estadísticas personales
- ✅ Consulta de inventario
- ✅ Registro de asistencia personal
- ✅ Marcaje de horarios de trabajo

---

## 🎯 Módulos del Sistema

### 1. **POS (Punto de Venta)**
Realiza ventas de forma rápida y eficiente con soporte para escáner de códigos de barras, búsqueda inteligente y cálculo automático de totales.

### 2. **Inventario**
Gestiona el catálogo completo de productos con control de stock, precios y códigos de barras. Edición y eliminación en tiempo real.

### 3. **Historial de Ventas**
Consulta el histórico completo de transacciones con filtros por fecha, vendedor y método de pago. Incluye estadísticas y gráficos.

### 4. **Asistencia**
Control automático de horarios de trabajo con marcaje de entrada/salida, horarios de almuerzo y cálculo de horas trabajadas.

### 5. **Asignar Códigos** _(Solo Encargado)_
Asigna códigos de barras a productos que no los tienen, facilitando el proceso de venta con escáner.

### 6. **Caja y Gastos** _(Solo Encargado)_
Administra el flujo de efectivo, registra gastos operativos y realiza el cierre diario de caja.

### 7. **Administrar Precios** _(Solo Encargado)_
Actualiza precios de forma masiva en todo el inventario desde una única interfaz.

---

## 📱 Diseño Responsive

El sistema está completamente optimizado para:
- 🖥️ **Desktop** - Interfaz completa con todas las funcionalidades
- 📱 **Tablet** - Adaptación automática del layout
- 📲 **Móvil** - Navegación optimizada con barra inferior

---

## 🚀 Instalación y Configuración

### Requisitos Previos
- Cuenta en [Supabase](https://supabase.com)
- Navegador web moderno (Chrome, Firefox, Edge)

### Configuración

1. **Clona el repositorio:**
```bash
git clone https://github.com/nutria005/sabrofood.git
cd sabrofood
```

2. **Configura Supabase:**
```bash
cp supabase-config.example.js supabase-config.js
```

3. **Edita `supabase-config.js` con tus credenciales:**
```javascript
const SUPABASE_URL = 'TU_URL_DE_SUPABASE';
const SUPABASE_ANON_KEY = 'TU_API_KEY_PUBLICA';
```

4. **Ejecuta los scripts SQL en Supabase:**
- `database/crear_sistema_asistencia.sql` - Sistema de asistencia

5. **Abre `index.html` en tu navegador o despliega en GitHub Pages**

---

## 📊 Estructura de la Base de Datos

### Tablas Principales
- **productos** - Catálogo de productos
- **ventas** - Registro de transacciones
- **ventas_items** - Detalle de productos por venta
- **gastos** - Registro de egresos
- **usuarios** - Control de acceso
- **asistencias** - Control de horarios

### Triggers y Funciones
- `calcular_horas_trabajadas()` - Cálculo automático de horas
- `actualizar_horas_trabajadas()` - Trigger para asistencias
- `validar_login()` - Validación de credenciales

---

## 🔒 Seguridad

### Medidas Implementadas
- ✅ Contraseñas encriptadas con bcrypt
- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Validación de sesiones con tokens
- ✅ Permisos basados en roles
- ✅ Protección contra inyección SQL
- ✅ CORS configurado correctamente

### Buenas Prácticas
- 🔐 No compartir credenciales
- 🔐 Cerrar sesión después de cada uso
- 🔐 Mantener actualizado el archivo `.gitignore`
- 🔐 No exponer `supabase-config.js` en repositorios públicos

---

## 📈 Roadmap

### Versión 2.1 (Próximamente)
- [ ] Alertas de stock bajo
- [ ] Registro de entradas de productos
- [ ] Notificaciones push en tiempo real
- [ ] Exportación de reportes en PDF

### Versión 3.0 (Futuro)
- [ ] App móvil nativa
- [ ] Impresión de tickets
- [ ] Integración con contabilidad
- [ ] Sistema de metas y comisiones

---

## 🐛 Solución de Problemas

### El sistema no carga
- Verifica tu conexión a internet
- Revisa las credenciales de Supabase
- Limpia la caché del navegador (Ctrl + Shift + Delete)

### Error de CORS
- Agrega tu dominio en Supabase → Settings → API → CORS allowed origins
- Ejemplo: `https://nutria005.github.io`

### No puedo iniciar sesión
- Verifica que las credenciales sean correctas
- Asegúrate de que el usuario esté activo en la base de datos
- Revisa la consola del navegador (F12) para ver errores

---

## 📝 Changelog

### v2.0.0 (Febrero 2026)
- ✨ Sistema de autenticación completo
- ✨ Control de asistencia automático
- ✨ Pagos mixtos (efectivo + transferencia)
- ✨ Dashboard administrativo mejorado
- ✨ Estadísticas individuales por vendedor
- 🐛 Corrección de timezone para Chile

### v1.0.0 (Enero 2026)
- 🎉 Lanzamiento inicial
- ✨ POS básico
- ✨ Gestión de inventario
- ✨ Historial de ventas

---

## 👨‍💻 Desarrollo

Este sistema fue desarrollado como una solución personalizada para negocios de comida rápida y restaurantes, con enfoque en facilidad de uso y eficiencia operativa.

### Contacto
Para soporte técnico o consultas sobre el sistema, contacta al administrador.

---

## ⚖️ Licencia

Este proyecto es de uso privado. Todos los derechos reservados.

---

**Desarrollado con ❤️ para SabroFood**
