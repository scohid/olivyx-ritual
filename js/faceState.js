import { OneEuro } from './oneEuro.js?v=20261120d';

/**
 * Convierte landmarks normalizados de MediaPipe a píxeles de pantalla,
 * teniendo en cuenta object-fit: cover y el efecto espejo, y los suaviza.
 */
export function makeMapper(video, width, height) {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const s = Math.max(width / vw, height / vh); // object-fit: cover
  const ox = (width - vw * s) / 2;
  const oy = (height - vh * s) / 2;
  // El <video> se refleja con CSS (scaleX(-1)) alrededor de su centro,
  // así que la X en pantalla es width - x.
  return (nx, ny) => ({ x: width - (ox + nx * vw * s), y: oy + ny * vh * s });
}

const LOST_AFTER = 0.4; // s sin detección para considerar el rostro perdido

export class FaceState {
  constructor(indices) {
    this.indices = [...new Set(indices)];
    this.filters = new Map();
    this.pts = new Map();
    this.raw = null;
    this.present = false;
    this.lastSeen = -Infinity;
  }

  /** @param landmarks  Array normalizado o null  @param t segundos */
  update(landmarks, t, map) {
    if (!landmarks) {
      if (t - this.lastSeen > LOST_AFTER) this.present = false;
      return;
    }
    // Si el rostro reaparece tras perderse, reiniciar filtros para que
    // las flechas no "viajen" desde la posición antigua.
    if (t - this.lastSeen > LOST_AFTER) this.filters.clear();
    this.lastSeen = t;
    this.present = true;
    this.raw = landmarks;
    this.map = map;

    for (const i of this.indices) {
      const l = landmarks[i];
      if (!l) continue;
      const p = map(l.x, l.y);
      let f = this.filters.get(i);
      if (!f) {
        f = [new OneEuro(), new OneEuro()];
        this.filters.set(i, f);
      }
      this.pts.set(i, { x: f[0].filter(p.x, t), y: f[1].filter(p.y, t) });
    }
  }

  tick(t) {
    if (t - this.lastSeen > LOST_AFTER) this.present = false;
  }

  reset() {
    this.filters.clear();
    this.pts.clear();
    this.present = false;
    this.lastSeen = -Infinity;
  }

  get(i) { return this.pts.get(i); }
}
