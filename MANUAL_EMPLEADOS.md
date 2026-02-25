# 📖 Manual de Uso - Sistema Sabrofood POS

**Versión:** 1.0.16  
**Fecha:** 25 de Febrero de 2026

---

## 📋 Índice

1. [Inicio de Sesión](#inicio-de-sesión)
2. [Roles y Permisos](#roles-y-permisos)
3. [Punto de Venta](#punto-de-venta)
4. [Inventario](#inventario)
5. [Bodega](#bodega)
6. [Historial de Ventas](#historial-de-ventas)
7. [Asistencia](#asistencia)
8. [Caja y Gastos](#caja-y-gastos)
9. [Solución de Problemas](#solución-de-problemas)

---

## 🔐 Inicio de Sesión

### Acceso al Sistema
1. Abre el navegador (Chrome, Edge, Firefox)
2. Ingresa a: `https://tu-dominio.github.io/sabrofood` (o la URL proporcionada)
3. Ingresa tu correo y contraseña
4. Click en **"Iniciar Sesión"**

### Credenciales
- **Correo:** El que te proporcionó el administrador
- **Contraseña:** Tu contraseña personal (¡no la compartas!)

### Primer Inicio
- El sistema te dará la bienvenida con tu nombre
- Verás un mensaje de "Sistema en tiempo real activado"
- Las pestañas visibles dependen de tu rol

---

## 👥 Roles y Permisos

### 🔵 Vendedor
**Puede:**
- ✅ Vender productos (Punto de Venta)
- ✅ Ver inventario (solo lectura)
- ✅ Marcar asistencia
- ✅ Ver su historial de ventas

**No puede:**
- ❌ Modificar precios
- ❌ Crear/editar productos
- ❌ Ver caja y gastos
- ❌ Gestionar proveedores/categorías

### 🟣 Encargado/Admin
**Puede hacer TODO:**
- ✅ Todo lo del vendedor
- ✅ Administrar inventario (crear/editar/eliminar)
- ✅ Administrar precios
- ✅ Gestionar proveedores y categorías
- ✅ Ver bodega y pedidos
- ✅ Ver y gestionar caja/gastos
- ✅ Ver asistencia de todos
- ✅ Registrar mermas

---

## 🛒 Punto de Venta

### Buscar Productos

#### Método 1: Escanear Código de Barras
1. Click en **"📷 ESCANEAR"**
2. Permite acceso a la cámara
3. Apunta al código de barras
4. El producto se agregará automáticamente

#### Método 2: Búsqueda Manual
1. Escribe el nombre del producto en la barra de búsqueda
2. Puedes buscar por:
   - Nombre: "9 lives"
   - Marca: "Purina"
   - Categoría: "Gato Adulto"

#### Método 3: Filtros por Categoría
- Click en **"Todos"** para ver todos los productos
- Click en **"🐾 Granel"** para productos a granel
- Click en **"🐕 Perro Adulto"**, **"🐱 Cachorro"**, etc.

### Agregar al Carrito
- Click en la tarjeta del producto
- Se agregará al carrito con cantidad 1
- Para agregar más: vuelve a hacer click

### Modificar Cantidad
- En el carrito, usa los botones **+** y **-**
- O escribe directamente la cantidad

### Eliminar del Carrito
- Click en el ícono de **🗑️** (papelera) junto al producto

### Procesar Venta

#### Paso 1: Revisar Carrito
- Verifica productos y cantidades
- El total se muestra abajo

#### Paso 2: Método de Pago
- **Efectivo:** Click en botón verde "💵 Efectivo"
- **Tarjetas:** Click en botón azul "💳 Tarjetas"

#### Paso 3: Confirmar
- Click en **"💰 PROCESAR PAGO"**
- Aparecerá confirmación de venta exitosa
- El carrito se vaciará automáticamente

### Notas Especiales
- **Productos sin stock:** Aparecen con opacidad reducida pero aún se pueden vender
- **Stock bajo:** Se marcan en amarillo
- **Productos granel:** No muestran estado de stock

---

## 📦 Inventario

### Ver Productos

#### Estadísticas Principales
- **Total Productos:** Cantidad total en catálogo
- **En Stock:** Productos con stock suficiente
- **Stock Bajo:** Productos que necesitan reposición
- **Sin Stock:** Productos agotados (pero vendibles)

#### Filtros Rápidos
- **Todos:** Ver todos los productos
- **En Stock:** Solo productos con suficiente stock
- **Stock Bajo:** Productos que necesitan reposición pronto
- **Sin Stock:** Productos agotados

#### Filtros Avanzados

**Filtrar por Proveedor:**
1. Click en el dropdown "Filtrar por Proveedor"
2. Selecciona un proveedor (Argentinos, Befoods, Purina, etc.)
3. Solo verás productos de ese proveedor

**Filtrar por Categoría:**
1. Click en el dropdown "Filtrar por Categoría"
2. Selecciona una categoría (Gato Adulto, Perro Senior, etc.)
3. Solo verás productos de esa categoría

**Combinar filtros:**
- Puedes usar ambos filtros a la vez
- Ejemplo: "Proveedor: Argentinos" + "Categoría: Gato Adulto"

#### Buscar Producto Específico
- Usa la barra de búsqueda arriba
- Busca por nombre, código de barras, o categoría

### Acciones (Solo Encargado/Admin)

#### ✏️ Editar Producto
1. Click en el ícono de lápiz (✏️)
2. Modifica los campos necesarios:
   - Nombre
   - Código de barras
   - Precio
   - Stock
   - Stock mínimo
   - Proveedor
   - Categoría
3. Click en **"Guardar Producto"**

#### 🗑️ Eliminar Producto
1. Click en el ícono de papelera (🗑️)
2. Confirma la eliminación
3. El producto desaparecerá de inmediato

#### ➕ Crear Producto
1. Click en **"+ Crear Producto"** (botón verde)
2. Completa todos los campos:
   - **Nombre:** Ej. "9 Lives Carne 15kg"
   - **Proveedor:** Selecciona de la lista
   - **Categoría:** Selecciona de la lista
   - **Precio:** Solo números, sin puntos ni comas
   - **Stock:** Cantidad inicial
   - **Stock Mínimo:** Cantidad mínima antes de alertar
   - **Código de Barras:** (opcional) Escribe o escanea
3. Click en **"Guardar Producto"**

#### 📊 Administrar Precios
1. Click en **"💲 Administrar Precios"** (botón azul)
2. Verás lista de todos los productos con sus precios
3. Haz cambios masivos de precio
4. Guarda los cambios

#### 🏢 Gestionar Proveedores
1. Click en **"Gestionar Proveedores"**
2. **Agregar:** Escribe nombre y click "Agregar"
3. **Editar:** Click en ✏️ junto al proveedor, modifica y guarda
4. **Eliminar:** Click en 🗑️ (no afecta productos existentes)

#### 📂 Gestionar Categorías
1. Click en **"Gestionar Categorías"**
2. **Agregar:** Escribe nombre y click "Agregar"
3. **Editar:** Click en ✏️ junto a la categoría, modifica y guarda
4. **Eliminar:** Click en 🗑️ (no afecta productos existentes)

#### ⚠️ Registrar Merma
1. Click en **"Registrar Merma"** (botón naranja)
2. Busca el producto afectado
3. Ingresa cantidad de merma
4. Ingresa motivo (vencimiento, daño, etc.)
5. Click en **"Registrar"**
6. El stock se reducirá automáticamente

### Actualización en Tiempo Real
- Si otro usuario crea/edita/elimina un producto, verás el cambio automáticamente
- No necesitas recargar la página
- El inventario se actualiza cada 500ms

---

## 🏬 Bodega

### ¿Qué es la Bodega Virtual?

Es el sistema para **registrar y controlar los sacos que se sacan de bodega** para rellenar los tachos de venta a granel en el local.

**Objetivo:** Llevar un control exacto de qué productos se están usando para la venta a granel, evitando descontrol de stock y pérdida de inventario.

### Ver Lista de Reposición

#### Panel Principal
- **Lista de Reposición:** Muestra los productos que están pendientes de sacar de bodega
- **Contador de Pendientes:** Cantidad de sacos/productos pendientes de registrar

#### Solicitar Producto

**Cuándo usar:**  
En la mañana, cuando vas a rellenar los tachos de venta a granel.

**Cómo solicitar:**
1. Click en **"Solicitar Producto"** (botón azul arriba)
2. Busca el producto que vas a sacar (ejemplo: "Cat chow delimix", "9 lives carne")
3. **IMPORTANTE:** Estos son productos a granel marcados en el sistema
4. Selecciona el producto de la lista
5. El producto se agrega a la lista de reposición

**Nota:** La solicitud queda registrada para control de inventario. Esto ayuda a:
- Saber cuántos sacos se sacaron de bodega
- Controlar el stock real de productos a granel
- Evitar pérdidas o descontrol de inventario

### Historial de Hoy

**Panel Lateral Derecho**
- Muestra todos los sacos que se sacaron de bodega en el día
- Se actualiza en tiempo real
- Puedes ver:
  - Qué producto
  - A qué hora se sacó
  - Quién lo registró

**Actualizar historial:**
- Click en el ícono de refrescar (🔄) para actualizar la lista

### Flujo de Trabajo Típico

**Por la mañana (antes de abrir el local):**
1. Revisa qué tachos de granel necesitan ser rellenados
2. Ve a la pestaña **Bodega**
3. Para cada saco que saques:
   - Click en "Solicitar Producto"
   - Selecciona el producto (ej: "Cat chow delimix 15kg")
   - Confirma
4. Saca físicamente los sacos de la bodega
5. Rellena los tachos correspondientes

**Durante el día:**
- Si necesitas rellenar un tacho nuevamente, registra el nuevo saco
- Revisa el historial para saber cuántos sacos se han usado

### Beneficios del Sistema

✅ **Control de Stock:** El sistema sabe exactamente cuántos sacos se están usando  
✅ **Transparencia:** Cualquier encargado puede ver el historial  
✅ **Evita Pérdidas:** Detecta si hay más sacos usados de los que deberían  
✅ **Reposición Inteligente:** Sabes cuándo pedir más producto al proveedor  

---

## 📊 Historial de Ventas

### Ver Ventas

#### Filtros de Fecha
- **Hoy:** Solo ventas del día actual
- **Ayer:** Ventas del día anterior
- **Esta Semana:** Últimos 7 días
- **Este Mes:** Mes actual
- **Personalizado:** Selecciona rango específico

#### Información Mostrada
- **Fecha y Hora:** Cuándo se realizó la venta
- **Vendedor:** Quién hizo la venta
- **Productos:** Lista de productos vendidos
- **Cantidad:** Cantidad de cada producto
- **Total:** Monto total de la venta
- **Método de Pago:** Efectivo o Tarjetas

### Estadísticas del Día
- **Total Ventas:** Suma de todas las ventas
- **Cantidad de Transacciones:** Número de ventas
- **Promedio por Venta:** Total ÷ Cantidad
- **Efectivo vs Tarjetas:** Desglose por método de pago

### Ranking de Vendedores (Admin)
- Ve quién vendió más en el período seleccionado
- Muestra total vendido y cantidad de ventas por vendedor

---

## ⏰ Asistencia

### Marcar Tu Asistencia

#### Entrada del Día
1. Ve a la pestaña **"Asistencia"**
2. Click en **"🟢 Marcar Entrada"**
3. Se registra automáticamente fecha y hora

#### Inicio de Almuerzo
1. Click en **"🍽️ Inicio Almuerzo"**
2. Se registra el momento exacto

#### Fin de Almuerzo
1. Click en **"✅ Fin Almuerzo"**
2. Se registra el regreso

#### Salida del Día
1. Click en **"🔴 Marcar Salida"**
2. Se cierra tu registro del día

### Ver Tu Asistencia
- Verás tus marcaciones del día actual
- El historial muestra todos tus días trabajados
- Muestra horas trabajadas y tiempo de almuerzo

### Ver Asistencia de Otros (Admin)
- Los encargados pueden ver asistencia de todos
- Pueden editar marcaciones si hubo errores
- Exportar reportes de asistencia

---

## 💰 Caja y Gastos (Solo Admin)

### Ver Estado de Caja

#### Información Principal
- **Efectivo en Caja:** Total en efectivo actual
- **Ventas del Día:** Total de ventas realizadas
- **Gastos del Día:** Total de gastos registrados
- **Balance:** Ventas - Gastos

### Registrar Gastos

#### Tipos de Gastos
- Insumos
- Servicios (luz, agua, internet)
- Transporte
- Honorarios
- Mantenimiento
- Arriendo
- Publicidad
- Otros

#### Cómo Registrar
1. Click en **"Registrar Gasto"**
2. Selecciona categoría del gasto
3. Ingresa monto
4. Agrega descripción detallada
5. (Opcional) Adjunta comprobante/foto
6. Click en **"Guardar"**

### Cierre de Caja
1. Al final del día, click en **"Cerrar Caja"**
2. Revisa el resumen del día
3. Confirma los montos
4. Se genera reporte automático

### Historial de Movimientos
- Ve todos los movimientos de caja
- Filtra por fecha
- Exporta reportes

---

## 🔧 Solución de Problemas

### Problema: No Puedo Iniciar Sesión
**Solución:**
1. Verifica que tu usuario y contraseña sean correctos
2. Asegúrate de tener conexión a internet
3. Intenta recargar la página (F5)
4. Si persiste, contacta al encargado

### Problema: El Escáner No Funciona
**Solución:**
1. Verifica que diste permiso de cámara al navegador
2. Asegúrate que haya buena iluminación
3. Acerca más el código de barras
4. Si no funciona, usa búsqueda manual

### Problema: No Veo Algunos Productos
**Solución:**
1. Revisa los filtros activos (categoría, proveedor, stock)
2. Limpia filtros seleccionando "Todos"
3. Verifica la barra de búsqueda (debe estar vacía)

### Problema: Los Cambios No Se Guardan
**Solución:**
1. Verifica tu conexión a internet
2. Recarga la página (Ctrl + F5)
3. Vuelve a intentar la acción
4. Si persiste, toma captura y reporta al encargado

### Problema: La App Está Lenta
**Solución:**
1. Cierra pestañas innecesarias del navegador
2. Limpia caché del navegador:
   - Presiona Ctrl + Shift + Delete
   - Selecciona "Imágenes y archivos en caché"
   - Click en "Borrar datos"
3. Recarga la página (Ctrl + F5)

### Problema: El Inventario No Se Actualiza
**Solución:**
1. Espera 5 segundos (actualización automática cada 500ms)
2. Si no se actualiza, recarga la página (F5)
3. Verifica tu conexión a internet
4. Si usas múltiples dispositivos, asegúrate de estar logueado

### Problema: Error al Procesar Pago
**Solución:**
1. Verifica que el carrito no esté vacío
2. Asegúrate de seleccionar método de pago
3. Revisa tu conexión a internet
4. Recarga página e intenta de nuevo
5. Si persiste, anota la hora y productos, reporta al encargado

---

## 📱 Consejos y Mejores Prácticas

### Para Vendedores
✅ **Siempre marca tu asistencia** al inicio y fin del día  
✅ **Verifica el precio** antes de confirmar la venta  
✅ **Confirma el método de pago** con el cliente antes de procesar  
✅ **Si hay dudas de stock**, consulta el inventario antes de prometer disponibilidad  

### Para Encargados
✅ **Revisa el inventario diariamente** para detectar productos con stock bajo  
✅ **Actualiza precios regularmente** según cambios de proveedores  
✅ **Registra mermas inmediatamente** para mantener stock preciso  
✅ **Cierra caja diariamente** para llevar control exacto  
✅ **Revisa asistencia del equipo** para detectar irregularidades  

### Seguridad
🔒 **Nunca compartas tu contraseña**  
🔒 **Cierra sesión** si te ausentas del dispositivo  
🔒 **No dejes el navegador abierto** cuando termines tu turno  
🔒 **Reporta cualquier comportamiento extraño** del sistema  

---

## 🆘 Soporte

### ¿Necesitas Ayuda?
- **Encargado del Local:** Consulta primero internamente
- **Soporte Técnico:** Reporta problemas técnicos con capturas de pantalla

### Información Útil al Reportar Problemas
1. **Qué estabas haciendo** cuando ocurrió el error
2. **Mensaje de error** (si apareció alguno)
3. **Captura de pantalla** del problema
4. **Hora exacta** en que ocurrió
5. **Navegador** que estás usando (Chrome, Firefox, etc.)

---

**Versión del Manual:** 1.0  
**Última Actualización:** 25 de Febrero de 2026  
**Sistema:** Sabrofood POS v1.0.16

---

💡 **Recuerda:** El sistema se actualiza automáticamente. Si ves alguna funcionalidad nueva, consulta la versión actualizada de este manual.
