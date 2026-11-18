// Definición del ritual y de los trazos, anclados a puntos reales de la malla
// MediaPipe Face Landmarker (478 puntos, misma numeración que Face Mesh).
//
// Tipos de ancla:
//   148                 → un landmark
//   B(129, 50, 0.3)     → 30 % del camino del landmark 129 hacia el 50
//   D(176, 10, 152, k)  → landmark 176 desplazado k veces el vector 10→152
//                         (eje frente-barbilla). Sirve para el cuello, que no
//                         tiene landmarks propios.
// Los trazos se definen para un lado del rostro y se reflejan con PAIRS.
// Con ?debug=1 se ven los índices sobre la cara para calibrar.

const B = (a, b, t) => ({ a, b, t });
const D = (base, from, to, k) => ({ base, from, to, k });

export const STEP_SECONDS = 15;

// Pares simétricos izquierda/derecha de la malla canónica.
export const PAIRS = [
  [33, 263], [133, 362], [145, 374], [61, 291],
  [234, 454], [93, 323], [132, 361], [58, 288], [172, 397], [136, 365],
  [150, 379], [149, 378], [176, 400], [148, 377],
  [127, 356], [162, 389], [21, 251], [54, 284], [103, 332], [67, 297], [109, 338],
  [70, 300], [63, 293], [105, 334], [66, 296], [107, 336], [55, 285], [46, 276],
  [129, 358], [50, 280], [116, 345], [123, 352], [205, 425],
  [108, 337], [69, 299], [104, 333],
];
const CENTER = new Set([1, 4, 6, 9, 10, 17, 151, 152, 168, 175, 199]);
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

// ── Trazos (lado A = índices "bajos", lado derecho de la persona) ──────────
// inset: fracción para acercar cada punto hacia `toward`, de modo que el trazo
// quede sobre la piel y no sobre el borde del contorno.
const S = {
  neck: { // base del cuello → mandíbula
    anchors: [D(176, 10, 152, 0.4), D(176, 10, 152, 0.07)],
    inset: 0.15, toward: 152,
  },
  neckOuter: {
    anchors: [D(150, 10, 152, 0.3), D(150, 10, 152, 0.05)],
    inset: 0.22, toward: 152,
  },
  jaw: { // barbilla → oreja por el contorno
    anchors: [B(152, 148, 0.55), 176, 149, 150, 136, 172, 58, B(132, 93, 0.35)],
    inset: 0.09, toward: 1,
  },
  smileLow: { // comisura → oreja
    anchors: [B(61, 205, 0.3), B(205, 132, 0.5), B(132, 93, 0.6)],
    inset: 0.06, toward: 1,
  },
  smileHigh: { // aleta nasal → bajo el pómulo → oreja
    anchors: [B(129, 205, 0.25), B(50, 205, 0.5), B(234, 93, 0.55)],
    inset: 0.06, toward: 1,
  },
  underEye: { // lagrimal → bajo el ojo → sien
    anchors: [B(133, 50, 0.2), B(145, 50, 0.28), B(33, 116, 0.4), B(33, 127, 0.7)],
    inset: 0, toward: 1,
  },
  brow: { // inicio de la ceja → sien siguiendo el arco
    anchors: [B(55, 107, 0.5), 105, 70, B(21, 162, 0.5)],
    inset: 0.03, toward: 168,
  },
  foreheadUp: { // sobre la ceja → nacimiento del pelo
    anchors: [B(107, 109, 0.12), B(107, 109, 0.86)],
    inset: 0, toward: 168,
  },
  foreheadUpOuter: {
    anchors: [B(105, 67, 0.14), B(105, 67, 0.84)],
    inset: 0, toward: 168,
  },
};

/** Un trazo por lado. `stone` = en este trazo se dibuja la piedra deslizándose. */
const pair = (key, stone = false) => {
  const s = S[key];
  return [
    { id: `${key}-a`, side: 'a', stone, ...s },
    { id: `${key}-b`, side: 'b', stone, ...s, anchors: s.anchors.map(mirrorAnchor) },
  ];
};
const center = (id, anchors) => ({ id, side: 'c', anchors, inset: 0, toward: 168 });

// ── Piedra Gua Sha ─────────────────────────────────────────────────────────
// Qué parte de la piedra trabaja en cada zona. La piedra se dibuja con ese
// borde por delante, en el sentido del movimiento.
export const EDGES = {
  long: { label: 'Borde largo' },
  notch: { label: 'Hendidura en V' },
  lobe: { label: 'Curva pequeña' },
};

// ── Ritual: preparación + 6 zonas + cierre, 15 s cada una ──────────────────
// Orden de abajo arriba (cuello → frente), el habitual en Gua Sha.
export const RITUAL = [
  {
    key: 'prep',
    title: 'Prepara la piel',
    text: 'Calienta 3 o 4 gotas de escualano de oliva entre las palmas y presiónalas sobre rostro y cuello.',
    overlay: 'drops',
    tool: null,
    note: 'Sujeta la piedra casi plana, inclinada unos 15°.',
  },
  {
    key: 'neck',
    title: 'Cuello',
    text: 'Desliza desde la base del cuello hacia la mandíbula, con pasadas lentas.',
    strokes: [center('neck-c', [D(152, 10, 152, 0.42), D(152, 10, 152, 0.08)]), ...pair('neck', true), ...pair('neckOuter')],
    period: 2.4,
    tool: { edge: 'long', dir: 'de abajo arriba', travel: 'up' },
  },
  {
    key: 'jaw',
    title: 'Contorno de la mandíbula',
    text: 'Abraza la mandíbula con la hendidura y desliza desde la barbilla hasta la oreja.',
    strokes: pair('jaw', true),
    period: 2.4,
    tool: { edge: 'notch', dir: 'de la barbilla a la oreja', travel: 'out' },
  },
  {
    key: 'smile',
    title: 'Zona de la sonrisa',
    text: 'Desde la comisura y la aleta de la nariz, hacia la oreja.',
    strokes: [...pair('smileLow', true), ...pair('smileHigh')],
    period: 2.2,
    tool: { edge: 'long', dir: 'hacia la oreja', travel: 'out' },
  },
  {
    key: 'eyes',
    title: 'Contorno de ojos',
    text: 'Del lagrimal hacia la sien, por debajo del ojo. Casi sin presión: aquí la piel es muy fina.',
    strokes: pair('underEye', true),
    period: 2.6,
    tool: { edge: 'lobe', dir: 'del lagrimal a la sien', travel: 'out' },
  },
  {
    key: 'brows',
    title: 'Cejas',
    text: 'Abraza la ceja con la hendidura y deslízala desde su inicio hacia la sien.',
    strokes: pair('brow', true),
    period: 2.2,
    tool: { edge: 'notch', dir: 'hacia la sien', travel: 'out' },
  },
  {
    key: 'forehead',
    title: 'Frente',
    text: 'Desde las cejas hacia el nacimiento del pelo, con movimientos cortos y ligeros.',
    strokes: [center('forehead-c', [B(9, 151, 0.2), B(9, 10, 0.86)]), ...pair('foreheadUp', true), ...pair('foreheadUpOuter')],
    period: 1.8,
    tool: { edge: 'long', dir: 'hacia arriba', travel: 'up' },
  },
  {
    key: 'finish',
    title: 'Finaliza el ritual',
    text: 'Lleva las palmas al rostro, presiona con suavidad y respira. Limpia la piedra antes de guardarla.',
    overlay: 'oval',
    tool: null,
    note: 'La piel reconoce lo que le pertenece.',
  },
];

/** Índices que hay que seguir y suavizar. */
export function requiredIndices() {
  const set = new Set([1, 10, 168, 234, 454, 151, 50, 280, 17, 152, ...FACE_OVAL]);
  const add = (a) => {
    if (typeof a === 'number') set.add(a);
    else if ('base' in a) { set.add(a.base); set.add(a.from); set.add(a.to); }
    else { set.add(a.a); set.add(a.b); }
  };
  RITUAL.forEach((step) => (step.strokes || []).forEach((s) => {
    s.anchors.forEach(add);
    set.add(s.toward);
  }));
  return [...set];
}

/** Convierte un trazo en puntos de pantalla. Devuelve null si falta algún punto. */
export function resolveStroke(stroke, face) {
  const c = face.get(stroke.toward);
  const out = [];
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
    out.push(p);
  }
  return out;
}
