// The wall as an architect's pencil elevation, drawn by hand: a list of strokes in the order a person
// would make them, each a ruled gesture with its own pace. Structure only, never light: the frame
// (guides, its outer and sight edges, the mitres), the rail's and skirting's edges, the tile joints
// spreading out from under the frame. Pure: boot.ts puts them on the page and times them.
import type { Config } from '../config';
import type { WallPlan } from '../plan';

export type Part = 'frame' | 'rail' | 'tiles' | 'skirting';

export interface Stroke {
  part: Part;
  x0: number; // page px, drawn from 0 towards 1
  y0: number;
  x1: number;
  y1: number;
  width: number; // css px
  alpha: number;
  pair: number; // > 0: a grout joint, two lines this far apart (centre to centre)
  ms: number; // drawing time
  gap: number; // pen up before it, ms
  ease: string; // CSS easing of the stroke's progress: a hand speeds up into a line and settles at its end
}

type Kind = 'guide' | 'firm' | 'flick';
const MERGE_PX = 3;

// A hand at work: lines never quite on the mark, never quite the same weight, and a pace that
// finds its rhythm through a run of similar strokes and drops it between parts.
function hand(c: Config, tile: number, rand: () => number) {
  const between = (a: number, b: number) => a + (b - a) * rand();
  const over = c.PENCIL_OVERSHOOT * tile;
  const strokes: Stroke[] = [];
  let run = 0, pause = 0, part: Part = 'frame';

  const begin = (p: Part) => {
    part = p;
    run = 0;
    pause = strokes.length ? c.PENCIL_PAUSE_MS * between(0.8, 1.3) : 0;
  };

  const line = (x0: number, y0: number, x1: number, y1: number, kind: Kind, o: { pair?: number; weight?: number; reversible?: boolean } = {}) => {
    if (o.reversible !== false && kind === 'firm' && rand() < 0.15) [x0, y0, x1, y1] = [x1, y1, x0, y0];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.5) return;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    // Past the corner (or, now and then, just short of it), and a little off the mark sideways.
    const reach = () => (kind === 'guide' ? between(3, 8) : kind === 'flick' ? between(-0.2, 0.5) : between(-0.3, 1)) * over;
    // (Not a line that runs true: off its axis by a fraction of a pixel, it rasterises as a stair-step.)
    const ruled = Math.abs(ux) < 1e-6 || Math.abs(uy) < 1e-6;
    const off = () => (ruled ? 0 : between(-0.35, 0.35));
    const [a, b, s0, s1] = [reach(), reach(), off(), off()];
    const stroke: Stroke = {
      part,
      x0: x0 - ux * a - uy * s0,
      y0: y0 - uy * a + ux * s0,
      x1: x1 + ux * b - uy * s1,
      y1: y1 + uy * b + ux * s1,
      width: c.PENCIL_WEIGHT_PX * (kind === 'guide' ? 0.6 : between(0.85, 1.15)),
      alpha: (kind === 'guide' ? between(0.16, 0.26) : between(0.6, 0.82)) * (o.weight ?? 1),
      pair: o.pair ?? 0,
      ms: 0,
      gap: 0,
      ease: kind === 'guide' ? `cubic-bezier(${between(0.25, 0.45).toFixed(2)},0,${between(0.35, 0.6).toFixed(2)},1)` : `cubic-bezier(${between(0.35, 0.6).toFixed(2)},${between(0, 0.1).toFixed(2)},${between(0.15, 0.35).toFixed(2)},1)`,
    };
    // Longer lines are swept faster (time grows with the square root of length, as a hand's does), and
    // into a run of like strokes the hand finds its rhythm.
    const rhythm = 1 + Math.min(0.8, run * 0.1);
    const drawn = Math.hypot(stroke.x1 - stroke.x0, stroke.y1 - stroke.y0) / tile;
    stroke.ms = kind === 'flick' ? between(50, 80) : 40 + (c.PENCIL_PACE_MS * Math.sqrt(drawn) * (kind === 'guide' ? 0.6 : 1) * between(0.85, 1.2)) / rhythm;
    stroke.gap = pause + (c.PENCIL_LIFT_MS * between(0.6, 1.5) * (kind === 'flick' ? 0.6 : 1)) / rhythm + (rand() < 0.07 ? c.PENCIL_PAUSE_MS * between(0.3, 0.7) : 0); // now and then, a look before the next line
    pause = 0;
    run++;
    strokes.push(stroke);
    // Now and then a firm line is gone over again, not quite where it was, and not all of it.
    if (kind === 'firm' && !o.pair && rand() < 0.12) {
      const t0 = between(0, 0.15), t1 = 1 - between(0, 0.15), d = between(0.3, 0.5);
      const at = (t: number) => [stroke.x0 + (stroke.x1 - stroke.x0) * t - uy * d, stroke.y0 + (stroke.y1 - stroke.y0) * t + ux * d];
      const [[rx0, ry0], [rx1, ry1]] = [at(t0), at(t1)];
      strokes.push({ ...stroke, x0: rx0, y0: ry0, x1: rx1, y1: ry1, alpha: stroke.alpha * 0.55, ms: stroke.ms * 0.8, gap: between(25, 60) });
    }
  };
  return { strokes, begin, line };
}

// `view`: the window, in page px; nothing is drawn wholly outside it.
export function sketch(c: Config, plan: WallPlan, view: { width: number; height: number }, rand: () => number): Stroke[] {
  const { tile, pitch, originX, top, rows } = plan.tiles;
  const { strokes, begin, line } = hand(c, tile, rand);

  // The frame hangs a little crooked from its nail: draw it turned about its top centre.
  const f = plan.frame, th = (f.tiltDeg * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
  const L = -f.width / 2, R = f.width / 2, T = 0, B = f.height, m = f.moulding, top0 = f.y - f.height / 2;
  const p = (x: number, y: number): [number, number] => [f.x + x * cos - y * sin, top0 + x * sin + y * cos];
  const frameLine = (x0: number, y0: number, x1: number, y1: number, kind: Kind) => line(...p(x0, y0), ...p(x1, y1), kind);
  begin('frame');
  frameLine(L, T, R, T, 'guide');
  frameLine(L, T, L, B, 'guide');
  frameLine(L, B, R, B, 'guide');
  frameLine(R, T, R, B, 'guide');
  for (const i of [0, m]) {
    frameLine(L + i, T + i, R - i, T + i, 'firm');
    frameLine(L + i, T + i, L + i, B - i, 'firm');
    frameLine(R - i, T + i, R - i, B - i, 'firm');
    frameLine(L + i, B - i, R - i, B - i, 'firm');
  }
  for (const [x, y, dx, dy] of [[L, T, 1, 1], [R, T, -1, 1], [R, B, -1, -1], [L, B, 1, -1]]) frameLine(x, y, x + dx * m, y + dy * m, 'flick');

  const across = (y: number, kind: Kind, o: { pair?: number; weight?: number } = {}) => y < view.height && line(0, y, view.width, y, kind, { ...o, reversible: false });
  // A moulding's edges, its inner ones lighter; edges closer than a line's width read as one.
  const moulding = (ys: number[]) => {
    let last = -Infinity;
    ys.forEach((y, i) => {
      if (y - last < MERGE_PX && i < ys.length - 1) return;
      across(y, 'firm', { weight: i === 0 || i === ys.length - 1 ? 1 : 0.65 });
      last = y;
    });
  };
  begin('rail');
  moulding(plan.rail);

  // The joints, spreading out from under the frame: the verticals in order of their distance from it,
  // then the horizontals, top down. Each is both tiles' edges at once, a grout's width apart.
  begin('tiles');
  const grout = pitch - tile, bottom = Math.min(view.height, top + rows * pitch - grout);
  const joints: number[] = [];
  for (let k = Math.ceil(-originX / pitch); originX + k * pitch - grout / 2 <= view.width; k++) joints.push(originX + k * pitch - grout / 2);
  joints.sort((a, b) => Math.abs(a - f.x) - Math.abs(b - f.x));
  for (const x of joints) if (x >= 0 && top < view.height) line(x, top, x, bottom, 'firm', { pair: grout });
  for (let r = 1; r < rows; r++) across(top + r * pitch - grout / 2, 'firm', { pair: grout });

  if (plan.skirting[0] < view.height) {
    begin('skirting');
    moulding(plan.skirting);
  }
  return strokes;
}

// How long the drawing takes, unhurried, start to finish.
export const drawingMs = (strokes: Stroke[]) => strokes.reduce((t, s) => t + s.gap + s.ms, 0);

// The first stroke of the tail (the last `share` of the drawing's time, never the frame) that waits
// for the page to finish loading.
export function heldFrom(strokes: Stroke[], share: number): number {
  const total = drawingMs(strokes);
  let t = 0, i = strokes.length;
  for (; i > 0; i--) {
    const s = strokes[i - 1];
    if (s.part === 'frame' || t + s.gap + s.ms > share * total) break;
    t += s.gap + s.ms;
  }
  return i;
}
