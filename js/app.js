import { startCamera, stopCamera, checkSupport, describeCameraError, isInAppBrowser } from './camera.js';
import { createTracker } from './tracker.js';
import { FaceState, makeMapper } from './faceState.js';
import { Renderer } from './renderer.js';
import {
  RITUAL, SECTIONS, TOTAL_SECONDS, BREATH, EDGES, FACE_OVAL,
  requiredIndices, resolveStroke, emphasize,
} from './ritual.js';
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
  eyebrow: $('#step-eyebrow'),
  sideTag: $('#side-tag'),
  stepTitle: $('#step-title'),
  stepText: $('#step-text'),
  tool: $('#tool'),
  toolIcon: $('#tool-icon'),
  toolEdge: $('#tool-edge'),
  toolDir: $('#tool-dir'),
  note: $('#step-note'),
  nextUp: $('#next-up'),
  remaining: $('#remaining'),
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
  introTime: $('#intro-time'),
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
  shownRemaining: '',
  moveIdx: -1,
};

const indices = DEBUG ? Array.from({ length: 478 }, (_, i) => i) : requiredIndices();
const face = new FaceState(indices);
const renderer = new Renderer(el.canvas);
const LABELS = requiredIndices();

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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
/** Barra superior: un segmento por paso, agrupados por sección. */
function buildSegments() {
  el.segments.innerHTML = '';
  SECTIONS.forEach((section) => {
    const group = document.createElement('div');
    group.className = 'seg-group';
    const steps = RITUAL.map((s, i) => [s, i]).filter(([s]) => s.section === section);
    group.style.flexGrow = String(steps.length);
    steps.forEach(([step, i]) => {
      const b = document.createElement('button');
      b.className = 'segment';
      b.type = 'button';
      b.dataset.index = String(i);
      b.setAttribute('aria-label', `Ir al paso ${i + 1}: ${step.title}`);
      b.innerHTML = '<span class="segment-fill"></span>';
      b.addEventListener('click', () => { goToStep(i); togglePlay(true); });
      group.appendChild(b);
    });
    el.segments.appendChild(group);
  });
  state.segmentEls = [...el.segments.querySelectorAll('.segment')];
}

function goToStep(i) {
  state.step = Math.max(0, Math.min(RITUAL.length - 1, i));
  state.elapsed = 0;
  state.anim = 0;
  state.completed = false;
  state.shownSecond = -1;
  state.moveIdx = -1;
  const step = RITUAL[state.step];

  el.eyebrow.textContent = `Paso ${state.step + 1} de ${RITUAL.length} · ${step.section}`;
  el.stepTitle.textContent = step.title;
  el.stepText.innerHTML = emphasize(step.text);

  if (step.tool) {
    el.tool.hidden = false;
    el.toolIcon.innerHTML = stoneIcon(step.tool.edge, step.tool.travel);
    el.toolEdge.textContent = EDGES[step.tool.edge].label;
    el.toolDir.textContent = step.tool.dir;
  } else {
    el.tool.hidden = true;
  }
  el.note.hidden = !step.note || !!step.tool;
  if (step.note) el.note.innerHTML = emphasize(step.note);

  const next = RITUAL[state.step + 1];
  el.nextUp.innerHTML = next
    ? `A continuación · <span>${next.title}</span>`
    : 'Último paso del ritual';

  // Animación suave de entrada del contenido del paso
  el.sheetBody.classList.remove('in');
  void el.sheetBody.offsetWidth;
  el.sheetBody.classList.add('in');

  el.endActions.hidden = true;
  el.controls.hidden = false;
  el.prev.disabled = state.step === 0;
  el.timer.classList.remove('done');
  updateMove();
  updateTimer();
  updateSegments();
}

function currentMove() {
  const step = RITUAL[state.step];
  let acc = 0;
  for (let i = 0; i < step.moves.length; i++) {
    const mv = step.moves[i];
    if (state.elapsed < acc + mv.seconds || i === step.moves.length - 1) {
      return { move: mv, index: i, elapsed: state.elapsed - acc };
    }
    acc += mv.seconds;
  }
  return null;
}

function updateMove() {
  const { move, index } = currentMove();
  if (index === state.moveIdx) return;
  state.moveIdx = index;
  el.sideTag.hidden = !move.label;
  el.sideTag.textContent = move.label;
  if (move.label) {
    el.sideTag.classList.remove('pulse');
    void el.sideTag.offsetWidth;
    el.sideTag.classList.add('pulse');
  }
}

function updateSegments() {
  state.segmentEls.forEach((seg, i) => {
    const f = i < state.step ? 1 : i > state.step ? 0 : Math.min(1, state.elapsed / RITUAL[i].seconds);
    seg.firstChild.style.transform = `scaleX(${f})`;
    seg.classList.toggle('current', i === state.step);
  });
}

function updateTimer() {
  const step = RITUAL[state.step];
  const left = Math.max(0, step.seconds - state.elapsed);
  const sec = Math.ceil(left);
  if (sec !== state.shownSecond) {
    state.shownSecond = sec;
    el.timerNum.textContent = sec;
    el.timer.setAttribute('aria-label', `Quedan ${sec} segundos de este paso`);
    let total = left;
    for (let i = state.step + 1; i < RITUAL.length; i++) total += RITUAL[i].seconds;
    const label = `Quedan ${fmt(Math.ceil(total))}`;
    if (label !== state.shownRemaining) {
      state.shownRemaining = label;
      el.remaining.textContent = label;
    }
  }
  el.timerRing.style.strokeDashoffset = String(RING * (1 - left / step.seconds));
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

  // 2. Contador del paso; al terminar pasa solo al siguiente.
  const step = RITUAL[state.step];
  if (state.playing && !state.completed) {
    state.elapsed += dt;
    if (state.elapsed >= step.seconds) {
      if (state.step < RITUAL.length - 1) goToStep(state.step + 1);
      else { state.elapsed = step.seconds; complete(); }
    }
  }
  if (state.playing || state.completed) state.anim += dt;
  updateMove();
  updateTimer();
  updateSegments();

  // 3. Presencia del rostro
  state.faceAlpha += ((face.present ? 1 : 0) - state.faceAlpha) * Math.min(1, dt * 6);
  const current = RITUAL[state.step];
  el.faceHint.hidden = current.overlay === 'breath' || face.present || t - face.lastSeen < 1.2;

  // 4. Dibujo
  renderer.clear();
  if (current.overlay === 'breath') drawBreath();
  else if (state.faceAlpha > 0.01 && face.get(1)) draw();
  if (DEBUG) {
    renderer.debug(face, LABELS);
    el.debug.textContent = `detect ${state.detectCost.toFixed(1)} ms · ${state.tracker.delegate} · ${state.tracker.source} · ${v.videoWidth}×${v.videoHeight}`;
  }
}

/** Respiración guiada: funciona aunque no se detecte el rostro. */
function drawBreath() {
  const cycle = BREATH.inhale + BREATH.exhale;
  const tc = state.elapsed % cycle;
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));
  let p, label, count;
  if (tc < BREATH.inhale) {
    p = ease(tc / BREATH.inhale);
    label = 'Inspira';
    count = Math.ceil(BREATH.inhale - tc);
  } else {
    p = 1 - ease((tc - BREATH.inhale) / BREATH.exhale);
    label = 'Espira';
    count = Math.ceil(cycle - tc);
  }

  // Centro: sobre el rostro si se detecta; si no, en la zona del encuadre.
  const fb = { x: renderer.w / 2, y: renderer.h * 0.34, r: Math.min(renderer.w * 0.36, renderer.h * 0.2) };
  let cx = fb.x, cy = fb.y, r = fb.r;
  const top = face.get(10), chin = face.get(152), nose = face.get(1);
  if (top && chin && nose && state.faceAlpha > 0.01) {
    const fr = Math.hypot(chin.x - top.x, chin.y - top.y) * 0.62;
    const fx = (top.x + chin.x) / 2, fy = (top.y + chin.y) / 2;
    const k = state.faceAlpha;
    cx = fb.x + (fx - fb.x) * k;
    cy = fb.y + (fy - fb.y) * k;
    r = fb.r + (fr - fb.r) * k;
  }
  renderer.breath({ x: cx, y: cy }, r, p, label, count, smooth(0, 0.8, state.anim));
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
  // Si la persona gira la cabeza, el lado que se aleja se desvanece
  // (salvo en el calentamiento, donde girar es el ejercicio).
  const step = RITUAL[state.step];
  const warm = step.section === 'Calentamiento';
  const vis = {
    a: warm ? 1 : smooth(0.16, 0.3, ratio),
    b: warm ? 1 : smooth(0.16, 0.3, 1 - ratio),
    c: 1,
  };

  const lw = clamp(faceW * 0.0066, 1.1, 2.6);
  const head = clamp(faceW * 0.03, 6, 14);
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

  const { move } = currentMove();
  const phase = (state.anim / (step.period || 2.2)) % 1;
  const stones = [];
  for (const s of move.strokes) {
    const pts = resolveStroke(s, face);
    if (!pts) continue;
    // En los pasos por lados, el lado que no toca se queda en segundo plano.
    const active = !move.side || s.side === 'c' || s.side === move.side;
    const sAlpha = alpha * vis[s.side] * (active ? 1 : 0.22);
    const tip = renderer.stroke(pts, { phase, alpha: sAlpha, lw: warm ? lw * 1.25 : lw, head: warm ? head * 1.3 : head });
    if (s.stone && active && step.tool) stones.push([tip, sAlpha]);
  }
  // La piedra se dibuja encima de todas las flechas.
  const width = clamp(faceW * 0.32, 60, 150);
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
  else { state.elapsed = RITUAL[state.step].seconds; complete(); }
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
if (el.introTime) el.introTime.textContent = String(Math.round(TOTAL_SECONDS / 60));
if (isInAppBrowser()) el.inapp.hidden = false;
if (DEBUG) el.debug.hidden = false;
show('intro');
