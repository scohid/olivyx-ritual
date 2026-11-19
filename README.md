# OLIVYX · Ritual facial — Taller de automasaje con Gua Sha

Experiencia web para móvil que guía un ritual de Gua Sha con flechas animadas sobre el propio
rostro, en tiempo real, con la cámara frontal. Se abre desde un código QR en Safari (iOS) o
Chrome (Android), sin instalar nada.

- **Seguimiento facial:** MediaPipe Face Landmarker de Google (478 puntos), procesado en el navegador.
- **Privacidad:** la imagen de la cámara no sale del dispositivo. No se graba, no se guarda y no se
  envía a ningún servidor.
- **Sin compilación:** HTML, CSS y JavaScript. Se publica tal cual en GitHub Pages.

## Ritual: 17 pasos (≈ 11 minutos de ejercicio)

| # | Sección | Paso | Duración |
|---|---|---|---|
| 1 | Calentamiento | Flexión de cuello | 20 s |
| 2 | Calentamiento | Extensión de cuello | 20 s |
| 3 | Calentamiento | Inclinación lateral (derecha / izquierda) | 2 × 15 s |
| 4 | Calentamiento | Rotación de cuello (derecha / izquierda) | 2 × 10 s |
| 5 | Calentamiento | Estiramiento del trapecio (derecha / izquierda) | 2 × 15 s |
| 6 | Respiración | Inspirar 4 s · espirar 6 s, con círculo sobre el rostro | 60 s |
| 7 | Ritual Gua Sha | Prepara la piel (escualano de oliva o Facial Oil) | 20 s |
| 8–13 | Ritual Gua Sha | Cuello, mandíbula, sonrisa, ojos, cejas, frente (30 s por lado) | 6 × 60 s |
| 14 | Cierre | Puntos gatillo (puntos rojos con onda) | 60 s |
| 15 | Cierre | Finaliza el ritual | 20 s |
| 16 | Cierre | Limpia tu piedra (piedra girando) | 30 s |
| 17 | Cierre | Comparte tu ritual (captura con líneas sensoriales, logo y firma) | libre |

**Cómo se recorre cada paso**

1. Se abre la **ficha centrada** con toda la información, sobre la imagen de la cámara. El contador
   no corre: la persona lee a su ritmo.
2. Al pulsar **Comenzar**, la ficha se pliega hacia abajo y queda una **barra compacta**: logo,
   «Paso X de 17 · Sección», nombre de la zona y botones. Empieza el contador (arriba a la derecha).
3. **Info** vuelve a abrir la ficha (pausa el contador); **Continuar** la vuelve a plegar.
4. Al acabar el tiempo se abre la ficha del paso siguiente.

**Compartir:** el botón de cámara compone una imagen vertical (cámara en espejo, líneas
sensoriales, logo y «Ritual facial con OLIVYX») en el propio móvil. En iOS y Android abre el menú
de compartir del sistema; en otros navegadores permite guardar la imagen.

- Palabras clave en negrita: en `js/ritual.js`, el texto entre `**dobles asteriscos**`.
- Duraciones, orden y textos se editan en `js/ritual.js`; el ritmo de respiración en `BREATH`;
  los puntos gatillo en `TRIGGER_POINTS`; la forma de la piedra en `js/stone.js`.

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
