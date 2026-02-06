# 📖 Manual de Uso - Sistema POS SabroFood

## 🔐 Credenciales de Acceso

### 👤 **Encargado (Administrador)**
- **Usuario:** Raquel0603
- **Contraseña:** 0603
- **Permisos:** Acceso completo a todas las funciones

### 👥 **Vendedores**
Todos los vendedores tienen la misma contraseña: **0603**

**Usuarios disponibles:**
- Jonathan R.
- Sebastian
- Pablo
- Hugo
- Tonio
- Diego Sr.
- Diego Jr.
- Emil
- Jonathan J.

---

## 🌐 Acceso al Sistema

**URL:** https://nutria005.github.io/sabrofood/

**Recomendaciones:**
- Usar Google Chrome, Firefox o Edge (navegadores modernos)
- Marcar como favorito para acceso rápido
- Activar "Recordar en este dispositivo" para no iniciar sesión cada vez

---

## 📱 Funciones por Módulo

### 1️⃣ **POS (Punto de Venta)**

#### Realizar una Venta:
1. Selecciona el vendedor en la parte superior
2. Busca el producto:
   - **Escaneando el código de barras** (si tienes lector)
   - **Buscando por nombre** en la barra de búsqueda
   - **Navegando por categorías** (Comida, Bebestibles, Snacks)
3. Haz clic en el producto para agregarlo al carrito
4. Ajusta la cantidad si es necesario (botones + y -)
5. Haz clic en **"Cobrar"**
6. Selecciona el método de pago:
   - **Efectivo:** Ingresa el monto recibido, el sistema calcula el vuelto
   - **Transferencia:** Registra el pago digital
   - **Pago Mixto:** Divide entre efectivo y transferencia
7. Confirma la venta

#### Funciones Rápidas:
- **Eliminar producto del carrito:** Haz clic en el ícono de basura (🗑️)
- **Vaciar carrito completo:** Botón "Limpiar" en la parte inferior
- **Buscar producto:** Escribe en la barra o escanea el código

---

### 2️⃣ **Inventario**

#### Ver Stock:
- Lista completa de productos con:
  - Nombre y categoría
  - Precio de venta
  - Stock disponible
  - Código de barras

#### Filtrar Productos:
- Por categoría (Comida, Bebestibles, Snacks)
- Por búsqueda de texto

#### Editar Producto:
1. Haz clic en el ícono de lápiz (✏️)
2. Modifica los datos necesarios
3. Guarda los cambios

#### Eliminar Producto:
1. Haz clic en el ícono de basura (🗑️)
2. Confirma la eliminación

#### Agregar Nuevo Producto:
1. Haz clic en **"+ Nuevo Producto"**
2. Completa:
   - Nombre del producto
   - Categoría
   - Precio de venta
   - Stock inicial
   - Código de barras (puedes escanearlo)
3. Guarda el producto

---

### 3️⃣ **Historial de Ventas**

#### Vista de Vendedor:
- Solo ve sus propias ventas
- Estadísticas personales del día:
  - Total vendido
  - Número de ventas
  - Ticket promedio
  - Producto más vendido
- Gráfico de ventas por hora

#### Vista de Encargado:
- Ve **TODAS** las ventas de todos los vendedores
- Dashboard completo:
  - Total del día
  - Comparación con días anteriores
  - Ranking de vendedores
  - Productos más vendidos
  - Distribución de métodos de pago
- Gráficos y análisis completos

#### Filtros Disponibles:
- Por fecha (hoy, ayer, última semana, mes)
- Por vendedor (solo encargado)
- Por método de pago

#### Exportar Datos:
- Botón "Exportar CSV" para descargar registros

---

### 4️⃣ **Asistencia (Control de Horarios)** ⏰

#### Para Vendedores:

**Al Iniciar Sesión:**
- El sistema marca tu **entrada automáticamente**

**Durante el Día:**
1. **Iniciar Almuerzo:** Haz clic en el botón cuando comiences a almorzar
2. **Terminar Almuerzo:** Haz clic cuando termines
3. **Marcar Salida:** Al finalizar tu jornada

**Ver tu Historial:**
- Accede a la pestaña "Asistencia" (ícono del reloj)
- Verás tu registro del día actual
- Tabla con historial de días anteriores
- Horas trabajadas calculadas automáticamente

#### Para Encargado:

**Funciones Adicionales:**
- Ver asistencias de **todos los vendedores**
- Filtrar por vendedor y fecha
- **Editar registros manualmente** (botón ✏️):
  - Corregir horarios olvidados
  - Agregar notas explicativas
  - Ajustar horas si hubo error

**Reportes:**
- Total de horas trabajadas por vendedor
- Estados: Completo, Trabajando, En almuerzo, Incompleto
- Historial completo con cálculo automático

---

### 5️⃣ **Asignar Códigos** (Solo Encargado)

#### Función:
Asignar códigos de barras a productos que no los tienen

#### Proceso:
1. Abre la pestaña "Asignar Códigos"
2. Verás lista de productos sin código
3. Para cada producto:
   - Escanea el código de barras con el lector
   - O ingrésalo manualmente
4. Haz clic en "Asignar"
5. El producto ya tendrá código y desaparecerá de esta lista

---

### 6️⃣ **Caja y Gastos** (Solo Encargado)

#### Resumen de Caja:
- **Total en caja:** Suma de efectivo del día
- **Total transferencias:** Suma de pagos digitales
- **Gastos del día:** Total de egresos registrados
- **Balance final:** Total ingresos - gastos

#### Registrar Gasto:
1. Haz clic en **"+ Nuevo Gasto"**
2. Completa:
   - Descripción (ej: "Compra de productos", "Pago servicios")
   - Monto
   - Categoría (Compras, Servicios, Sueldos, Otros)
3. Guarda el gasto

#### Ver Historial de Gastos:
- Lista completa con fecha, descripción y monto
- Filtrar por fecha y categoría
- Editar o eliminar gastos

#### Cierre de Caja:
- Revisa el balance al final del día
- Exporta el resumen si es necesario
- Verifica que coincida con el efectivo físico

---

### 7️⃣ **Administrar Precios** (Solo Encargado)

#### Acceso:
- Desde la vista de "Inventario"
- Botón **"Admin Precios"** en la parte superior

#### Cambiar Precios Masivamente:
1. Verás todos los productos con:
   - Precio actual
   - Campo para nuevo precio
2. Modifica los precios que necesites
3. Haz clic en **"Guardar Cambios"**
4. Los precios se actualizan inmediatamente

---

## ⚙️ Configuración y Ajustes

### Cerrar Sesión:
- Haz clic en el botón de salida (🚪) en la esquina superior derecha
- Si olvidaste marcar salida en asistencia, el sistema te lo recordará

### "Recordar en este dispositivo":
- Marca esta opción al iniciar sesión
- No tendrás que ingresar credenciales por 30 días
- Útil para dispositivos de trabajo fijos

### Cambiar de Vista:
- **En PC:** Usa el menú lateral izquierdo
- **En Móvil:** Usa la barra inferior con los iconos

---

## 📊 Métodos de Pago

### 1. **Efectivo**
- Ingresa el monto recibido
- El sistema calcula el vuelto automáticamente
- Se suma al total de caja

### 2. **Transferencia**
- Registra pagos por transferencia bancaria
- Se suma al total de transferencias
- No genera vuelto

### 3. **Pago Mixto**
- Divide el pago entre efectivo y transferencia
- Útil cuando el cliente paga parte en efectivo y parte por transferencia
- Ejemplo: Total $10.000 → $5.000 efectivo + $5.000 transferencia

---

## 🔒 Seguridad y Privacidad

### Protección de Datos:
- ✅ Contraseñas encriptadas
- ✅ Sesiones seguras
- ✅ Cada vendedor solo ve su información
- ✅ Solo el encargado tiene acceso completo

### Recomendaciones:
- No compartas tu contraseña
- Cierra sesión al terminar tu turno
- Si sospechas acceso no autorizado, avisa al encargado

---

## 🆘 Solución de Problemas

### No puedo iniciar sesión:
- ✅ Verifica que la contraseña sea **0603**
- ✅ Asegúrate de que tu usuario esté en la lista
- ✅ Revisa tu conexión a internet

### No cargan los productos:
- ✅ Verifica tu conexión a internet
- ✅ Recarga la página (F5)
- ✅ Limpia el caché del navegador

### El escáner no funciona:
- ✅ Verifica que esté conectado
- ✅ Haz clic en el campo de búsqueda antes de escanear
- ✅ Intenta ingresar el código manualmente

### No veo mis ventas:
- ✅ Asegúrate de haber iniciado sesión con tu usuario correcto
- ✅ Verifica que el filtro de fecha esté en "Hoy"
- ✅ Recarga la página

### Olvidé marcar mi salida:
- ✅ Avisa al encargado
- ✅ El encargado puede editar tu registro manualmente
- ✅ El sistema te recordará antes de cerrar sesión

### La página no carga:
- ✅ Verifica tu conexión a internet
- ✅ Intenta con otro navegador
- ✅ Limpia la caché (Ctrl + Shift + Delete)

---

## 📞 Soporte Técnico

Si tienes problemas que no puedes resolver:

1. **Reinicia la aplicación**: Cierra y vuelve a abrir el navegador
2. **Verifica tu conexión**: Asegúrate de tener internet estable
3. **Contacta al administrador del sistema**

---

## 🎯 Consejos y Mejores Prácticas

### Para Vendedores:
- ✅ Marca tu entrada/salida todos los días
- ✅ Verifica el total antes de cobrar
- ✅ Confirma el método de pago con el cliente
- ✅ Cuenta el vuelto dos veces antes de entregarlo
- ✅ Revisa tu resumen de ventas al final del día

### Para Encargado:
- ✅ Revisa el cierre de caja diariamente
- ✅ Verifica asistencias y horas trabajadas
- ✅ Actualiza precios cuando sea necesario
- ✅ Revisa el stock y productos más vendidos
- ✅ Exporta reportes semanalmente para análisis

---

## 📝 Actualizaciones y Versiones

**Versión Actual:** 2.0.0

**Últimas Funcionalidades:**
- ✅ Sistema de autenticación con contraseñas
- ✅ Control de asistencia y horarios
- ✅ Pagos mixtos (efectivo + transferencia)
- ✅ Estadísticas individuales por vendedor
- ✅ Dashboard administrativo completo

---

## ✨ ¡Listo para Usar!

El sistema está diseñado para ser **intuitivo y fácil de usar**. Con práctica diaria, te familiarizarás rápidamente con todas las funciones.

**¡Bienvenido al sistema POS de SabroFood!** 🚀
