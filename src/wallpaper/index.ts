// Builds the wallpaper repeat as an image URL, cached per size and settings.
// Source: Sidewall, ca. 1875, Cooper Hewitt, Smithsonian Design Museum, 1939-45-7 (CC0), prepared by
// scripts/prepare-wallpaper.ts into a seamless repeat (scan.webp) and a per-pixel ink map (inks.png).
// Here it's recoloured per ink, given its pebbled emboss back, and lit.
import type { Config } from '../config';
import inksUrl from './inks.png';
import palette from './palette.json';
import { recolour, type RGB } from './recolour';
import { blurWrap, hexToRgb, pebbles, shade } from './relief';
import scanUrl from './scan.webp';

const ELEVATION_DEG = 55; // room light from above, not raking
const ASPECT = 1660 / 1200; // repeat height / width of scan.webp

// Config key per ink, in inks.png index order.
export const INK_KEYS = palette.inks.map((ink) => `WALLPAPER_${ink.name.toUpperCase()}`) as (keyof Config)[];
const ORIGINAL = palette.inks.map((ink) => ink.rgb as RGB);

export interface Wallpaper {
  url: string;
  width: number; // CSS px of one repeat
  height: number;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('wallpaper: image failed to load'));
    img.src = src;
  });
let sources: Promise<[HTMLImageElement, HTMLImageElement]> | undefined;

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

function pixels(img: HTMLImageElement, w: number, h: number, smooth: boolean): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = smooth; // the ink map must stay exact: nearest-neighbour
  if (smooth) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

async function build(c: Config, tile: number, dpr: number): Promise<Wallpaper> {
  sources ??= Promise.all([loadImage(scanUrl), loadImage(inksUrl)]);
  const [scanImg, inksImg] = await sources;
  const width = c.WALLPAPER_ZOOM * tile;
  const height = width * ASPECT;
  const w = Math.max(8, Math.round(width * dpr));
  const h = Math.max(8, Math.round(height * dpr));

  const albedo = pixels(scanImg, w, h, true);
  const inkPx = pixels(inksImg, w, h, false);
  const index = new Uint8Array(w * h);
  for (let i = 0; i < index.length; i++) index[i] = Math.min(ORIGINAL.length - 1, Math.round(inkPx[i * 4] / palette.indexStep));

  const target = INK_KEYS.map((k) => hexToRgb(c[k] as string));
  recolour(albedo, index, w, h, ORIGINAL, target, dpr);

  // Pebbled emboss over the whole sheet; printed inks sit slightly proud of the ground.
  const height_ = pebbles(w, h, c.WALLPAPER_PEBBLE_PX * dpr);
  const ink = blurWrap(Float32Array.from(index, (k) => (k === 0 ? 0 : c.WALLPAPER_INK_RELIEF)), w, h, dpr, 1);
  for (let i = 0; i < height_.length; i++) height_[i] = height_[i] * 0.5 + ink[i];

  const rgba = shade(height_, w, h, {
    albedo,
    relief: c.WALLPAPER_RELIEF * c.WALLPAPER_PEBBLE_PX * dpr * 0.5, // slope scale tied to pebble size: same look at any dpr
    lightDeg: c.WALLPAPER_LIGHT_DEG,
    elevationDeg: ELEVATION_DEG,
    ambient: c.WALLPAPER_AMBIENT,
    sheen: c.WALLPAPER_SHEEN,
  });

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  const blob = await new Promise<Blob>((r, reject) => canvas.toBlob((b) => (b ? r(b) : reject(new Error('wallpaper: toBlob failed')))));
  return { url: URL.createObjectURL(blob), width, height };
}
