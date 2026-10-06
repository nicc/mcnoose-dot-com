// The framed sampler as cached canvases: redrawn only when size or settings change, so resizes
// and window moves just re-attach them. The glass's window reflection is a separate layer that
// slides with parallax as the view scrolls (updateReflection), which is what makes it read as glass.
import type { Config } from '../config';
import { lightsAt, parallaxFactor, pxPerCm, reflectedWindow, roomFromConfig, viewAt } from '../room';
import { drawWindowReflection, parallaxOffset } from '../surface/reflection';
import { hexToRgb } from '../colour';
import { layoutSampler, type Chart } from './chart';
import { frameTilt, showingBack } from '../frame';
import { flush, later, soon } from '../later';
import { drawBack, nailDrop, paperRect } from './back';
import { drawEdges, drawEmbroidery, embroiderySize, type EmbroideryStyle } from './draw';

export const SAMPLER_LINES = ['Snickers', 'McNoose'];

let chartKey = '';
let chart: Chart;
let key = '';
let canvas: HTMLCanvasElement | undefined;
let edgesKey = '';
let edges: Record<'top' | 'bottom' | 'left' | 'right', HTMLCanvasElement> | undefined;
let backKey = '';
let back: HTMLCanvasElement | undefined;
let paper = { x: 0, y: 0, w: 0, h: 0 };
let reflectionKey = '';
let reflection: HTMLCanvasElement | undefined;
const glass = document.createElement('div');
glass.className = 'glass';
let margin = 0;
let parallax = 0;
let tilt = 0; // the tilt the reflection was drawn at
let turn = 0; // degrees the frame has turned since (live, while it's dragged or swinging)
let shift: [number, number] = [0, 0]; // parallax slide

// The cloth at the frame's centre is always opaque: if that pixel reads back clear, the canvas's
// pixels were lost (a GPU reset: Firefox, plugging in a monitor) — see main.ts.
export function embroideryLost(): boolean {
  if (!canvas || !canvas.isConnected || !canvas.classList.contains('drawn')) return false;
  return canvas.getContext('2d')!.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data[3] === 0;
}

// Redraw everything next time, into fresh canvases.
export function forgetEmbroidery() {
  key = edgesKey = backKey = reflectionKey = '';
}

// Draw anything still waiting: call before revealing the back or the sides.
export const drawPending = () => flush('embroidery:');

const edgeCanvas = (side: string) => {
  const e = document.createElement('canvas');
  e.className = `frame-edge frame-edge-${side}`;
  e.setAttribute('aria-hidden', 'true');
  return e;
};

export interface Embroidered {
  canvas: HTMLCanvasElement;
  back: HTMLCanvasElement; // what you see when it's turned over
  paper: { x: number; y: number; w: number; h: number }; // css px on the back: where the note goes
  edges: HTMLCanvasElement[]; // top, bottom, left, right: the frame's sides
  depth: number; // css px: how far it stands off the wall
  nail: number; // css px below the frame's top edge: where it hangs (in a notch of its hanger)
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
    view: viewAt(room, room.embroidery),
    dust: { top: c.EMBROIDERY_DUST_TOP, inner: c.EMBROIDERY_DUST_INNER, shade: c.DUST_SHADE },
    tiltDeg: frameTilt(c),
    dpr,
  };
  const natural = embroiderySize(chart, style);
  const size = { width: natural.width * zoom, height: natural.height * zoom };
  const next = JSON.stringify([style, zoom, chartKey]);
  if (!canvas || next !== key) {
    // The first time, just after the first paint (wallpaper and tiles first), fading in; after that
    // (re-lit after a turn, settings changed) at once, so it doesn't blink.
    const first = !canvas, fresh = (canvas = document.createElement('canvas'));
    fresh.className = 'embroidery';
    fresh.setAttribute('aria-hidden', 'true');
    const draw = () => (drawEmbroidery(fresh, chart, style, zoom), fresh.classList.add('drawn'));
    if (first) void soon('embroidery:front', draw);
    else draw();
    key = next;
  }
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;

  // The back and the sides: only seen when it's turned over (or falls), so drawn when the browser is
  // next idle rather than holding up the first paint — or at once if something reveals them first.
  const backStyle = { paper: hexToRgb(c.ABOUT_PAPER), stains: c.ABOUT_STAINS, wear: c.ABOUT_EDGE_WEAR, tarnish: c.ABOUT_HANGER_TARNISH, pxPerCm: pxPerCm(room, tile), hangerDropCm: c.ABOUT_HANGER_DROP_CM, hangerTiltDeg: c.ABOUT_HANGER_TILT_DEG };
  const wood = { ...style.wood, ring: style.wood.ring * zoom }, bdpr = Math.min(2, dpr);
  const nextBack = JSON.stringify([style, zoom, size, backStyle]);
  if (!back || nextBack !== backKey) {
    const canvas = (back = document.createElement('canvas'));
    canvas.className = 'embroidery-back';
    canvas.setAttribute('aria-hidden', 'true');
    const draw = () => drawBack(canvas, size.width, size.height, style.frame * zoom, { ...style, wood }, backStyle, bdpr);
    // Re-lit while it's showing (settled after a swing, turned over): at once, or it blanks and redraws.
    if (showingBack()) draw();
    else later('embroidery:back', draw);
    backKey = nextBack;
  }
  paper = paperRect(size.width, size.height, style.frame * zoom);
  back.style.width = `${size.width}px`;
  back.style.height = `${size.height}px`;

  // Its sides: as deep as it stands off the wall (the same depth that sets its shadow).
  const depth = c.EMBROIDERY_STANDOFF_CM * pxPerCm(room, tile);
  const nextEdges = JSON.stringify([style, zoom, size, depth]);
  if (!edges || nextEdges !== edgesKey) {
    const placed = (edges = { top: edgeCanvas('top'), bottom: edgeCanvas('bottom'), left: edgeCanvas('left'), right: edgeCanvas('right') });
    later('embroidery:edges', () => {
      const drawn = drawEdges({ ...style, wood }, size.width, size.height, depth, bdpr);
      for (const side of ['top', 'bottom', 'left', 'right'] as const) {
        const to = placed[side], from = drawn[side];
        [to.width, to.height] = [from.width, from.height];
        to.getContext('2d')!.drawImage(from, 0, 0);
      }
    });
    edgesKey = nextEdges;
  }

  // Glass area (CSS px) and its reflection layer, with a margin to slide into.
  const inset = style.frame * zoom;
  const gw = chart.w * style.stitch * zoom, gh = chart.h * style.stitch * zoom;
  margin = Math.max(gw, gh) * 0.5;
  parallax = c.ROOM_EYE_FOLLOW * parallaxFactor(room);
  tilt = frameTilt(c);
  Object.assign(glass.style, { left: `${inset}px`, top: `${inset}px`, width: `${gw}px`, height: `${gh}px` });
  const rKey = JSON.stringify([gw, gh, dpr, tile, c.EMBROIDERY_GLASS_REFLECTION, room, tilt]);
  if (!reflection || rKey !== reflectionKey) {
    reflection = document.createElement('canvas');
    reflection.className = 'reflection';
    reflection.width = Math.round((gw + 2 * margin) * dpr);
    reflection.height = Math.round((gh + 2 * margin) * dpr);
    Object.assign(reflection.style, { width: `${gw + 2 * margin}px`, height: `${gh + 2 * margin}px`, left: `${-margin}px`, top: `${-margin}px` });
    // The window's mirror image in wall cm → glass px (y down), as at tilt 0. A flat mirror turned in
    // its own plane reflects the same scene, so the image holds still on screen while the frame turns
    // about its nail: draw it turned back by −tilt about the nail (top centre, above the glass).
    const ppc = pxPerCm(room, tile), win = reflectedWindow(room), e = room.embroidery;
    const rect = { x0: (win.x0 - e.x) * ppc + gw / 2, x1: (win.x1 - e.x) * ppc + gw / 2, y0: (e.y - win.y1) * ppc + gh / 2, y1: (e.y - win.y0) * ppc + gh / 2 };
    const ctx = reflection.getContext('2d')!, angle = (-tilt * Math.PI) / 180, bars = WINDOW_BAR_CM * win.scale * ppc, strength = c.EMBROIDERY_GLASS_REFLECTION;
    reflection.style.transformOrigin = `${margin + gw / 2}px ${margin - inset}px`; // the nail, for live turns
    paintPanes = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.scale(dpr, dpr);
      ctx.translate(margin + gw / 2, margin - inset);
      ctx.rotate(angle);
      ctx.translate(-gw / 2, inset);
      drawWindowReflection(ctx, { strength, rect, bars, sky: paneSky });
    };
    paintPanes();
    glass.replaceChildren(reflection);
    reflectionKey = rKey;
    rest = undefined;
    turn = 0;
    placeReflection();
  }
  return { canvas, back, paper, glass, edges: Object.values(edges), depth, nail: nailDrop(style.frame * zoom, pxPerCm(room, tile), c.ABOUT_HANGER_DROP_CM), ...size };
}

const WINDOW_BAR_CM = 5; // sash frame and glazing bars

let paneSky: { top: number[]; low: number[] } | undefined; // the sky in the reflected panes (sunset.ts)
let paintPanes: (() => void) | undefined;

// The sky through the window has changed colour (the sunset): repaint the reflected panes.
export function skyInGlass(sky: { top: number[]; low: number[] }) {
  paneSky = sky;
  paintPanes?.();
}

let rest: [number, number] | undefined; // the glass's screen position when its reflection is at rest

// Slides the reflection opposite to how the glass has moved on screen (scrolling). `screen` is the
// window's position on the physical screen, so moving the window (with screen pinning) doesn't
// count as the eye moving.
export function updateReflection(screen: { x: number; y: number }) {
  if (!reflection || !glass.isConnected) return;
  const r = glass.getBoundingClientRect();
  const pos: [number, number] = [r.left + r.width / 2 + screen.x, r.top + r.height / 2 + screen.y];
  rest ??= pos;
  shift = parallaxOffset([pos[0] - rest[0], pos[1] - rest[1]], parallax, tilt, margin);
  placeReflection();
}

// The frame is at `liveTilt` (being turned or swinging): hold the reflection still on screen.
export function turnReflection(liveTilt: number) {
  turn = liveTilt - tilt;
  placeReflection();
}

function placeReflection() {
  if (reflection) reflection.style.transform = `translate(${shift[0]}px, ${shift[1]}px) rotate(${-turn}deg)`;
}

export function resetReflection() {
  rest = undefined;
}
