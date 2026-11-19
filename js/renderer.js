// Dibujo en Canvas 2D: trazos finos con una luz que recorre la flecha
// marcando el sentido y el ritmo del movimiento, y la piedra Gua Sha
// deslizándose con la parte de trabajo por delante.

import { STONE_PATH, STONE_EDGES, STONE_WIDTH, STONE_HEIGHT } from './stone.js?v=20261119e';

const CREAM = '246, 241, 228';
const LIGHT = '255, 248, 226';
const SHADOW = '38, 44, 22';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Catmull-Rom uniforme → polilínea suave que pasa por todos los anclajes. */
export function spline(pts, segs = 10) {
  if (pts.length < 2) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    for (let j = 0; j < segs; j++) {
      const t = j / segs, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function measure(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) {
    L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return L;
}

function pointAt(pts, L, s) {
  if (s <= 0) return pts[0];
  const total = L[L.length - 1];
  if (s >= total) return pts[pts.length - 1];
  let i = 1;
  while (L[i] < s) i++;
  const t = (s - L[i - 1]) / (L[i] - L[i - 1] || 1);
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
}

function slice(pts, L, s0, s1) {
  const out = [pointAt(pts, L, s0)];
  for (let i = 0; i < pts.length; i++) if (L[i] > s0 && L[i] < s1) out.push(pts[i]);
  out.push(pointAt(pts, L, s1));
  return out;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }

  polyline(pts) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  }

  /**
   * @param anchors  puntos de pantalla
   * @param o.phase  0..1 posición en el ciclo de la pasada
   * @param o.alpha  opacidad global
   * @param o.lw     grosor base (px CSS)
   * @param o.head   tamaño de la punta de flecha
   * @returns {{x,y,angle,fade}|null} posición y dirección de la luz, para la piedra
   */
  stroke(anchors, { phase, alpha, lw, head, closed = false }) {
    if (alpha <= 0.01) return null;
    const c = this.ctx;
    const pts = spline(closed ? [...anchors, anchors[0]] : anchors);
    const L = measure(pts);
    const total = L[L.length - 1];
    if (total < 4) return null;
    let tip = null;

    c.lineCap = 'round';
    c.lineJoin = 'round';

    // 1. sombra muy suave para legibilidad sobre piel clara
    this.polyline(pts);
    c.strokeStyle = `rgba(${SHADOW}, ${0.2 * alpha})`;
    c.lineWidth = lw * 2.6;
    c.stroke();

    // 2. guía base
    this.polyline(pts);
    c.strokeStyle = `rgba(${CREAM}, ${0.55 * alpha})`;
    c.lineWidth = lw;
    c.stroke();

    // 3. luz que recorre el trazo (80 % del ciclo recorre, 20 % reposa)
    const run = 0.8;
    const p = phase / run;
    let arrival = 0;
    if (p <= 1) {
      const e = easeInOut(p);
      const headS = e * total;
      const tail = Math.max(0, headS - total * 0.42);
      const fade = smooth(0, 0.08, p) * (1 - smooth(0.9, 1, p));
      const segs = slice(pts, measure(pts), tail, headS);
      const SL = measure(segs);
      const segTotal = SL[SL.length - 1] || 1;
      const N = 12;
      for (let k = 0; k < N; k++) {
        const a = (k / N) * segTotal;
        const b = ((k + 1) / N) * segTotal;
        const piece = slice(segs, SL, a, b);
        const w = (k + 1) / N;
        this.polyline(piece);
        c.strokeStyle = `rgba(${LIGHT}, ${w * 0.95 * fade * alpha})`;
        c.lineWidth = lw * (1 + 0.7 * w);
        c.stroke();
      }
      const hp = pointAt(pts, L, headS);
      c.beginPath();
      c.arc(hp.x, hp.y, lw * 1.5, 0, Math.PI * 2);
      c.fillStyle = `rgba(${LIGHT}, ${fade * alpha})`;
      c.fill();
      arrival = smooth(0.75, 1, p);
      const behind = pointAt(pts, L, Math.max(0, headS - Math.max(4, total * 0.04)));
      tip = { x: hp.x, y: hp.y, angle: Math.atan2(hp.y - behind.y, hp.x - behind.x), fade };
    }

    // 4. punta de flecha
    if (!closed) {
      const end = pts[pts.length - 1];
      const back = pointAt(pts, L, total - Math.min(total * 0.12, head * 1.6));
      const ang = Math.atan2(end.y - back.y, end.x - back.x);
      const spread = 0.48;
      const a1 = { x: end.x - head * Math.cos(ang - spread), y: end.y - head * Math.sin(ang - spread) };
      const a2 = { x: end.x - head * Math.cos(ang + spread), y: end.y - head * Math.sin(ang + spread) };
      const draw = (style, width) => {
        c.beginPath();
        c.moveTo(a1.x, a1.y);
        c.lineTo(end.x, end.y);
        c.lineTo(a2.x, a2.y);
        c.strokeStyle = style;
        c.lineWidth = width;
        c.stroke();
      };
      draw(`rgba(${SHADOW}, ${0.2 * alpha})`, lw * 2.6);
      draw(`rgba(${LIGHT}, ${(0.6 + 0.4 * arrival) * alpha})`, lw * 1.15);
    }
    return tip;
  }

  ensureStone() {
    if (this.stonePath) return;
    this.stonePath = new Path2D(STONE_PATH);
    this.edgePaths = Object.fromEntries(Object.entries(STONE_EDGES).map(([k, v]) => [k, new Path2D(v.path)]));
  }

  /**
   * Piedra Gua Sha translúcida en la cabeza de la luz, girada para que la
   * parte de trabajo (`edge`) vaya por delante en el sentido del movimiento.
   */
  stone(tip, edge, { width, alpha }) {
    if (!tip || alpha <= 0.01) return;
    const e = STONE_EDGES[edge];
    if (!e) return;
    this.ensureStone();
    const c = this.ctx;
    const s = width / STONE_WIDTH;
    const a = alpha * tip.fade;
    c.save();
    c.translate(tip.x, tip.y);
    c.rotate(tip.angle - (e.angle * Math.PI) / 180);
    c.scale(s, s);
    c.translate(-Math.cos((e.angle * Math.PI) / 180) * e.dist, -Math.sin((e.angle * Math.PI) / 180) * e.dist);
    c.fillStyle = `rgba(62, 72, 39, ${0.5 * a})`;
    c.fill(this.stonePath);
    c.lineWidth = 1.5 / s;
    c.strokeStyle = `rgba(${CREAM}, ${0.7 * a})`;
    c.stroke(this.stonePath);
    c.lineWidth = 4 / s;
    c.lineCap = 'round';
    c.strokeStyle = `rgba(${LIGHT}, ${0.95 * a})`;
    c.stroke(this.edgePaths[edge]);
    c.restore();
  }

  /** Puntos de aplicación del aceite: una gota que respira y una onda que se expande. */
  drops(points, t, { alpha, r }) {
    const c = this.ctx;
    points.forEach((p, i) => {
      const ph = (t * 0.45 + i * 0.17) % 1;
      // onda
      c.beginPath();
      c.arc(p.x, p.y, r * (1 + ph * 2.6), 0, Math.PI * 2);
      c.strokeStyle = `rgba(${CREAM}, ${(1 - ph) * 0.5 * alpha})`;
      c.lineWidth = 1;
      c.stroke();
      // gota
      const breathe = 0.75 + 0.25 * Math.sin((t + i * 0.4) * 2.2);
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.4);
      g.addColorStop(0, `rgba(${LIGHT}, ${0.85 * breathe * alpha})`);
      g.addColorStop(0.45, `rgba(232, 214, 160, ${0.35 * breathe * alpha})`);
      g.addColorStop(1, 'rgba(232, 214, 160, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(p.x, p.y, r * 1.4, 0, Math.PI * 2);
      c.fill();
    });
  }

  /**
   * Respiración: un círculo translúcido sobre el rostro que se llena al
   * inspirar y se vacía al espirar. Se ve la cara a través de él.
   * @param p  0..1 nivel de llenado
   */
  breath(c, rMax, p, label, count, alpha) {
    const ctx = this.ctx;
    const r = rMax * (0.22 + 0.78 * p);

    // Anillos guía (tamaño máximo)
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rMax, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${CREAM}, ${0.5 * alpha})`;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rMax * 1.09, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${CREAM}, ${0.18 * alpha})`;
    ctx.stroke();

    // Relleno con degradado suave
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    g.addColorStop(0, `rgba(${LIGHT}, ${0.34 * alpha})`);
    g.addColorStop(0.65, `rgba(${CREAM}, ${0.22 * alpha})`);
    g.addColorStop(1, `rgba(${CREAM}, ${0.1 * alpha})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(${LIGHT}, ${0.75 * alpha})`;
    ctx.stroke();

    // Indicación
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(30, 34, 18, 0.45)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(${LIGHT}, ${alpha})`;
    ctx.font = '300 26px Poppins, "Helvetica Neue", sans-serif';
    ctx.fillText(label, c.x, c.y - 10);
    ctx.font = '400 15px Poppins, "Helvetica Neue", sans-serif';
    ctx.fillStyle = `rgba(${CREAM}, ${0.85 * alpha})`;
    ctx.fillText(String(count), c.x, c.y + 20);
    ctx.restore();
  }

  /** Puntos faciales: verde salvia corporativo, núcleo luminoso y ondas. */
  pulses(points, t, { alpha, r }) {
    const c = this.ctx;
    const GREEN = '186, 196, 132';     // verde claro (salvia OLIVYX)
    const DEEP = '62, 72, 39';         // verde oliva para dar contraste sobre la piel
    points.forEach((p, i) => {
      for (const k of [0, 0.33, 0.66]) {
        const q = (t * 0.6 + k) % 1;
        c.beginPath();
        c.arc(p.x, p.y, r * (0.9 + q * 2.4), 0, Math.PI * 2);
        c.strokeStyle = `rgba(${GREEN}, ${(1 - q) * 0.85 * alpha})`;
        c.lineWidth = 2.2 * (1 - q) + 0.6;
        c.stroke();
      }
      const breathe = 0.85 + 0.15 * Math.sin((t + i * 0.5) * 3.4);
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
      g.addColorStop(0, `rgba(${GREEN}, ${0.8 * breathe * alpha})`);
      g.addColorStop(0.4, `rgba(${GREEN}, ${0.4 * breathe * alpha})`);
      g.addColorStop(1, `rgba(${GREEN}, 0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(p.x, p.y, r * 0.55 * breathe, 0, Math.PI * 2);
      c.fillStyle = `rgba(250, 248, 236, ${0.95 * alpha})`;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = `rgba(${DEEP}, ${0.9 * alpha})`;
      c.stroke();
    });
  }

  /** Una pompa de jabón: transparente, con reflejos irisados y un brillo. */
  bubble(x, y, r, a) {
    const c = this.ctx;
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, `rgba(255, 255, 255, ${0.05 * a})`);
    g.addColorStop(0.75, `rgba(220, 235, 255, ${0.12 * a})`);
    g.addColorStop(0.92, `rgba(255, 210, 235, ${0.35 * a})`);
    g.addColorStop(1, `rgba(200, 240, 220, ${0.5 * a})`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 1;
    c.strokeStyle = `rgba(255, 255, 255, ${0.55 * a})`;
    c.stroke();
    c.beginPath();
    c.arc(x, y, r * 0.68, Math.PI * 1.1, Math.PI * 1.45);
    c.strokeStyle = `rgba(255, 255, 255, ${0.85 * a})`;
    c.lineWidth = Math.max(1, r * 0.12);
    c.lineCap = 'round';
    c.stroke();
  }

  /**
   * La piedra tumbada bajo el rostro, meciéndose suavemente sobre espuma,
   * con pompas de jabón que suben y se desvanecen.
   */
  soapStone(center, width, t, alpha) {
    this.ensureStone();
    const c = this.ctx;
    const s = width / STONE_HEIGHT;            // tumbada: el alto pasa a ser el ancho
    // espuma bajo la piedra
    for (let i = 0; i < 16; i++) {
      const fx = center.x + (i / 15 - 0.5) * width * 1.15 + Math.sin(i * 7.1) * width * 0.04;
      const fy = center.y + width * 0.2 + Math.sin(i * 3.3) * width * 0.04;
      const fr = width * (0.035 + 0.03 * ((i * 37) % 5) / 5) * (1 + 0.08 * Math.sin(t * 2 + i));
      this.bubble(fx, fy, fr, alpha * 0.9);
    }
    // piedra
    c.save();
    c.translate(center.x, center.y + Math.sin(t * 1.4) * width * 0.02);
    c.rotate(Math.PI / 2 + Math.sin(t * 0.9) * 0.08);
    c.scale(s, s);
    c.fillStyle = `rgba(62, 72, 39, ${0.62 * alpha})`;
    c.fill(this.stonePath);
    c.lineWidth = 2 / s;
    c.strokeStyle = `rgba(${CREAM}, ${0.9 * alpha})`;
    c.stroke(this.stonePath);
    c.save();
    c.clip(this.stonePath);
    const sx = ((t * 0.3) % 1) * 240 - 120;
    const g = c.createLinearGradient(sx - 30, -80, sx + 30, 80);
    g.addColorStop(0, 'rgba(255, 248, 226, 0)');
    g.addColorStop(0.5, `rgba(255, 248, 226, ${0.4 * alpha})`);
    g.addColorStop(1, 'rgba(255, 248, 226, 0)');
    c.fillStyle = g;
    c.fillRect(-90, -100, 180, 200);
    c.restore();
    c.restore();
    // pompas que suben y se desvanecen antes de llegar al rostro
    for (let i = 0; i < 10; i++) {
      const q = (t * 0.22 + i / 10) % 1;
      const bx = center.x + (((i * 53) % 10) / 9 - 0.5) * width * 1.1 + Math.sin(t * 1.3 + i) * width * 0.05;
      const by = center.y + width * 0.1 - q * width * 0.9;
      const br = width * (0.03 + ((i * 29) % 4) * 0.015);
      this.bubble(bx, by, br, alpha * Math.sin(q * Math.PI));
    }
  }

  /**
   * Brillo en la piel: luz suave en pómulos y destellos que titilan
   * (puntos finos y estrellas de cuatro puntas), como un iluminador.
   * @param zones [{ x, y, spread, glow }]
   */
  glitter(zones, t, alpha) {
    const c = this.ctx;
    // luz suave
    c.save();
    c.globalCompositeOperation = 'screen';
    zones.forEach((z) => {
      if (!z.glow) return;
      const g = c.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.spread * 1.6);
      g.addColorStop(0, `rgba(255, 246, 228, ${0.32 * alpha})`);
      g.addColorStop(1, 'rgba(255, 246, 228, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(z.x, z.y, z.spread * 1.6, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
    // destellos con posiciones pseudoaleatorias fijas por zona
    zones.forEach((z, zi) => {
      const n = z.count || 10;
      for (let k = 0; k < n; k++) {
        const seed = zi * 97 + k * 13.37;
        const rnd = (m) => { const v = Math.sin(seed * m) * 43758.5453; return v - Math.floor(v); };
        const ang = rnd(1.1) * Math.PI * 2;
        const rad = Math.sqrt(rnd(2.3)) * z.spread;
        const x = z.x + Math.cos(ang) * rad * 1.3;
        const y = z.y + Math.sin(ang) * rad * 0.8;
        const tw = Math.pow(Math.max(0, Math.sin(t * (1.6 + rnd(3.7) * 1.8) + rnd(5.9) * 6.28)), 2);
        if (tw < 0.02) continue;
        if (k % 3 === 0) {
          const r = (6 + rnd(7.7) * 8) * tw;
          c.save();
          c.translate(x, y);
          c.fillStyle = `rgba(255, 252, 240, ${tw * alpha})`;
          c.shadowColor = 'rgba(255, 240, 210, 0.9)';
          c.shadowBlur = 8;
          c.beginPath();
          c.moveTo(0, -r); c.quadraticCurveTo(0, 0, r * 0.7, 0); c.quadraticCurveTo(0, 0, 0, r);
          c.quadraticCurveTo(0, 0, -r * 0.7, 0); c.quadraticCurveTo(0, 0, 0, -r);
          c.fill();
          c.restore();
        } else {
          c.beginPath();
          c.arc(x, y, 1 + tw * 2, 0, Math.PI * 2);
          c.fillStyle = `rgba(255, 250, 235, ${0.9 * tw * alpha})`;
          c.fill();
        }
      }
    });
  }

  debug(face, labels) {
    const c = this.ctx;
    if (face.raw && face.map) {
      c.fillStyle = 'rgba(255,255,255,0.45)';
      for (const l of face.raw) {
        const p = face.map(l.x, l.y);
        c.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5);
      }
    }
    c.font = '9px ui-monospace, monospace';
    c.fillStyle = '#ffe9a8';
    for (const i of labels) {
      const p = face.get(i);
      if (p) c.fillText(String(i), p.x + 2, p.y - 2);
    }
  }
}
