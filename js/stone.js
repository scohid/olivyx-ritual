// Silueta de una piedra Gua Sha en forma de corazón (forma genérica), en
// coordenadas locales centradas en (0,0), ~112 × 98 unidades.
// Para cada parte de trabajo: ángulo de su normal hacia fuera (grados),
// distancia al centro y un subtrazo para resaltarla.

export const STONE_PATH =
  'M 0 -24 C -8 -42 -34 -48 -46 -32 C -56 -18 -50 2 -34 18 C -22 30 -10 40 0 50 ' +
  'C 10 40 22 30 34 18 C 50 2 56 -18 46 -32 C 34 -48 8 -42 0 -24 Z';

export const STONE_EDGES = {
  notch: { angle: -90, dist: 24, path: 'M -13 -37 C -6 -39 -2 -33 0 -24 C 2 -33 6 -39 13 -37' },
  long: { angle: 135, dist: 36, path: 'M -51 -2 C -48 8 -42 13 -34 18 C -22 30 -11 40 -3 47' },
  lobe: { angle: -131, dist: 52, path: 'M -54 -14 C -57 -28 -50 -44 -33 -46' },
};

export const STONE_WIDTH = 112;

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
  // La flecha nace fuera de la silueta, delante de la parte de trabajo, y apunta en el sentido del movimiento.
  const sx = ux * 64, sy = uy * 64;
  const ex = ux * 96, ey = uy * 96;
  const h = 9, px = -uy, py = ux;
  const head = `M ${ex - ux * h + px * h * 0.7} ${ey - uy * h + py * h * 0.7} L ${ex} ${ey} L ${ex - ux * h - px * h * 0.7} ${ey - uy * h - py * h * 0.7}`;
  return `
<svg viewBox="-100 -100 200 200" aria-hidden="true" class="stone-icon">
  <g transform="rotate(${rot})">
    <path d="${STONE_PATH}" class="stone-body"/>
    <path d="${e.path}" class="stone-edge"/>
  </g>
  <path d="M ${sx} ${sy} L ${ex} ${ey}" class="stone-arrow"/>
  <path d="${head}" class="stone-arrow"/>
</svg>`;
}
