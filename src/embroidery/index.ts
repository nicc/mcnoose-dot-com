// The framed sampler as a cached canvas: redrawn only when its size or settings change, so
// resizes and window moves just re-attach it.
import type { Config } from '../config';
import { layoutSampler } from './chart';
import { drawEmbroidery, embroiderySize, type EmbroideryStyle } from './draw';

export const SAMPLER_LINES = ['Snickers', 'McNoose'];
const chart = layoutSampler(SAMPLER_LINES);

let key = '';
let canvas: HTMLCanvasElement | undefined;

export function embroidery(c: Config, tile: number): { canvas: HTMLCanvasElement; width: number; height: number } {
  const style: EmbroideryStyle = {
    stitch: c.EMBROIDERY_STITCH_SIZE * tile,
    frame: c.EMBROIDERY_FRAME * tile,
    colors: { cloth: c.EMBROIDERY_CLOTH, T: c.EMBROIDERY_THREAD, P: c.EMBROIDERY_PETAL, L: c.EMBROIDERY_LEAF, wood: c.EMBROIDERY_WOOD },
    lightDeg: c.WALLPAPER_LIGHT_DEG,
    tiltDeg: c.EMBROIDERY_TILT_DEG,
    dpr: Math.min(3, devicePixelRatio || 1),
  };
  const size = embroiderySize(chart, style);
  const next = JSON.stringify(style);
  if (!canvas || next !== key) {
    canvas = document.createElement('canvas');
    canvas.className = 'embroidery';
    canvas.setAttribute('aria-hidden', 'true');
    drawEmbroidery(canvas, chart, style);
    key = next;
  }
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
  return { canvas, ...size };
}
