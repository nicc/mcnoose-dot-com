// The back of the framed sampler, seen when it's turned over: the four boards' raw backs (oak left
// unfinished: paler, matte, flat) and an old kraft dust-cover glued over them, trimmed a little
// inside the frame's edge. The paper has aged: darker and ragged at the edges where it has been
// handled, mottled, cockled, with water tide-marks and foxing. Lit by the room through the frame's
// tilt, like the front.
import { AMBIENT, type Light, type Vec3 } from '../room';
import type { RGB } from '../wood/grain';
import { fbm, hash2 } from '../wood/noise';
import { frame, toLocal, type EmbroideryStyle } from './draw';

export interface BackStyle {
  paper: RGB;
  stains: number; // 0–1 water marks and foxing
  wear: number; // 0–1 edges darkened, rubbed and torn
  tarnish: number; // 0–1 the hanger's brass: bright → dark patina and verdigris
  pxPerCm: number; // room scale, for the hanger's real size
  hangerDropCm: number; // how far down from the frame's top the hanger is fixed
  hangerTiltDeg: number; // and how crookedly
}

const PAPER_INSET = 0.3; // of the frame width: bare wood showing round the paper
const RAW_OAK: [RGB, RGB] = [[196, 168, 128], [160, 128, 92]]; // unfinished, oxidised a little
const STAIN: RGB = [0.86, 0.76, 0.6]; // multiplied in: tea-brown
const FOX: RGB = [0.78, 0.6, 0.45];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Where the paper sits on the back (css px): known before (and without) drawing it.
export const paperRect = (W: number, H: number, f: number) => ({ x: f * PAPER_INSET, y: f * PAPER_INSET, w: W - 2 * f * PAPER_INSET, h: H - 2 * f * PAPER_INSET });

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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = hangerTop(f, b.hangerDropCm * b.pxPerCm), mid = top + (HANGER_H_CM * b.pxPerCm) / 2;
  ctx.save();
  ctx.translate(W / 2, mid); // fixed a little crooked, turned about its middle
  ctx.rotate((b.hangerTiltDeg * Math.PI) / 180);
  ctx.translate(-W / 2, -mid);
  hanger(ctx, W / 2, top, b, lights, toLocal(o.view, o.tiltDeg + b.hangerTiltDeg), dpr);
  ctx.restore();
  return { x: p, y: p, w: W - 2 * p, h: H - 2 * p };
}

// A sawtooth hanger: a pressed brass strip, its lower edge cut into teeth for the nail to catch in,
// fixed with two brads at the top centre of the back. (Sawtooth hangers are early-1900s: a later
// re-hang of an 1870s piece, which is why the brass has had time to tarnish.) Lit from the room:
// the strip is pressed slightly convex, so its shading and highlight move with the light.
const HANGER_W_CM = 4.4, HANGER_H_CM = 0.85, TEETH = 27, BRAD_CM = 0.12, TOOTH = 0.22;
const hangerTop = (f: number, dropPx: number) => f * 0.15 + dropPx;

// How far below the frame's top edge the nail sits (css px): in the notch at the hanger's middle
// (which its tilt turns about, so that notch stays put). f: the frame's moulding width (css px).
export const nailDrop = (f: number, pxPerCm: number, dropCm: number) => hangerTop(f, dropCm * pxPerCm) + HANGER_H_CM * pxPerCm * (1 - TOOTH);
const BRASS: RGB = [190, 152, 84], PATINA: RGB = [72, 62, 40], VERDIGRIS: RGB = [112, 140, 112], BRAD: RGB = [104, 100, 94];

function hanger(ctx: CanvasRenderingContext2D, cx: number, top: number, b: BackStyle, lights: Light[], view: Vec3, dpr: number) {
  const ppc = b.pxPerCm, hw = HANGER_W_CM * ppc, hh = HANGER_H_CM * ppc, x0 = cx - hw / 2, tooth = hh * TOOTH;
  const body = new Path2D();
  body.moveTo(x0 + hh * 0.2, top);
  body.lineTo(x0 + hw - hh * 0.2, top);
  body.quadraticCurveTo(x0 + hw, top, x0 + hw, top + hh * 0.25);
  body.lineTo(x0 + hw, top + hh - tooth);
  for (let i = TEETH; i >= 0; i--) body.lineTo(x0 + (hw * i) / TEETH, top + hh - (i % 2 ? 0 : tooth)); // the teeth
  body.lineTo(x0, top + hh * 0.25);
  body.quadraticCurveTo(x0, top, x0 + hh * 0.2, top);
  body.closePath();

  // Cast shadow: it stands off the wood by its own thickness, away from the light.
  const L = lights.reduce<Vec3>((s, { dir, weight }) => [s[0] + dir[0] * weight, s[1] + dir[1] * weight, s[2] + dir[2] * weight], [0, 0, 0]);
  const lift = 0.08 * ppc;
  ctx.save();
  ctx.shadowColor = 'rgba(30,20,10,0.45)';
  ctx.shadowBlur = 1.5 * dpr;
  ctx.shadowOffsetX = (-L[0] / L[2]) * lift * dpr;
  ctx.shadowOffsetY = (-L[1] / L[2]) * lift * dpr;
  ctx.fillStyle = '#000';
  ctx.fill(body);
  ctx.restore();

  // Shading down the convex pressing: normals tilt from facing up (top) to facing down (teeth).
  const flat = lights.reduce((s, l) => s + l.weight * l.dir[2], 0) || 1;
  const H = lights.map(({ dir, weight }) => {
    const h: Vec3 = [dir[0] + view[0], dir[1] + view[1], dir[2] + view[2]], n = Math.hypot(...h);
    return { h: [h[0] / n, h[1] / n, h[2] / n] as Vec3, weight };
  });
  const shine = 0.9 * (1 - 0.85 * b.tarnish);
  const metal = BRASS.map((c, k) => c + (PATINA[k] - c) * 0.45 * b.tarnish);
  const grad = ctx.createLinearGradient(0, top, 0, top + hh);
  for (let s = 0; s <= 8; s++) {
    const t = s / 8, a = (0.5 - t) * 1.1, n: Vec3 = [0, -Math.sin(a), Math.cos(a)];
    const lambert = lights.reduce((acc, { dir, weight }) => acc + weight * Math.max(0, dir[0] * n[0] + dir[1] * n[1] + dir[2] * n[2]), 0) / flat;
    const spec = H.reduce((acc, { h, weight }) => acc + weight * Math.max(0, h[0] * n[0] + h[1] * n[1] + h[2] * n[2]) ** 60, 0) * shine;
    const k = AMBIENT + (1 - AMBIENT) * lambert;
    grad.addColorStop(t, `rgb(${metal.map((c) => Math.min(255, Math.round(c * k + 255 * spec))).join(',')})`);
  }
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = grad;
  ctx.fillRect(x0, top, hw, hh);

  // Tarnish: an even darkening with soft blotches; verdigris only in the crevices, along the
  // teeth and round the brads, where moisture sits.
  if (b.tarnish > 0) {
    const tw = Math.ceil(hw * dpr), th = Math.ceil(hh * dpr), t = document.createElement('canvas');
    t.width = tw;
    t.height = th;
    const tc = t.getContext('2d')!, img = tc.createImageData(tw, th);
    const brads = [hw * 0.1 * dpr, hw * 0.9 * dpr], bradY = hh * 0.38 * dpr, toothY = (hh - tooth) * dpr;
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const i = (y * tw + x) * 4, n = fbm(x / (3 * dpr), y / (3 * dpr), 131, 3) + 0.5;
        const crevice = Math.max(clamp01((y - toothY) / (tooth * dpr)), ...brads.map((bx) => clamp01(1 - Math.hypot(x - bx, y - bradY) / (BRAD_CM * ppc * 2.2 * dpr))));
        const green = clamp01((fbm(x / (1.2 * dpr), y / (1.2 * dpr), 137, 2) + 0.5) * crevice * 2 - (1 - b.tarnish) * 1.2) * b.tarnish;
        const col = PATINA.map((c, k) => c + (VERDIGRIS[k] - c) * clamp01(green * 2));
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255 * clamp01(b.tarnish * (0.45 + 0.35 * n) + green * 0.35);
      }
    }
    tc.putImageData(img, 0, 0);
    ctx.drawImage(t, x0, top, hw, hh);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,30,15,0.5)';
  ctx.lineWidth = 0.5;
  ctx.stroke(body);

  // Two brads through the strip's ends.
  const r = BRAD_CM * ppc;
  for (const bx of [x0 + hw * 0.1, x0 + hw * 0.9]) {
    const by = top + hh * 0.38;
    const g = ctx.createRadialGradient(bx - (L[0] / L[2]) * -r * 0.4, by - (L[1] / L[2]) * -r * 0.4, 0, bx, by, r);
    const lit = BRAD.map((c) => Math.round(c * (1 - 0.3 * b.tarnish)));
    g.addColorStop(0, `rgb(${lit.map((c) => Math.min(255, c + 70 * (1 - b.tarnish))).join(',')})`);
    g.addColorStop(1, `rgb(${lit.map((c) => Math.round(c * 0.6)).join(',')})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
