// Procedural oak: a flat-sawn board is a plane cut through a log's growth rings. Rings appear as
// bands along the board that arch where the cut drifts towards the pith (cathedral figure).
// Produces per-pixel albedo, gloss and fine relief; lighting lives in board.ts.
import { fbm, hash2 } from './noise';

export type RGB = [number, number, number];

export interface GrainStyle {
  early: RGB; // lighter, porous wood laid down in spring
  late: RGB; // denser, darker summer wood: the visible ring lines
  ringPx: number; // spacing between growth rings, px
  figure: number; // 0–1: how strongly rings arch into cathedrals
  pores: number; // 0–1: open-pore flecks (oak is ring-porous)
  drift: number; // 0–1: slow colour variation along the board (uneven stain uptake)
  seed: number;
}

export interface GrainMaps {
  albedo: Float32Array; // RGB 0–255 per pixel
  gloss: Float32Array; // 0–1: how much finish sheen survives here
  relief: Float32Array; // fine height: pores sunk, latewood slightly proud
}

// len: px along the grain, wid: px across. periodLen > 0 makes the pattern repeat along the length.
export function grainMaps(len: number, wid: number, s: GrainStyle, periodLen = 0): GrainMaps {
  const n = len * wid;
  const albedo = new Float32Array(n * 3), gloss = new Float32Array(n), relief = new Float32Array(n);
  const ring = Math.max(0.5, s.ringPx);
  // The log's pith sits off the board; its distance varies along the length → arches.
  const archCells = periodLen > 0 ? Math.max(1, Math.round(periodLen / (ring * 40))) : 0;
  const archScale = periodLen > 0 ? archCells / periodLen : 1 / (ring * 40);
  const pith = wid * (0.5 + (hash2(1, 2, s.seed) - 0.5) * 0.6);
  // Pore cells along the length; when periodic, sized to divide the period exactly.
  const poreCols = Math.max(1, Math.round(len / Math.max(2, ring * 1.6)));
  const poreLen = periodLen > 0 ? len / poreCols : Math.max(2, ring * 1.6);
  for (let u = 0; u < len; u++) {
    const depth = ring * (3 + 9 * s.figure * (0.5 + fbm(u * archScale, 0.5, s.seed, 2, archCells)));
    const drift = 1 + s.drift * 0.35 * fbm(u * archScale, 3.7, s.seed + 7, 2, archCells);
    for (let v = 0; v < wid; v++) {
      const i = v * len + u;
      const warp = fbm(u * archScale * 3, v / (ring * 6), s.seed + 13, 3, archCells * 3) * ring * 1.5;
      const r = Math.hypot(v - pith, depth) + warp;
      const phase = (((r / ring) % 1) + 1) % 1;
      // Earlywood eases into latewood, then breaks sharply to the next year's earlywood.
      const late = phase < 0.55 ? 0 : phase < 0.9 ? (phase - 0.55) / 0.35 : (1 - phase) / 0.1;
      const lateBand = late * late;
      // Oak pores: short dark flecks along the grain, concentrated in earlywood.
      const pu = Math.floor(u / poreLen) % (periodLen > 0 ? poreCols : Infinity), pv = Math.floor(v / Math.max(1, ring * 0.25));
      const pore = s.pores * (1 - lateBand) * (hash2(pu, pv, s.seed + 29) > 0.82 ? 0.5 + 0.5 * hash2(pu, pv, s.seed + 31) : 0);
      const tone = drift * (1 - 0.45 * pore);
      for (let c = 0; c < 3; c++) albedo[i * 3 + c] = (s.early[c] + (s.late[c] - s.early[c]) * lateBand) * tone;
      gloss[i] = (0.55 + 0.45 * lateBand) * (1 - 0.8 * pore);
      relief[i] = 0.15 * lateBand - 0.6 * pore;
    }
  }
  return { albedo, gloss, relief };
}
