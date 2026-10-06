// Old grout: discolouration and grime (dirtier in horizontal joints and low down), mould at the
// crossings and a limescale crust along the lower horizontals, and erosion (worn edges, crumbled
// crossings, soft pitting) with the odd hairline crack. Planned as soft marks per joint, seeded by
// wall position, then drawn clipped to the joint so nothing spills onto the tile faces.
import type { RGB } from '../colour';
import { hash2 } from '../wood/noise';

export interface GroutAge {
  age: number; // 0–1 yellowing/greying
  grime: number; // 0–1 dirt, more in horizontals and low down
  mould: number; // 0–1 dark spots at low crossings
  limescale: number; // 0–1 crust along low horizontals
  erosion: number; // 0–1 worn edges, crumbled crossings, pitting
  cracks: number; // 0–1 hairline cracks
  level: number; // 0 high on the wall … 1 bottom row
}

export interface Joint {
  x: number;
  y: number;
  w: number;
  h: number;
  horizontal: boolean;
}

export type Mark =
  | { kind: 'band'; joint: number; colour: RGB; stops: [number, number][] } // [position 0–1 along, alpha]
  | { kind: 'dot'; joint: number; x: number; y: number; r: number; colour: RGB; alpha: number }
  | { kind: 'line'; joint: number; points: [number, number][]; width: number; colour: RGB; alpha: number };

const AGED: RGB = [170, 150, 108];
const GRIME: RGB = [72, 64, 52];
const MOULD: RGB = [34, 40, 31];
const LIME: RGB = [246, 247, 241];
const PIT_DARK: RGB = [80, 76, 68];
const PIT_LIGHT: RGB = [238, 236, 228];

export function groutMarks(joints: Joint[], g: number, a: GroutAge, seed: number): Mark[] {
  const marks: Mark[] = [];
  const rand = (i: number, k: number) => hash2(i, k, seed);
  joints.forEach((j, ji) => {
    const len = j.horizontal ? j.w : j.h;
    const along = (t: number): [number, number] => (j.horizontal ? [j.x + t * j.w, j.y + j.h / 2] : [j.x + j.w / 2, j.y + t * j.h]);
    const n = Math.max(3, Math.round(len / (g * 4)));
    const stops = (k: number, amount: number): [number, number][] =>
      Array.from({ length: n + 1 }, (_, s) => [s / n, amount * (0.35 + 0.65 * rand(ji * 97 + s, k))] as [number, number]);

    // Discolouration: uneven along each joint.
    if (a.age > 0) marks.push({ kind: 'band', joint: ji, colour: AGED, stops: stops(1, 0.4 * a.age) });
    // Grime: water lingers and dust settles on horizontals; worse low down.
    if (a.grime > 0) marks.push({ kind: 'band', joint: ji, colour: GRIME, stops: stops(2, a.grime * (j.horizontal ? 0.4 : 0.18) * (0.5 + a.level)) });
    // Limescale crust along low horizontals.
    if (a.limescale > 0 && j.horizontal && a.level > 0) marks.push({ kind: 'band', joint: ji, colour: LIME, stops: stops(3, 0.6 * a.limescale * a.level) });

    // Erosion: worn-back edges (thin soft lines wobbling along both sides) and pitting.
    if (a.erosion > 0) {
      for (const side of [0.18, 0.82]) {
        const pts: [number, number][] = [];
        for (let s = 0; s <= n; s++) {
          const t = s / n, wob = (rand(ji * 131 + s, side > 0.5 ? 4 : 5) - 0.5) * g * 0.3;
          pts.push(j.horizontal ? [j.x + t * j.w, j.y + side * j.h + wob] : [j.x + side * j.w + wob, j.y + t * j.h]);
        }
        marks.push({ kind: 'line', joint: ji, points: pts, width: Math.max(0.4, g * 0.15), colour: PIT_DARK, alpha: 0.35 * a.erosion });
      }
      const pits = Math.round((len / g) * 1.2 * a.erosion);
      for (let p = 0; p < pits; p++) {
        const [x, y] = along(rand(ji * 211 + p, 6));
        const off = (rand(ji * 211 + p, 7) - 0.5) * g * 0.6;
        marks.push({
          kind: 'dot', joint: ji,
          x: j.horizontal ? x : x + off, y: j.horizontal ? y + off : y,
          r: g * (0.15 + 0.25 * rand(ji * 211 + p, 8)),
          colour: rand(ji * 211 + p, 9) < 0.6 ? PIT_DARK : PIT_LIGHT,
          alpha: 0.12 + 0.18 * a.erosion,
        });
      }
      // The crossing at this joint's start crumbles first.
      if (rand(ji, 10) < 0.5 * a.erosion) marks.push({ kind: 'dot', joint: ji, x: j.x + g / 2, y: j.y + g / 2, r: g * 0.75, colour: PIT_DARK, alpha: 0.3 * a.erosion });
    }

    // Hairline crack along part of the joint.
    if (rand(ji, 11) < 0.45 * a.cracks) {
      const t0 = rand(ji, 12) * 0.6, t1 = t0 + 0.15 + rand(ji, 13) * 0.3;
      const pts: [number, number][] = [];
      for (let s = 0; s <= 6; s++) {
        const [x, y] = along(t0 + ((t1 - t0) * s) / 6), wob = (rand(ji * 17 + s, 14) - 0.5) * g * 0.5;
        pts.push(j.horizontal ? [x, y + wob] : [x + wob, y]);
      }
      marks.push({ kind: 'line', joint: ji, points: pts, width: 0.35, colour: [40, 36, 30], alpha: 0.45 * a.cracks });
    }

    // Mould: small dark spots clustered at the crossing, low on the wall.
    if (a.mould > 0 && a.level > 0.15) {
      const spots = Math.round(10 * a.mould * a.level * rand(ji, 15));
      for (let m = 0; m < spots; m++) {
        const d = g * 2.5 * rand(ji * 59 + m, 16) ** 1.5;
        const [x, y] = j.horizontal ? [j.x + d, j.y + j.h * rand(ji * 59 + m, 17)] : [j.x + j.w * rand(ji * 59 + m, 17), j.y + d];
        marks.push({ kind: 'dot', joint: ji, x, y, r: g * (0.12 + 0.2 * rand(ji * 59 + m, 18)), colour: MOULD, alpha: 0.35 + 0.35 * rand(ji * 59 + m, 19) });
      }
    }
  });
  return marks;
}

const rgba = ([r, g, b]: RGB, a: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

export function drawGrout(ctx: CanvasRenderingContext2D, joints: Joint[], marks: Mark[]) {
  joints.forEach((j, ji) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(j.x, j.y, j.w, j.h);
    ctx.clip();
    for (const m of marks) {
      if (m.joint !== ji) continue;
      if (m.kind === 'band') {
        const g = j.horizontal ? ctx.createLinearGradient(j.x, 0, j.x + j.w, 0) : ctx.createLinearGradient(0, j.y, 0, j.y + j.h);
        for (const [t, a] of m.stops) g.addColorStop(t, rgba(m.colour, a));
        ctx.fillStyle = g;
        ctx.fillRect(j.x, j.y, j.w, j.h);
      } else if (m.kind === 'dot') {
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
        g.addColorStop(0, rgba(m.colour, m.alpha));
        g.addColorStop(1, rgba(m.colour, 0));
        ctx.fillStyle = g;
        ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      } else {
        ctx.beginPath();
        m.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.lineWidth = m.width;
        ctx.lineCap = 'round';
        ctx.strokeStyle = rgba(m.colour, m.alpha);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}
