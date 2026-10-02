// The back of the framed sampler, seen when it's turned over: the four boards' raw backs (oak left
// unfinished: paler, matte, flat) and an old kraft dust-cover glued over them, trimmed a little
// inside the frame's edge. The paper has aged: darker and ragged at the edges where it has been
// handled, mottled, cockled, with water tide-marks and foxing. Lit by the room through the frame's
// tilt, like the front.
import { AMBIENT, type Light } from '../room';
import type { RGB } from '../wood/grain';
import { fbm, hash2 } from '../wood/noise';
import { frame, toLocal, type EmbroideryStyle } from './draw';

export interface BackStyle {
  paper: RGB;
  stains: number; // 0–1 water marks and foxing
  wear: number; // 0–1 edges darkened, rubbed and torn
}

const PAPER_INSET = 0.3; // of the frame width: bare wood showing round the paper
const RAW_OAK: [RGB, RGB] = [[196, 168, 128], [160, 128, 92]]; // unfinished, oxidised a little
const STAIN: RGB = [0.86, 0.76, 0.6]; // multiplied in: tea-brown
const FOX: RGB = [0.78, 0.6, 0.45];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// W, H, f in css px; dpr: canvas px per css px. Returns the paper's rectangle (css px).
export function drawBack(canvas: HTMLCanvasElement, W: number, H: number, f: number, o: Pick<EmbroideryStyle, 'wood' | 'view' | 'tiltDeg' | 'lights'>, b: BackStyle, dpr: number) {
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const lights: Light[] = o.lights.map((l) => ({ dir: toLocal(l.dir, o.tiltDeg), weight: l.weight }));
  const wood = { ...o.wood, early: RAW_OAK[0], late: RAW_OAK[1], depth: 0, sheen: 0, wear: 0, grime: o.wood.grime * 0.5 };
  frame(ctx, W, H, f, { ...o, wood }, lights, dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const p = f * PAPER_INSET, x0 = Math.round(p * dpr), y0 = Math.round(p * dpr);
  const pw = canvas.width - 2 * x0, ph = canvas.height - 2 * y0;
  const img = ctx.getImageData(x0, y0, pw, ph), px = img.data;
  const unit = f * dpr; // scale for edge effects: one frame-width
  const flat = lights.reduce((s, l) => s + l.weight * l.dir[2], 0);
  const cockle = Math.max(pw, ph) / 5, relief = 0.35 * dpr; // gentle waves in glued paper

  // Tide-marks: a few drying rings, placed at random; foxing on a grid of cells.
  const marks = Math.round(1 + 5 * b.stains);
  const rings = Array.from({ length: marks }, (_, i) => ({
    x: pw * (0.1 + 0.8 * hash2(i, 1, 91)),
    y: ph * (0.1 + 0.8 * hash2(i, 2, 91)),
    r: Math.min(pw, ph) * (0.08 + 0.25 * hash2(i, 3, 91)),
    k: 0.4 + 0.6 * hash2(i, 4, 91),
  }));
  const foxCell = 6 * dpr;

  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = (y * pw + x) * 4;
      const d = Math.min(x, y, pw - 1 - x, ph - 1 - y); // to the paper's trimmed edge
      // Handling has worn the edge back raggedly; beyond it the wood shows.
      const cut = b.wear * unit * 0.3 * (0.5 + fbm(x / (unit * 0.7), y / (unit * 0.7), 93, 3)) * 1.6;
      const present = clamp01(d - cut + 0.5);
      if (present <= 0) continue;
      const n = fbm(x / (unit * 2), y / (unit * 2), 95, 4);
      let r = b.paper[0] * (1 + 0.07 * n), g = b.paper[1] * (1 + 0.07 * n), bl = b.paper[2] * (1 + 0.08 * n);
      const fibre = (hash2(x, y >> 1, 97) - 0.5) * 0.05;
      r *= 1 + fibre;
      g *= 1 + fibre;
      bl *= 1 + fibre;
      // Edges darken (light and handling) and rub pale right at the fringe.
      const dark = Math.exp(-(d - cut) / (unit * 0.6)) * (0.15 + 0.35 * b.wear);
      const rub = Math.exp(-(d - cut) / (1.5 * dpr)) * 0.25 * b.wear;
      const tone = (1 - dark) * (1 + rub);
      r *= tone * (1 - dark * 0.1);
      g *= tone * (1 - dark * 0.2);
      bl *= tone * (1 - dark * 0.35);
      // Water stains: darker tide line, slightly tinted inside.
      for (const s of rings) {
        const q = Math.hypot(x - s.x, y - s.y) / (s.r * (1 + 0.15 * fbm(x / (s.r * 0.6), y / (s.r * 0.6), 99, 2)));
        if (q > 1.15) continue;
        const inside = q < 1 ? 0.35 : 0, line = Math.exp(-(((q - 1) / 0.035) ** 2));
        const a = b.stains * s.k * (inside + line);
        r *= 1 + (STAIN[0] - 1) * a;
        g *= 1 + (STAIN[1] - 1) * a;
        bl *= 1 + (STAIN[2] - 1) * a;
      }
      // Foxing: small rust-brown spots.
      const cx = Math.floor(x / foxCell), cy = Math.floor(y / foxCell);
      if (hash2(cx, cy, 101) < 0.04 * b.stains) {
        const fx = (cx + hash2(cx, cy, 102)) * foxCell, fy = (cy + hash2(cx, cy, 103)) * foxCell, fr = (0.6 + 1.6 * hash2(cx, cy, 104)) * dpr;
        const a = clamp01(1 - Math.hypot(x - fx, y - fy) / fr) * (0.5 + 0.5 * hash2(cx, cy, 105));
        r *= 1 + (FOX[0] - 1) * a;
        g *= 1 + (FOX[1] - 1) * a;
        bl *= 1 + (FOX[2] - 1) * a;
      }
      // Cockle, lit by the room (normalised so flat paper shows its colour).
      const hx = (fbm((x + 1) / cockle, y / cockle, 107, 3) - fbm((x - 1) / cockle, y / cockle, 107, 3)) * relief * cockle * 0.5;
      const hy = (fbm(x / cockle, (y + 1) / cockle, 107, 3) - fbm(x / cockle, (y - 1) / cockle, 107, 3)) * relief * cockle * 0.5;
      const nl = Math.hypot(hx, hy, 1);
      let lit = 0;
      for (const { dir, weight } of lights) lit += weight * Math.max(0, (-hx * dir[0] - hy * dir[1] + dir[2]) / nl);
      const light = AMBIENT + (1 - AMBIENT) * (lit / flat);
      // Over wood: blend at the ragged edge. Over the frame's empty opening: paper alone.
      const under = px[i + 3] / 255, mix = under > 0 ? present : 1;
      px[i] = px[i] * (1 - mix) + r * light * mix;
      px[i + 1] = px[i + 1] * (1 - mix) + g * light * mix;
      px[i + 2] = px[i + 2] * (1 - mix) + bl * light * mix;
      px[i + 3] = Math.max(px[i + 3], 255 * present);
    }
  }
  ctx.putImageData(img, x0, y0);
  return { x: p, y: p, w: W - 2 * p, h: H - 2 * p };
}
