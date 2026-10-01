// Paints the framed sampler: aida cloth, X stitches with thread sheen, and a mitred wooden frame,
// all lit from the wallpaper's light direction (rotated into the tilted frame's own coordinates).
import { AMBIENT, LIGHT_ELEVATION_DEG } from '../light';
import { drawSpots, spotLayout } from '../surface/spots';
import { frameProfile, shadeBoard } from '../wood/board';
import { grainMaps, type RGB } from '../wood/grain';
import { weather } from '../wood/wear';
import { hash2 } from '../wood/noise';
import type { Chart, Ink } from './chart';

export interface WoodStyle {
  early: RGB; // oak base colour
  late: RGB; // growth-ring colour
  ring: number; // CSS px between rings
  figure: number;
  pores: number;
  drift: number;
  variation: number; // tone difference between the four boards
  depth: number; // moulding profile depth, fraction of its width
  sheen: number;
  gloss: number;
  wear: number;
  grime: number;
  patches: number;
}

export interface GlassStyle {
  tint: number; // 0–1 slight green colour cast from the glass
  spots: number; // 0–1 dried water spots
  spotSize: number; // droplet radius, layout units
}

export interface EmbroideryStyle {
  stitch: number; // CSS px per stitch
  frame: number; // CSS px moulding width
  colors: Record<Ink, string> & { cloth: string };
  wood: WoodStyle;
  glass: GlassStyle;
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

const GRAIN_DEPTH = 0.8; // CSS px of height for pores and ring relief

// Four mitred oak boards, each its own piece of wood: own grain, slightly different tone.
// Lit with the scene light rotated into each board's coordinates (u along, v inward, z up).
function frame(ctx: Ctx, W: number, H: number, f: number, o: EmbroideryStyle, L: V, pxPerUnit: number) {
  const e = (LIGHT_ELEVATION_DEG * Math.PI) / 180;
  const L3: [number, number, number] = [L[0] * Math.cos(e), L[1] * Math.cos(e), Math.sin(e)];
  const w = o.wood, dpr = pxPerUnit; // board pixels per layout unit
  sides(W, H, f).forEach((side, k) => {
    const len = Math.max(2, Math.round((side.along[0] ? W : H) * dpr)), wid = Math.max(2, Math.round(f * dpr));
    const toneShift = 1 + w.variation * (hash2(k, 17, 5) - 0.5);
    const maps = grainMaps(len, wid, {
      early: w.early.map((c) => c * toneShift) as RGB,
      late: w.late.map((c) => c * toneShift) as RGB,
      ringPx: w.ring * dpr,
      figure: w.figure,
      pores: w.pores,
      drift: w.drift,
      seed: 41 + k * 7,
    });
    weather(maps, len, wid, frameProfile, { wear: w.wear, grime: w.grime, patches: w.patches, mitres: true, seed: 77 + k });
    const inward: V = [-side.n[0], -side.n[1]];
    const Lb: [number, number, number] = [L3[0] * side.along[0] + L3[1] * side.along[1], L3[0] * inward[0] + L3[1] * inward[1], L3[2]];
    const rgba = shadeBoard(maps, len, wid, { profile: frameProfile, profileDepth: w.depth * wid, grainDepth: GRAIN_DEPTH * dpr, sheen: w.sheen, gloss: w.gloss, ambient: AMBIENT }, Lb);
    const board = document.createElement('canvas');
    board.width = len;
    board.height = wid;
    board.getContext('2d')!.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, len, wid), 0, 0);
    ctx.save();
    ctx.beginPath();
    side.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    ctx.transform(side.along[0], side.along[1], inward[0], inward[1], side.from[0], side.from[1]);
    ctx.drawImage(board, 0, 0, len / dpr, f);
    ctx.restore();
  });
  // Mitre joints and the outer/inner edges.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const [cx, cy, ix, iy] of [[0, 0, f, f], [W, 0, W - f, f], [W, H, W - f, H - f], [0, H, f, H - f]]) ctx.moveTo(cx, cy), ctx.lineTo(ix, iy);
  ctx.stroke();
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

const MAX_SUPERSAMPLE = 2.5; // beyond this, shrinking a detailed render shows no further gain

// Cloth and stitches render at full detail (stitch size) and are shrunk by zoom, which keeps
// their character. The frame is drawn straight at the final size: its grain is procedural, so
// there's nothing to gain from supersampling and it's the expensive part.
export function drawEmbroidery(canvas: HTMLCanvasElement, chart: Chart, o: EmbroideryStyle, zoom = 1) {
  const { width: W, height: H } = embroiderySize(chart, o);
  const L = localLight(o.lightDeg, o.tiltDeg);
  const f = o.frame, cw = chart.w * o.stitch, ch = chart.h * o.stitch;
  const final = o.dpr * zoom;
  const detail = Math.min(o.dpr * Math.max(1, zoom), final * MAX_SUPERSAMPLE);

  let cloth_ = document.createElement('canvas');
  cloth_.width = Math.round(cw * detail);
  cloth_.height = Math.round(ch * detail);
  const cctx = cloth_.getContext('2d')!;
  cctx.scale(detail, detail);
  cloth(cctx, chart, o.stitch, o);
  stitches(cctx, chart, o.stitch, o, L, rng(chart.w * 1000 + chart.h));
  if (zoom < 1) cloth_ = downscale(cloth_, Math.max(1, Math.round(cw * final)), Math.max(1, Math.round(ch * final)));

  canvas.width = Math.max(1, Math.round(W * final));
  canvas.height = Math.max(1, Math.round(H * final));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(final, final); // layout units from here on
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cloth_, f, f, cw, ch);
  innerShadow(ctx, W, H, f, L);
  glass(ctx, f, f, cw, ch, o.glass, L);
  frame(ctx, W, H, f, o, L, final);
}

const GLASS_CAST = [232, 244, 238]; // multiplied in: a green cast with almost no darkening

// Glass over the cloth, under the frame lip: a slight colour cast, a lit cut edge and dried water
// marks (it's a bathroom). The window reflection is a separate, moving layer (see index.ts).
// Its own seed: no other surface shares its marks.
function glass(ctx: Ctx, x: number, y: number, w: number, h: number, g: GlassStyle, L: V) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgb(${GLASS_CAST.map((c) => Math.round(255 + (c - 255) * g.tint))})`;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  // The cut edge of the glass catches the light along the sides facing it.
  ctx.lineWidth = Math.max(0.6, Math.min(w, h) * 0.006);
  for (const [nx, ny, x0, y0, x1, y1] of [[0, -1, x, y, x + w, y], [-1, 0, x, y, x, y + h], [1, 0, x + w, y, x + w, y + h], [0, 1, x, y + h, x + w, y + h]]) {
    const k = Math.max(0, nx * L[0] + ny * L[1]);
    if (!k) continue;
    ctx.strokeStyle = `rgba(255,255,255,${(0.35 * k).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(x0 - nx * ctx.lineWidth, y0 - ny * ctx.lineWidth);
    ctx.lineTo(x1 - nx * ctx.lineWidth, y1 - ny * ctx.lineWidth);
    ctx.stroke();
  }
  const spotOpts = { amount: g.spots, size: g.spotSize, limescale: 0, seed: 9001 };
  ctx.translate(x, y);
  drawSpots(ctx, spotLayout(w, h, spotOpts), spotOpts);
  ctx.restore();
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
