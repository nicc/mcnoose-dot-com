// Knocks on a skirting: smudged scuffs from shoes and vacuum heads, longest along the board, plus
// the odd paint chip showing wood — concentrated low on the face. Seeded in wall coordinates
// (u0 = where this length starts), so lengths join and nothing repeats.
import type { GrainMaps } from '../wood/grain';
import { fbm, hash2 } from '../wood/noise';
import { PAINT_BARE } from '../wood/paint';

const SMUDGE = [0.8, 0.78, 0.74]; // grey-brown dirt
const STREAK = [0.42, 0.4, 0.38]; // black rubber from shoe soles

export function scuff(maps: GrainMaps, len: number, wid: number, amount: number, u0: number, pxPerCm: number, seed: number): GrainMaps {
  if (amount <= 0) return maps;
  const cell = 3 * pxPerCm; // chips placed per ~3cm
  const streakCell = 18 * pxPerCm; // at most one shoe streak per ~18cm
  for (let v = 0; v < wid; v++) {
    const low = Math.max(0, (v / wid - 0.45) / 0.55); // 0 above the lower half, 1 at the floor
    if (low <= 0) continue;
    for (let u = 0; u < len; u++) {
      const x = u + u0, i = v * len + u;
      // Smudges: stretched noise along the board; more of the face is covered as amount rises.
      const n = fbm(x / (12 * pxPerCm), v / (1.5 * pxPerCm), seed, 3);
      const smudge = Math.max(0, Math.min(1, (n - 0.28 + 0.22 * amount) * 4)) * low;
      // Shoe streaks: short, thin, dark, tapered at both ends, mostly in the bottom third.
      let streak = 0;
      const sc = Math.floor(x / streakCell);
      for (let c = sc - 1; c <= sc + 1; c++) {
        if (hash2(c, 0, seed + 2) >= 0.7 * amount) continue;
        const half = (1 + 3 * hash2(c, 1, seed + 2)) * pxPerCm;
        const xc = (c + hash2(c, 2, seed + 2)) * streakCell;
        const yc = wid * (0.66 + 0.3 * hash2(c, 3, seed + 2)), th = (0.08 + 0.12 * hash2(c, 4, seed + 2)) * pxPerCm;
        const along = 1 - ((x - xc) / half) ** 2;
        if (along <= 0) continue;
        const across = (v - yc - (x - xc) * 0.04) / th; // a slight slant
        streak = Math.max(streak, Math.sqrt(along) * Math.exp(-across * across) * (0.5 + 0.5 * hash2(c, 5, seed + 2)));
      }
      // Chips: small, crisp-ish, mostly near the floor.
      const c = Math.floor(x / cell), r = Math.floor(v / (cell * 0.5));
      const chip = hash2(c, r, seed) < 0.05 * amount * low ? Math.max(0, 1 - Math.hypot((x % cell) - cell * hash2(c, r, seed + 1), v % (cell * 0.5) - cell * 0.25) / (0.25 * pxPerCm)) : 0;
      for (let k = 0; k < 3; k++) {
        const a = maps.albedo[i * 3 + k];
        maps.albedo[i * 3 + k] = a * (1 + (SMUDGE[k] - 1) * smudge) * (1 + (STREAK[k] - 1) * streak) * (1 + (PAINT_BARE[k] - 1) * chip);
      }
      maps.gloss[i] *= (1 - 0.5 * smudge) * (1 - 0.6 * streak);
    }
  }
  return maps;
}
