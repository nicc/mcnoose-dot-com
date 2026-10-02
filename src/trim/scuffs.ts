// Knocks on a skirting, built up over years: a patchy grey rub line along the floor from mops and
// vacuum heads, short curved black shoe scuffs, and small chips showing wood. `low` sets how much the
// scuffs and chips cluster at the floor (1) rather than spreading up the face from kicks and knocks
// (0). Only the flat face is marked. Seeded in wall coordinates (u0 = where this length starts), so
// lengths join and nothing repeats.
import type { GrainMaps } from '../wood/grain';
import { fbm, hash2 } from '../wood/noise';
import { PAINT_BARE } from '../wood/paint';

export interface Scuffs {
  amount: number; // 0–1
  low: number; // 0–1 clustering at the floor
  faceTop: number; // row where the flat face begins
}

const RUB = [0.8, 0.78, 0.74]; // grey-brown dirt
const STREAK = [0.42, 0.4, 0.38]; // black rubber from shoe soles
const RUB_CM = 1.5; // height of the rub line
const STREAK_CELL_CM = 14; // at most one shoe scuff per cell
const CHIP_CELL_CM = 3;
const CLUSTER_CM = 3; // how fast floor-clustered marks thin out going up

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function scuff(maps: GrainMaps, len: number, wid: number, s: Scuffs, u0: number, pxPerCm: number, seed: number): GrainMaps {
  if (s.amount <= 0) return maps;
  const face = wid - s.faceTop, streakCell = STREAK_CELL_CM * pxPerCm, chipCell = CHIP_CELL_CM * pxPerCm;
  const spread = 1 + 4 * s.low; // scuff heights: face × h^spread, so they gather at the floor as low rises
  const h = (c: number, k: number) => hash2(c, k, seed + 2);
  for (let v = Math.max(0, s.faceTop); v < wid; v++) {
    const above = (wid - v) / pxPerCm; // cm above the floor
    const density = 1 - s.low + s.low * Math.exp(-above / CLUSTER_CM);
    for (let u = 0; u < len; u++) {
      const x = u + u0, i = v * len + u;
      // Rub line: patchy along the floor edge.
      const rub = s.amount * (0.3 + 0.7 * s.low) * clamp01(1 - above / RUB_CM) ** 0.7 * clamp01(0.5 + 2 * fbm(x / (8 * pxPerCm), 0.5, seed + 5, 3));
      // Shoe scuffs: short, thin, slightly curved and slanted, tapered at both ends.
      let streak = 0;
      const sc = Math.floor(x / streakCell);
      for (let c = sc - 1; c <= sc + 1; c++) {
        if (h(c, 0) >= 0.8 * s.amount) continue;
        const half = (1 + 2.5 * h(c, 1)) * pxPerCm, xc = (c + h(c, 2)) * streakCell, t = (x - xc) / half;
        const along = 1 - t * t;
        if (along <= 0) continue;
        const yc = Math.max(s.faceTop + 2, wid - 1 - face * h(c, 3) ** spread), th = (0.06 + 0.1 * h(c, 4)) * pxPerCm;
        const offset = (h(c, 6) - 0.5) * 0.6 * pxPerCm * t * t + (h(c, 7) - 0.5) * 0.15 * (x - xc);
        const across = (v - yc - offset) / th;
        streak = Math.max(streak, Math.sqrt(along) * Math.exp(-across * across) * (0.5 + 0.5 * h(c, 5)));
      }
      // Chips: small, soft-edged, where the paint was knocked off.
      const cx = Math.floor(x / chipCell), cy = Math.floor(v / (chipCell * 0.5));
      const chip = hash2(cx, cy, seed) < 0.05 * s.amount * density ? Math.max(0, 1 - Math.hypot((x % chipCell) - chipCell * hash2(cx, cy, seed + 1), (v % (chipCell * 0.5)) - chipCell * 0.25) / (0.25 * pxPerCm)) : 0;
      for (let k = 0; k < 3; k++) {
        const a = maps.albedo[i * 3 + k];
        maps.albedo[i * 3 + k] = a * (1 + (RUB[k] - 1) * rub) * (1 + (STREAK[k] - 1) * streak) * (1 + (PAINT_BARE[k] - 1) * chip);
      }
      maps.gloss[i] *= (1 - 0.5 * rub) * (1 - 0.6 * streak);
    }
  }
  return maps;
}
