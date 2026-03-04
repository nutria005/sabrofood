# 🍎 Guía de Depuración para iOS

## Problema: Bucle infinito al seleccionar usuario en iPhone

### ✅ Soluciones Implementadas

1. **Protección contra bucle infinito**
   - Se agregó contador de intentos en `sessionStorage`
   - Si detecta más de 3 intentos, limpia automáticamente todos los datos

2. **Manejo robusto de localStorage**
   - iOS en modo standalone a veces lanza `SecurityError` al acceder a localStorage
   - Todos los accesos a localStorage están protegidos con try-catch
   - Si falla localStorage, la app continúa sin sesión persistente

3. **Logs de depuración**
   - Se agregaron logs detallados en consola para rastrear el problema
   - iOS standalone se detecta y se registra en logs

4. **Meta tags iOS optimizados**
   - `viewport-fit=cover` para dispositivos con notch
   - Múltiples tamaños de iconos Apple Touch
   - Safe area insets para evitar superposición con notch

## 📱 Cómo Depurar en iPhone

### Opción 1: Safari Web Inspector (recomendado)

1. En iPhone:
   - Configuración → Safari → Avanzado → Activar "Web Inspector"

2. En Mac:
   - Conectar iPhone por cable
   - Abrir Safari
   - Menú Desarrollo → [Tu iPhone] → Sabrofood
   - Ver consola para logs de error

### Opción 2: Logs en Pantalla

Agregar temporalmente al HTML (después de `<body>`):

```html
<div id="debugLog" style="position: fixed; bottom: 0; left: 0; right: 0; background: black; color: lime; font-size: 10px; padding: 10px; max-height: 150px; overflow-y: auto; z-index: 99999;"></div>

<script>
// Capturar todos los console.log y mostrarlos en pantalla
const originalLog = console.log;
const originalError = console.error;
const debugDiv = document.getElementById('debugLog');

console.log = function(...args) {
    originalLog.apply(console, args);
    debugDiv.innerHTML += `<div>[LOG] ${args.join(' ')}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
};

console.error = function(...args) {
    originalError.apply(console, args);
    debugDiv.innerHTML += `<div style="color: red;">[ERROR] ${args.join(' ')}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
};
</script>
```

## 🔍 Qué Buscar en los Logs

### Logs Normales (funcionando):
```
🚀 Iniciando aplicación...
📱 Dispositivo: Mozilla/5.0 (iPhone...
🌐 Modo Standalone: Sí (iOS)
ℹ️ No hay sesión guardada
✅ Sesión guardada para: [nombre]
✅ Sesión restaurada: [nombre]
```

### Logs de Error (problemas):
```
❌ Error al leer localStorage (común en iOS standalone): SecurityError
❌ Detectado bucle infinito. Limpiando datos...
❌ Error crítico al verificar sesión: [error]
⚠️ localStorage no disponible en este contexto
```

## 🛠️ Soluciones Manuales

### Si sigue en bucle:

1. **Borrar datos de Safari:**
   ```
   iPhone → Configuración → Safari → Borrar historial y datos
   ```

2. **Eliminar la app y reinstalar:**
   - Mantener presionado el ícono de Sabrofood
   - Eliminar App
   - Volver a Safari y reinstalar desde Compartir → Agregar a pantalla de inicio

3. **Modo avión ON/OFF:**
   - A veces iOS bloquea localStorage por problemas de red
   - Activar modo avión 5 segundos
   - Desactivar y probar de nuevo

### Si localStorage está bloqueado permanentemente:

Modificar `script.js` para usar solo `sessionStorage`:

```javascript
// Reemplazo temporal (línea ~924)
function guardarSesionSiRecordado(rememberDevice, username, role) {
    if (!rememberDevice) return;
    
    // Usar sessionStorage en lugar de localStorage
    const sessionData = { username, role, timestamp: Date.now() };
    try {
        sessionStorage.setItem('sabrofood_temp', JSON.stringify(sessionData));
    } catch (e) {
        console.error('Ni siquiera sessionStorage funciona:', e);
    }
}
```

## 📊 Verificar Estado de la App

Ejecutar en consola de Safari Web Inspector:

```javascript
// Ver si localStorage funciona
try {
    localStorage.setItem('test', '1');
    console.log('✅ localStorage OK');
    localStorage.removeItem('test');
} catch (e) {
    console.error('❌ localStorage bloqueado:', e);
}

// Ver contador de bucle
console.log('Contador de bucle:', sessionStorage.getItem('init_loop_counter'));

// Limpiar todo manualmente
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## 📞 Información para Reportar Bug

Si el problema persiste, recopilar:

1. **Modelo de iPhone:** (ej: iPhone 14 Pro)
2. **Versión de iOS:** (ej: iOS 17.2)
3. **Navegador:** Safari / Standalone PWA
4. **Logs de consola:** (usando Safari Web Inspector)
5. **¿Funciona en Safari normal?:** Sí / No
6. **¿Funciona como PWA instalada?:** Sí / No

## ✨ Validar Corrección

Después de aplicar las correcciones, probar:

1. ✅ Abrir en Safari → Funciona
2. ✅ Instalar como PWA → Funciona
3. ✅ Cerrar app y reabrir → Recuerda sesión
4. ✅ Cerrar sesión → Vuelve a login sin bucle
5. ✅ Modo avión → Funciona offline (si está cacheado)

## 🔄 Versión Actual

- **Fecha corrección:** 4 de marzo de 2026
- **Archivos modificados:**
  - `script.js` (initApp, verificarSesionGuardada, guardarSesionSiRecordado, handleLogout)
  - `index.html` (meta tags iOS, iconos)
  - `style.css` (safe-area-inset)
- **Cambios principales:** 
  - Protección contra bucle infinito
  - Manejo de errores localStorage/sessionStorage
  - Logs mejorados para depuración
