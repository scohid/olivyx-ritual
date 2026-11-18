// MediaPipe Face Landmarker (Google). Todo el procesamiento ocurre en el
// navegador (WebAssembly + WebGL). No se envía ninguna imagen a servidores:
// solo se descargan la librería y el modelo, una vez, como cualquier recurso web.
//
// Si existe /vendor/mediapipe (ver scripts/vendor-mediapipe.sh) se usa la copia
// alojada en el propio dominio; si no, se cargan desde CDN.

const VERSION = '0.10.14';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const LOCAL_BASE = new URL('../vendor/mediapipe', import.meta.url).href;
const REMOTE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

async function exists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const type = r.headers.get('content-type') || '';
    return r.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

let trackerPromise = null;

/** Crea (una sola vez) el detector. Devuelve { detect(video, tsMs), delegate }. */
export function createTracker() {
  if (!trackerPromise) {
    trackerPromise = build().catch((e) => {
      trackerPromise = null; // permitir reintento
      throw e;
    });
  }
  return trackerPromise;
}

async function build() {
  const local = await exists(`${LOCAL_BASE}/vision_bundle.mjs`);
  const base = local ? LOCAL_BASE : CDN_BASE;
  const modelPath = local && (await exists(`${LOCAL_BASE}/face_landmarker.task`))
    ? `${LOCAL_BASE}/face_landmarker.task`
    : REMOTE_MODEL;

  const vision = await import(/* @vite-ignore */ `${base}/vision_bundle.mjs`);
  const { FaceLandmarker, FilesetResolver } = vision;
  const fileset = await FilesetResolver.forVisionTasks(`${base}/wasm`);

  const options = (delegate) => ({
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });

  let landmarker;
  let delegate = 'GPU';
  try {
    landmarker = await FaceLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (e) {
    console.warn('[OLIVYX] GPU no disponible, usando CPU', e);
    delegate = 'CPU';
    landmarker = await FaceLandmarker.createFromOptions(fileset, options('CPU'));
  }

  let lastTs = -1;
  return {
    delegate,
    source: local ? 'local' : 'cdn',
    /** @returns {Array<{x:number,y:number,z:number}>|null} 478 puntos normalizados */
    detect(video, nowMs) {
      const ts = Math.max(Math.round(nowMs), lastTs + 1); // timestamps estrictamente crecientes
      lastTs = ts;
      try {
        const res = landmarker.detectForVideo(video, ts);
        return res.faceLandmarks && res.faceLandmarks.length ? res.faceLandmarks[0] : null;
      } catch (e) {
        console.warn('[OLIVYX] detectForVideo', e);
        return null;
      }
    },
    close() { landmarker.close(); },
  };
}
