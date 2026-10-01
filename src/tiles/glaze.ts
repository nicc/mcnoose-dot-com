// What time does to a glazed tile: crazing (a network of hairline cracks, dirt settled in them)
// and dried water marks that build towards limescale on the lowest rows. Seeded by the tile's wall
// position, so no two tiles match.
import { drawSpots, spotLayout } from '../surface/spots';
import { hash2 } from '../wood/noise';

export interface Ageing {
  crazing: number; // 0–1
  spots: number; // 0–1 water marks on this tile
  limescale: number; // 0–1 on this tile
  spotSize: number; // px
  dust?: number; // 0–1 dust settled along the top edge (a ledge, like the bull-nose)
}

// How bad a tile is by its distance above the skirting: worst on the bottom row, easing to the
// base level `rows` rows up. Returns 0 (top of the wall) … 1 (bottom row).
export function grimeLevel(rowsFromBottom: number, rows: number): number {
  return rows <= 0 ? 0 : Math.max(0, 1 - rowsFromBottom / rows) ** 1.5;
}

export function drawCrazing(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  if (amount <= 0) return;
  const cell = Math.max(8, Math.min(w, h) / 9);
  const cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
  const pt = (i: number, j: number): [number, number] => [(i + (hash2(i, j, seed) - 0.5) * 0.8) * cell, (j + (hash2(i, j, seed + 1) - 0.5) * 0.8) * cell];
  const crack = (a: [number, number], b: [number, number], k: number) => {
    const mx = (a[0] + b[0]) / 2 + (hash2(k, 3, seed) - 0.5) * cell * 0.35, my = (a[1] + b[1]) / 2 + (hash2(k, 4, seed) - 0.5) * cell * 0.35;
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(mx, my, b[0], b[1]);
  };
  ctx.beginPath();
  let k = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      if (hash2(i, j, seed + 2) < 0.72) crack(pt(i, j), pt(i + 1, j), k++);
      if (hash2(i, j, seed + 5) < 0.72) crack(pt(i, j), pt(i, j + 1), k++);
    }
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = `rgba(90,75,55,${(0.16 * amount).toFixed(3)})`; // dirt settled in the cracks
  ctx.stroke();
  ctx.save();
  ctx.translate(0.6, 0.6);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = `rgba(255,255,255,${(0.25 * amount).toFixed(3)})`; // the crack's lit lip
  ctx.stroke();
  ctx.restore();
}

// A tile's ageing layer, w×h CSS px at the given pixel density.
export function drawAgeing(canvas: HTMLCanvasElement, w: number, h: number, dpr: number, a: Ageing, seed: number) {
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawCrazing(ctx, w, h, a.crazing, seed);
  const spots = { amount: a.spots, size: a.spotSize, limescale: a.limescale, seed: seed + 11 };
  drawSpots(ctx, spotLayout(w, h, spots), spots);
  if (a.dust) {
    // Dust settles on the ledge: fine specks thickest at the very top, a faint grey haze.
    const band = h * 0.14;
    const haze = ctx.createLinearGradient(0, 0, 0, band);
    haze.addColorStop(0, `rgba(120,110,95,${(0.16 * a.dust).toFixed(3)})`);
    haze.addColorStop(1, 'rgba(120,110,95,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, band);
    const specks = Math.round(w * 1.2 * a.dust);
    for (let i = 0; i < specks; i++) {
      const y = band * Math.pow(hash2(i, 1, seed + 23), 2); // most near the top
      ctx.fillStyle = `rgba(95,85,70,${(0.2 + 0.35 * hash2(i, 2, seed + 23)).toFixed(3)})`;
      const r = 0.3 + 0.7 * hash2(i, 3, seed + 23);
      ctx.fillRect(hash2(i, 4, seed + 23) * w, y, r, r);
    }
  }
  if (a.limescale > 0.3) {
    // Drips stop at the grout below: a faint crust along the tile's bottom edge.
    const g = ctx.createLinearGradient(0, h, 0, h - h * 0.08);
    g.addColorStop(0, `rgba(245,247,244,${(0.5 * (a.limescale - 0.3)).toFixed(3)})`);
    g.addColorStop(1, 'rgba(245,247,244,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.92, w, h * 0.08);
  }
}
