// Draws a tile's logo + title as halftone dots onto a canvas.
import { loadImage, renderHalftone } from 'halftone-print';
import type { Config } from '../config';

// Logos are shared across re-anchors and config changes, so load each once.
const logos = new Map<string, Promise<HTMLImageElement>>();
const loadLogo = (url: string) => {
  let p = logos.get(url);
  if (!p) logos.set(url, (p = loadImage(url)));
  return p;
};

const SOURCE_SCALE = 2; // source px per CSS px: enough samples per dot cell for clean tone
const TITLE_MAX_WIDTH = 0.86; // of tile; longer titles shrink to fit

export interface PrintJob {
  canvas: HTMLCanvasElement;
  clean?: HTMLCanvasElement; // the same layout unprinted: the logo in its own colours (hover)
  title: string;
  logoUrl: string;
  tile: number; // CSS px
}

function drawSource(c: Config, logo: HTMLImageElement, title: string, size: number, ink = '#000', into?: HTMLCanvasElement): CanvasRenderingContext2D {
  const src = into ?? document.createElement('canvas');
  src.width = src.height = size;
  const ctx = src.getContext('2d')!;

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
  ctx.fillStyle = ink;
  ctx.fillText(title, size / 2, top + box + gap + font * 0.8);
  return ctx;
}

export async function printTile(c: Config, job: PrintJob): Promise<void> {
  const logo = await loadLogo(job.logoUrl);
  await document.fonts.ready;
  if (!job.canvas.isConnected) return; // superseded by a newer render

  // Compose logo + title at sampling resolution, then print it 1:1 into the tile.
  const src = drawSource(c, logo, job.title, Math.round(job.tile * SOURCE_SCALE));
  renderHalftone(job.canvas, src.canvas, {
    width: job.tile,
    height: job.tile,
    fit: 'fill',
    sampleScale: SOURCE_SCALE,
    pitch: c.HALFTONE_PITCH_PX,
    angle: c.HALFTONE_ANGLE_DEG,
    gain: c.HALFTONE_GAIN,
    minDot: c.HALFTONE_MIN_DOT,
    jitter: c.HALFTONE_JITTER,
    noise: c.HALFTONE_NOISE,
    seed: job.title,
    color: c.PRINT_COLOR,
  });
  if (job.clean) drawSource(c, logo, job.title, Math.round(job.tile * Math.min(3, devicePixelRatio || 1)), c.PRINT_COLOR, job.clean);
}
