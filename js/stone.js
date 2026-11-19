// Silueta de una piedra Gua Sha en forma de corazón, inspirada en la forma real:
// lóbulo superior grande y redondeado, hendidura en V suave, lóbulo pequeño,
// borde largo convexo que baja hasta una punta redondeada y lado opuesto
// ligeramente cóncavo. Coordenadas locales centradas en (0,0), ~112 × 142.
//
// Para cada parte de trabajo: ángulo de su normal hacia fuera (grados),
// distancia al centro y un subtrazo para resaltarla.

export const STONE_PATH =
  'M 21 -44 ' +
  'C 26 -58 34 -66 43 -64 ' +          // hendidura → lóbulo pequeño
  'C 54 -60 58 -50 56 -38 ' +          // lóbulo pequeño
  'C 54 -20 52 -8 47 6 ' +             // borde largo (parte alta)
  'C 40 26 28 46 14 60 ' +             // borde largo (parte baja)
  'C 9 66 3 71 -2 70 ' +               // punta redondeada
  'C -8 68 -12 60 -16 50 ' +
  'C -24 32 -33 16 -42 -2 ' +          // lado cóncavo
  'C -52 -20 -60 -36 -56 -50 ' +       // lóbulo grande
  'C -52 -66 -34 -74 -16 -70 ' +
  'C 0 -66 14 -56 21 -44 Z';           // vuelta a la hendidura

export const STONE_EDGES = {
  notch: { angle: -80, dist: 47, path: 'M 10 -60 C 15 -55 19 -50 21 -44 C 23 -52 27 -60 34 -64' },
  long: { angle: 15, dist: 47, path: 'M 56 -30 C 54 -14 51 -4 47 6 C 41 24 30 42 18 55' },
  lobe: { angle: -48, dist: 72, path: 'M 33 -64 C 44 -66 54 -58 56 -42' },
};

export const STONE_WIDTH = 112;
export const STONE_HEIGHT = 142;

/**
 * Icono SVG para la ficha del paso: la piedra con la parte de trabajo
 * resaltada y una flecha que indica el sentido del movimiento.
 * @param edge   'long' | 'notch' | 'lobe'
 * @param travel 'up' | 'out'
 */
export function stoneIcon(edge, travel) {
  const e = STONE_EDGES[edge];
  const travelAngle = travel === 'up' ? -90 : 0;
  const rot = travelAngle - e.angle;
  const rad = (travelAngle * Math.PI) / 180;
  const ux = Math.cos(rad), uy = Math.sin(rad);
  // La flecha nace fuera de la silueta, delante de la parte de trabajo.
  const start = Math.max(e.dist + 14, 80);
  const end = start + 34;
  const sx = ux * start, sy = uy * start;
  const ex = ux * end, ey = uy * end;
  const h = 10, px = -uy, py = ux;
  const head = `M ${ex - ux * h + px * h * 0.7} ${ey - uy * h + py * h * 0.7} L ${ex} ${ey} L ${ex - ux * h - px * h * 0.7} ${ey - uy * h - py * h * 0.7}`;
  return `
<svg viewBox="-125 -125 250 250" aria-hidden="true" class="stone-icon">
  <g transform="rotate(${rot})">
    <path d="${STONE_PATH}" class="stone-body"/>
    <path d="${e.path}" class="stone-edge"/>
  </g>
  <path d="M ${sx} ${sy} L ${ex} ${ey}" class="stone-arrow"/>
  <path d="${head}" class="stone-arrow"/>
</svg>`;
}
