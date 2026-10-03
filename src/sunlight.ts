// The quality of the window's light, and direct sun.
//
// Colour: the window light's colour temperature (ROOM_LIGHT_KELVIN), from golden late light to cool
// north sky. It tints the window's share of the room's light (the ceiling fill keeps its own colour)
// with one multiply layer over the scene; at 6500 K (neutral) the layer is off.
//
// Sun patch: when the sun is out, it throws the window onto this wall — a bright patch of four panes
// crossed by the sash bars' shadows, the window's own size (sun rays are parallel), shifted down and
// across by the sun's elevation and azimuth. It brightens whatever it falls on (color-dodge with a
// grey is an exact multiply-up), soft-edged by ROOM_SUN_SOFTNESS_CM, and comes and goes with the
// clouds (--sunlit, set by clouds.ts): direct sun is the first thing a cloud takes away.
import type { Config } from './config';
import { roomFromConfig, type Room } from './room';
import type { Sky } from './sunset';
import type { WallMap } from './tiles/surface';

// The sky now (the sunset, sunset.ts) and how much direct sun the clouds let through (clouds.ts):
// kept here so a re-render puts the tint and the patch straight back where they've got to.
let sky: Sky | undefined;
let sunNow = 1;

const NEUTRAL_K = 6500;
const ADAPTED = 0.6; // the eye adapts to a room's light: it sees ~60% of a camera's colour shift
const BAR_CM = 5; // sash frame and glazing bars, as in the glass's reflection

// Approximate sRGB of a black body at kelvin k (Tanner Helland's fit), 0–255.
export function kelvinRgb(k: number): [number, number, number] {
  const t = k / 100, c = (v: number) => Math.max(0, Math.min(255, v));
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [c(r), c(g), c(b)];
}

// The window light's colour relative to neutral daylight, as the eye sees it once adapted,
// brightest channel 1 (a multiply tint).
export function lightTint(k: number): [number, number, number] {
  const a = kelvinRgb(k), n = kelvinRgb(NEUTRAL_K), rel = a.map((v, i) => v / n[i]), m = Math.max(...rel);
  return rel.map((v) => 1 - ADAPTED * (1 - v / m)) as [number, number, number];
}

const windowShare = (r: Room) => (r.sun * (1 + r.bounce)) / (r.sun * (1 + r.bounce) + r.fill || 1);

// The whole-scene tint, as a multiply colour (white = none).
export function sceneTint(c: Config, kelvin = sky?.kelvin ?? c.ROOM_LIGHT_KELVIN): string | undefined {
  if (Math.abs(kelvin - NEUTRAL_K) < 1) return undefined;
  const share = windowShare(roomFromConfig(c)), t = lightTint(kelvin);
  return `rgb(${t.map((v) => Math.round(255 * (1 - share * (1 - v)))).join(',')})`;
}

let tintLayer: HTMLElement | undefined;
export function applyTint(c: Config): void {
  tintLayer ??= Object.assign(document.createElement('div'), { className: 'light-tint' });
  tintLayer.setAttribute('aria-hidden', 'true');
  const tint = sceneTint(c);
  if (!tint) return void tintLayer.remove();
  tintLayer.style.background = tint;
  if (!tintLayer.isConnected) document.body.append(tintLayer);
}

// Where the sun puts the window on this wall, in wall cm (y up).
export function patchRect(c: Config, elevation = c.ROOM_SUN_ELEVATION_DEG, azimuth = c.ROOM_SUN_AZIMUTH_DEG): { x0: number; x1: number; y0: number; y1: number } {
  const r = roomFromConfig(c), w = r.window, rad = Math.PI / 180;
  const dx = r.depthCm * Math.tan(azimuth * rad), dy = -r.depthCm * Math.tan(elevation * rad);
  return { x0: w.x - w.width / 2 + dx, x1: w.x + w.width / 2 + dx, y0: w.bottom + dy, y1: w.bottom + w.height + dy };
}

let patchCache: { key: string; canvas: HTMLCanvasElement } | undefined;

// The patch, placed in page px (map: wall cm ↔ page px). Undefined when there's no sun patch.
export function sunPatch(c: Config, map: WallMap): HTMLElement | undefined {
  if (c.ROOM_SUN_PATCH <= 0) return undefined;
  const rect = patchRect(c), soft = Math.max(0.2, c.ROOM_SUN_SOFTNESS_CM), margin = soft * 2;
  // Drawn at about one pixel per softness and scaled up smoothly: the scaling is the soft edge.
  const res = Math.max(0.3, Math.min(4, 1 / soft));
  const tint = lightTint(c.ROOM_LIGHT_KELVIN), boost = c.ROOM_SUN_PATCH;
  const key = JSON.stringify([rect, soft, tint, boost]);
  if (!patchCache || patchCache.key !== key) {
    const wCm = rect.x1 - rect.x0 + 2 * margin, hCm = rect.y1 - rect.y0 + 2 * margin;
    const canvas = document.createElement('canvas');
    canvas.className = 'sun-patch';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = Math.max(2, Math.round(wCm * res));
    canvas.height = Math.max(2, Math.round(hCm * res));
    const ctx = canvas.getContext('2d')!;
    ctx.scale(res, res);
    // color-dodge divides by (1 − src): src = 1 − 1/(1 + boost·tint) multiplies the light by 1 + boost·tint.
    ctx.fillStyle = `rgb(${tint.map((t) => Math.round(255 * (1 - 1 / (1 + boost * t)))).join(',')})`;
    const pw = (rect.x1 - rect.x0 - 3 * BAR_CM) / 2, ph = (rect.y1 - rect.y0 - 3 * BAR_CM) / 2;
    for (const i of [0, 1]) for (const j of [0, 1]) ctx.fillRect(margin + BAR_CM + i * (pw + BAR_CM), margin + BAR_CM + j * (ph + BAR_CM), pw, ph);
    patchCache = { key, canvas };
  }
  const ppc = map.pxPerCm, canvas = patchCache.canvas;
  const left = map.embroideryPage.x + (rect.x0 - margin - map.embroidery.x) * ppc, top = map.embroideryPage.y - (rect.y1 + margin - map.embroidery.y) * ppc;
  Object.assign(canvas.style, { left: `${left}px`, top: `${top}px`, width: `${(rect.x1 - rect.x0 + 2 * margin) * ppc}px`, height: `${(rect.y1 - rect.y0 + 2 * margin) * ppc}px` });
  canvas.dataset.ppc = String(ppc);
  placePatch(c, canvas);
  return canvas;
}

// The sun patch where the sky has got to: slid (a lower sun puts it higher, a swung one across) and
// faded, without redrawing it.
function placePatch(c: Config, canvas: HTMLElement) {
  const ppc = Number(canvas.dataset.ppc) || 0, from = patchRect(c), to = sky ? patchRect(c, sky.elevation, sky.azimuth) : from;
  canvas.style.transform = sky ? `translate(${((to.x0 - from.x0) * ppc).toFixed(1)}px, ${(-(to.y1 - from.y1) * ppc).toFixed(1)}px)` : '';
  canvas.style.setProperty('--sunlit', (sunNow * (sky?.patch ?? 1)).toFixed(3));
}

// The sky has moved on (the sunset) or the clouds have changed how much direct sun gets through.
export function setSky(c: Config, s: Sky, sun: number) {
  const tintChanged = !sky || Math.abs(s.kelvin - sky.kelvin) >= 5;
  sky = s;
  sunNow = sun;
  if (tintChanged) applyTint(c);
  const patch = document.querySelector<HTMLElement>('.sun-patch');
  if (patch) placePatch(c, patch);
}

// How much direct sun there is at cloud level k (1 = clear): by how far the window light has
// actually dropped — gone once a cloud dims it by `hide` (so a shallow cloud depth barely touches it).
export function sunlit(k: number, hide: number): number {
  const x = Math.max(0, Math.min(1, 1 - (1 - k) / Math.max(0.01, hide)));
  return x * x * (3 - 2 * x);
}
