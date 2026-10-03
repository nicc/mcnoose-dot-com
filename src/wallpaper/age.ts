// The wallpaper's age, laid over the pattern in wall coordinates so none of it repeats with the
// print. A soft multiply layer (half-centimetre cells): uneven yellowing, heavier towards the
// ceiling where steam and warmth rise; tea-brown blotches with darker tide-lines; and the frame's
// mark — the paper behind it kept clean while the wall around yellowed, with a grime halo where
// dust settled at its edges (most above it, carried up by warm air). The frame's angle has wandered
// over the years, so the clean patch and halo are blurred around the nail (averaged over a spread
// of angles). Plus the seams between rolls: hairline joints, lifted edges catching the light, and
// tears back to the plaster. Lit edges take the room's light direction.
import type { Vec3 } from '../room';
import { wallPoint, type WallMap } from '../tiles/surface';
import { fbm, hash2 } from '../wood/noise';

export interface AgeStyle {
  yellowing: number;
  stains: number;
  seams: number; // master: 0 = no seams at all
  seam: SeamStyle;
  halo: number;
  haloSpreadDeg: number;
}

export interface SeamStyle {
  gapMm: number; // the joint between rolls (0 = butted tight)
  lift: number; // 0–1 how often and how far edges lift
  tear: number; // 0–1 how often and how big the tears are
  sharpness: number; // 0 worn soft edges … 1 crisply cut
  dirt: number; // 0–1 paste and handling grime along the seam
}

const RES = 3; // tint cells per cm
const ROLL_CM = 53; // a roll's width (21 in)
const SEAM_OFFSET_CM = 19;
const STRIP_CM = 8; // each seam's canvas width
const HALO_CM = 2.2; // how far the grime spreads from the frame's edge
const STAIN_CELL_CM = 60;
const AGED = [224, 204, 158], DIRT = [118, 104, 86], STAIN = [214, 186, 140], TIDE = [176, 146, 104];
const PLASTER = [190, 181, 164], CORE = [214, 204, 182]; // core: the paper's body, paler than its printed face but not white
const SPREAD_SAMPLES = 9;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const mul = (base: number[], amount: number) => base.map((c) => 1 - clamp01(amount) * (1 - c / 255));

export interface Frame {
  wCm: number;
  hCm: number;
  nail: { x: number; y: number }; // wall cm (y up), top centre at 0°
}

// Clean (0–1) and halo (0–1) at a wall point, averaged over the frame's wandering angle.
export function frameMark(x: number, y: number, f: Frame, spreadDeg: number): { clean: number; halo: number } {
  // Beyond the frame's reach from its nail (at any angle) plus the halo's spread, there's nothing.
  if (Math.hypot(x - f.nail.x, y - f.nail.y) > Math.hypot(f.wCm / 2, f.hCm) + 6 * HALO_CM) return { clean: 0, halo: 0 };
  let clean = 0, halo = 0;
  for (let k = 0; k < SPREAD_SAMPLES; k++) {
    const a = ((k / (SPREAD_SAMPLES - 1) - 0.5) * 2 * spreadDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const dx = x - f.nail.x, dy = y - f.nail.y, qx = dx * c - dy * s, qy = dx * s + dy * c; // in the frame's frame
    const ox = Math.max(0, Math.abs(qx) - f.wCm / 2), oy = Math.max(0, qy, -f.hCm - qy);
    const d = Math.hypot(ox, oy);
    if (d === 0) clean++;
    else halo += Math.exp(-d / HALO_CM) * (qy > -f.hCm / 2 ? 1.6 : 0.7); // heavier above its middle
  }
  return { clean: clean / SPREAD_SAMPLES, halo: halo / SPREAD_SAMPLES };
}

function stainAt(x: number, y: number, amount: number): { inside: number; tide: number } {
  let inside = 0, tide = 0;
  const cx = Math.floor(x / STAIN_CELL_CM), cy = Math.floor(y / STAIN_CELL_CM);
  for (let i = cx - 1; i <= cx + 1; i++) {
    for (let j = cy - 1; j <= cy + 1; j++) {
      if (hash2(i, j, 301) > 0.55 * amount) continue;
      const sx = (i + hash2(i, j, 302)) * STAIN_CELL_CM, sy = (j + hash2(i, j, 303)) * STAIN_CELL_CM;
      const r = 3 + 10 * hash2(i, j, 304);
      const q = Math.hypot(x - sx, y - sy) / (r * (1 + 0.25 * fbm((x - sx) / (r * 0.7), (y - sy) / (r * 0.7), 305 + i * 7 + j, 2)));
      if (q > 1.2) continue;
      inside = Math.max(inside, q < 1 ? 0.5 + 0.5 * hash2(i, j, 306) : 0);
      tide = Math.max(tide, Math.exp(-(((q - 1) / 0.05) ** 2)));
    }
  }
  return { inside, tide };
}

export interface AgeArea {
  x0: number; // wall cm
  x1: number;
  yBottom: number;
  yTop: number;
}

// The tint layer for an area of wall: a canvas of RES cells per cm, to be shown multiplied.
export function drawTint(area: AgeArea, s: AgeStyle, f: Frame): HTMLCanvasElement {
  const w = Math.max(1, Math.ceil((area.x1 - area.x0) * RES)), h = Math.max(1, Math.ceil((area.yTop - area.yBottom) * RES));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!, img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const y = area.yTop - (j + 0.5) / RES, up = clamp01((y - area.yBottom) / 40);
    for (let i = 0; i < w; i++) {
      const x = area.x0 + (i + 0.5) / RES, k = (j * w + i) * 4;
      const { clean, halo } = s.halo > 0 || s.yellowing > 0 ? frameMark(x, y, f, s.haloSpreadDeg) : { clean: 0, halo: 0 };
      const n = fbm(x / 70, y / 70, 307, 3) + 0.5;
      let col = mul(AGED, s.yellowing * (0.25 + 0.55 * n + 0.3 * up) * (1 - 0.85 * clean));
      const dirt = mul(DIRT, s.halo * Math.min(1, halo) * 0.9 * (1 - clean));
      col = col.map((c, ch) => c * dirt[ch]);
      if (s.stains > 0) {
        const st = stainAt(x, y, s.stains), keep = 1 - 0.5 * clean;
        const a = mul(STAIN, st.inside * 0.45 * keep), b = mul(TIDE, st.tide * 0.6 * keep);
        col = col.map((c, ch) => c * a[ch] * b[ch]);
      }
      img.data[k] = col[0] * 255;
      img.data[k + 1] = col[1] * 255;
      img.data[k + 2] = col[2] * 255;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// The rolls (seam to seam, wall cm) across an area, and how far each was hung off the pattern's
// match: −1…1 of the greatest mismatch. Hand-hung paper rarely matched exactly.
export function rollsIn(x0: number, x1: number): { k: number; x0: number; x1: number }[] {
  return seamsIn(x0 - ROLL_CM, x1 + ROLL_CM).slice(0, -1).map((x, i, all) => ({ k: Math.round(x / ROLL_CM), x0: x, x1: all[i + 1] ?? x + ROLL_CM }));
}
export const rollShift = (k: number) => 2 * hash2(k, 0, 351) - 1;

// Seam x positions (wall cm) across an area.
export function seamsIn(x0: number, x1: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil((x0 - SEAM_OFFSET_CM) / ROLL_CM); SEAM_OFFSET_CM + k * ROLL_CM <= x1; k++) out.push(SEAM_OFFSET_CM + k * ROLL_CM);
  return out;
}

const SEG_CM = 12; // seams are considered in lengths this long for lifts and tears
const DIRT_CM = 1.2; // how far paste and handling grime spreads from the joint
const LIFT_CM = 0.25; // greatest lift of an edge off the wall

// The joint at height y (cm): how far its centre wavers off the seam line, and how far it's open
// (canvas px). Shared by the joint and the tears, so a tear runs flush with its roll's edge.
function jointAt(k: number, y: number, gapPx: number, scale: number): { wob: number; open: number } {
  return {
    wob: fbm(y / 35, k * 3.1, 331, 2) * 0.08 * scale, // edges not quite straight
    open: gapPx * Math.max(0, Math.min(1, 0.15 + 1.1 * (fbm(y / 14, k * 1.7, 333, 2) + 0.5))), // opens and closes
  };
}

interface Lift {
  y0: number; // wall cm, bottom
  y1: number;
  side: number; // which roll's edge: −1 left, 1 right
  height: number; // cm
}

// One seam's strip (STRIP_CM wide, centred on the seam), lit by the room (light: blended light
// direction, screen coords). The joint is a narrow gap that wavers and opens and closes along its
// length; the paper edge facing the light catches it and the other shades the gap. Lifted edges
// catch light along the lip and shadow the paper beyond. Grime gathers, patchily, along the joint.
// Tears are strips torn back to the plaster. The master amount scales how visible the joint is and
// how often lifts and tears happen (each is drawn in full); at 0 it's empty.
export function drawSeam(seamX: number, area: AgeArea, amount: number, s: SeamStyle, ppc: number, dpr: number, light: Vec3): HTMLCanvasElement {
  const k = Math.round(seamX / ROLL_CM), scale = ppc * dpr; // canvas px per cm
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(STRIP_CM * scale);
  canvas.height = Math.ceil((area.yTop - area.yBottom) * scale);
  if (amount <= 0) return canvas;
  const ctx = canvas.getContext('2d')!, W = canvas.width, H = canvas.height, cx = W / 2;
  const rowCm = (j: number) => area.yTop - (j + 0.5) / scale;
  const grazing = Math.min(1, Math.abs(light[0]) / Math.max(0.2, light[2]) + 0.25); // side light shows edges more
  const lit = light[0] < 0 ? 1 : -1; // the edge facing the light: light from the left lights the right roll's edge
  const blur = (0.25 + 1.6 * (1 - s.sharpness)) * dpr; // edge softness, canvas px
  const gapPx = (s.gapMm / 10) * scale;

  // Lifted lengths, seeded by seam and length.
  const lifts: Lift[] = [];
  for (let seg = Math.floor(area.yBottom / SEG_CM); seg * SEG_CM < area.yTop; seg++) {
    if (hash2(k, seg, 312) >= 0.4 * s.lift * amount) continue;
    const len = 4 + 10 * hash2(k, seg, 314), y0 = seg * SEG_CM + (SEG_CM - len) * hash2(k, seg, 311);
    lifts.push({ y0, y1: y0 + len, side: hash2(k, seg, 313) < 0.5 ? -1 : 1, height: LIFT_CM * s.lift * (0.3 + 0.7 * hash2(k, seg, 315)) });
  }

  const img = ctx.createImageData(W, H), px = img.data;
  const over = (i: number, r: number, g: number, b: number, a: number) => {
    if (a <= 0.002) return;
    const keep = 1 - a;
    px[i] = r * a + px[i] * keep; // premultiplied in effect: we unpremultiply at the end
    px[i + 1] = g * a + px[i + 1] * keep;
    px[i + 2] = b * a + px[i + 2] * keep;
    px[i + 3] = 255 * a + px[i + 3] * keep;
  };
  const ramp = (v: number) => Math.max(0, Math.min(1, 0.5 + v / (2 * blur)));
  const line = (d: number, w: number) => Math.exp(-((d / w) ** 2));
  const reach = Math.min(cx, gapPx / 2 + DIRT_CM * scale * 2 + LIFT_CM * scale * 3 + 4 * blur);
  for (let j = 0; j < H; j++) {
    const y = rowCm(j);
    const { wob, open } = jointAt(k, y, gapPx, scale);
    const grime = s.dirt * (0.3 + 1.1 * Math.max(0, fbm(y / 18, k * 2.3, 335, 3) + 0.5)); // patchy along its length
    const lift = lifts.find((l) => y >= l.y0 && y <= l.y1);
    const bump = lift ? Math.sin((Math.PI * (y - lift.y0)) / (lift.y1 - lift.y0)) ** 2 : 0;
    const liftPx = lift ? lift.height * bump * scale : 0;
    const x0 = Math.max(0, Math.floor(cx - reach)), x1 = Math.min(W - 1, Math.ceil(cx + reach));
    for (let x = x0; x <= x1; x++) {
      const i = (j * W + x) * 4, d = x + 0.5 - (cx + wob);
      if (grime > 0) over(i, 70, 58, 42, amount * grime * 0.16 * line(d, DIRT_CM * scale)); // grime along the joint
      if (open > 0) {
        over(i, 46, 36, 26, amount * 0.55 * ramp(open / 2 - Math.abs(d))); // the gap: wall and paste in shadow
        over(i, 40, 30, 20, amount * grazing * 0.35 * line(d + lit * open / 2, blur)); // edge in shadow
        over(i, 255, 250, 236, amount * grazing * 0.45 * line(d - lit * open / 2, blur)); // edge catching the light
      }
      if (liftPx > 0) {
        const e = lift!.side * open / 2, away = -lit;
        over(i, 30, 22, 14, 0.4 * bump * line(d - e - away * liftPx * 0.8, Math.max(blur, liftPx))); // shadow beyond the lip
        over(i, 255, 251, 238, 0.6 * bump * line(d - e, blur * 1.2)); // the lifted lip
      }
    }
  }
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255;
    if (a > 0) (px[i] /= a), (px[i + 1] /= a), (px[i + 2] /= a);
  }
  ctx.putImageData(img, 0, 0);
  if (s.tear > 0) tears(ctx, k, area, amount, s, scale, dpr, -lit, gapPx);
  return canvas;
}

// Strips torn back to the plaster, starting at the seam, widest where they began and tapering. The
// torn edge is what sells it: a broken, uneven fringe of the paper's pale core (only along the torn
// side, never the seam), toned near the paper, with a thin shadow only where the edge faces away
// from the light. The plaster is stained with old paste towards the edge, a few fibres still on it.
function tears(ctx: CanvasRenderingContext2D, k: number, area: AgeArea, amount: number, s: SeamStyle, scale: number, dpr: number, away: number, gapPx: number) {
  const cx = ctx.canvas.width / 2, py = (yCm: number) => (area.yTop - yCm) * scale, cm = (yPx: number) => area.yTop - yPx / scale;
  const soft = 1 - s.sharpness;
  for (let seg = Math.floor(area.yBottom / SEG_CM); seg * SEG_CM < area.yTop; seg++) {
    if (hash2(k, seg, 341) >= 0.35 * s.tear * amount) continue;
    const side = hash2(k, seg, 342) < 0.5 ? -1 : 1, size = 0.5 + s.tear;
    const wT = (0.6 + 1.6 * hash2(k, seg, 316)) * size * scale, hT = (1.5 + 4.5 * hash2(k, seg, 317)) * size * scale;
    const top = py(seg * SEG_CM + SEG_CM * hash2(k, seg, 343)) - hT;
    // Its roll's edge (the joint's centre, wavering, plus half the gap on this side) at a height.
    const rollEdge = (yPx: number) => {
      const j = jointAt(k, cm(yPx), gapPx, scale);
      return cx + j.wob + (side * j.open) / 2;
    };
    // The torn edge, from the roll's edge at the top, out and back to it at the bottom.
    const steps = 48, edge: [number, number][] = [[rollEdge(top), top]];
    for (let i = 1; i < steps; i++) {
      const t = i / steps, y = top + t * hT, width = Math.sin(Math.PI * t) ** 0.7 * (1 - 0.55 * t);
      const ragged = 1 + 0.4 * fbm(i * 0.3, seg, 318 + k, 3) + (0.12 + 0.1 * s.sharpness) * (hash2(i, seg, 322 + k) - 0.5);
      edge.push([rollEdge(y) + side * wT * width * ragged, y]);
    }
    edge.push([rollEdge(top + hT), top + hT]);
    const path = new Path2D(); // out along the torn edge, back up the roll's own edge
    edge.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    for (let i = steps - 1; i > 0; i--) path.lineTo(rollEdge(top + (i / steps) * hT), top + (i / steps) * hT);
    path.closePath();

    // Plaster, stained with paste towards the torn edge, a few fibres left on it.
    ctx.save();
    ctx.clip(path);
    const tone = 0.94 + 0.08 * hash2(k, seg, 344);
    ctx.fillStyle = `rgb(${PLASTER.map((c) => Math.round(c * tone)).join(',')})`;
    ctx.fillRect(cx - wT * 1.5, top, wT * 3, hT);
    for (let i = 0; i < 70; i++) {
      const r = (0.04 + 0.12 * hash2(i, seg, 324)) * scale;
      ctx.fillStyle = `rgba(120,108,88,${(0.03 + 0.06 * hash2(i, seg, 319)).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(cx + side * wT * hash2(i, seg, 320), top + hT * hash2(i, seg, 321), r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(150,120,80,0.16)'; // old paste: a brownish margin inside the edge
    ctx.lineWidth = (0.25 + 0.2 * soft) * scale;
    ctx.stroke(path);
    for (let i = 0; i < 14; i++) {
      const [ex, ey] = edge[1 + Math.floor(hash2(i, seg, 345) * (steps - 2))]; // fibres still stuck near the edge
      ctx.fillStyle = `rgba(${CORE.join(',')},${(0.25 + 0.3 * hash2(i, seg, 346)).toFixed(2)})`;
      ctx.fillRect(ex - side * (0.05 + 0.15 * hash2(i, seg, 347)) * scale, ey, 0.6 * dpr, (0.05 + 0.1 * hash2(i, seg, 348)) * scale);
    }
    ctx.restore();

    // The torn edge, a piece at a time: broken, uneven, never along the seam.
    ctx.lineCap = 'round';
    for (let i = 1; i < edge.length - 2; i++) {
      const [x0, y0] = edge[i], [x1, y1] = edge[i + 1];
      const n = fbm(i * 0.45, seg * 1.3, 349 + k, 2) + 0.5; // 0–1 along the edge
      const nx = y1 - y0, ny = -(x1 - x0), nl = Math.hypot(nx, ny) || 1; // edge normal
      const facesAway = (side * nx) / nl * away > 0; // this bit of edge faces away from the light
      if (facesAway) {
        ctx.strokeStyle = `rgba(40,30,20,${(0.12 + 0.1 * n).toFixed(2)})`;
        ctx.lineWidth = dpr * (0.6 + 0.8 * soft);
        ctx.beginPath();
        ctx.moveTo(x0 + away * dpr * 0.7, y0 + dpr * 0.4);
        ctx.lineTo(x1 + away * dpr * 0.7, y1 + dpr * 0.4);
        ctx.stroke();
      }
      if (n < 0.35) continue; // the core shows only in places
      ctx.strokeStyle = `rgba(${CORE.join(',')},${((0.25 + 0.4 * (n - 0.35)) * (1 - 0.35 * soft)).toFixed(2)})`;
      ctx.lineWidth = dpr * (0.35 + 1.1 * (n - 0.35)) * (1 + soft);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }
}

export const STRIP_WIDTH_CM = STRIP_CM;

// Wall area to cover for what's on screen (wall cm), with a viewport's slack either side so pinned
// window moves don't need redraws.
export function areaFor(map: WallMap, vpWidth: number, headerH: number): AgeArea {
  const left = wallPoint(map, { x: 0, y: headerH }), right = wallPoint(map, { x: vpWidth, y: 0 });
  const span = right.x - left.x;
  return { x0: left.x - span, x1: right.x + span, yBottom: left.y, yTop: right.y + 20 };
}

let cached: { key: string; area: AgeArea; tint: HTMLCanvasElement; seams: { x: number; canvas: HTMLCanvasElement }[] } | undefined;

// The age layers for the header, placed in page px. Redrawn only when settings change or the view
// leaves the area already drawn.
export function ageLayers(map: WallMap, vpWidth: number, headerH: number, s: AgeStyle, f: Frame, light: Vec3, dpr: number): HTMLElement[] {
  const ppc = map.pxPerCm, key = JSON.stringify([s, f, ppc, dpr, light]);
  const want = areaFor(map, vpWidth, headerH), have = cached?.area;
  const covered = have && cached!.key === key && want.x0 + (want.x1 - want.x0) / 3 >= have.x0 && want.x1 - (want.x1 - want.x0) / 3 <= have.x1 && want.yTop - 20 <= have.yTop;
  if (!covered) {
    const seams = s.seams > 0 ? seamsIn(want.x0 - STRIP_CM, want.x1 + STRIP_CM) : []; // none at all at 0
    cached = { key, area: want, tint: drawTint(want, s, f), seams: seams.map((x) => ({ x, canvas: drawSeam(x, want, s.seams, s.seam, ppc, dpr, light) })) };
    cached.tint.className = 'paper-age';
    for (const seam of cached.seams) seam.canvas.className = 'paper-seam';
  }
  const { area, tint, seams } = cached!;
  const page = (x: number, y: number) => ({ x: map.embroideryPage.x + (x - map.embroidery.x) * ppc, y: map.embroideryPage.y - (y - map.embroidery.y) * ppc });
  const tl = page(area.x0, area.yTop);
  Object.assign(tint.style, { left: `${tl.x}px`, top: `${tl.y}px`, width: `${(area.x1 - area.x0) * ppc}px`, height: `${(area.yTop - area.yBottom) * ppc}px` });
  for (const seam of seams) {
    const at = page(seam.x - STRIP_CM / 2, area.yTop);
    Object.assign(seam.canvas.style, { left: `${at.x}px`, top: `${at.y}px`, width: `${STRIP_CM * ppc}px`, height: `${(area.yTop - area.yBottom) * ppc}px` });
  }
  return [tint, ...seams.map((seam) => seam.canvas)];
}
