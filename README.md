# OLIVYX · Ritual facial — Taller de automasaje con Gua Sha

Experiencia web para móvil que guía un ritual de Gua Sha con flechas animadas sobre el propio
rostro, en tiempo real, con la cámara frontal. Se abre desde un código QR en Safari (iOS) o
Chrome (Android), sin instalar nada.

- **Seguimiento facial:** MediaPipe Face Landmarker de Google (478 puntos), procesado en el navegador.
- **Privacidad:** la imagen de la cámara no sale del dispositivo. No se graba, no se guarda y no se
  envía a ningún servidor.
- **Sin compilación:** HTML, CSS y JavaScript. Se publica tal cual en GitHub Pages.

## Ritual: 4 bloques

| Bloque | Pasos | Duración |
|---|---|---|
| 1 · Calentamiento | Flexión, extensión, inclinación lateral, rotación, trapecio | 2 min |
| 2 · Respiración | Inspirar 4 s · espirar 6 s, con círculo sobre el rostro | 1 min |
| 3 · Piedra Gua Sha | Prepara la piel + cuello, mandíbula, sonrisa, ojos, cejas, frente (30 s por lado) | 6 min |
| 4 · Estimulación de puntos faciales | Puntos por parejas (cejas, sienes, delante de las orejas, mandíbula, cuello; 12 s cada pareja), finaliza, limpia tu piedra (360°), comparte | 2 min |

**Recorrido**

1. Al entrar en cada bloque aparece su **portada** («Bloque 1 de 4 · Calentamiento»), con lo que
   incluye y su duración → **Continuar**.
2. Cada paso abre su **ficha centrada** («Paso 1 de 5 · Calentamiento») para leer con calma. El
   contador no corre. Solo hay un botón: **Comenzar**.
3. Al pulsarlo, la ficha se pliega hacia abajo en una **barra compacta** (logo, paso, zona y
   botones) y empieza el contador (arriba a la derecha). **Info** vuelve a abrir la ficha.
4. Al acabar el tiempo se abre la ficha del paso siguiente (o la portada del bloque siguiente).

**Compartir:** el botón de cámara compone una imagen vertical en el propio móvil: cámara en espejo,
líneas doradas que estilizan mandíbula, pómulos, patas de gallo y frente, marco fino, «Ritual
facial con» + logotipo OLIVYX y el claim. En iOS y Android abre el menú de compartir del sistema.

- Palabras clave en negrita: en `js/ritual.js`, el texto entre `**dobles asteriscos**`.
- Bloques y textos de portada: `BLOCKS`; pasos y duraciones: `STEPS`; respiración: `BREATH`;
  puntos: `POINT_GROUPS`; líneas de compartir: `SCULPT`; forma de la piedra: `js/stone.js`.

## Publicar en GitHub Pages

1. Crea un repositorio **público** en GitHub (por ejemplo `olivyx-ritual`).
2. Pulsa **uploading an existing file** y arrastra **todo el contenido** de esta carpeta, no la
   carpeta en sí: `index.html` tiene que quedar en la raíz del repositorio. Usa Chrome para arrastrar carpetas.
3. Pulsa **Commit changes**.
4. Ve a **Settings › Pages › Build and deployment** y elige **Deploy from a branch**, rama `main`,
   carpeta `/ (root)`. Guarda.
5. En uno o dos minutos la web estará en `https://TU-USUARIO.github.io/olivyx-ritual/`.

Para actualizarla, sube los archivos modificados al repositorio y GitHub Pages se actualiza sola.
Para usar un dominio propio (por ejemplo `ritual.olivyx.com`), configúralo en **Settings › Pages › Custom domain**.

## Calibrar las flechas

Abre la web añadiendo `?debug=1` al final de la dirección. Verás los puntos faciales numerados
y el rendimiento de la detección. Las posiciones de las flechas se ajustan en `js/ritual.js`.

## Estructura

```
index.html                Pantallas: inicio, carga, error y ritual
css/styles.css            Identidad visual y diseño mobile-first
assets/                   Logotipo oficial (oscuro y crema), Poppins, favicon
js/app.js                 Flujo, contador, controles y bucle de dibujo
js/ritual.js              Pasos del ritual y trazos anclados a puntos faciales
js/stone.js               Silueta de la piedra Gua Sha e icono de cada paso
js/renderer.js            Dibujo de flechas, luz, gotas y piedra
js/faceState.js           Coordenadas de pantalla (espejo) y suavizado
js/oneEuro.js             Filtro anti-temblor
js/camera.js              Cámara, compatibilidad y mensajes de error
js/tracker.js             Carga de MediaPipe (CDN o copia local)
scripts/vendor-mediapipe.sh   Opcional: aloja MediaPipe en el propio repositorio
```

## Compatibilidad

iOS 16.4+ (Safari, Chrome), Android con Chrome reciente y navegadores de escritorio con webcam.
Los navegadores integrados de Instagram o Facebook pueden bloquear la cámara: la web lo detecta y
sugiere abrir el enlace en Safari o Chrome.
