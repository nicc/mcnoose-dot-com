// The wallpaper pipeline as pure maths, shared by the live dev render (browser) and the
// build-time bake (Node): scan + ink map → recoloured, pebble-embossed, lit RGBA.
import type { Config } from '../config';
import { lightsAt, roomFromConfig, viewAt } from '../room';
import palette from './palette.json';
import { hexToRgb, type RGB } from '../colour';
import { recolour } from './recolour';
import { blurWrap, pebbles, shade } from './relief';

export const ASPECT = 1660 / 1200; // repeat height / width of scan.webp

// Config key per ink, in inks.png index order.
export const INK_KEYS = palette.inks.map((ink) => `WALLPAPER_${ink.name.toUpperCase()}`) as (keyof Config)[];
const ORIGINAL = palette.inks.map((ink) => ink.rgb as RGB);

export function inkIndex(inkPx: Uint8ClampedArray | Uint8Array, channels: number): Uint8Array {
  const index = new Uint8Array(inkPx.length / channels);
  for (let i = 0; i < index.length; i++) index[i] = Math.min(ORIGINAL.length - 1, Math.round(inkPx[i * channels] / palette.indexStep));
  return index;
}

// albedo: RGBA scan pixels at w×h (modified in place). pxPerCss: output pixels per CSS px,
// which keeps pebble size and relief consistent across resolutions.
export function renderWallpaper(c: Config, albedo: Uint8ClampedArray, index: Uint8Array, w: number, h: number, pxPerCss: number): Uint8ClampedArray {
  recolour(albedo, index, w, h, ORIGINAL, INK_KEYS.map((k) => hexToRgb(c[k] as string)), pxPerCss);

  // Pebbled emboss over the whole sheet; printed inks sit slightly proud of the ground.
  const height = pebbles(w, h, c.WALLPAPER_PEBBLE_PX * pxPerCss);
  const ink = blurWrap(Float32Array.from(index, (k) => (k === 0 ? 0 : c.WALLPAPER_INK_RELIEF)), w, h, pxPerCss, 1);
  for (let i = 0; i < height.length; i++) height[i] = height[i] * 0.5 + ink[i];

  return shade(height, w, h, {
    albedo,
    relief: c.WALLPAPER_RELIEF * c.WALLPAPER_PEBBLE_PX * pxPerCss * 0.5,
    lights: lightsAt(roomFromConfig(c), roomFromConfig(c).embroidery), // the header sits around embroidery height
    ambient: c.WALLPAPER_AMBIENT,
    sheen: c.WALLPAPER_SHEEN,
    view: viewAt(roomFromConfig(c), roomFromConfig(c).embroidery),
  });
}
