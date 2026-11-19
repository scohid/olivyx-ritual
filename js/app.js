import { startCamera, stopCamera, checkSupport, describeCameraError, isInAppBrowser } from './camera.js?v=20261119g';
import { createTracker } from './tracker.js?v=20261119g';
import { FaceState, makeMapper } from './faceState.js?v=20261119g';
import { Renderer, drawGlow } from './renderer.js?v=20261119g';
import {
  RITUAL, SECTIONS, BLOCKS, BREATH, EDGES, FACE_OVAL, GLOW,
  requiredIndices, resolveStroke, emphasize,
} from './ritual.js?v=20261119g';
import { stoneIcon } from './stone.js?v=20261119g';

const VERSION = '20261119g';
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
  loadingText: $('#loading-text'),
  errorTitle: $('#error-title'),
  errorText: $('#error-text'),
  segments: $('#segments'),
  remaining: $('#remaining'),
  timer: $('#timer'),
  timerNum: $('#timer-num'),
  timerRing: $('#timer-ring'),
  faceHint: $('#face-hint'),
  pausedTag: $('#paused-tag'),
  // ficha central
  infoCard: $('#info-card'),
  infoEyebrow: $('#info-eyebrow'),
  infoTitle: $('#info-title'),
  infoDuration: $('#info-duration'),
  stepText: $('#step-text'),
  tool: $('#tool'),
  toolIcon: $('#tool-icon'),
  toolEdge: $('#tool-edge'),
  toolDir: $('#tool-dir'),
  note: $('#step-note'),
  nextUp: $('#next-up'),
  continue: $('#btn-continue'),
  // portada de bloque
  blockKicker: $('#block-kicker'),
  blockTitle: $('#block-title'),
  blockMeta: $('#block-meta'),
  blockText: $('#block-text'),
  tick: $('#tick'),
  tickNum: $('#tick-num'),
  tickName: $('#tick-name'),
  tickDots: $('#tick-dots'),
  blockBtn: $('#btn-block'),
  // barra compacta
  sheet: $('#sheet'),
  eyebrow: $('#step-eyebrow'),
  sideTag: $('#side-tag'),
  stepTitle: $('#step-title'),
  controls: $('#controls'),
  info: $('#btn-info'),
  prev: $('#btn-prev'),
  next: $('#btn-next'),
  play: $('#btn-play'),
  shot: $('#btn-shot'),
  repeat: $('#btn-repeat'),
  endActions: $('#end-actions'),
  restart: $('#btn-restart'),
  finish: $('#btn-finish'),
  // compartir
  flash: $('#flash'),
  sharePreview: $('#share-preview'),
  shareImg: $('#share-img'),
  share: $('#btn-share'),
  save: $('#btn-save'),
  shareClose: $('#btn-share-close'),
  debug: $('#debug'),
  inapp: $('#inapp-note'),
};

const RING = 2 * Math.PI * 20; // circunferencia del anillo del contador (r = 20)

const state = {
  stream: null,
  tracker: null,
  running: false,
  step: 0,
  panel: 'info',          // 'block' = portada del bloque · 'info' = ficha del paso · 'run' = ejercicio
  currentBlock: null,
  started: false,         // si ya se ha pulsado «Comenzar» en este paso
  elapsed: 0,
  anim: 0,
  playing: false,
  completed: false,
  lastT: 0,
  lastVideoTime: -1,
  faceAlpha: 0,
  detectCost: 0,
  frameN: 0,
  wakeLock: null,
  shownSecond: -1,
  moveIdx: -1,
  shot: null,
};

const indices = DEBUG ? Array.from({ length: 478 }, (_, i) => i) : requiredIndices();
const face = new FaceState(indices);
const renderer = new Renderer(el.canvas);
const LABELS = requiredIndices();

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const mid = (p, q, t) => (p && q ? { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t } : null);

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
  state.currentBlock = null;
  goToStep(0);
  requestWakeLock();
  state.running = true;
  state.lastT = 0;
  requestAnimationFrame(frame);
}

function exit() {
  stopTicker();
  state.running = false;
  stopCamera(state.stream);
  state.stream = null;
  el.video.srcObject = null;
  releaseWakeLock();
  renderer.clear();
  closeShare();
  show('intro');
}

// ── Barra de progreso por secciones ────────────────────────────────────────
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
      b.addEventListener('click', () => goToStep(i));
      group.appendChild(b);
    });
    el.segments.appendChild(group);
  });
  state.segmentEls = [...el.segments.querySelectorAll('.segment')];
}

// ── Pasos ──────────────────────────────────────────────────────────────────
function durationLabel(step) {
  if (!step.seconds) return 'Sin tiempo: tómate el que quieras';
  const sides = step.moves.length === 2 && step.moves.every((m) => m.label);
  return sides ? `${step.seconds} segundos · ${step.moves[0].seconds} s por lado` : `${step.seconds} segundos`;
}

const blockOf = (i) => SECTIONS.indexOf(RITUAL[i].section);
const stepsOfBlock = (b) => RITUAL.map((s, i) => i).filter((i) => blockOf(i) === b);

/**
 * Va a un paso. Si es el primero de un bloque al que se entra, muestra antes
 * la portada del bloque; después, la ficha del paso para leerla con calma.
 */
function goToStep(i) {
  state.step = clamp(i, 0, RITUAL.length - 1);
  state.elapsed = 0;
  state.anim = 0;
  state.completed = false;
  state.started = false;
  state.shownSecond = -1;
  state.moveIdx = -1;
  const step = RITUAL[state.step];
  const block = blockOf(state.step);
  const inBlock = stepsOfBlock(block);
  const stepLabel = `Paso ${inBlock.indexOf(state.step) + 1} de ${inBlock.length}`;
  const eyebrow = step.title === step.section ? stepLabel : `${stepLabel} · ${step.section}`;

  // Ficha completa
  el.infoEyebrow.textContent = eyebrow;
  el.infoTitle.textContent = step.title;
  el.infoDuration.textContent = durationLabel(step);
  el.stepText.innerHTML = emphasize(step.text);
  if (step.tool) {
    el.tool.hidden = false;
    el.toolIcon.innerHTML = stoneIcon(step.tool.edge, step.tool.travel);
    el.toolEdge.textContent = EDGES[step.tool.edge].label;
    el.toolDir.textContent = step.tool.dir;
  } else {
    el.tool.hidden = true;
  }
  el.note.hidden = !step.note;
  if (step.note) el.note.innerHTML = emphasize(step.note);
  const next = RITUAL[state.step + 1];
  el.nextUp.innerHTML = next ? `A continuación · <span>${next.title}</span>` : 'Último paso del ritual';

  // Barra compacta
  el.eyebrow.textContent = eyebrow;
  el.stepTitle.textContent = step.title;
  el.prev.disabled = state.step === 0;
  el.next.disabled = state.step === RITUAL.length - 1;
  el.play.hidden = !!step.share;
  el.shot.hidden = !step.share;
  el.endActions.hidden = !step.share;
  el.timer.hidden = !step.seconds;
  el.timer.classList.remove('done');

  updateMove();
  updateTimer(true);
  updateSegments();
  const entering = inBlock[0] === state.step && state.currentBlock !== block;
  state.currentBlock = block;
  if (entering) openBlock(block);
  else openInfo();
}

/** Portada del bloque: «Bloque 1 · Calentamiento», qué incluye y cuánto dura. */
function openBlock(b) {
  const name = SECTIONS[b];
  const steps = stepsOfBlock(b);
  const secs = steps.reduce((acc, i) => acc + RITUAL[i].seconds, 0);
  el.blockKicker.textContent = `Bloque ${b + 1} de ${SECTIONS.length}`;
  el.blockTitle.textContent = name;
  el.blockMeta.textContent = `${steps.length} ${steps.length === 1 ? 'paso' : 'pasos'} · ${secs >= 60 ? `${Math.round(secs / 60)} min` : `${secs} s`}`;
  el.blockText.innerHTML = emphasize(BLOCKS[name] || '');
  startTicker(steps);
  state.panel = 'block';
  state.playing = false;
  document.body.dataset.panel = 'block';
  syncPlay();
}

/** Pasos del bloque de uno en uno: el actual baja y desaparece, sube el siguiente. */
let tickTimer = null;
function startTicker(steps) {
  stopTicker();
  el.tickDots.innerHTML = steps.length > 1 ? steps.map(() => '<span></span>').join('') : '';
  const dots = [...el.tickDots.children];
  let k = 0;
  const showTick = () => {
    const i = steps[k];
    el.tickNum.textContent = String(k + 1).padStart(2, '0');
    el.tickName.textContent = RITUAL[i].title;
    dots.forEach((d, j) => d.classList.toggle('on', j === k));
    el.tick.classList.remove('out', 'in');
    void el.tick.offsetWidth;
    el.tick.classList.add('in');
  };
  showTick();
  if (steps.length < 2) return;
  tickTimer = setInterval(() => {
    el.tick.classList.remove('in');
    void el.tick.offsetWidth;
    el.tick.classList.add('out');
    setTimeout(() => {
      k = (k + 1) % steps.length;
      if (tickTimer) showTick();
    }, 450);
  }, 2200);
}
function stopTicker() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}

/** Muestra la ficha centrada y pausa el ejercicio. */
function openInfo() {
  stopTicker();
  state.panel = 'info';
  state.playing = false;
  el.continue.textContent = state.started ? 'Continuar' : 'Comenzar';
  document.body.dataset.panel = 'info';
  el.infoCard.scrollTop = 0;
  syncPlay();
}

/** Pliega la ficha hacia abajo y empieza (o reanuda) el contador. */
function startRun() {
  stopTicker();
  state.panel = 'run';
  state.started = true;
  state.playing = true;
  document.body.dataset.panel = 'run';
  syncPlay();
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
  return { move: step.moves[0], index: 0, elapsed: 0 };
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
    const s = RITUAL[i];
    const f = i < state.step ? 1 : i > state.step ? 0 : s.seconds ? Math.min(1, state.elapsed / s.seconds) : 0;
    seg.firstChild.style.transform = `scaleX(${f})`;
    seg.classList.toggle('current', i === state.step);
  });
}

function updateTimer(force = false) {
  const step = RITUAL[state.step];
  const left = Math.max(0, step.seconds - state.elapsed);
  const sec = Math.ceil(left);
  if (sec !== state.shownSecond || force) {
    state.shownSecond = sec;
    el.timerNum.textContent = sec;
    el.timer.setAttribute('aria-label', `Quedan ${sec} segundos de este paso`);
    let total = left;
    for (let i = state.step + 1; i < RITUAL.length; i++) total += RITUAL[i].seconds;
    el.remaining.textContent = total > 0 ? `Quedan ${fmt(Math.ceil(total))}` : '';
  }
  el.timerRing.style.strokeDashoffset = step.seconds ? String(RING * (1 - left / step.seconds)) : '0';
}

function togglePlay(force) {
  if (state.panel !== 'run') return;
  state.playing = typeof force === 'boolean' ? force : !state.playing;
  syncPlay();
}

/** Evita que el foco de un botón oculto desplace la pantalla. */
function resetScroll() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const stage = document.getElementById('stage');
  if (stage.scrollTop || stage.scrollLeft) { stage.scrollTop = 0; stage.scrollLeft = 0; }
  if (window.scrollY) window.scrollTo(0, 0);
}

function syncPlay() {
  resetScroll();
  el.play.dataset.state = state.playing ? 'playing' : 'paused';
  el.play.setAttribute('aria-label', state.playing ? 'Pausar' : 'Continuar');
  el.pausedTag.hidden = state.playing || state.panel !== 'run';
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
  const stageEl = el.sheet.parentElement;
  if (stageEl.scrollTop) stageEl.scrollTop = 0;

  // 2. Contador del paso (solo con la ficha plegada). Al terminar, pasa al
  //    siguiente paso, que se abre con su ficha para leerla.
  const step = RITUAL[state.step];
  if (state.panel === 'run' && state.playing && step.seconds) {
    state.elapsed += dt;
    if (state.elapsed >= step.seconds) {
      if (state.step < RITUAL.length - 1) goToStep(state.step + 1);
      else state.elapsed = step.seconds;
    }
  }
  // La animación sigue en la ficha (vista previa) y en el ejercicio, salvo en pausa.
  if (state.panel !== 'run' || state.playing || !step.seconds) state.anim += dt;
  updateMove();
  updateTimer();
  updateSegments();

  // 3. Presencia del rostro
  state.faceAlpha += ((face.present ? 1 : 0) - state.faceAlpha) * Math.min(1, dt * 6);
  const cur = RITUAL[state.step];
  el.faceHint.hidden = state.panel !== 'run' || ['breath', 'spin'].includes(cur.overlay) ||
    face.present || t - face.lastSeen < 1.2;

  // 4. Dibujo
  renderer.clear();
  draw();
  if (DEBUG) {
    renderer.debug(face, LABELS);
    el.debug.textContent = `detect ${state.detectCost.toFixed(1)} ms · ${state.tracker.delegate} · ${state.tracker.source} · ${v.videoWidth}×${v.videoHeight}`;
  }
}

/** Centro y tamaño del rostro (o de la zona de encuadre si no se detecta). */
function faceFrame() {
  const fb = { x: renderer.w / 2, y: renderer.h * 0.36, h: Math.min(renderer.w * 0.75, renderer.h * 0.42) };
  const top = face.get(10), chin = face.get(152);
  if (!top || !chin || state.faceAlpha <= 0.01) return fb;
  const k = state.faceAlpha;
  const fx = (top.x + chin.x) / 2, fy = (top.y + chin.y) / 2;
  const fh = Math.hypot(chin.x - top.x, chin.y - top.y);
  return { x: fb.x + (fx - fb.x) * k, y: fb.y + (fy - fb.y) * k, h: fb.h + (fh - fb.h) * k };
}

function draw() {
  const step = RITUAL[state.step];
  const preview = state.panel === 'run' ? 1 : 0.45;

  // Pasos que no dependen del rostro
  if (step.overlay === 'breath') {
    if (state.panel === 'run') drawBreath();
    return;
  }

  if (state.faceAlpha <= 0.01 || !face.get(1)) return;
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
  const warm = step.section === 'Calentamiento';
  const vis = {
    a: warm ? 1 : smooth(0.16, 0.3, ratio),
    b: warm ? 1 : smooth(0.16, 0.3, 1 - ratio),
    c: 1,
  };

  const lw = clamp(faceW * 0.0066, 1.1, 2.6);
  const head = clamp(faceW * 0.03, 6, 14);
  const alpha = state.faceAlpha * smooth(0, 0.7, state.anim) * preview;

  if (step.overlay === 'drops') {
    const pts = [face.get(151), face.get(50), face.get(280), mid(face.get(17), face.get(152), 0.55)].filter(Boolean);
    renderer.drops(pts, state.anim, { alpha, r: clamp(faceW * 0.022, 4, 10) });
    return;
  }

  if (step.overlay === 'points') {
    // Dos puntos simétricos cada vez; aparecen con un fundido al cambiar de zona.
    const { move, elapsed } = currentMove();
    const pts = [];
    for (const p of move.points || []) {
      const r = resolveStroke(p, face);
      if (r && vis[p.side] > 0.2) pts.push(r[0]);
    }
    const fade = state.panel === 'run' ? smooth(0, 0.6, elapsed) : 1;
    renderer.pulses(pts, state.anim, { alpha: alpha * fade, r: clamp(faceW * 0.07, 13, 30) });
    return;
  }

  if (step.overlay === 'oval') {
    const c = face.get(1);
    const pts = ovalRing(0.06, c);
    if (pts) renderer.stroke(pts, { phase: (state.anim / 6) % 1, alpha: alpha * 0.8, lw, head, closed: true });
    return;
  }

  if (step.overlay === 'aura') {
    state.glowData = glowData(faceW, vis);
    renderer.glow(state.glowData.items, state.glowData.prism, state.anim, alpha);
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

/** Contorno facial desplazado hacia el centro (k > 0) o hacia fuera (k < 0). */
function ovalRing(k, c, wobble = 0, seed = 0) {
  const pts = [];
  for (let j = 0; j < FACE_OVAL.length; j++) {
    const p = face.get(FACE_OVAL[j]);
    if (!p) return null;
    const kk = k + wobble * Math.sin(state.anim * 1.1 + j * 0.45 + seed);
    pts.push({ x: p.x + (c.x - p.x) * kk, y: p.y + (c.y - p.y) * kk });
  }
  return pts;
}

/** Zonas de brillo, rubor y luz prismática sobre el rostro actual. */
function glowData(faceW, vis) {
  const items = [];
  for (const g of GLOW) {
    const r = resolveStroke(g, face);
    const p = face.get(g.axis[0]), q = face.get(g.axis[1]);
    if (!r || !p || !q) continue;
    const a = vis[g.side];
    items.push({
      kind: g.kind,
      x: r[0].x, y: r[0].y,
      rx: g.w * faceW, ry: g.h * faceW * (0.4 + 0.6 * a),
      angle: Math.atan2(q.y - p.y, q.x - p.x),
    });
  }
  // Luz prismática: cruza el rostro en diagonal, siguiendo su inclinación.
  const f = faceFrame();
  const l = face.get(234), rr = face.get(454);
  const roll = l && rr ? Math.atan2(rr.y - l.y, rr.x - l.x) : 0;
  const prism = { x: f.x, y: f.y + f.h * 0.15, size: f.h * 1.1, angle: roll - 0.55 };
  return { items, prism };
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
  const f = faceFrame();
  renderer.breath({ x: f.x, y: f.y }, f.h * 0.62, p, label, count, smooth(0, 0.8, state.anim));
}

// ── Compartir: imagen del ritual ───────────────────────────────────────────
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

/** Compone una imagen vertical: cámara (espejo) + líneas + logo + texto. */
async function captureImage() {
  const W = renderer.w, H = renderer.h;
  const k = Math.min(3, 1080 / W);
  const cw = Math.round(W * k), ch = Math.round(H * k);
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const x = cv.getContext('2d');

  // 1. Cámara, con el mismo encuadre y espejo que en pantalla
  const v = el.video;
  const s = Math.max(W / v.videoWidth, H / v.videoHeight) * k;
  const dw = v.videoWidth * s, dh = v.videoHeight * s;
  x.save();
  x.translate(cw, 0);
  x.scale(-1, 1);
  x.drawImage(v, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  x.restore();

  // 2. Glow: en el paso de compartir se pinta sobre la propia imagen con
  //    modos de fusión, para que la luz se integre en la piel.
  if (RITUAL[state.step].overlay === 'aura' && state.glowData && state.faceAlpha > 0.3) {
    drawGlow(x, state.glowData.items, state.glowData.prism, state.anim, 1, { blend: true, k });
  } else {
    x.drawImage(el.canvas, 0, 0, cw, ch);
  }

  // 3. Bloom: una copia muy desenfocada sumada en «screen» da el halo suave
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(cw / 14));
  small.height = Math.max(1, Math.round(ch / 14));
  const sx = small.getContext('2d');
  sx.imageSmoothingQuality = 'high';
  sx.drawImage(cv, 0, 0, small.width, small.height);
  x.save();
  x.globalCompositeOperation = 'screen';
  x.globalAlpha = 0.28;
  x.imageSmoothingQuality = 'high';
  x.drawImage(small, 0, 0, cw, ch);
  x.restore();

  // 4. Sombra neutra muy suave abajo, solo para que se lea la firma
  const g = x.createLinearGradient(0, ch * 0.62, 0, ch);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  x.fillStyle = g;
  x.fillRect(0, ch * 0.66, cw, ch * 0.34);

  // 5. Marco fino editorial
  const m = cw * 0.04;
  x.strokeStyle = 'rgba(243, 237, 224, 0.55)';
  x.lineWidth = Math.max(1, cw * 0.0016);
  x.strokeRect(m, m, cw - 2 * m, ch - 2 * m);

  try { await document.fonts.load(`300 ${Math.round(cw * 0.05)}px Poppins`); } catch { /* */ }
  const spaced = (txt) => txt.split('').join('\u2009');
  x.fillStyle = '#f3ede0';
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  x.shadowColor = 'rgba(0, 0, 0, 0.35)';
  x.shadowBlur = cw * 0.012;

  // «RITUAL FACIAL CON» + wordmark OLIVYX + claim
  const logo = await loadImage('assets/olivyx-logo-light.svg');
  const lw = cw * 0.5;
  const lh = lw * (logo.naturalHeight / logo.naturalWidth || 65 / 448);
  const logoY = ch * 0.8;
  x.font = `400 ${Math.round(cw * 0.026)}px Poppins, "Helvetica Neue", sans-serif`;
  x.globalAlpha = 0.85;
  x.fillText(spaced('RITUAL FACIAL CON'), cw / 2, logoY - cw * 0.04);
  x.globalAlpha = 1;
  x.drawImage(logo, (cw - lw) / 2, logoY, lw, lh);
  const ly = logoY + lh + cw * 0.05;
  x.strokeStyle = 'rgba(198, 173, 116, 0.8)';
  x.beginPath();
  x.moveTo(cw / 2 - cw * 0.06, ly);
  x.lineTo(cw / 2 + cw * 0.06, ly);
  x.stroke();
  x.font = `italic 300 ${Math.round(cw * 0.03)}px Poppins, "Helvetica Neue", sans-serif`;
  x.globalAlpha = 0.85;
  x.fillText('La piel reconoce lo que le pertenece', cw / 2, ly + cw * 0.05);
  x.globalAlpha = 1;
  // Instagram
  x.font = `500 ${Math.round(cw * 0.038)}px Poppins, "Helvetica Neue", sans-serif`;
  x.fillText('@olivyx.es', cw / 2, ly + cw * 0.12);

  // Arriba: nombre del taller
  x.font = `400 ${Math.round(cw * 0.022)}px Poppins, "Helvetica Neue", sans-serif`;
  x.globalAlpha = 0.8;
  x.fillText(spaced('TALLER DE AUTOMASAJE CON GUA SHA'), cw / 2, m + cw * 0.07);
  x.globalAlpha = 1;

  return new Promise((resolve) => cv.toBlob(resolve, 'image/jpeg', 0.92));
}

async function takeShot() {
  el.flash.classList.remove('on');
  void el.flash.offsetWidth;
  el.flash.classList.add('on');
  try {
    const blob = await captureImage();
    if (!blob) throw new Error('toBlob');
    if (state.shot) URL.revokeObjectURL(state.shot.url);
    const file = new File([blob], 'ritual-facial-olivyx.jpg', { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    state.shot = { file, url };
    el.shareImg.src = url;
    el.save.href = url;
    el.share.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    el.sharePreview.hidden = false;
  } catch (e) {
    console.error('[OLIVYX] captura', e);
  }
}

async function shareShot() {
  if (!state.shot) return;
  try {
    await navigator.share({
      files: [state.shot.file],
      title: 'Ritual facial con OLIVYX',
      text: 'Mi ritual facial con OLIVYX',
    });
  } catch (e) {
    if (e && e.name !== 'AbortError') console.warn('[OLIVYX] compartir', e);
  }
}

function closeShare() {
  el.sharePreview.hidden = true;
}

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
const go = (d) => goToStep(state.step + d);
el.start.addEventListener('click', begin);
el.retry.addEventListener('click', begin);
el.errorBack.addEventListener('click', () => show('intro'));
el.close.addEventListener('click', exit);
el.finish.addEventListener('click', exit);
el.restart.addEventListener('click', () => { state.currentBlock = null; goToStep(0); });
el.continue.addEventListener('click', startRun);
el.info.addEventListener('click', openInfo);
el.blockBtn.addEventListener('click', openInfo);
el.prev.addEventListener('click', () => go(-1));
el.next.addEventListener('click', () => go(1));
el.repeat.addEventListener('click', () => { goToStep(state.step); startRun(); });
el.play.addEventListener('click', () => togglePlay());
el.timer.addEventListener('click', () => togglePlay());
el.shot.addEventListener('click', takeShot);
el.share.addEventListener('click', shareShot);
el.shareClose.addEventListener('click', closeShare);

// Deslizar la barra hacia los lados también cambia de paso.
let touchX = null;
el.sheet.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
el.sheet.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) < 60) return;
  go(dx < 0 ? 1 : -1);
});

window.addEventListener('keydown', (e) => {
  if (document.body.dataset.screen !== 'stage') return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (state.panel === 'block') openInfo();
    else if (state.panel === 'info') startRun();
    else if (e.key === ' ') togglePlay();
  }
  if (e.key === 'ArrowRight') go(1);
  if (e.key === 'ArrowLeft') go(-1);
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { renderer.resize(); face.reset(); }, 120);
});

// Comprobación de integridad: si falta algún elemento, el HTML y el JS no son
// de la misma versión (subida incompleta o caché).
const missing = Object.entries(el).filter(([, node]) => !node).map(([k]) => k);
if (missing.length) {
  console.error('[OLIVYX] faltan elementos en index.html:', missing);
  document.documentElement.dataset.versionError = 'html';
}

buildSegments();
document.body.dataset.panel = 'info';
window.__OLIVYX_VERSION = VERSION;
if (isInAppBrowser()) el.inapp.hidden = false;
if (DEBUG) el.debug.hidden = false;
show('intro');
