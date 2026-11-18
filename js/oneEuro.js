// Filtro One Euro (Casiez et al., 2012): suaviza el temblor en reposo
// sin introducir retardo cuando el rostro se mueve rápido.

class LowPass {
  constructor() { this.y = null; }
  filter(x, a) {
    this.y = this.y === null ? x : a * x + (1 - a) * this.y;
    return this.y;
  }
}

const alpha = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuro {
  /**
   * @param {number} minCutoff  Hz. Más bajo = más suave en reposo.
   * @param {number} beta       Cuánto aumenta la respuesta con la velocidad.
   * @param {number} dCutoff    Hz para la derivada.
   */
  constructor(minCutoff = 1.2, beta = 0.015, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPass();
    this.dx = new LowPass();
    this.lastT = null;
  }

  filter(value, t) {
    if (this.lastT === null) {
      this.lastT = t;
      this.dx.y = 0;
      return this.x.filter(value, 1);
    }
    const dt = Math.max(t - this.lastT, 1e-3);
    this.lastT = t;
    const d = (value - this.x.y) / dt;
    const ed = this.dx.filter(d, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(ed);
    return this.x.filter(value, alpha(cutoff, dt));
  }
}
