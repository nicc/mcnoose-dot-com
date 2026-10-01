// Smooths screen pinning. The OS moves window content a frame or two before the page can
// correct, so raw tracking snaps. Velocity prediction leads the reported position by roughly
// that latency; easing absorbs the overshoot when a drag stops. Frame-rate independent.

export interface Point {
  x: number;
  y: number;
}

const VELOCITY_MS = 50; // time constant for the velocity estimate
const MAX_LEAD_PX = 200; // caps prediction after sudden jumps (e.g. moving between monitors)
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

  // predictMs: how far ahead of the reported position the wall sits during a steady drag.
  // smoothMs: easing time constant. Its steady-state lag is cancelled, so it only shapes transients.
  step(raw: Point, t: number, predictMs: number, smoothMs: number): { pos: Point; settled: boolean } {
    const dt = Math.max(1, t - this.t);
    this.t = t;
    const kv = 1 - Math.exp(-dt / VELOCITY_MS);
    const ks = smoothMs > 0 ? 1 - Math.exp(-dt / smoothMs) : 1;
    let settled = true;
    for (const a of ['x', 'y'] as const) {
      this.vel[a] += ((raw[a] - this.raw[a]) / dt - this.vel[a]) * kv;
      // Easing a steady ramp once per frame lags by v·dt·(1−k)/k; add that back plus the prediction.
      const lead = Math.max(-MAX_LEAD_PX, Math.min(MAX_LEAD_PX, this.vel[a] * (predictMs + (dt * (1 - ks)) / ks)));
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
