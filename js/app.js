import { startCamera, stopCamera, checkSupport, describeCameraError, isInAppBrowser } from './camera.js';
import { createTracker } from './tracker.js';
import { FaceState, makeMapper } from './faceState.js';
import { Renderer } from './renderer.js';
import { RITUAL, STEP_SECONDS, EDGES, FACE_OVAL, requiredIndices, resolveStroke } from './ritual.js';
import { stoneIcon } from './stone.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const el = {
  video: $('#video'),
  canvas: $('#overlay'),
  start: $('#btn-start'),
  retry: $('#btn-retry'),
  errorBack: $('#btn-error-back'),
  close: $('#btn-close'),
  prev: $('#btn-prev'),
  next: $('#btn-next'),
  play: $('#btn-play'),
  repeat: $('#btn-repeat'),
  restart: $('#btn-restart'),
  finish: $('#btn-finish'),
  loadingText: $('#loading-text'),
  errorTitle: $('#error-title'),
  errorText: $('#error-text'),
  stepCount: $('#step-count'),
  stepTitle: $('#step-title'),
  stepText: $('#step-text'),
  tool: $('#tool'),
  toolIcon: $('#tool-icon'),
  toolEdge: $('#tool-edge'),
  toolDir: $('#tool-dir'),
  note: $('#step-note'),
  segments: $('#segments'),
  timer: $('#timer'),
  timerNum: $('#timer-num'),
  timerRing: $('#timer-ring'),
  faceHint: $('#face-hint'),
  pausedTag: $('#paused-tag'),
  endActions: $('#end-actions'),
  controls: $('#controls'),
  sheetBody: $('#sheet-body'),
  debug: $('#debug'),
  inapp: $('#inapp-note'),
};

const RING = 2 * Math.PI * 20; // circunferencia del anillo del contador (r = 20)

const state = {
  stream: null,
  tracker: null,
  running: false,
  step: 0,
  elapsed: 0,
  anim: 0,
  playing: true,
  completed: false,
  lastT: 0,
  lastVideoTime: -1,
  faceAlpha: 0,
  detectCost: 0,
  frameN: 0,
  wakeLock: null,
  shownSecond: -1,
};

const indices = DEBUG ? Array.from({ length: 478 }, (_, i) => i) : requiredIndices();
const face = new FaceState(indices);
const renderer = new Renderer(el.canvas);
const LABELS = requiredIndices();

// ── Pantallas ──────────────────────────────────────────────────────────────
function show(screen) {
  document.body.dataset.screen = screen;
}

function showError({ title, message, retry }) {
  el.errorTitle.textContent = title;
  el.errorText.textContent = message;
  el.retry.hidden = !retry;
  show('error');
}

// ── Inicio ─────────────────────────────────────────────────────────────────
async function begin() {
  const unsupported = checkSupport();
  if (unsupported) return showError(unsupported);

  show('loading');
  el.loadingText.textContent = 'Solicitando acceso a la cámara…';

  // La carga del modelo empieza en paralelo al permiso de cámara.
  const trackerPromise = createTracker();
  trackerPromise.catch(() => {});

  try {
    state.stream = await startCamera(el.video);
  } catch (err) {
    console.error(err);
    return showError(describeCameraError(err));
  }

  el.loadingText.textContent = 'Preparando el seguimiento facial…';
  try {
    state.tracker = await trackerPromise;
  } catch (err) {
    console.error(err);
    stopCamera(state.stream);
    state.stream = null;
    return showError({
      title: 'No hemos podido cargar el seguimiento facial',
      message: navigator.onLine
        ? 'Tu dispositivo no ha podido iniciar el detector facial. Actualiza tu navegador o prueba con otro móvil.'
        : 'Parece que no hay conexión a internet. Conéctate y vuelve a intentarlo.',
      retry: true,
    });
  }

  show('stage');
  renderer.resize();
  face.reset();
  goToStep(0);
  togglePlay(true);
  requestWakeLock();
  state.running = true;
  state.lastT = 0;
  requestAnimationFrame(frame);
}

function exit() {
  state.running = false;
  stopCamera(state.stream);
  state.stream = null;
  el.video.srcObject = null;
  releaseWakeLock();
  renderer.clear();
  show('intro');
}

// ── Ritual ─────────────────────────────────────────────────────────────────
function buildSegments() {
  el.segments.innerHTML = '';
  RITUAL.forEach((step, i) => {
    const b = document.createElement('button');
    b.className = 'segment';
    b.type = 'button';
    b.setAttribute('aria-label', `Ir al paso ${i + 1}: ${step.title}`);
    b.innerHTML = '<span class="segment-fill"></span>';
    b.addEventListener('click', () => { goToStep(i); togglePlay(true); });
    el.segments.appendChild(b);
  });
}

function goToStep(i) {
  state.step = Math.max(0, Math.min(RITUAL.length - 1, i));
  state.elapsed = 0;
  state.anim = 0;
  state.completed = false;
  state.shownSecond = -1;
  const step = RITUAL[state.step];

  el.stepCount.textContent = `${String(state.step + 1).padStart(2, '0')} / ${String(RITUAL.length).padStart(2, '0')}`;
  el.stepTitle.textContent = step.title;
  el.stepText.textContent = step.text;

  if (step.tool) {
    el.tool.hidden = false;
    el.note.hidden = true;
    el.toolIcon.innerHTML = stoneIcon(step.tool.edge, step.tool.travel);
    el.toolEdge.textContent = EDGES[step.tool.edge].label;
    el.toolDir.textContent = step.tool.dir;
  } else {
    el.tool.hidden = true;
    el.note.hidden = false;
    el.note.textContent = step.note;
  }

  // Animación suave de entrada del contenido del paso
  el.sheetBody.classList.remove('in');
  void el.sheetBody.offsetWidth;
  el.sheetBody.classList.add('in');

  el.endActions.hidden = true;
  el.controls.hidden = false;
  el.prev.disabled = state.step === 0;
  el.timer.classList.remove('done');
  updateTimer();
  updateSegments();
}

function updateSegments() {
  [...el.segments.children].forEach((seg, i) => {
    const f = i < state.step ? 1 : i > state.step ? 0 : Math.min(1, state.elapsed / STEP_SECONDS);
    seg.firstChild.style.transform = `scaleX(${f})`;
    seg.classList.toggle('current', i === state.step);
  });
}

function updateTimer() {
  const remaining = Math.max(0, STEP_SECONDS - state.elapsed);
  const sec = Math.ceil(remaining);
  if (sec !== state.shownSecond) {
    state.shownSecond = sec;
    el.timerNum.textContent = sec;
    el.timer.setAttribute('aria-label', `Quedan ${sec} segundos`);
  }
  el.timerRing.style.strokeDashoffset = String(RING * (1 - remaining / STEP_SECONDS));
}

function complete() {
  state.completed = true;
  el.endActions.hidden = false;
  el.controls.hidden = true;
  el.timer.classList.add('done');
}

function togglePlay(force) {
  state.playing = typeof force === 'boolean' ? force : !state.playing;
  el.play.dataset.state = state.playing ? 'playing' : 'paused';
  el.play.setAttribute('aria-label', state.playing ? 'Pausar' : 'Continuar');
  el.pausedTag.hidden = state.playing;
  el.timer.classList.toggle('paused', !state.playing);
}

// ── Bucle principal ────────────────────────────────────────────────────────
function frame(now) {
  if (!state.running) return;
  requestAnimationFrame(frame);

  const t = now / 1000;
  const dt = state.lastT ? Math.min(0.1, t - state.lastT) : 0;
  state.lastT = t;

  // 1. Detección (solo cuando hay un fotograma nuevo)
  const v = el.video;
  if (v.readyState >= 2 && v.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = v.currentTime;
    state.frameN++;
    // Si el dispositivo va justo, detectamos en fotogramas alternos;
    // el filtro mantiene las flechas fluidas entre detecciones.
    if (state.detectCost < 28 || state.frameN % 2 === 0) {
      const t0 = performance.now();
      const lm = state.tracker.detect(v, now);
      state.detectCost = state.detectCost * 0.9 + (performance.now() - t0) * 0.1;
      face.update(lm, t, makeMapper(v, renderer.w, renderer.h));
    }
  }
  face.tick(t);

  // 2. Contador de 15 s por paso; al terminar pasa solo al siguiente.
  if (state.playing && !state.completed) {
    state.elapsed += dt;
    if (state.elapsed >= STEP_SECONDS) {
      if (state.step < RITUAL.length - 1) goToStep(state.step + 1);
      else { state.elapsed = STEP_SECONDS; complete(); }
    }
  }
  if (state.playing || state.completed) state.anim += dt;
  updateTimer();
  updateSegments();

  // 3. Presencia del rostro
  state.faceAlpha += ((face.present ? 1 : 0) - state.faceAlpha) * Math.min(1, dt * 6);
  el.faceHint.hidden = face.present || t - face.lastSeen < 0.8;

  // 4. Dibujo
  renderer.clear();
  if (state.faceAlpha > 0.01 && face.get(1)) draw();
  if (DEBUG) {
    renderer.debug(face, LABELS);
    el.debug.textContent = `detect ${state.detectCost.toFixed(1)} ms · ${state.tracker.delegate} · ${state.tracker.source} · ${v.videoWidth}×${v.videoHeight}`;
  }
}

function draw() {
  const n = face.get(1);
  const a = face.get(234);
  const b = face.get(454);
  if (!a || !b) return;
  const da = Math.hypot(n.x - a.x, n.y - a.y);
  const db = Math.hypot(n.x - b.x, n.y - b.y);
  const faceW = Math.hypot(a.x - b.x, a.y - b.y);
  const ratio = da / (da + db || 1);
  // Si la persona gira la cabeza, el lado que se aleja se desvanece.
  const vis = {
    a: smooth(0.16, 0.3, ratio),
    b: smooth(0.16, 0.3, 1 - ratio),
    c: 1,
  };

  const lw = clamp(faceW * 0.0066, 1.1, 2.6);
  const head = clamp(faceW * 0.03, 6, 14);
  const step = RITUAL[state.step];
  const alpha = state.faceAlpha * smooth(0, 0.7, state.anim);

  if (step.overlay === 'drops') {
    const pts = [face.get(151), face.get(50), face.get(280), mid(face.get(17), face.get(152), 0.55)].filter(Boolean);
    renderer.drops(pts, state.anim, { alpha, r: clamp(faceW * 0.022, 4, 10) });
    return;
  }

  if (step.overlay === 'oval') {
    const c = face.get(1);
    const pts = FACE_OVAL.map((i) => face.get(i)).filter(Boolean).map((p) => ({
      x: p.x + (c.x - p.x) * 0.06,
      y: p.y + (c.y - p.y) * 0.06,
    }));
    if (pts.length === FACE_OVAL.length) {
      renderer.stroke(pts, { phase: (state.anim / 6) % 1, alpha: alpha * 0.8, lw, head, closed: true });
    }
    return;
  }

  const phase = (state.anim / (step.period || 2.2)) % 1;
  const stones = [];
  for (const s of step.strokes) {
    const pts = resolveStroke(s, face);
    if (!pts) continue;
    const sAlpha = alpha * vis[s.side];
    const tip = renderer.stroke(pts, { phase, alpha: sAlpha, lw, head });
    if (s.stone && step.tool) stones.push([tip, sAlpha]);
  }
  // La piedra se dibuja encima de todas las flechas.
  const width = clamp(faceW * 0.15, 26, 70);
  for (const [tip, sAlpha] of stones) renderer.stone(tip, step.tool.edge, { width, alpha: sAlpha });
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const mid = (p, q, t) => (p && q ? { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t } : null);

// ── Pantalla encendida durante el ritual ───────────────────────────────────
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) state.wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* opcional */ }
}
function releaseWakeLock() {
  try { state.wakeLock && state.wakeLock.release(); } catch { /* */ }
  state.wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.running) {
    requestWakeLock();
    state.lastT = 0;
  }
});

// ── Eventos ────────────────────────────────────────────────────────────────
el.start.addEventListener('click', begin);
el.retry.addEventListener('click', begin);
el.errorBack.addEventListener('click', () => show('intro'));
el.close.addEventListener('click', exit);
el.finish.addEventListener('click', exit);
el.restart.addEventListener('click', () => { goToStep(0); togglePlay(true); });
el.prev.addEventListener('click', () => { goToStep(state.step - 1); togglePlay(true); });
el.next.addEventListener('click', () => {
  if (state.step < RITUAL.length - 1) { goToStep(state.step + 1); togglePlay(true); }
  else { state.elapsed = STEP_SECONDS; complete(); }
});
el.repeat.addEventListener('click', () => { goToStep(state.step); togglePlay(true); });
el.play.addEventListener('click', () => togglePlay());
el.timer.addEventListener('click', () => togglePlay());

// Deslizar el panel hacia los lados también cambia de paso.
let touchX = null;
$('.sheet').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
$('.sheet').addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) < 60 || state.completed) return;
  (dx < 0 ? el.next : el.prev).click();
});

window.addEventListener('keydown', (e) => {
  if (document.body.dataset.screen !== 'stage') return;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  if (e.key === 'ArrowRight') el.next.click();
  if (e.key === 'ArrowLeft') el.prev.click();
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { renderer.resize(); face.reset(); }, 120);
});

buildSegments();
if (isInAppBrowser()) el.inapp.hidden = false;
if (DEBUG) el.debug.hidden = false;
show('intro');
