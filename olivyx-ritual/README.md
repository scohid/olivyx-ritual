# OLIVYX · Ritual Gua Sha

Experiencia web para móvil que guía un ritual de Gua Sha con flechas animadas sobre el propio
rostro, en tiempo real, con la cámara frontal. Se abre desde un código QR en Safari (iOS) o
Chrome (Android), sin instalar nada.

- **Seguimiento facial:** MediaPipe Face Landmarker de Google (478 puntos), procesado en el navegador.
- **Privacidad:** la imagen de la cámara no sale del dispositivo. No se graba, no se guarda y no se
  envía a ningún servidor.
- **Sin compilación:** HTML, CSS y JavaScript. Se publica tal cual en GitHub Pages.

## Ritual: 8 pasos de 15 segundos (2 minutos)

| Paso | Movimiento | Piedra: parte y sentido |
|---|---|---|
| 1. Prepara la piel | Puntos de aplicación del escualano | — |
| 2. Cuello | Base del cuello → mandíbula | Borde largo · de abajo arriba |
| 3. Contorno de la mandíbula | Barbilla → oreja | Hendidura en V · de la barbilla a la oreja |
| 4. Zona de la sonrisa | Comisura y aleta de la nariz → oreja | Borde largo · hacia la oreja |
| 5. Contorno de ojos | Lagrimal → sien, bajo el ojo | Curva pequeña · del lagrimal a la sien |
| 6. Cejas | Inicio de la ceja → sien | Hendidura en V · hacia la sien |
| 7. Frente | Cejas → nacimiento del pelo | Borde largo · hacia arriba |
| 8. Finaliza el ritual | Contorno facial y claim | — |

- Contador de 15 s arriba a la derecha (al tocarlo se pausa); al llegar a cero pasa solo al siguiente paso.
- Navegación libre: botones anterior / siguiente, repetir paso, pausa, deslizar el panel o tocar
  los segmentos superiores.
- Sobre la cara, una piedra translúcida recorre la flecha con la parte de trabajo por delante. En el
  panel, un icono muestra esa parte resaltada y el sentido del movimiento.
- El logotipo de OLIVYX aparece en todas las pantallas y siempre encima de la explicación.

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
