// Age on a finished board, applied to its maps before lighting. Raised, convex parts of the
// profile get rubbed (finish worn through: paler, duller); low, concave parts and mitre joints
// collect grime (darker, greyer, matte). Both come and go in patches along the length.
import type { RGB } from '../colour';
import type { GrainMaps } from './grain';
import { clamp01, fbm } from './noise';

export interface Wear {
  wear: number; // 0–1 rubbing on high points
  grime: number; // 0–1 dirt in recesses and joints
  patches: number; // 0–1 how uneven both are along the board
  mitres: boolean; // dirt collects along 45° joints at both ends (frames)
  seed: number;
  bare?: RGB; // what wear reveals, as a colour multiplier (default: varnish rubbed off, paler)
}

const BARE = [1.45, 1.38, 1.3]; // finish rubbed off: paler, less amber
const DIRT = [0.62, 0.6, 0.58]; // grime: darker, slightly grey

// Convexity and height per row across the board, from the profile.
function profileShape(profile: (t: number) => number, wid: number) {
  const h = Float32Array.from({ length: wid }, (_, v) => profile((v + 0.5) / wid));
  const convex = Float32Array.from({ length: wid }, (_, v) => {
    const a = h[Math.max(0, v - 2)], b = h[Math.min(wid - 1, v + 2)];
    return (2 * h[v] - a - b) * wid * 0.25; // positive on ridges, negative in hollows
  });
  return { h, convex };
}

export function weather(maps: GrainMaps, len: number, wid: number, profile: (t: number) => number, w: Wear, periodLen = 0, uOffset = 0): GrainMaps {
  const bare = w.bare ?? BARE;
  if (w.wear <= 0 && w.grime <= 0) return maps;
  const { h, convex } = profileShape(profile, wid);
  const cells = periodLen > 0 ? Math.max(1, Math.round(periodLen / (wid * 2))) : 0;
  const scale = periodLen > 0 ? cells / periodLen : 1 / (wid * 2);
  const jointWidth = Math.max(1, wid * 0.08);
  // How much each row's shape invites rubbing and grime (the same down every column).
  const rubRow = Float64Array.from({ length: wid }, (_, v) => clamp01(convex[v] * 1.5 + (h[v] - 0.85) * 2) * w.wear);
  const dirtRow = Float64Array.from({ length: wid }, (_, v) => clamp01(-convex[v] * 1.5 + (0.55 - h[v]) * 1.5) * w.grime);
  // Distance to a mitre line is a whole number of px: its falloff tabulated once.
  const falloff = w.mitres ? Float64Array.from({ length: Math.max(len, wid) + 1 }, (_, d) => Math.exp(-d / jointWidth)) : undefined;
  const [b0, b1, b2] = bare, [d0, d1, d2] = DIRT;
  for (let u = 0; u < len; u++) {
    const patch = 1 + w.patches * 1.6 * fbm((u + uOffset) * scale, 0.3, w.seed, 3, cells);
    const inverse = 2 - patch;
    for (let v = 0; v < wid; v++) {
      const i = v * len + u;
      let rub = rubRow[v] * patch;
      let dirt = dirtRow[v] * inverse;
      if (falloff) {
        const d = Math.min(Math.abs(u - v), Math.abs(len - 1 - u - v)); // distance to either mitre line
        const near = falloff[d];
        dirt += near * w.grime * 0.8;
        rub *= 1 - near;
      }
      rub = clamp01(rub);
      dirt = clamp01(dirt);
      const k = i * 3;
      maps.albedo[k] = maps.albedo[k] * (1 + (b0 - 1) * rub) * (1 + (d0 - 1) * dirt);
      maps.albedo[k + 1] = maps.albedo[k + 1] * (1 + (b1 - 1) * rub) * (1 + (d1 - 1) * dirt);
      maps.albedo[k + 2] = maps.albedo[k + 2] * (1 + (b2 - 1) * rub) * (1 + (d2 - 1) * dirt);
      maps.gloss[i] *= (1 - 0.6 * rub) * (1 - 0.8 * dirt);
    }
  }
  return maps;
}
