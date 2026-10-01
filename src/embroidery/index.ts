// The framed sampler as a cached canvas: redrawn only when its size or settings change, so
// resizes and window moves just re-attach it.
import type { Config } from '../config';
import { layoutSampler, type Chart } from './chart';
import { downscale, drawEmbroidery, embroiderySize, type EmbroideryStyle } from './draw';

export const SAMPLER_LINES = ['Snickers', 'McNoose'];

let chartKey = '';
let chart: Chart;
let key = '';
let canvas: HTMLCanvasElement | undefined;

// EMBROIDERY_STITCH_SIZE sets detail (how big each stitch is drawn); EMBROIDERY_ZOOM scales the
// finished piece. Zooming out shrinks a detailed render rather than drawing tiny stitches.
export function embroidery(c: Config, tile: number): { canvas: HTMLCanvasElement; width: number; height: number } {
  const cloth = { w: c.EMBROIDERY_CLOTH_W, h: c.EMBROIDERY_CLOTH_H };
  if (JSON.stringify(cloth) !== chartKey) {
    chart = layoutSampler(SAMPLER_LINES, cloth);
    chartKey = JSON.stringify(cloth);
  }
  const dpr = Math.min(3, devicePixelRatio || 1);
  const zoom = c.EMBROIDERY_ZOOM;
  const style: EmbroideryStyle = {
    stitch: c.EMBROIDERY_STITCH_SIZE * tile,
    frame: c.EMBROIDERY_FRAME * tile,
    colors: { cloth: c.EMBROIDERY_CLOTH, T: c.EMBROIDERY_THREAD, P: c.EMBROIDERY_PETAL, L: c.EMBROIDERY_LEAF, wood: c.EMBROIDERY_WOOD },
    lightDeg: c.WALLPAPER_LIGHT_DEG,
    tiltDeg: c.EMBROIDERY_TILT_DEG,
    dpr,
  };
  const natural = embroiderySize(chart, style);
  const size = { width: natural.width * zoom, height: natural.height * zoom };
  const next = JSON.stringify([style, zoom, chartKey]);
  if (!canvas || next !== key) {
    if (zoom >= 1) {
      canvas = document.createElement('canvas');
      drawEmbroidery(canvas, chart, { ...style, dpr: dpr * zoom }); // crisp at the larger size
    } else {
      const full = document.createElement('canvas');
      drawEmbroidery(full, chart, style);
      canvas = downscale(full, Math.max(1, Math.round(size.width * dpr)), Math.max(1, Math.round(size.height * dpr)));
    }
    canvas.className = 'embroidery';
    canvas.setAttribute('aria-hidden', 'true');
    key = next;
  }
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
  return { canvas, ...size };
}
