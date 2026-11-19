// Definición del ritual y de los trazos, anclados a puntos reales de la malla
// MediaPipe Face Landmarker (478 puntos, misma numeración que Face Mesh).
//
// Tipos de ancla:
//   148                 → un landmark
//   B(129, 50, 0.3)     → 30 % del camino del landmark 129 hacia el 50
//   D(176, 10, 152, k)  → landmark 176 desplazado k veces el vector 10→152
//   out(234, 0.3)       → landmark 234 desplazado hacia fuera del rostro
//                         (desde la nariz), un 30 % de su distancia a ella
// Los trazos se definen para un lado del rostro y se reflejan con PAIRS.
// Con ?debug=1 se ven los índices sobre la cara para calibrar.
//
// Textos: las palabras entre **dobles asteriscos** se muestran destacadas.

const B = (a, b, t) => ({ a, b, t });
const D = (base, from, to, k) => ({ base, from, to, k });
const out = (i, k) => D(i, 1, i, k);

// Pares simétricos izquierda/derecha de la malla canónica.
export const PAIRS = [
  [33, 263], [133, 362], [145, 374], [61, 291],
  [234, 454], [93, 323], [132, 361], [58, 288], [172, 397], [136, 365],
  [150, 379], [149, 378], [176, 400], [148, 377],
  [127, 356], [162, 389], [21, 251], [54, 284], [103, 332], [67, 297], [109, 338],
  [70, 300], [63, 293], [105, 334], [66, 296], [4, 4], [6, 6], [107, 336], [55, 285], [46, 276],
  [129, 358], [50, 280], [116, 345], [123, 352], [205, 425],
  [108, 337], [69, 299], [104, 333],
];
const CENTER = new Set([0, 1, 2, 4, 6, 9, 10, 17, 151, 152, 168, 175, 199]);
const MIRROR = new Map();
PAIRS.forEach(([a, b]) => { MIRROR.set(a, b); MIRROR.set(b, a); });

const m = (i) => {
  if (CENTER.has(i)) return i;
  const r = MIRROR.get(i);
  if (r === undefined) console.warn('[OLIVYX] índice sin pareja simétrica:', i);
  return r ?? i;
};
const mirrorAnchor = (a) => {
  if (typeof a === 'number') return m(a);
  if ('base' in a) return D(m(a.base), m(a.from), m(a.to), a.k);
  return B(m(a.a), m(a.b), a.t);
};

// Contorno facial (orden de la malla), usado en el cierre.
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

// ── Trazos (lado A = índices "bajos" = lado derecho de la persona) ─────────
// inset: fracción para acercar cada punto hacia `toward`, de modo que el trazo
// quede sobre la piel y no sobre el borde del contorno.
const S = {
  // Calentamiento: arcos alrededor del rostro, fuera de la piel
  arcUp: { anchors: [out(172, 0.22), out(234, 0.26), out(54, 0.2)], inset: 0, toward: 1 },
  arcDown: { anchors: [out(54, 0.2), out(234, 0.26), out(172, 0.22)], inset: 0, toward: 1 },
  tilt: { anchors: [out(10, 0.14), out(103, 0.22), out(127, 0.32), out(93, 0.45)], inset: 0, toward: 1 },
  turn: { anchors: [B(1, 234, 0.25), B(1, 234, 0.75), out(234, 0.3)], inset: 0, toward: 1 },

  // Gua Sha
  neck: { anchors: [D(176, 10, 152, 0.4), D(176, 10, 152, 0.07)], inset: 0.15, toward: 152 },
  neckOuter: { anchors: [D(150, 10, 152, 0.3), D(150, 10, 152, 0.05)], inset: 0.22, toward: 152 },
  jaw: { anchors: [B(152, 148, 0.55), 176, 149, 150, 136, 172, 58, B(132, 93, 0.35)], inset: 0.09, toward: 1 },
  smileLow: { anchors: [B(61, 205, 0.3), B(205, 132, 0.5), B(132, 93, 0.6)], inset: 0.06, toward: 1 },
  smileHigh: { anchors: [B(129, 205, 0.25), B(50, 205, 0.5), B(234, 93, 0.55)], inset: 0.06, toward: 1 },
  underEye: { anchors: [B(133, 50, 0.2), B(145, 50, 0.28), B(33, 116, 0.4), B(33, 127, 0.7)], inset: 0, toward: 1 },
  brow: { anchors: [B(55, 107, 0.5), 105, 70, B(21, 162, 0.5)], inset: 0.03, toward: 168 },
  foreheadUp: { anchors: [B(107, 109, 0.12), B(107, 109, 0.86)], inset: 0, toward: 168 },
  foreheadUpOuter: { anchors: [B(105, 67, 0.14), B(105, 67, 0.84)], inset: 0, toward: 168 },
};

const sideA = (key, stone = false) => ({ id: `${key}-a`, side: 'a', stone, ...S[key] });
const sideB = (key, stone = false) => ({ id: `${key}-b`, side: 'b', stone, ...S[key], anchors: S[key].anchors.map(mirrorAnchor) });
const pair = (key, stone = false) => [sideA(key, stone), sideB(key, stone)];
const center = (id, anchors) => ({ id, side: 'c', anchors, inset: 0, toward: 168 });

// ── Estimulación de puntos faciales: por parejas simétricas ─────────────────
const P = (anchor, inset = 0, toward = 1) => ({ anchors: [anchor], inset, toward });
const twin = (p) => [{ side: 'a', ...p }, { side: 'b', ...p, anchors: p.anchors.map(mirrorAnchor) }];
export const POINT_GROUPS = [
  { label: 'Cejas', points: twin(P(B(55, 107, 0.5))) },
  { label: 'Sienes', points: twin(P(B(21, 127, 0.5), 0.1)) },
  { label: 'Delante de las orejas', points: twin(P(B(234, 93, 0.5), 0.08)) },
  { label: 'Mandíbula', points: twin(P(B(58, 205, 0.35))) },
  { label: 'Cuello', points: twin(P(D(132, 10, 152, 0.4), 0.2, 152)) },
];

// ── Glow para «Comparte tu ritual» ─────────────────────────────────────────
// Piel jugosa y luminosa: brillos especulares donde la luz toca el rostro
// (pómulos, arco de la ceja, tabique, punta de la nariz, arco de Cupido,
// barbilla), un rubor suave en las mejillas y luz difusa en la frente.
// w y h: tamaño relativo al ancho del rostro. axis: dos landmarks que dan
// la orientación de la elipse.
const G = (kind, anchor, w, h, axis) => ({ kind, anchors: [anchor], inset: 0, toward: 1, w, h, axis });
const GLOW_A = [
  G('spec', B(116, 50, 0.3), 0.17, 0.055, [50, 127]),     // pómulo
  G('blush', B(50, 205, 0.35), 0.15, 0.11, [50, 127]),    // mejilla
  G('spec', B(105, 66, 0.4), 0.075, 0.022, [107, 70]),    // arco de la ceja
];
export const GLOW = [
  ...GLOW_A.map((g) => ({ side: 'a', ...g })),
  ...GLOW_A.map((g) => ({ side: 'b', ...g, anchors: g.anchors.map(mirrorAnchor), axis: g.axis.map(m) })),
  { side: 'c', ...G('spec', B(6, 4, 0.45), 0.022, 0.1, [168, 4]) },   // tabique
  { side: 'c', ...G('spec', 4, 0.032, 0.024, [234, 454]) },           // punta de la nariz
  { side: 'c', ...G('spec', B(0, 2, 0.35), 0.045, 0.012, [61, 291]) }, // arco de Cupido
  { side: 'c', ...G('spec', B(17, 152, 0.6), 0.055, 0.03, [61, 291]) }, // barbilla
  { side: 'c', ...G('soft', B(151, 9, 0.15), 0.16, 0.07, [67, 297]) },  // frente
];

// ── Bloques del ritual ─────────────────────────────────────────────────────
export const BLOCKS = {
  'Calentamiento': 'Prepara el **cuello y los hombros** con estiramientos suaves antes del masaje.',
  'Respiración': 'Un minuto para **bajar el ritmo** y conectar con el gesto.',
  'Piedra Gua Sha': 'Aplica el aceite y recorre **seis zonas del rostro** con la piedra: siempre **hacia fuera** y **de abajo arriba**.',
  'Estimulación de puntos faciales': 'Presión suave en **puntos clave del rostro y el cuello**, y cierre del ritual.',
};

// ── Piedra Gua Sha ─────────────────────────────────────────────────────────
export const EDGES = {
  long: { label: 'Borde largo' },
  notch: { label: 'Hendidura en V' },
  lobe: { label: 'Curva pequeña' },
};

// ── Respiración: 4 s inspirar, 6 s espirar (≈ 6 respiraciones por minuto) ──
export const BREATH = { inhale: 4, exhale: 6 };

const WARMUP_NOTE = 'Movimientos **lentos y sin forzar**. Si notas **dolor o mareo**, detente.';

// ── Ritual ─────────────────────────────────────────────────────────────────
// seconds: duración del paso. sides: el paso se divide en dos mitades,
// primero el lado derecho y después el izquierdo.
const STEPS = [
  // Calentamiento de cuello (2 min)
  {
    section: 'Calentamiento',
    title: 'Flexión de cuello',
    text: 'Lleva **la barbilla hacia el pecho** despacio, mantén **unos segundos** y vuelve al centro.',
    note: WARMUP_NOTE,
    strokes: pair('arcDown'),
    period: 3,
    seconds: 20,
  },
  {
    section: 'Calentamiento',
    title: 'Extensión de cuello',
    text: '**Mira hacia arriba** sin echar la cabeza atrás del todo, mantén **unos segundos** y vuelve al centro.',
    note: WARMUP_NOTE,
    strokes: pair('arcUp'),
    period: 3,
    seconds: 20,
  },
  {
    section: 'Calentamiento',
    title: 'Inclinación lateral',
    text: 'Lleva **la oreja hacia el hombro** sin subir el hombro. **Mantén** y cambia de lado.',
    note: WARMUP_NOTE,
    moves: [
      { side: 'a', label: 'Hacia la derecha', strokes: [sideA('tilt')], seconds: 15 },
      { side: 'b', label: 'Hacia la izquierda', strokes: [sideB('tilt')], seconds: 15 },
    ],
    period: 3,
  },
  {
    section: 'Calentamiento',
    title: 'Rotación de cuello',
    text: '**Gira la cabeza** despacio para mirar **por encima del hombro**. Alterna ambos lados.',
    note: WARMUP_NOTE,
    moves: [
      { side: 'a', label: 'Hacia la derecha', strokes: [sideA('turn')], seconds: 10 },
      { side: 'b', label: 'Hacia la izquierda', strokes: [sideB('turn')], seconds: 10 },
    ],
    period: 2.6,
  },
  {
    section: 'Calentamiento',
    title: 'Estiramiento del trapecio',
    text: 'Apoya **la mano sobre la cabeza** y deja que su peso **incline la oreja hacia el hombro**. Sin tirar.',
    note: WARMUP_NOTE,
    moves: [
      { side: 'a', label: 'Lado derecho', strokes: [sideA('tilt')], seconds: 15 },
      { side: 'b', label: 'Lado izquierdo', strokes: [sideB('tilt')], seconds: 15 },
    ],
    period: 3,
  },

  // Respiración (1 min)
  {
    section: 'Respiración',
    title: 'Respiración consciente',
    text: '**Inspira por la nariz** mientras el círculo se llena y **espira despacio** mientras se vacía.',
    note: '**4 segundos** para inspirar, **6 segundos** para espirar.',
    overlay: 'breath',
    seconds: 60,
  },

  // Ritual Gua Sha (7 min)
  {
    section: 'Piedra Gua Sha',
    title: 'Prepara la piel',
    text: 'Calienta **3 o 4 gotas** de **escualano de oliva** o **Facial Oil de OLIVYX** entre las palmas y **presiónalas** sobre rostro y cuello.',
    note: 'Sujeta la piedra **casi plana**, inclinada unos **15°**.',
    overlay: 'drops',
    seconds: 20,
  },
  {
    section: 'Piedra Gua Sha',
    title: 'Cuello',
    text: 'Desliza desde la **base del cuello** hacia la **mandíbula**, con **pasadas lentas**.',
    strokes: [center('neck-c', [D(152, 10, 152, 0.42), D(152, 10, 152, 0.08)]), ...pair('neck', true), ...pair('neckOuter')],
    period: 2.4,
    tool: { edge: 'long', dir: 'de abajo arriba', travel: 'up' },
    seconds: 60,
    sides: true,
  },
  {
    section: 'Piedra Gua Sha',
    title: 'Contorno de la mandíbula',
    text: '**Abraza la mandíbula** con la hendidura y desliza desde la **barbilla** hasta la **oreja**.',
    strokes: pair('jaw', true),
    period: 2.4,
    tool: { edge: 'notch', dir: 'de la barbilla a la oreja', travel: 'out' },
    seconds: 60,
    sides: true,
  },
  {
    section: 'Piedra Gua Sha',
    title: 'Zona de la sonrisa',
    text: 'Desde la **comisura** y la **aleta de la nariz**, hacia la **oreja**.',
    strokes: [...pair('smileLow', true), ...pair('smileHigh')],
    period: 2.2,
    tool: { edge: 'long', dir: 'hacia la oreja', travel: 'out' },
    seconds: 60,
    sides: true,
  },
  {
    section: 'Piedra Gua Sha',
    title: 'Contorno de ojos',
    text: 'Del **lagrimal** hacia la **sien**, por debajo del ojo. **Casi sin presión**: aquí la piel es muy fina.',
    strokes: pair('underEye', true),
    period: 2.6,
    tool: { edge: 'lobe', dir: 'del lagrimal a la sien', travel: 'out' },
    seconds: 60,
    sides: true,
  },
  {
    section: 'Piedra Gua Sha',
    title: 'Cejas',
    text: '**Abraza la ceja** con la hendidura y deslízala desde su **inicio** hacia la **sien**.',
    strokes: pair('brow', true),
    period: 2.2,
    tool: { edge: 'notch', dir: 'hacia la sien', travel: 'out' },
    seconds: 60,
    sides: true,
  },
  {
    section: 'Piedra Gua Sha',
    title: 'Frente',
    text: 'Desde las **cejas** hacia el **nacimiento del pelo**, con movimientos **cortos y ligeros**.',
    strokes: [center('forehead-c', [B(9, 151, 0.2), B(9, 10, 0.86)]), ...pair('foreheadUp', true), ...pair('foreheadUpOuter')],
    period: 1.8,
    tool: { edge: 'long', dir: 'hacia arriba', travel: 'up' },
    seconds: 60,
    sides: true,
  },

  // Cierre
  {
    section: 'Estimulación de puntos faciales',
    title: 'Estimulación de puntos faciales',
    text: '**Presiona** con las yemas los **dos puntos marcados** y haz **pequeños círculos**. Cada **12 segundos** cambian de zona: **cejas, sienes, delante de las orejas, mandíbula y cuello**.',
    note: 'Presión **firme pero cómoda**, nunca dolorosa.',
    overlay: 'points',
    moves: POINT_GROUPS.map((g) => ({ side: null, label: g.label, strokes: [], points: g.points, seconds: 12 })),
  },
  {
    section: 'Estimulación de puntos faciales',
    title: 'Finaliza el ritual',
    text: 'Lleva las **palmas al rostro**, presiona con suavidad y **respira**.',
    note: 'La piel reconoce lo que le pertenece.',
    overlay: 'oval',
    seconds: 20,
  },
  {
    section: 'Estimulación de puntos faciales',
    title: 'Limpia tu piedra',
    text: 'Lávala con **agua tibia** y un **jabón suave**, sécala con un **paño limpio** y guárdala en su **funda**, lejos del sol directo.',
    note: 'Evita el **agua muy caliente** y los productos **abrasivos**.',
    seconds: 30,
  },
  {
    section: 'Estimulación de puntos faciales',
    title: 'Comparte tu ritual',
    text: 'Pulsa la **cámara** para crear tu **imagen del ritual** y **compártela** en tus redes sociales.',
    note: 'La imagen se crea **en tu móvil** y solo se comparte si tú lo decides.',
    overlay: 'aura',
    share: true,
    seconds: 0,
  },
];

// Normaliza: cada paso tiene `moves` y `seconds`.
export const RITUAL = STEPS.map((step) => {
  let moves = step.moves;
  if (!moves && step.sides) {
    moves = [
      { side: 'a', label: 'Lado derecho', strokes: step.strokes, seconds: step.seconds / 2 },
      { side: 'b', label: 'Lado izquierdo', strokes: step.strokes, seconds: step.seconds / 2 },
    ];
  }
  if (!moves) moves = [{ side: null, label: '', strokes: step.strokes || [], seconds: step.seconds }];
  const seconds = moves.reduce((acc, mv) => acc + mv.seconds, 0);
  return { ...step, moves, seconds };
});

export const SECTIONS = [...new Set(RITUAL.map((s) => s.section))];
export const TOTAL_SECONDS = RITUAL.reduce((s, st) => s + st.seconds, 0);

/** Índices que hay que seguir y suavizar. */
export function requiredIndices() {
  const set = new Set([1, 10, 168, 234, 454, 151, 50, 280, 17, 152, ...FACE_OVAL]);
  const add = (a) => {
    if (typeof a === 'number') set.add(a);
    else if ('base' in a) { set.add(a.base); set.add(a.from); set.add(a.to); }
    else { set.add(a.a); set.add(a.b); }
  };
  RITUAL.forEach((step) => step.moves.forEach((mv) => mv.strokes.forEach((s) => {
    s.anchors.forEach(add);
    set.add(s.toward);
  })));
  RITUAL.forEach((step) => step.moves.forEach((mv) => (mv.points || []).forEach((p) => { p.anchors.forEach(add); set.add(p.toward); })));
  GLOW.forEach((g) => { g.anchors.forEach(add); g.axis.forEach((i) => set.add(i)); set.add(g.toward); });
  return [...set];
}

/** Convierte un trazo en puntos de pantalla. Devuelve null si falta algún punto. */
export function resolveStroke(stroke, face) {
  const c = face.get(stroke.toward);
  const pts = [];
  for (const a of stroke.anchors) {
    let p;
    if (typeof a === 'number') {
      const q = face.get(a);
      if (!q) return null;
      p = { x: q.x, y: q.y };
    } else if ('base' in a) {
      const pb = face.get(a.base), pf = face.get(a.from), pt = face.get(a.to);
      if (!pb || !pf || !pt) return null;
      p = { x: pb.x + (pt.x - pf.x) * a.k, y: pb.y + (pt.y - pf.y) * a.k };
    } else {
      const pa = face.get(a.a), pb = face.get(a.b);
      if (!pa || !pb) return null;
      p = { x: pa.x + (pb.x - pa.x) * a.t, y: pa.y + (pb.y - pa.y) * a.t };
    }
    if (stroke.inset && c) {
      p.x += (c.x - p.x) * stroke.inset;
      p.y += (c.y - p.y) * stroke.inset;
    }
    pts.push(p);
  }
  return pts;
}

/** Convierte **palabras** en <strong>, escapando el resto del texto. */
export function emphasize(text) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<strong class="kw">$1</strong>');
}
