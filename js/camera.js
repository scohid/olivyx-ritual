// Acceso a la cámara frontal. El flujo de vídeo nunca sale del dispositivo:
// se pinta en un <video> local y se entrega a MediaPipe en el propio navegador.

export async function startCamera(video) {
  const preferred = {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  };

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: preferred, audio: false });
  } catch (err) {
    if (err && (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')) {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    } else {
      throw err;
    }
  }

  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.srcObject = stream;

  if (video.readyState < 1) {
    await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
  }
  await video.play();
  return stream;
}

export function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function isInAppBrowser() {
  return /Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly/i.test(navigator.userAgent);
}

/** Comprueba requisitos antes de pedir la cámara. Devuelve un error o null. */
export function checkSupport() {
  if (!window.isSecureContext) {
    return {
      title: 'Conexión no segura',
      message: 'La cámara solo puede utilizarse desde una dirección https://. Abre la experiencia desde el enlace oficial.',
      retry: false,
    };
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      title: 'Navegador no compatible',
      message: isInAppBrowser()
        ? 'Este navegador integrado no permite usar la cámara. Abre el enlace en Safari o Chrome desde el menú «⋯».'
        : 'Tu navegador no permite acceder a la cámara. Prueba con una versión reciente de Safari o Chrome.',
      retry: false,
    };
  }
  if (typeof WebAssembly !== 'object') {
    return {
      title: 'Dispositivo no compatible',
      message: 'Este dispositivo no admite el seguimiento facial en el navegador. Prueba con un móvil más reciente.',
      retry: false,
    };
  }
  return null;
}

export function describeCameraError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return {
      title: 'Necesitamos ver tu rostro',
      message: isIOS()
        ? 'Has bloqueado el acceso a la cámara. En Safari, toca «aA» en la barra de direcciones › Ajustes del sitio web › Cámara › Permitir, y vuelve a intentarlo.'
        : 'Has bloqueado el acceso a la cámara. Toca el icono junto a la dirección web › Permisos › Cámara › Permitir, y vuelve a intentarlo.',
      retry: true,
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return {
      title: 'No encontramos una cámara frontal',
      message: 'Esta experiencia necesita la cámara frontal de tu móvil o tableta.',
      retry: false,
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return {
      title: 'La cámara está ocupada',
      message: 'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentarlo.',
      retry: true,
    };
  }
  return {
    title: 'No hemos podido abrir la cámara',
    message: 'Algo ha fallado al iniciar la cámara. Recarga la página y vuelve a intentarlo.',
    retry: true,
  };
}
