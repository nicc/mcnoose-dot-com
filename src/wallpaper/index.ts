// Live wallpaper render, dev only: re-renders on every panel change. Production uses the
// tile baked at build time by tools/wallpaper-bake.ts from the same renderWallpaper().
// Source: Sidewall, ca. 1875, Cooper Hewitt, Smithsonian Design Museum, 1939-45-7 (CC0).
import type { Config } from '../config';
import inksUrl from './inks.png';
import { ASPECT, inkIndex, renderWallpaper } from './render';
import scanUrl from './scan.webp';

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
  const rgba = renderWallpaper(c, albedo, inkIndex(pixels(inksImg, w, h, false), 4), w, h, dpr);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  const blob = await new Promise<Blob>((r, reject) => canvas.toBlob((b) => (b ? r(b) : reject(new Error('wallpaper: toBlob failed')))));
  return { url: URL.createObjectURL(blob), width, height };
}
