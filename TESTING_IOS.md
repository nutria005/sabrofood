# 🚀 Script de Testing Rápido para iOS

## Método 1: Usando ngrok (RECOMENDADO)

### 1. Instalar ngrok

**Opción A - Chocolatey:**
```powershell
choco install ngrok
```

**Opción B - Manual:**
1. Descargar desde: https://ngrok.com/download
2. Extraer ngrok.exe a una carpeta (ej: C:\ngrok)
3. Agregar a PATH o ejecutar desde esa carpeta

**Opción C - Winget:**
```powershell
winget install ngrok.ngrok
```

### 2. Registrarse en ngrok (gratis)
1. Ir a: https://dashboard.ngrok.com/signup
2. Copiar tu authtoken
3. Ejecutar:
   ```powershell
   ngrok config add-authtoken TU_TOKEN_AQUI
   ```

### 3. Iniciar servidor local
**Con Live Server de VS Code:**
- Click derecho en `index.html` → "Open with Live Server"
- Se abre en `http://127.0.0.1:5500`

**O con Python:**
```powershell
cd "f:\codigos visual studio\sabrofood-main\sabrofood-main"
python -m http.server 8000
```

**O con Node.js:**
```powershell
npx serve -p 5500
```

### 4. Crear túnel público
```powershell
ngrok http 5500
```

Verás algo así:
```
Forwarding  https://abc123-45-67.ngrok-free.app -> http://localhost:5500
```

### 5. Probar en iPhone
1. Copiar la URL `https://...ngrok-free.app`
2. Abrir Safari en iPhone
3. Pegar URL y navegar
4. Probar todo el flujo de login
5. Instalar como PWA: Compartir → Agregar a Inicio
6. Abrir desde el ícono y probar

---

## Método 2: Localhost con misma red WiFi

### 1. Obtener IP local de tu PC
```powershell
ipconfig
# Buscar "Dirección IPv4" de tu adaptador WiFi
# Ejemplo: 192.168.1.100
```

### 2. Iniciar Live Server
- Click derecho en `index.html` → "Open with Live Server"

### 3. Abrir en iPhone (conectado a MISMA WiFi)
```
http://192.168.1.100:5500/sabrofood-main/sabrofood-main/
```

**Nota**: Puede que Supabase bloquee la conexión por CORS si no está en la lista de dominios permitidos.

---

## Método 3: Desplegar temporalmente en GitHub Pages

### 1. Asegurar que el repo está actualizado
```powershell
cd "f:\codigos visual studio\sabrofood-main\sabrofood-main"
git add .
git commit -m "test: Probar en iOS"
git push origin main
```

### 2. Activar GitHub Pages
1. Ir a: https://github.com/nutria005/sabrofood
2. Settings → Pages
3. Source: Deploy from branch
4. Branch: `main` / folder: `/ (root)`
5. Save

### 3. Esperar 1-2 minutos y abrir en iPhone
```
https://nutria005.github.io/sabrofood/
```

**Ventaja**: URL pública permanente, HTTPS, no necesita ngrok

---

## 🔍 Depuración Remota (Ver logs en tiempo real)

### Con Safari Web Inspector (necesitas Mac)
1. iPhone: Configuración → Safari → Avanzado → Web Inspector (ON)
2. Conectar iPhone a Mac por cable
3. Mac: Safari → Menú Desarrollo → [Tu iPhone] → Sabrofood
4. Ver consola en vivo

### Con eruda (console en pantalla - TEMPORAL)

Agregar temporalmente al HTML (antes de `</body>`):

```html
<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
<script>eruda.init();</script>
```

Aparecerá un botón flotante en el iPhone con console, network, elements, etc.

---

## 📊 Checklist de Testing en iPhone

### En Safari (antes de instalar PWA):
- [ ] Login funciona
- [ ] Seleccionar usuario no hace bucle
- [ ] Carrito funciona
- [ ] Ventas se registran
- [ ] Ajuste de caja funciona
- [ ] Console sin errores rojos

### Como PWA instalada:
- [ ] Ícono aparece correctamente
- [ ] Abre en modo standalone (fullscreen)
- [ ] No hay barra de Safari
- [ ] Login funciona
- [ ] No hay bucle al seleccionar usuario
- [ ] localStorage funciona (sesión persiste)
- [ ] Funciona offline (después de visitar una vez)

### Safe Area (dispositivos con notch):
- [ ] No hay contenido bajo el notch
- [ ] Botones accesibles en parte inferior
- [ ] Sidebar no se corta
- [ ] Modales centrados correctamente

---

## 🆘 Si Detectas Problemas

### Ver logs en pantalla (sin Mac)

Agregar antes de `</body>`:

```html
<!-- DEBUG: Ver logs en pantalla (ELIMINAR EN PRODUCCIÓN) -->
<div id="debugLogs" style="position: fixed; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.9); color: lime; font-size: 10px; padding: 10px; max-height: 200px; overflow-y: auto; z-index: 999999; font-family: monospace;"></div>
<script>
const debugDiv = document.getElementById('debugLogs');
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
    originalLog.apply(console, args);
    debugDiv.innerHTML += `<div style="color: lime;">[LOG] ${args.join(' ')}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
};

console.error = function(...args) {
    originalError.apply(console, args);
    debugDiv.innerHTML += `<div style="color: red;">[ERROR] ${args.join(' ')}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
};

console.warn = function(...args) {
    originalWarn.apply(console, args);
    debugDiv.innerHTML += `<div style="color: yellow;">[WARN] ${args.join(' ')}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
};

// Capturar errores no manejados
window.addEventListener('error', (e) => {
    debugDiv.innerHTML += `<div style="color: red; font-weight: bold;">[UNCAUGHT ERROR] ${e.message} at ${e.filename}:${e.lineno}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
});
</script>
```

---

## 🎯 Mi Recomendación

**Para testing rápido:**
1. Usar **ngrok** (5 minutos de setup, funciona perfecto)
2. O desplegar en **GitHub Pages** (más simple, URL permanente)

**Para depuración profunda:**
1. Agregar **eruda** o el div de debug logs
2. Tomar screenshots de los errores
3. Enviarme los logs para analizar

¿Quieres que te ayude a configurar ngrok ahora mismo?
