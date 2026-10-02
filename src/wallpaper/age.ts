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
  seams: number;
  halo: number;
  haloSpreadDeg: number;
}

const RES = 3; // tint cells per cm
const ROLL_CM = 53; // a roll's width (21 in)
const SEAM_OFFSET_CM = 19;
const STRIP_CM = 8; // each seam's canvas width
const HALO_CM = 2.2; // how far the grime spreads from the frame's edge
const STAIN_CELL_CM = 60;
const AGED = [224, 204, 158], DIRT = [118, 104, 86], STAIN = [214, 186, 140], TIDE = [176, 146, 104];
const PLASTER = [190, 181, 164], CORE = [236, 228, 210];
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

// Seam x positions (wall cm) across an area.
export function seamsIn(x0: number, x1: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil((x0 - SEAM_OFFSET_CM) / ROLL_CM); SEAM_OFFSET_CM + k * ROLL_CM <= x1; k++) out.push(SEAM_OFFSET_CM + k * ROLL_CM);
  return out;
}

// One seam's strip (STRIP_CM wide, centred on the seam): joint, lifted edges, tears to plaster.
// light: blended room light direction (screen coords), for which side shadows fall.
export function drawSeam(seamX: number, area: AgeArea, s: AgeStyle, ppc: number, dpr: number, light: Vec3): HTMLCanvasElement {
  const k = Math.round(seamX / ROLL_CM), scale = ppc * dpr;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(STRIP_CM * scale);
  canvas.height = Math.ceil((area.yTop - area.yBottom) * scale);
  const ctx = canvas.getContext('2d')!, cx = canvas.width / 2, py = (yCm: number) => (area.yTop - yCm) * scale;
  const away = light[0] > 0 ? -1 : 1; // shadows fall away from the light, sideways
  ctx.fillStyle = `rgba(50,38,26,${(0.12 + 0.25 * s.seams).toFixed(3)})`;
  ctx.fillRect(cx - 0.5 * dpr, 0, 1 * dpr, canvas.height); // the butt joint
  if (s.seams <= 0) return canvas;
  for (let seg = Math.floor(area.yBottom / 12); seg * 12 < area.yTop; seg++) {
    const y0 = seg * 12 + 12 * hash2(k, seg, 311), side = hash2(k, seg, 312) < 0.5 ? -1 : 1;
    const roll = hash2(k, seg, 313);
    if (roll < 0.3 * s.seams) {
      // A lifted edge: catches the light along its lip, shadows the wall beside it.
      const len = (4 + 12 * hash2(k, seg, 314)) * scale, top = py(y0) - len, lift = (0.08 + 0.12 * hash2(k, seg, 315)) * scale;
      const g = ctx.createLinearGradient(cx, 0, cx + away * lift * 2, 0);
      g.addColorStop(0, 'rgba(30,20,10,0.35)');
      g.addColorStop(1, 'rgba(30,20,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx + away * lift, top + len / 2, lift * 1.5, len / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,250,236,0.55)';
      ctx.fillRect(cx - (away * dpr) / 2, top + len * 0.1, dpr, len * 0.8);
    } else if (roll < 0.3 * s.seams + 0.38 * s.seams) {
      // A tear back to the plaster: a strip torn away from the seam, widest near where it started
      // and tapering as it ran down, its far edge jagged with torn fibres.
      const wT = (0.8 + 1.8 * hash2(k, seg, 316)) * scale, hT = (2 + 5 * hash2(k, seg, 317)) * scale, top = py(y0) - hT;
      const path = new Path2D();
      path.moveTo(cx, top);
      const steps = 36;
      for (let i = 1; i < steps; i++) {
        const t = i / steps, width = Math.sin(Math.PI * t) ** 0.7 * (1 - 0.55 * t);
        const ragged = 1 + 0.45 * fbm(i * 0.35, seg, 318 + k, 3) + 0.18 * (hash2(i, seg, 322 + k) - 0.5);
        path.lineTo(cx + side * wT * width * ragged, top + t * hT + (hash2(i, seg, 323) - 0.5) * 0.06 * scale);
      }
      path.lineTo(cx, top + hT);
      path.closePath();
      ctx.save();
      ctx.fillStyle = `rgb(${PLASTER.join(',')})`;
      ctx.fill(path);
      ctx.clip(path);
      for (let i = 0; i < 90; i++) {
        const r = (0.04 + 0.14 * hash2(i, seg, 324)) * scale; // mottling: old grime and paste
        ctx.fillStyle = `rgba(120,108,88,${(0.04 + 0.08 * hash2(i, seg, 319)).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(cx + side * wT * hash2(i, seg, 320), top + hT * hash2(i, seg, 321), r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(away * dpr * 0.8, dpr * 0.6); // paper thickness: a shadow on the plaster
      ctx.strokeStyle = 'rgba(40,30,20,0.35)';
      ctx.lineWidth = dpr;
      ctx.stroke(path);
      ctx.restore();
      ctx.strokeStyle = `rgba(${CORE.join(',')},0.85)`; // the paper's pale torn core
      ctx.lineWidth = dpr * 0.7;
      ctx.stroke(path);
    }
  }
  return canvas;
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
    cached = { key, area: want, tint: drawTint(want, s, f), seams: seamsIn(want.x0 - STRIP_CM, want.x1 + STRIP_CM).map((x) => ({ x, canvas: drawSeam(x, want, s, ppc, dpr, light) })) };
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
