// The framed sampler as a cached canvas: redrawn only when its size or settings change, so
// resizes and window moves just re-attach it.
import type { Config } from '../config';
import { hexToRgb } from '../wallpaper/relief';
import { layoutSampler, type Chart } from './chart';
import { drawEmbroidery, embroiderySize, type EmbroideryStyle } from './draw';

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
    colors: { cloth: c.EMBROIDERY_CLOTH, T: c.EMBROIDERY_THREAD, P: c.EMBROIDERY_PETAL, L: c.EMBROIDERY_LEAF },
    wood: {
      early: hexToRgb(c.EMBROIDERY_WOOD),
      late: hexToRgb(c.EMBROIDERY_WOOD_LATE),
      ring: c.EMBROIDERY_WOOD_RINGS * tile,
      figure: c.EMBROIDERY_WOOD_FIGURE,
      pores: c.EMBROIDERY_WOOD_PORES,
      drift: c.EMBROIDERY_WOOD_DRIFT,
      variation: c.EMBROIDERY_WOOD_VARIATION,
      depth: c.EMBROIDERY_WOOD_DEPTH,
      sheen: c.EMBROIDERY_WOOD_SHEEN,
      gloss: c.EMBROIDERY_WOOD_GLOSS,
      wear: c.EMBROIDERY_WOOD_WEAR,
      grime: c.EMBROIDERY_WOOD_GRIME,
      patches: c.EMBROIDERY_WOOD_PATCHES,
    },
    lightDeg: c.WALLPAPER_LIGHT_DEG,
    tiltDeg: c.EMBROIDERY_TILT_DEG,
    dpr,
  };
  const natural = embroiderySize(chart, style);
  const size = { width: natural.width * zoom, height: natural.height * zoom };
  const next = JSON.stringify([style, zoom, chartKey]);
  if (!canvas || next !== key) {
    canvas = document.createElement('canvas');
    drawEmbroidery(canvas, chart, style, zoom);
    canvas.className = 'embroidery';
    canvas.setAttribute('aria-hidden', 'true');
    key = next;
  }
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
  return { canvas, ...size };
}
