// A painted finish over wood (rail, skirting). The paint hides the wood's colour, but
// latewood ridges still telegraph through as faint relief (pores are filled), long brush strokes
// leave ridged streaks along the board, layers of old paint soften the routing, and oil paint
// yellows, most in the recesses away from the light. Produces maps for shadeBoard + weather.
import type { RGB } from '../colour';
import type { GrainMaps } from './grain';
import { fbm, hash2 } from './noise';

export interface PaintStyle {
  colour: RGB;
  grain: number; // 0–1 how much grain shows through as relief
  brush: number; // 0–1 brush-stroke ridges
  yellowing: number; // 0–1 aged oil paint
  buildup: number; // 0–1 layers of old paint: soften the routing and fill the grain
  pxPerCm: number; // so strokes are the same physical size on every board
  seed: number;
}

// Brush strokes, in cm: about a loaded brush's run, and the spacing of its bristle ridges.
const STROKE_LEN_CM = 9;
const STROKE_WID_CM = 0.27;
const GRAIN_FILL = 0.6; // how much of the grain's relief full build-up fills

const YELLOWED = [1, 0.955, 0.84]; // what ageing does to a cream/white oil paint
export const PAINT_BARE: RGB = [0.72, 0.62, 0.5]; // chips show wood and old primer

// Layers of paint round off sharp routing: the profile, box-blurred across the board. The blur
// radius is physical (cm of paint build-up), so tall and short boards soften alike; sampled finely
// and interpolated so the slope has no steps for the lighting to pick out as stripes.
const SOFTEN_CM = 0.16; // blur radius at full build-up
const SAMPLE_CM = 0.02;
// The profile as softenProfile wants it: plain numbers, so a cross-section can be sent to a worker.
export function sampleProfile(profile: (t: number) => number, heightCm: number): Float32Array {
  const samples = Math.max(256, Math.ceil(heightCm / SAMPLE_CM));
  return Float32Array.from({ length: samples }, (_, i) => profile((i + 0.5) / samples));
}
export function softenProfile(raw: Float32Array, amount: number, heightCm: number): (t: number) => number {
  const samples = raw.length;
  const r = Math.round((amount * SOFTEN_CM) / (heightCm / samples));
  const soft = r <= 0 ? raw : raw.map((_, i) => {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) {
      // Beyond either end, continue the slope (odd reflection) rather than flattening it.
      const j = i + k;
      s += j < 0 ? 2 * raw[0] - raw[Math.min(samples - 1, -j)] : j >= samples ? 2 * raw[samples - 1] - raw[Math.max(0, 2 * (samples - 1) - j)] : raw[j];
      n++;
    }
    return s / n;
  });
  return (t) => {
    const x = Math.min(samples - 1, Math.max(0, t * samples - 0.5)), i = Math.floor(x), f = x - i;
    return soft[i] + (soft[Math.min(samples - 1, i + 1)] - soft[i]) * f;
  };
}

// grain: the wood under the paint (its relief is used, its colour is not). uOffset: position
// along the whole board, so adjacent lengths join seamlessly.
export function paintMaps(grain: GrainMaps, len: number, wid: number, profile: (t: number) => number, s: PaintStyle, uOffset = 0): GrainMaps {
  const n = len * wid;
  const albedo = new Float32Array(n * 3), gloss = new Float32Array(n), relief = new Float32Array(n);
  // Recesses (concave parts of the profile) yellow and dull more.
  const h = Float32Array.from({ length: wid }, (_, v) => profile((v + 0.5) / wid));
  const recess = h.map((_, v) => Math.max(0, (h[Math.max(0, v - 2)] + h[Math.min(wid - 1, v + 2)] - 2 * h[v]) * wid * 0.3));
  const strokeLen = STROKE_LEN_CM * s.pxPerCm, strokeWid = Math.max(1, STROKE_WID_CM * s.pxPerCm);
  const grainShows = s.grain * 3 * (1 - GRAIN_FILL * s.buildup);
  // A stroke now and then ends with a slight lap. Laps taper at both ends and edges like a stroke
  // thinning out, so they never form a hard edge: the taper along the board (per column) and up it
  // (per row) are worked out once each.
  const lapCol = new Float64Array(len), lapColCell = new Float64Array(len);
  for (let u = 0; u < len; u++) {
    const lx = (u + uOffset) / strokeLen;
    lapColCell[u] = Math.floor(lx);
    lapCol[u] = 0.15 * Math.sqrt(Math.sin(Math.PI * (lx - Math.floor(lx))));
  }
  for (let v = 0; v < wid; v++) {
    const yel = Math.min(1, s.yellowing * (0.6 + 1.4 * recess[v]));
    const [b0, b1, b2] = s.colour.map((c, k) => c * (1 + (YELLOWED[k] - 1) * yel));
    const lv = v / (strokeWid * 3), lvCell = Math.floor(lv), lapRow = Math.sin(Math.PI * (lv - lvCell));
    for (let u = 0; u < len; u++) {
      const i = v * len + u, x = u + uOffset;
      // Ridged streaks along the board.
      const streak = fbm(x / strokeLen, v / strokeWid, s.seed, 3);
      const lap = hash2(lapColCell[u], lvCell, s.seed + 3) > 0.9 ? lapCol[u] * lapRow : 0;
      relief[i] = Math.max(0, grain.relief[i]) * grainShows + (streak + lap) * s.brush * 0.8;
      const tone = 1 + 0.025 * s.brush * streak;
      albedo[i * 3] = b0 * tone;
      albedo[i * 3 + 1] = b1 * tone;
      albedo[i * 3 + 2] = b2 * tone;
      gloss[i] = Math.max(0, 0.85 + 0.25 * streak * s.brush - 0.5 * recess[v]);
    }
  }
  return { albedo, gloss, relief };
}
