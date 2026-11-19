// Dibujo en Canvas 2D: trazos finos con una luz que recorre la flecha
// marcando el sentido y el ritmo del movimiento, y la piedra Gua Sha
// deslizándose con la parte de trabajo por delante.

import { STONE_PATH, STONE_EDGES, STONE_WIDTH, STONE_HEIGHT } from './stone.js?v=20261119d';

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

  /** Puntos faciales: halo rojo, núcleo luminoso y ondas que se expanden. */
  pulses(points, t, { alpha, r }) {
    const c = this.ctx;
    points.forEach((p, i) => {
      // ondas
      for (const k of [0, 0.33, 0.66]) {
        const q = (t * 0.6 + k) % 1;
        c.beginPath();
        c.arc(p.x, p.y, r * (0.9 + q * 2.4), 0, Math.PI * 2);
        c.strokeStyle = `rgba(230, 70, 56, ${(1 - q) * 0.7 * alpha})`;
        c.lineWidth = 2 * (1 - q) + 0.6;
        c.stroke();
      }
      const breathe = 0.85 + 0.15 * Math.sin((t + i * 0.5) * 3.4);
      // halo
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
      g.addColorStop(0, `rgba(240, 80, 60, ${0.75 * breathe * alpha})`);
      g.addColorStop(0.35, `rgba(230, 70, 56, ${0.45 * breathe * alpha})`);
      g.addColorStop(1, 'rgba(230, 70, 56, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
      c.fill();
      // núcleo
      c.beginPath();
      c.arc(p.x, p.y, r * 0.55 * breathe, 0, Math.PI * 2);
      c.fillStyle = `rgba(255, 236, 224, ${0.95 * alpha})`;
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = `rgba(230, 70, 56, ${alpha})`;
      c.stroke();
    });
  }

  /** Piedra girando 360° sobre sí misma, con brillo y burbujas de agua. */
  spinStone(center, height, t, alpha) {
    this.ensureStone();
    const c = this.ctx;
    const s = height / STONE_HEIGHT;
    const ang = (t / 4) * Math.PI * 2;          // una vuelta cada 4 s
    // burbujas que suben alrededor
    for (let i = 0; i < 9; i++) {
      const q = (t * 0.28 + i / 9) % 1;
      const bx = center.x + Math.sin(i * 2.3 + t * 0.8) * height * 0.55;
      const by = center.y + height * 0.55 - q * height * 1.2;
      c.beginPath();
      c.arc(bx, by, 2 + (i % 3) * 1.5, 0, Math.PI * 2);
      c.strokeStyle = `rgba(${CREAM}, ${Math.sin(q * Math.PI) * 0.6 * alpha})`;
      c.lineWidth = 1;
      c.stroke();
    }
    c.save();
    c.translate(center.x, center.y);
    c.rotate(ang);
    c.scale(s, s);
    c.fillStyle = `rgba(62, 72, 39, ${0.6 * alpha})`;
    c.fill(this.stonePath);
    c.lineWidth = 2 / s;
    c.strokeStyle = `rgba(${CREAM}, ${0.9 * alpha})`;
    c.stroke(this.stonePath);
    c.lineWidth = 4 / s;
    c.lineCap = 'round';
    c.strokeStyle = `rgba(${LIGHT}, ${0.9 * alpha})`;
    c.stroke(this.edgePaths.long);
    // brillo que la recorre
    c.save();
    c.clip(this.stonePath);
    const sx = ((t * 0.45) % 1) * 240 - 120;
    const g = c.createLinearGradient(sx - 30, -80, sx + 30, 80);
    g.addColorStop(0, 'rgba(255, 248, 226, 0)');
    g.addColorStop(0.5, `rgba(255, 248, 226, ${0.4 * alpha})`);
    g.addColorStop(1, 'rgba(255, 248, 226, 0)');
    c.fillStyle = g;
    c.fillRect(-90, -100, 180, 200);
    c.restore();
    c.restore();
  }

  /**
   * Líneas que estilizan el rostro (mandíbula, pómulos, patas de gallo, frente)
   * con resplandor dorado, una luz que las recorre y destellos.
   */
  sculpt(lines, sparkles, center, faceH, t, alpha) {
    const c = this.ctx;
    // resplandor general muy suave
    c.save();
    c.globalCompositeOperation = 'screen';
    const bloom = c.createRadialGradient(center.x, center.y, 0, center.x, center.y, faceH * 0.9);
    bloom.addColorStop(0, `rgba(255, 226, 170, ${0.16 * alpha})`);
    bloom.addColorStop(1, 'rgba(255, 226, 170, 0)');
    c.fillStyle = bloom;
    c.fillRect(center.x - faceH, center.y - faceH, faceH * 2, faceH * 2);
    c.restore();

    c.lineCap = 'round';
    c.lineJoin = 'round';
    lines.forEach((anchors, i) => {
      const pts = spline(anchors, 10);
      const L = measure(pts);
      const total = L[L.length - 1];
      if (total < 4) return;
      const a = alpha * (0.8 + 0.2 * Math.sin(t * 1.5 + i));
      c.save();
      c.globalCompositeOperation = 'screen';
      this.polyline(pts);
      c.shadowColor = `rgba(255, 210, 140, ${0.9 * a})`;
      c.shadowBlur = 14;
      c.strokeStyle = `rgba(255, 222, 165, ${0.4 * a})`;
      c.lineWidth = 4;
      c.stroke();
      c.restore();
      this.polyline(pts);
      c.strokeStyle = `rgba(255, 249, 232, ${0.9 * a})`;
      c.lineWidth = 1.3;
      c.stroke();
      // luz que recorre la línea
      const q = (t * 0.35 + i * 0.17) % 1;
      const hp = pointAt(pts, L, q * total);
      const g = c.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 10);
      g.addColorStop(0, `rgba(255, 252, 240, ${Math.sin(q * Math.PI) * a})`);
      g.addColorStop(1, 'rgba(255, 252, 240, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(hp.x, hp.y, 10, 0, Math.PI * 2);
      c.fill();
    });
    // destellos de cuatro puntas
    sparkles.forEach((p, i) => {
      const tw = Math.max(0, Math.sin(t * 1.8 + i * 1.9));
      const r = 9 * (0.5 + tw * 0.7);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(Math.PI / 4 * (i % 2));
      c.fillStyle = `rgba(255, 250, 235, ${tw * alpha})`;
      c.shadowColor = 'rgba(255, 215, 150, 0.9)';
      c.shadowBlur = 10;
      c.beginPath();
      c.moveTo(0, -r); c.quadraticCurveTo(0, 0, r, 0); c.quadraticCurveTo(0, 0, 0, r);
      c.quadraticCurveTo(0, 0, -r, 0); c.quadraticCurveTo(0, 0, 0, -r);
      c.fill();
      c.restore();
    });
  }

  /**
   * Líneas sensoriales: contornos del rostro concéntricos que respiran,
   * hacia dentro y hacia fuera, como un aura topográfica.
   * @param rings  [{ pts, alpha }]
   */
  aura(rings, alpha) {
    const c = this.ctx;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const ring of rings) {
      const pts = spline([...ring.pts, ring.pts[0], ring.pts[1]], 6);
      this.polyline(pts);
      c.strokeStyle = `rgba(232, 214, 160, ${0.12 * ring.alpha * alpha})`;
      c.lineWidth = 4;
      c.stroke();
      c.strokeStyle = `rgba(${LIGHT}, ${0.6 * ring.alpha * alpha})`;
      c.lineWidth = 1;
      c.stroke();
    }
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
