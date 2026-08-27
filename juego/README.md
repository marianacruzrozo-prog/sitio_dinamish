# 🐙 Las Aventuras del Pulpo

Experiencia web con 3 minijuegos conectados por el mismo protagonista: un pulpo del mundo audiovisual. Funciona en computador, celular y tablet, 100% responsive, sin dependencias externas de build (HTML + CSS + JS puro).

## ▶️ Cómo abrir el proyecto

Los juegos cargan un `<canvas>` y usan `fetch`/rutas relativas, así que ábrelo con un servidor local (no directamente con doble clic, para evitar restricciones del navegador):

```bash
# Opción simple con Python
cd pulpo
python3 -m http.server 8080
# luego abre http://localhost:8080 en tu navegador
```

También puedes usar la extensión "Live Server" de VS Code o subir la carpeta completa a cualquier hosting estático (Netlify, Vercel, GitHub Pages, etc).

## 🐙 CÓMO REEMPLAZAR EL PULPO (muy importante)

1. Coloca tu propio archivo animado en: **`img/pulpo.gif`**
2. Recarga la página.
3. El sistema lo detecta automáticamente y lo usa como protagonista en el menú y en los tres juegos — no hay que tocar código.

Mientras `img/pulpo.gif` no exista, el proyecto usa un pulpo de reemplazo (dibujado en SVG, definido en `script.js` como `PULPO_FALLBACK`) para que puedas probar todo el sistema desde ya. Esto se resuelve en la función `resolvePulpoSrc()` de `script.js`.

Nota técnica: dentro de los juegos (canvas), un GIF animado se dibuja usando solo su primer cuadro (limitación estándar de `<canvas>` con GIF). En el menú y las pantallas de resultado, al ser una etiqueta `<img>` normal, la animación del GIF sí se reproduce completa.

## 🎨 Identidad visual

Definida como variables CSS en `style.css`:

```css
--naranja: #EF7A22;
--azul: #1E3C4D;
```

Todos los componentes (menús, HUD, botones, laberintos, obstáculos) usan estas variables — cambia el valor una vez y se actualiza en todo el proyecto.

## 🗂 Estructura de archivos

```
/
├── index.html          → estructura de todas las pantallas
├── style.css            → identidad visual + responsive + controles táctiles
├── script.js             → menú, transiciones, audio, progreso, almacenamiento local
├── juegos/
│   ├── juego1.js          → plataformas submarinas (EL MUNDO AUDIOVISUAL)
│   ├── juego2.js          → búsqueda (ENCUENTRA AL PULPO)
│   └── juego3.js          → laberinto arcade (PULPO-MAN)
├── img/
│   └── pulpo.gif          ← COLOCA AQUÍ TU GIF (ver instrucciones arriba)
├── audio/                → opcional, ver sección de audio
└── assets/                → opcional, para arte adicional
```

Los objetos decorativos (cámaras, claquetas, luces, peces, cables, etc.) se dibujan de forma procedural con emojis e íconos vectoriales directamente en el `<canvas>`, así que el proyecto funciona completo sin necesitar imágenes adicionales. Si quieres reemplazarlos por tus propias ilustraciones PNG, puedes hacerlo en las funciones `draw()` de cada archivo dentro de `juegos/`.

## 🔊 Audio

Los efectos de sonido actuales se generan de forma sintética con la Web Audio API (no requieren archivos), definidos en el objeto `SFX` dentro de `script.js` (función `playSfx`). Si prefieres usar archivos de audio reales:

1. Coloca tus `.mp3` en la carpeta `audio/` (por ejemplo `audio/menu.mp3`, `audio/juego1.mp3`).
2. Reemplaza las llamadas a `playSfx('nombre')` por tu propio reproductor de `<audio>`, o pide ayuda para integrarlos.

## 💾 Progreso y puntuación

Se guardan automáticamente en `localStorage` del navegador: mejor puntuación de cada juego y qué juegos están desbloqueados. Esto es local a cada navegador/dispositivo (no hay servidor).

## 🕹 Controles

| Dispositivo | Juego 1 (plataformas) | Juego 2 (búsqueda) | Juego 3 (laberinto) |
|---|---|---|---|
| PC | Flechas / WASD + salto (↑ / W / espacio) | Clic | Flechas / WASD |
| Celular / Tablet | Botones táctiles ◀ ▶ + salto | Toque directo | Cruceta táctil |

## ✏️ Ediciones rápidas más comunes

- **Cambiar textos del menú:** editar `index.html`, sección `#screen-menu`.
- **Dificultad del Juego 1:** editar `segments` y probabilidades en `buildLevel()` (juego1.js).
- **Niveles del Juego 2:** editar el arreglo `LEVELS` en juego2.js (tiempo, cantidad de señuelos, tamaño del pulpo).
- **Tamaño/enemigos del laberinto (Juego 3):** editar el arreglo `LEVELS` en juego3.js.
- **Colores:** editar las variables `--naranja` / `--azul` en `style.css`.
