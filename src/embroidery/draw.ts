// Paints the framed sampler: aida cloth, X stitches with thread sheen, and a mitred wooden frame,
// all lit from the wallpaper's light direction (rotated into the tilted frame's own coordinates).
import type { Chart, Ink } from './chart';

export interface EmbroideryStyle {
  stitch: number; // CSS px per stitch
  frame: number; // CSS px moulding width
  colors: Record<Ink, string> & { cloth: string; wood: string };
  lightDeg: number; // direction light comes from, screen space
  tiltDeg: number; // frame rotation, clockwise
  dpr: number;
}

type Ctx = CanvasRenderingContext2D;
type V = [number, number];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tint = (v: number) => (v >= 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`);

// Light direction (towards the light) in the frame's local coordinates. Screen y points down;
// CSS rotate(+t) turns the frame clockwise, so screen → local rotates by −t.
export function localLight(lightDeg: number, tiltDeg: number): V {
  const a = (lightDeg * Math.PI) / 180, t = (tiltDeg * Math.PI) / 180;
  const [x, y] = [Math.cos(a), -Math.sin(a)];
  return [x * Math.cos(t) + y * Math.sin(t), -x * Math.sin(t) + y * Math.cos(t)];
}

function cloth(ctx: Ctx, chart: Chart, s: number, o: EmbroideryStyle) {
  ctx.fillStyle = o.colors.cloth;
  ctx.fillRect(0, 0, chart.w * s, chart.h * s);
  // Aida weave: faint block edges and a hole at every grid intersection.
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  for (let x = 0; x <= chart.w; x++) ctx.moveTo(x * s, 0), ctx.lineTo(x * s, chart.h * s);
  for (let y = 0; y <= chart.h; y++) ctx.moveTo(0, y * s), ctx.lineTo(chart.w * s, y * s);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.beginPath();
  for (let y = 0; y <= chart.h; y++)
    for (let x = 0; x <= chart.w; x++) ctx.moveTo(x * s + s * 0.11, y * s), ctx.arc(x * s, y * s, s * 0.11, 0, Math.PI * 2);
  ctx.fill();
}

function stitches(ctx: Ctx, chart: Chart, s: number, o: EmbroideryStyle, L: V, rand: () => number) {
  const inset = s * 0.12, width = s * 0.3;
  const legs = (x: number, y: number): [V, V][] => [
    [[x + inset, y + s - inset], [x + s - inset, y + inset]], // bottom-left → top-right first
    [[x + inset, y + inset], [x + s - inset, y + s - inset]], // then the top leg crosses it
  ];
  ctx.lineCap = 'round';
  for (let i = 0; i < chart.cells.length; i++) {
    const ink = chart.cells[i];
    if (!ink) continue;
    const x = (i % chart.w) * s, y = Math.floor(i / chart.w) * s;
    const shade = (rand() - 0.5) * 0.12; // each stitch pulls a little differently
    for (const [a, b] of legs(x, y)) {
      ctx.lineWidth = width;
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; // thread shadow on the cloth
      ctx.beginPath();
      ctx.moveTo(a[0] - L[0] * s * 0.08, a[1] - L[1] * s * 0.08);
      ctx.lineTo(b[0] - L[0] * s * 0.08, b[1] - L[1] * s * 0.08);
      ctx.stroke();
      ctx.strokeStyle = o.colors[ink];
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.stroke();
      ctx.strokeStyle = tint(shade);
      ctx.stroke();
      ctx.lineWidth = width * 0.3; // sheen along the side facing the light
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.moveTo(a[0] + L[0] * width * 0.25, a[1] + L[1] * width * 0.25);
      ctx.lineTo(b[0] + L[0] * width * 0.25, b[1] + L[1] * width * 0.25);
      ctx.stroke();
    }
  }
}

// Outward normals of the four moulding sides, with their mitred trapezoids.
function sides(W: number, H: number, f: number): { n: V; poly: V[]; along: V; from: V }[] {
  return [
    { n: [0, -1], poly: [[0, 0], [W, 0], [W - f, f], [f, f]], along: [1, 0], from: [0, 0] },
    { n: [1, 0], poly: [[W, 0], [W, H], [W - f, H - f], [W - f, f]], along: [0, 1], from: [W, 0] },
    { n: [0, 1], poly: [[W, H], [0, H], [f, H - f], [W - f, H - f]], along: [-1, 0], from: [W, H] },
    { n: [-1, 0], poly: [[0, H], [0, 0], [f, f], [f, H - f]], along: [0, -1], from: [0, H] },
  ];
}

function frame(ctx: Ctx, W: number, H: number, f: number, o: EmbroideryStyle, L: V, rand: () => number) {
  for (const side of sides(W, H, f)) {
    const lit = side.n[0] * L[0] + side.n[1] * L[1];
    ctx.save();
    ctx.beginPath();
    side.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = o.colors.wood;
    ctx.fillRect(0, 0, W, H);
    // Grain: long wavering lines running along the side.
    const len = Math.abs(side.along[0]) ? W : H;
    const inward: V = [-side.n[0], -side.n[1]];
    for (let d = 0; d < f; d += 0.7 + rand() * 0.9) {
      const phase = rand() * 6, amp = 0.15 + rand() * 0.35, v = (rand() - 0.5) * 0.18;
      ctx.strokeStyle = tint(v);
      ctx.lineWidth = 0.4 + rand() * 0.8;
      ctx.beginPath();
      for (let t = 0; t <= len; t += 4) {
        const off = d + Math.sin(t / 23 + phase) * amp;
        const px = side.from[0] + side.along[0] * t + inward[0] * off, py = side.from[1] + side.along[1] * t + inward[1] * off;
        t ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    // Bevel: outer slope faces outward (lit when facing the light), inner lip faces in.
    const g = ctx.createLinearGradient(side.from[0], side.from[1], side.from[0] + inward[0] * f, side.from[1] + inward[1] * f);
    g.addColorStop(0, tint(0.28 * lit));
    g.addColorStop(0.45, tint(0));
    g.addColorStop(0.8, tint(0));
    g.addColorStop(1, tint(-0.3 * lit));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  ctx.strokeRect(f - 0.5, f - 0.5, W - 2 * f + 1, H - 2 * f + 1);
}

// The frame casts a shadow onto the recessed cloth along sides that face the light.
function innerShadow(ctx: Ctx, W: number, H: number, f: number, L: V) {
  const depth = f * 0.6;
  for (const side of sides(W, H, f)) {
    const k = Math.max(0, side.n[0] * L[0] + side.n[1] * L[1]);
    if (k === 0) continue;
    const inward: V = [-side.n[0], -side.n[1]];
    const ex = side.n[0] > 0 ? W - f : f, ey = side.n[1] > 0 ? H - f : f; // inner edge line
    const sx = side.n[0] ? ex : 0, sy = side.n[1] ? ey : 0;
    const g = ctx.createLinearGradient(sx, sy, sx + inward[0] * depth, sy + inward[1] * depth);
    g.addColorStop(0, `rgba(0,0,0,${0.3 * k})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(f, f, W - 2 * f, H - 2 * f);
  }
}

export function embroiderySize(chart: Chart, o: Pick<EmbroideryStyle, 'stitch' | 'frame'>): { width: number; height: number } {
  return { width: chart.w * o.stitch + 2 * o.frame, height: chart.h * o.stitch + 2 * o.frame };
}

export function drawEmbroidery(canvas: HTMLCanvasElement, chart: Chart, o: EmbroideryStyle) {
  const { width: W, height: H } = embroiderySize(chart, o);
  canvas.width = Math.round(W * o.dpr);
  canvas.height = Math.round(H * o.dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(o.dpr, o.dpr);
  const L = localLight(o.lightDeg, o.tiltDeg);
  const rand = rng(chart.w * 1000 + chart.h);
  ctx.save();
  ctx.translate(o.frame, o.frame);
  cloth(ctx, chart, o.stitch, o);
  stitches(ctx, chart, o.stitch, o, L, rand);
  ctx.restore();
  innerShadow(ctx, W, H, o.frame, L);
  frame(ctx, W, H, o.frame, o, L, rand);
}

// High-quality shrink: halve repeatedly, then a final step to the target. One big bilinear step
// skips most source pixels and shimmers; halving averages them, consistently across browsers.
export function downscale(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  let cur = src;
  const step = (nw: number, nh: number) => {
    const next = document.createElement('canvas');
    next.width = nw;
    next.height = nh;
    const ctx = next.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, nw, nh);
    cur = next;
  };
  while (cur.width / 2 >= w && cur.height / 2 >= h) step(Math.round(cur.width / 2), Math.round(cur.height / 2));
  if (cur.width !== w || cur.height !== h) step(w, h);
  return cur;
}
