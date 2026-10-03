// Smooths screen pinning. The OS moves window content a frame or two before the page can
// correct, so raw tracking snaps; easing softens the correction. Frame-rate independent.

export interface Point {
  x: number;
  y: number;
}

// Browser zoom: how many of the page's CSS px make one unit of the window's screen position.
// Chrome and Safari report screenX/outerWidth unzoomed while innerWidth zooms; Firefox's
// mozInnerScreenX and outerWidth zoom with the page. So innerWidth / outerWidth is the factor in
// every browser (≈1 in Firefox) — snapped to the zoom steps browsers use, since window borders
// make the raw ratio a little off. Docked devtools or a side panel also narrow the page: a ratio
// counts as zoom only if it's near a zoom step and leaves a real screen density (dpr = density ×
// zoom); otherwise it's taken as unzoomed.
const ZOOM_STEPS = [0.25, 0.3, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.33, 1.5, 1.7, 1.75, 2, 2.4, 2.5, 3, 4, 5];
const DENSITIES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4];
export function zoomScale(innerWidth: number, outerWidth: number, dpr: number): number {
  if (!(innerWidth > 0 && outerWidth > 0)) return 1;
  const zoom = outerWidth / innerWidth;
  const step = ZOOM_STEPS.reduce((a, b) => (Math.abs(b - zoom) < Math.abs(a - zoom) ? b : a));
  if (step === 1 || Math.abs(step - zoom) / step > 0.02) return 1;
  return DENSITIES.some((d) => Math.abs(dpr / step - d) / d < 0.02) ? 1 / step : 1;
}

const VELOCITY_MS = 50; // time constant for the velocity estimate
const MAX_LEAD_PX = 200; // caps lag correction after sudden jumps (e.g. moving between monitors)
const SETTLED_PX = 0.05;
const SETTLED_PX_PER_MS = 0.001;

export class PinFilter {
  private pos: Point;
  private raw: Point;
  private vel: Point = { x: 0, y: 0 };
  private t: number;

  constructor(raw: Point, t: number) {
    this.pos = { ...raw };
    this.raw = { ...raw };
    this.t = t;
  }

  // smoothMs: easing time constant. Its steady-state lag is cancelled, so it only shapes transients.
  step(raw: Point, t: number, smoothMs: number): { pos: Point; settled: boolean } {
    const dt = Math.max(1, t - this.t);
    this.t = t;
    const kv = 1 - Math.exp(-dt / VELOCITY_MS);
    const ks = smoothMs > 0 ? 1 - Math.exp(-dt / smoothMs) : 1;
    let settled = true;
    for (const a of ['x', 'y'] as const) {
      this.vel[a] += ((raw[a] - this.raw[a]) / dt - this.vel[a]) * kv;
      // Easing a steady ramp once per frame lags by v·dt·(1−k)/k; add that back so drags don't trail.
      const lead = Math.max(-MAX_LEAD_PX, Math.min(MAX_LEAD_PX, (this.vel[a] * dt * (1 - ks)) / ks));
      this.pos[a] += (raw[a] + lead - this.pos[a]) * ks;
      if (Math.abs(this.pos[a] - raw[a]) >= SETTLED_PX || Math.abs(this.vel[a]) >= SETTLED_PX_PER_MS) settled = false;
    }
    this.raw = { ...raw };
    if (settled) {
      this.pos = { ...raw };
      this.vel = { x: 0, y: 0 };
    }
    return { pos: { ...this.pos }, settled };
  }
}
