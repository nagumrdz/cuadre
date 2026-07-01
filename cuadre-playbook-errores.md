# Playbook: PWA con Vite + React + Vercel
## Guía de errores comunes, reglas estrictas y ciclo de deployment

---

## ANTES DE EMPEZAR — Checklist de entorno

Verifica esto una sola vez antes de crear cualquier proyecto nuevo:

```bash
node -v          # debe ser v18 o superior
npm -v           # debe ser v9 o superior
npx vercel -v    # si no está instalado: npm install -g vercel
```

---

## PARTE 1 — Errores comunes y cómo resolverlos

---

### ❌ Error: "npm run build" falla pero el build local sí funciona

**Síntoma en Vercel:**
```
Error: Command "npm run build" exited with 1
```
**Causa más común:**
El proyecto está dentro de otro proyecto (ej. `furia-hub/cuadre`). Localmente usa los `node_modules` del padre. En Vercel no.

**Regla estricta:**
> Cada proyecto PWA debe vivir en su propia carpeta raíz, al mismo nivel que otros proyectos — nunca dentro de otro proyecto.

**Estructura correcta:**
```
Proyectos Financieros/
├── furia-hub/        ← proyecto 1
├── cuadre/           ← proyecto 2 (NO dentro de furia-hub)
└── otro-proyecto/    ← proyecto 3
```

**Si ya está dentro de otro proyecto, muévelo:**
```bash
# Desde la carpeta padre de todos los proyectos:
xcopy /E /I "furia-hub\cuadre" "cuadre"   # Windows
cp -r furia-hub/cuadre ../cuadre           # Mac/Linux
cd cuadre
npm install
npm run build
```

---

### ❌ Error: "Could not resolve './NombreArchivo'"

**Síntoma:**
```
Could not resolve "./Cuadre" from "src/App.jsx"
```
**Causa:**
El archivo referenciado no existe en `src/` o tiene un nombre diferente.

**Checklist:**
1. ¿El archivo existe en `src/`? Verifica en el explorador de VS Code.
2. ¿El nombre coincide exactamente, incluyendo mayúsculas? (`Cuadre.jsx` ≠ `cuadre.jsx`)
3. ¿El import usa la ruta correcta? (`./Cuadre`, no `./pages/Cuadre`)

**Regla estricta:**
> Verifica que `src/` contiene todos los archivos antes de correr `npm run build`.
> Archivos mínimos requeridos:
```
src/
├── lib/
│   └── remoteStorageAdapter.js
├── TuComponente.jsx     ← el componente principal
├── App.jsx
├── main.jsx
└── index.css
```

---

### ❌ Error: "Identifier X has already been declared"

**Síntoma:**
```
[PARSE_ERROR] Identifier `csvPedidos` has already been declared
```
**Causa:**
Al copiar/pegar código o hacer str_replace, una función quedó declarada dos veces en el mismo archivo.

**Cómo encontrarla rápido:**
```bash
# En la terminal, dentro de la carpeta del proyecto:
grep -n "const csvPedidos\|const csvInventario" src/TuComponente.jsx
# Si aparece el mismo nombre en dos líneas distintas, ahí está el problema.
```

**Solución:**
1. Abre el archivo en VS Code
2. Ctrl+F → busca el nombre duplicado
3. Elimina la versión más antigua (la que aparece primero)
4. Vuelve a buildear

---

### ❌ Error: Variables de entorno no funcionan en Vercel

**Síntoma:**
Build exitoso pero la app no guarda datos o muestra error de conexión.

**Causa:**
Las variables de entorno se agregaron en Vercel pero no se hizo un nuevo build después.

**Regla estricta:**
> En Vite, las variables de entorno (`VITE_*`) se "hornean" dentro del bundle en el momento del build. Cambiarlas en Vercel no tiene efecto hasta el siguiente `npx vercel --prod`.

**Secuencia correcta:**
1. Agrega o modifica variables en Vercel → Settings → Environment Variables
2. Guarda
3. Corre `npx vercel --prod` desde la terminal
4. Espera a que termine
5. Verifica en la app

**Verificar que están correctas localmente:**
```bash
# Crea o revisa el archivo .env en la raíz del proyecto:
cat .env

# Debe tener:
VITE_UPSTASH_URL=https://tu-url.upstash.io
VITE_UPSTASH_TOKEN=tu-token-aqui
```

---

### ❌ Error: Estás en la carpeta equivocada

**Síntoma:**
```
PS C:\...\furia-hub\furia-hub> npm run build
```
El path en la terminal no termina en el nombre de tu proyecto.

**Regla estricta:**
> Antes de correr cualquier comando, verifica que el path del terminal termine en el nombre de tu proyecto.

**Cómo verificarlo y corregirlo:**
```bash
# Ver en qué carpeta estás:
pwd                          # Mac/Linux
cd                           # Windows PowerShell

# Ir a la carpeta correcta:
cd "C:\Users\TuUsuario\Desktop\Proyectos Financieros\cuadre"

# Verificar que es la correcta (debe mostrar package.json):
ls package.json              # Mac/Linux
dir package.json             # Windows
```

**Truco de VS Code:**
Abre la carpeta del proyecto directamente: `File → Open Folder` → selecciona `cuadre/`. Así la terminal integrada siempre abre en la carpeta correcta.

---

### ❌ Error: La sesión no se cierra / incógnito entra solo

**Síntoma:**
Al cerrar sesión o abrir en modo incógnito, la app entra sola sin pedir PIN.

**Causa:**
La sesión está guardada en Redis (compartido entre todos los navegadores) en lugar de `localStorage` (por dispositivo).

**Regla estricta:**
> La sesión activa (quién está logueado) SIEMPRE debe guardarse en `localStorage`, nunca en Redis/almacenamiento remoto.
> Redis es para datos de negocio. `localStorage` es para estado de sesión del dispositivo.

**Código correcto:**
```js
// ✅ Correcto — sesión en localStorage
const SESION_LOCAL = "cuadre_session";
localStorage.setItem(SESION_LOCAL, usuario.id);    // login
localStorage.removeItem(SESION_LOCAL);             // logout
const userId = localStorage.getItem(SESION_LOCAL); // verificar

// ❌ Incorrecto — sesión en Redis
await window.storage.set("cuadre:sesion", usuario.id);
```

---

## PARTE 2 — Reglas estrictas para que la PWA sea instalable

Una PWA solo puede instalarse si cumple **todos** estos requisitos. Si falta uno, el navegador no muestra el botón de instalación.

---

### Regla 1: HTTPS obligatorio

El sitio debe servirse desde HTTPS. Vercel lo da automáticamente. En local (`localhost`) también funciona.

> ❌ HTTP → no instalable
> ✅ HTTPS o localhost → instalable

---

### Regla 2: Web App Manifest válido

El archivo `manifest.webmanifest` (generado por `vite-plugin-pwa`) debe tener al menos:

```json
{
  "name": "Cuadre MX",
  "short_name": "Cuadre",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F5F0EB",
  "theme_color": "#E05C35",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Reglas del manifest:**
- `display: "standalone"` → se abre sin barra del navegador (como app nativa)
- `start_url: "/"` → siempre debe estar
- Necesitas **mínimo** un ícono de 192×192 y uno de 512×512
- Los íconos deben ser PNG, no SVG (aunque los SVG sirven para generar los PNG)
- Los PNG deben existir físicamente en `public/`

---

### Regla 3: Service Worker registrado

`vite-plugin-pwa` lo genera automáticamente. Verifica que está funcionando:

1. Abre Chrome en la URL de producción
2. F12 → Application → Service Workers
3. Debe aparecer el service worker con estado **"activated and running"**

Si no aparece:
- Verifica que `vite.config.js` tiene `VitePWA({ registerType: 'autoUpdate' })`
- Haz un nuevo deploy y espera 1 minuto antes de verificar

---

### Regla 4: Los íconos deben ser PNG opacos (sin transparencia)

**Regla estricta:**
> Los íconos de PWA deben tener fondo sólido. Los íconos transparentes se ven mal en Android (fondo negro) y no pasan la validación de Chrome.

- ✅ Usa `icon-cuadre.svg` (fondo terracota sólido) para generar los PNG
- ❌ No uses `icon-cuadre-light.svg` (fondo blanco/transparente) para el manifest

Para convertir SVG a PNG con fondo sólido:
```bash
npm install sharp --save-dev
node -e "
const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync('./public/icon-cuadre.svg');
sharp(svg).resize(192,192).png().toFile('./public/icon-192.png', ()=>console.log('192 listo'));
sharp(svg).resize(512,512).png().toFile('./public/icon-512.png', ()=>console.log('512 listo'));
"
```

---

### Regla 5: El `index.html` debe tener las meta tags de PWA

```html
<meta name="theme-color" content="#E05C35" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Cuadre MX" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

> Las meta tags de `apple-mobile-web-app-*` son para iOS/Safari, que no lee el manifest automáticamente.

---

### Regla 6: Cómo instalar en cada plataforma

**Android (Chrome) — instalación automática:**
1. Abre la URL en Chrome
2. Usa la app al menos 30 segundos
3. Chrome muestra un banner "Agregar a pantalla de inicio" automáticamente
4. Si no aparece: menú ⋮ → "Instalar app" o "Agregar a pantalla de inicio"

**iOS (Safari) — solo Safari, no Chrome:**
1. Abre la URL en **Safari** (Chrome en iOS no puede instalar PWA)
2. Toca el botón de compartir (cuadrado con flecha hacia arriba)
3. "Agregar a pantalla de inicio"
4. Confirma el nombre → aparece el ícono

**Escritorio (Chrome/Edge):**
1. Abre la URL
2. En la barra de direcciones aparece un ícono de instalación (monitor con flecha)
3. Click → "Instalar"

---

### Regla 7: Cómo verificar que todo está bien

Usa Chrome DevTools → F12 → pestaña **Lighthouse**:
1. Selecciona "Progressive Web App" en las categorías
2. Click "Analyze page load"
3. Debe dar score > 90 en PWA

O manualmente en **Application** tab:
- ✅ Manifest → sin errores
- ✅ Service Workers → activated and running
- ✅ Storage → datos guardados

---

## PARTE 3 — Ciclo de desarrollo y deployment

---

### El ciclo completo cada vez que cambias código

```bash
# 1. Haz tus cambios en el código

# 2. Verifica localmente
npm run dev
# Abre http://localhost:5173 y prueba

# 3. Build de producción (detecta errores antes de subir)
npm run build

# 4. Preview del build (opcional pero recomendado)
npm run preview
# Abre http://localhost:4173

# 5. Deploy a producción
npx vercel --prod

# 6. Espera ~30 segundos y abre la URL de producción
```

---

### ¿Cuándo se actualiza la app en el celular?

La PWA instalada **no se actualiza sola en tiempo real**. El ciclo es:

1. Corres `npx vercel --prod` → nuevo código en el servidor
2. El usuario abre la app **con internet** → el Service Worker detecta el cambio
3. **Descarga la actualización en segundo plano**
4. La actualización se aplica la **próxima vez que el usuario cierra y vuelve a abrir la app**

> Con `registerType: 'autoUpdate'` en `vite.config.js`, el paso 3 y 4 son automáticos.
> Sin `autoUpdate`, el usuario tendría que "actualizar" manualmente.

**Para forzar la actualización en tu propio celular al hacer pruebas:**
- Chrome → Configuración → Aplicaciones → Cuadre → Borrar caché
- O: F12 → Application → Service Workers → "Update" → "Skip waiting"

---

### Tabla de comandos de referencia rápida

| Situación | Comando |
|---|---|
| Primer setup del proyecto | `npm install` |
| Desarrollo local | `npm run dev` |
| Verificar antes de subir | `npm run build` |
| Ver el build localmente | `npm run preview` |
| Deploy a producción | `npx vercel --prod` |
| Instalar dependencia nueva | `npm install nombre-paquete` |
| Instalar dep. de desarrollo | `npm install nombre-paquete --save-dev` |
| Ver en qué carpeta estás | `cd` (Windows) / `pwd` (Mac/Linux) |
| Ir a la carpeta del proyecto | `cd "ruta\completa\cuadre"` |

---

### Regla de oro antes de cada deploy

> Corre siempre `npm run build` localmente antes de `npx vercel --prod`.
> Si el build falla localmente, fallará en Vercel.
> Si el build pasa localmente, llegará a Vercel y fallará solo si faltan variables de entorno.

---

## PARTE 4 — Variables de entorno: referencia rápida

| Variable | Dónde se guarda | Cuándo se aplica |
|---|---|---|
| `.env` local | Solo tu computadora | `npm run dev` y `npm run build` local |
| Vercel Environment Variables | Servidor de Vercel | Solo en el siguiente `npx vercel --prod` |

**Las dos deben tener los mismos valores.**

**Si cambias las variables en Vercel, debes hacer un nuevo deploy.**
No basta con guardarlas — Vite las hornea en el build.

---

*Playbook generado para el proyecto Cuadre MX — Furia.Corp*
*Actualizar este documento cada vez que se descubra un error nuevo.*
