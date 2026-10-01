// Builds the embossed wallpaper repeat as an image URL, cached per size and settings.
import type { Config } from '../config';
import { drawMotif } from './motif';
import { blurWrap, hexToRgb, shade, stipple } from './relief';

const ASPECT = 1.4; // repeat height / width: ogee cells are taller than wide
const ELEVATION_DEG = 55; // room light from above, not raking: keeps both lattice diagonals legible
const STIPPLE = 0.05; // fine sand texture depth, relative to motif height

export interface Wallpaper {
  url: string;
  width: number; // CSS px of one repeat
  height: number;
}

let cacheKey = '';
let cached: Promise<Wallpaper> | undefined;
let current: Wallpaper | undefined;
let previousUrl: string | undefined;

export function wallpaperReady(): Wallpaper | undefined {
  return current;
}

export function wallpaper(c: Config, tile: number): Promise<Wallpaper> {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const key = JSON.stringify([tile, dpr, Object.entries(c).filter(([k]) => k.startsWith('WALLPAPER_'))]);
  if (key === cacheKey && cached) return cached;
  cacheKey = key;
  current = undefined;
  cached = build(c, tile, dpr).then((wp) => {
    if (key !== cacheKey) {
      URL.revokeObjectURL(wp.url); // superseded before it was used
      return wp;
    }
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    previousUrl = wp.url;
    current = wp;
    return wp;
  });
  return cached;
}

async function build(c: Config, tile: number, dpr: number): Promise<Wallpaper> {
  const width = c.WALLPAPER_ZOOM * tile;
  const height = width * ASPECT;
  const w = Math.max(8, Math.round(width * dpr));
  const h = Math.max(8, Math.round(height * dpr));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  drawMotif(ctx, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const raw = new Float32Array(w * h);
  for (let i = 0; i < raw.length; i++) raw[i] = px[i * 4] / 255;

  const soft = blurWrap(raw, w, h, c.WALLPAPER_SOFTNESS * w);
  const sand = blurWrap(stipple(w, h, STIPPLE), w, h, dpr, 1);
  for (let i = 0; i < soft.length; i++) soft[i] += sand[i];

  const rgba = shade(soft, w, h, {
    color: hexToRgb(c.WALLPAPER_COLOR),
    relief: c.WALLPAPER_RELIEF * w * 0.02, // scale-free: same look at any size or pixel density
    lightDeg: c.WALLPAPER_LIGHT_DEG,
    elevationDeg: ELEVATION_DEG,
    ambient: c.WALLPAPER_AMBIENT,
    sheen: c.WALLPAPER_SHEEN,
  });
  ctx.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  const blob = await new Promise<Blob>((r, reject) => canvas.toBlob((b) => (b ? r(b) : reject(new Error('wallpaper: toBlob failed')))));
  return { url: URL.createObjectURL(blob), width, height };
}
