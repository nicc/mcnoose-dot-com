// Knocks on a skirting, built up over years: a patchy grey rub line along the floor from mops and
// vacuum heads, short curved black shoe scuffs, and small chips showing wood. `low` sets how much the
// scuffs and chips cluster at the floor (1) rather than spreading up the face from kicks and knocks
// (0). Only the flat face is marked. Seeded in wall coordinates (u0 = where this length starts), so
// lengths join and nothing repeats.
import type { GrainMaps } from '../wood/grain';
import { clamp01, fbm, hash2 } from '../wood/noise';
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

export function scuff(maps: GrainMaps, len: number, wid: number, s: Scuffs, u0: number, pxPerCm: number, seed: number): GrainMaps {
  if (s.amount <= 0) return maps;
  const face = wid - s.faceTop, streakCell = STREAK_CELL_CM * pxPerCm, chipCell = CHIP_CELL_CM * pxPerCm;
  const spread = 1 + 4 * s.low; // scuff heights: face × h^spread, so they gather at the floor as low rises
  const h = (c: number, k: number) => hash2(c, k, seed + 2);
  const top = Math.max(0, s.faceTop);

  // Everything that varies only along the wall, worked out once per column.
  // The rub line's patchiness; and each column's three candidate shoe scuffs (the cell it's in and
  // its neighbours): where along the scuff this column falls, and the scuff's height, thickness and
  // bend, so each row only has to measure its distance across the stroke.
  const rubAlong = new Float64Array(len);
  const STRIDE = 5, cand = new Float64Array(len * 3 * STRIDE); // per column, per candidate: sqrt(along), yc, th, offset, strength (sqrt(along) 0 = none)
  for (let u = 0; u < len; u++) {
    const x = u + u0;
    rubAlong[u] = clamp01(0.5 + 2 * fbm(x / (8 * pxPerCm), 0.5, seed + 5, 3));
    const sc = Math.floor(x / streakCell);
    for (let j = 0; j < 3; j++) {
      const c = sc - 1 + j, at = (u * 3 + j) * STRIDE;
      if (h(c, 0) >= 0.8 * s.amount) continue;
      const half = (1 + 2.5 * h(c, 1)) * pxPerCm, xc = (c + h(c, 2)) * streakCell, t = (x - xc) / half;
      const along = 1 - t * t;
      if (along <= 0) continue;
      cand[at] = Math.sqrt(along);
      cand[at + 1] = Math.max(s.faceTop + 2, wid - 1 - face * h(c, 3) ** spread);
      cand[at + 2] = (0.06 + 0.1 * h(c, 4)) * pxPerCm;
      cand[at + 3] = (h(c, 6) - 0.5) * 0.6 * pxPerCm * t * t + (h(c, 7) - 0.5) * 0.15 * (x - xc);
      cand[at + 4] = 0.5 + 0.5 * h(c, 5);
    }
  }

  const [r0, r1, r2] = RUB, [s0, s1, s2] = STREAK, [p0, p1, p2] = PAINT_BARE;
  for (let v = top; v < wid; v++) {
    const above = (wid - v) / pxPerCm; // cm above the floor
    const density = 1 - s.low + s.low * Math.exp(-above / CLUSTER_CM);
    // Rub line: patchy along the floor edge.
    const rubRow = s.amount * (0.3 + 0.7 * s.low) * clamp01(1 - above / RUB_CM) ** 0.7;
    const cy = Math.floor(v / (chipCell * 0.5)), chipChance = 0.05 * s.amount * density, vInCell = v % (chipCell * 0.5) - chipCell * 0.25;
    let chipCol = NaN, chipHit = false, chipX = 0; // the chip cell this column is in, looked up as it changes
    for (let u = 0; u < len; u++) {
      const x = u + u0, i = v * len + u;
      const rub = rubRow * rubAlong[u];
      // Shoe scuffs: short, thin, slightly curved and slanted, tapered at both ends.
      let streak = 0;
      for (let j = 0; j < 3; j++) {
        const at = (u * 3 + j) * STRIDE, root = cand[at];
        if (root === 0) continue;
        const across = (v - cand[at + 1] - cand[at + 3]) / cand[at + 2];
        streak = Math.max(streak, root * Math.exp(-across * across) * cand[at + 4]);
      }
      // Chips: small, soft-edged, where the paint was knocked off.
      const cx = Math.floor(x / chipCell);
      if (cx !== chipCol) {
        chipCol = cx;
        chipHit = hash2(cx, cy, seed) < chipChance;
        if (chipHit) chipX = chipCell * hash2(cx, cy, seed + 1);
      }
      const chip = chipHit ? Math.max(0, 1 - Math.hypot((x % chipCell) - chipX, vInCell) / (0.25 * pxPerCm)) : 0;
      const k = i * 3;
      maps.albedo[k] = maps.albedo[k] * (1 + (r0 - 1) * rub) * (1 + (s0 - 1) * streak) * (1 + (p0 - 1) * chip);
      maps.albedo[k + 1] = maps.albedo[k + 1] * (1 + (r1 - 1) * rub) * (1 + (s1 - 1) * streak) * (1 + (p1 - 1) * chip);
      maps.albedo[k + 2] = maps.albedo[k + 2] * (1 + (r2 - 1) * rub) * (1 + (s2 - 1) * streak) * (1 + (p2 - 1) * chip);
      maps.gloss[i] *= (1 - 0.5 * rub) * (1 - 0.6 * streak);
    }
  }
  return maps;
}
