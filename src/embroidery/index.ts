// The framed sampler as cached canvases: redrawn only when size or settings change, so resizes
// and window moves just re-attach them. The glass's window reflection is a separate layer that
// slides with parallax as the view scrolls (updateReflection), which is what makes it read as glass.
import type { Config } from '../config';
import { lightsAt, parallaxFactor, pxPerCm, reflectedWindow, roomFromConfig } from '../room';
import { drawWindowReflection, parallaxOffset } from '../surface/reflection';
import { hexToRgb } from '../wallpaper/relief';
import { layoutSampler, type Chart } from './chart';
import { drawEmbroidery, embroiderySize, type EmbroideryStyle } from './draw';

export const SAMPLER_LINES = ['Snickers', 'McNoose'];

let chartKey = '';
let chart: Chart;
let key = '';
let canvas: HTMLCanvasElement | undefined;
let reflectionKey = '';
let reflection: HTMLCanvasElement | undefined;
const glass = document.createElement('div');
glass.className = 'glass';
let margin = 0;
let parallax = 0;
let tilt = 0;

export interface Embroidered {
  canvas: HTMLCanvasElement;
  glass: HTMLElement; // positioned over the cloth; holds the reflection layer
  width: number;
  height: number;
}

// EMBROIDERY_STITCH_SIZE sets detail (how big each stitch is drawn); EMBROIDERY_ZOOM scales the
// finished piece. Zooming out shrinks a detailed render rather than drawing tiny stitches.
export function embroidery(c: Config, tile: number): Embroidered {
  const cloth = { w: c.EMBROIDERY_CLOTH_W, h: c.EMBROIDERY_CLOTH_H };
  if (JSON.stringify(cloth) !== chartKey) {
    chart = layoutSampler(SAMPLER_LINES, cloth);
    chartKey = JSON.stringify(cloth);
  }
  const dpr = Math.min(3, devicePixelRatio || 1);
  const zoom = c.EMBROIDERY_ZOOM;
  const room = roomFromConfig(c);
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
    glass: {
      tint: c.EMBROIDERY_GLASS_TINT,
      spots: c.EMBROIDERY_GLASS_SPOTS,
      spotSize: (c.WATER_SPOT_SIZE * tile) / zoom, // same physical marks as every other surface
    },
    lights: lightsAt(room, room.embroidery),
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

  // Glass area (CSS px) and its reflection layer, with a margin to slide into.
  const inset = style.frame * zoom;
  const gw = chart.w * style.stitch * zoom, gh = chart.h * style.stitch * zoom;
  margin = Math.max(gw, gh) * 0.5;
  parallax = c.ROOM_EYE_FOLLOW * parallaxFactor(room);
  tilt = c.EMBROIDERY_TILT_DEG;
  Object.assign(glass.style, { left: `${inset}px`, top: `${inset}px`, width: `${gw}px`, height: `${gh}px` });
  const rKey = JSON.stringify([gw, gh, dpr, tile, c.EMBROIDERY_GLASS_REFLECTION, room, tilt]);
  if (!reflection || rKey !== reflectionKey) {
    reflection = document.createElement('canvas');
    reflection.className = 'reflection';
    reflection.width = Math.round((gw + 2 * margin) * dpr);
    reflection.height = Math.round((gh + 2 * margin) * dpr);
    Object.assign(reflection.style, { width: `${gw + 2 * margin}px`, height: `${gh + 2 * margin}px`, left: `${-margin}px`, top: `${-margin}px` });
    // The window's mirror image in wall cm → glass px about the glass centre (y down). A level
    // window seen in tilted glass appears tilted the other way, so rotate by −tilt.
    const ppc = pxPerCm(room, tile), win = reflectedWindow(room), e = room.embroidery;
    const rect = { x0: (win.x0 - e.x) * ppc + gw / 2, x1: (win.x1 - e.x) * ppc + gw / 2, y0: (e.y - win.y1) * ppc + gh / 2, y1: (e.y - win.y0) * ppc + gh / 2 };
    const ctx = reflection.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.translate(margin + gw / 2, margin + gh / 2);
    ctx.rotate((-tilt * Math.PI) / 180);
    ctx.translate(-gw / 2, -gh / 2);
    drawWindowReflection(ctx, { strength: c.EMBROIDERY_GLASS_REFLECTION, rect, bars: WINDOW_BAR_CM * win.scale * ppc });
    glass.replaceChildren(reflection);
    reflectionKey = rKey;
    rest = undefined;
  }
  return { canvas, glass, ...size };
}

const WINDOW_BAR_CM = 5; // sash frame and glazing bars

let rest: [number, number] | undefined; // the glass's screen position when its reflection is at rest

// Slides the reflection opposite to how the glass has moved on screen (scrolling). `screen` is the
// window's position on the physical screen, so moving the window (with screen pinning) doesn't
// count as the eye moving.
export function updateReflection(screen: { x: number; y: number }) {
  if (!reflection || !glass.isConnected) return;
  const r = glass.getBoundingClientRect();
  const pos: [number, number] = [r.left + r.width / 2 + screen.x, r.top + r.height / 2 + screen.y];
  rest ??= pos;
  const [x, y] = parallaxOffset([pos[0] - rest[0], pos[1] - rest[1]], parallax, tilt, margin);
  reflection.style.transform = `translate(${x}px, ${y}px)`;
}

export function resetReflection() {
  rest = undefined;
}
