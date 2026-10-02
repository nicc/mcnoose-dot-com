// A painted finish over wood (rail now, skirting later). The paint hides the wood's colour, but
// latewood ridges still telegraph through as faint relief (pores are filled), long brush strokes
// leave ridged streaks along the board, layers of old paint soften the routing, and oil paint
// yellows, most in the recesses away from the light. Produces maps for shadeBoard + weather.
import type { GrainMaps, RGB } from './grain';
import { fbm, hash2 } from './noise';

export interface PaintStyle {
  colour: RGB;
  grain: number; // 0–1 how much grain shows through as relief
  brush: number; // 0–1 brush-stroke ridges
  yellowing: number; // 0–1 aged oil paint
  seed: number;
}

const YELLOWED = [1, 0.955, 0.84]; // what ageing does to a cream/white oil paint
export const PAINT_BARE: [number, number, number] = [0.72, 0.62, 0.5]; // chips show wood and old primer

// Layers of paint round off sharp routing: the profile, box-blurred across the board.
export function softenProfile(profile: (t: number) => number, amount: number, samples = 256): (t: number) => number {
  const raw = Float32Array.from({ length: samples }, (_, i) => profile((i + 0.5) / samples));
  const r = Math.round(amount * samples * 0.03);
  const soft = r <= 0 ? raw : raw.map((_, i) => {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) {
      const j = Math.min(samples - 1, Math.max(0, i + k));
      s += raw[j];
      n++;
    }
    return s / n;
  });
  return (t) => soft[Math.min(samples - 1, Math.max(0, Math.floor(t * samples)))];
}

// grain: the wood under the paint (its relief is used, its colour is not). uOffset: position
// along the whole board, so adjacent lengths join seamlessly.
export function paintMaps(grain: GrainMaps, len: number, wid: number, profile: (t: number) => number, s: PaintStyle, uOffset = 0): GrainMaps {
  const n = len * wid;
  const albedo = new Float32Array(n * 3), gloss = new Float32Array(n), relief = new Float32Array(n);
  // Recesses (concave parts of the profile) yellow and dull more.
  const h = Float32Array.from({ length: wid }, (_, v) => profile((v + 0.5) / wid));
  const recess = h.map((_, v) => Math.max(0, (h[Math.max(0, v - 2)] + h[Math.min(wid - 1, v + 2)] - 2 * h[v]) * wid * 0.3));
  const strokeLen = wid * 2.5, strokeWid = Math.max(1, wid / 14);
  for (let v = 0; v < wid; v++) {
    const yel = Math.min(1, s.yellowing * (0.6 + 1.4 * recess[v]));
    const base = s.colour.map((c, k) => c * (1 + (YELLOWED[k] - 1) * yel));
    for (let u = 0; u < len; u++) {
      const i = v * len + u, x = u + uOffset;
      // Ridged streaks along the board; a stroke now and then ends with a slight lap.
      const streak = fbm(x / strokeLen, v / strokeWid, s.seed, 3);
      const lap = hash2(Math.floor(x / strokeLen), Math.floor(v / (strokeWid * 3)), s.seed + 3) > 0.9 ? 0.15 : 0;
      relief[i] = Math.max(0, grain.relief[i]) * s.grain * 3 + (streak + lap) * s.brush * 0.8;
      const tone = 1 + 0.025 * s.brush * streak;
      for (let c = 0; c < 3; c++) albedo[i * 3 + c] = base[c] * tone;
      gloss[i] = Math.max(0, 0.85 + 0.25 * streak * s.brush - 0.5 * recess[v]);
    }
  }
  return { albedo, gloss, relief };
}
