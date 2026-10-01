// Dried water on a glossy bathroom surface, from faint droplet rings (limescale 0) to crusty
// limescale with drip trails (limescale 1). Placement is seeded per surface and clustered like
// real splashes, so no two surfaces match and nothing repeats.
import { hash2 } from '../wood/noise';

export interface SpotOptions {
  amount: number; // 0–1 how many spots
  size: number; // typical droplet radius, px
  limescale: number; // 0 water spots → 1 crusty limescale
  seed: number;
}

export interface Spot {
  x: number;
  y: number;
  r: number;
  drip: number; // px of drip trail below (vertical surfaces); 0 for none
  wobble: number; // seed for an irregular rim
}

function rng(seed: number) {
  let i = 0;
  return () => hash2(i++, seed, 0x5f0d);
}

// Splashes: cluster centres each scatter droplets with a long-tailed size mix, plus strays.
export function spotLayout(w: number, h: number, o: SpotOptions): Spot[] {
  if (o.amount <= 0 || o.size <= 0) return [];
  const rand = rng(o.seed);
  const area = (w * h) / (o.size * o.size);
  const clusters = Math.round(area * 0.0025 * o.amount * (1 + rand()));
  const strays = Math.round(area * 0.006 * o.amount);
  const spots: Spot[] = [];
  const add = (x: number, y: number) => {
    const r = o.size * (0.35 + 1.6 * rand() ** 3); // mostly small, a few large
    const drip = rand() < 0.15 + 0.35 * o.limescale ? r * (2 + 10 * rand()) * (0.3 + o.limescale) : 0;
    spots.push({ x, y, r, drip, wobble: Math.floor(rand() * 1e6) });
  };
  for (let c = 0; c < clusters; c++) {
    const cx = rand() * w, cy = rand() * h, spread = o.size * (4 + 12 * rand());
    const n = 3 + Math.floor(rand() * 10);
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2, d = spread * Math.sqrt(rand());
      add(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    }
  }
  for (let k = 0; k < strays; k++) add(rand() * w, rand() * h);
  return spots;
}

type Ctx = CanvasRenderingContext2D;

function rim(ctx: Ctx, s: Spot, grow: number) {
  ctx.beginPath();
  const steps = 18;
  for (let k = 0; k <= steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    const rr = (s.r + grow) * (0.85 + 0.3 * hash2(s.wobble, k % steps, 3));
    const px = s.x + Math.cos(a) * rr, py = s.y + Math.sin(a) * rr;
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

// Draws onto ctx in its current units. Mineral rims read on light and dark grounds alike: a
// pale deposit with a faint darker refraction edge just inside it.
export function drawSpots(ctx: Ctx, spots: Spot[], o: SpotOptions) {
  const L = o.limescale;
  for (const s of spots) {
    if (s.drip > 0) {
      const g = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.drip);
      g.addColorStop(0, `rgba(245,247,245,${0.12 + 0.3 * L})`);
      g.addColorStop(1, 'rgba(245,247,245,0)');
      ctx.fillStyle = g;
      const dw = s.r * (0.35 + 0.3 * L);
      ctx.fillRect(s.x - dw / 2, s.y, dw, s.drip);
    }
    rim(ctx, s, 0);
    ctx.fillStyle = `rgba(225,230,228,${0.08 + 0.45 * L * L})`; // faint film → crust
    ctx.fill();
    ctx.lineWidth = s.r * (0.16 + 0.35 * L);
    ctx.strokeStyle = `rgba(250,252,250,${0.35 + 0.4 * L})`; // mineral deposit at the rim
    ctx.stroke();
    rim(ctx, s, -ctx.lineWidth * 0.9);
    ctx.lineWidth = s.r * 0.1;
    ctx.strokeStyle = `rgba(60,70,68,${0.22 * (1 - 0.6 * L)})`; // refraction edge: shows on light grounds
    ctx.stroke();
  }
}
