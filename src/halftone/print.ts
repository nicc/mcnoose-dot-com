// Draws a tile's logo + title as halftone dots onto a canvas.
import type { Config } from '../config';
import { loadLogo } from './logo';
import { densityFromRGBA, hashString, screenDots } from './screen';

const SOURCE_SCALE = 2; // source px per CSS px: enough samples per dot cell for clean tone
const TITLE_MAX_WIDTH = 0.86; // of tile; longer titles shrink to fit

export interface PrintJob {
  canvas: HTMLCanvasElement;
  title: string;
  logoUrl: string;
  tile: number; // CSS px
}

function drawSource(c: Config, logo: HTMLImageElement, title: string, size: number): CanvasRenderingContext2D {
  const src = document.createElement('canvas');
  src.width = src.height = size;
  const ctx = src.getContext('2d', { willReadFrequently: true })!;

  let font = c.TILE_TITLE_SIZE * size;
  const setFont = () => (ctx.font = `${c.TILE_TITLE_WEIGHT} ${font}px ${c.TILE_TITLE_FONT}`);
  setFont();
  const textW = ctx.measureText(title).width;
  if (textW > TITLE_MAX_WIDTH * size) {
    font *= (TITLE_MAX_WIDTH * size) / textW;
    setFont();
  }

  // Fixed logo box keeps titles on a common baseline across a row.
  const box = c.TILE_LOGO_SIZE * size;
  const gap = c.TILE_TITLE_GAP * size;
  const top = (size - (box + gap + c.TILE_TITLE_SIZE * size)) / 2;
  const k = Math.min(box / logo.naturalWidth, box / logo.naturalHeight);
  const lw = logo.naturalWidth * k, lh = logo.naturalHeight * k;
  ctx.drawImage(logo, (size - lw) / 2, top + (box - lh) / 2, lw, lh);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.fillText(title, size / 2, top + box + gap + font * 0.8);
  return ctx;
}

export async function printTile(c: Config, job: PrintJob): Promise<void> {
  const logo = await loadLogo(job.logoUrl);
  await document.fonts.ready;
  if (!job.canvas.isConnected) return; // superseded by a newer render

  const size = Math.round(job.tile * SOURCE_SCALE);
  const src = drawSource(c, logo, job.title, size);
  const density = densityFromRGBA(src.getImageData(0, 0, size, size).data);
  const dots = screenDots(density, size, size, {
    pitch: c.HALFTONE_PITCH_PX * SOURCE_SCALE,
    angleDeg: c.HALFTONE_ANGLE_DEG,
    gain: c.HALFTONE_GAIN,
    minDot: c.HALFTONE_MIN_DOT,
    jitter: c.HALFTONE_JITTER,
    noise: c.HALFTONE_NOISE,
    seed: hashString(job.title),
  });

  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const out = job.canvas;
  out.width = out.height = Math.round(job.tile * dpr);
  const ctx = out.getContext('2d')!;
  ctx.scale(dpr / SOURCE_SCALE, dpr / SOURCE_SCALE);
  ctx.fillStyle = c.PRINT_COLOR;
  ctx.beginPath();
  for (let i = 0; i < dots.length; i += 3) {
    ctx.moveTo(dots[i] + dots[i + 2], dots[i + 1]);
    ctx.arc(dots[i], dots[i + 1], dots[i + 2], 0, Math.PI * 2);
  }
  ctx.fill();
}
