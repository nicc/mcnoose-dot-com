// Wiping the wall with a finger (mouse only: on touch a drag must scroll). A round, soft-edged
// brush sized in cm. Dust (on the rail and skirting) comes away in one pass; limescale and dried
// marks on the tiles take rubbing, set by stubbornness. Every dab is logged in wall cm, so canvases
// redrawn by a re-render get the same wipes replayed. Wipes last until the page reloads.
import type { Config } from './config';
import { wallPoint, type WallMap } from './tiles/surface';

export type WipeKind = 'dust' | 'scale';

interface Dab {
  x: number; // wall cm
  y: number;
  r: number; // cm
  kind: WipeKind;
  alpha: number; // share of what's left that this dab removes at its centre
}

interface Surface {
  canvas: HTMLCanvasElement;
  kind: WipeKind;
  map: WallMap;
  x: number; // canvas top-left: viewport x, page y (css px)
  y: number;
  dpr: number; // canvas px per css px
}

const dabs: Dab[] = [];
let surfaces: Surface[] = [];
let map: WallMap | undefined;

// Called at the start of each render, then wipeable() for each canvas the render places.
export function beginSurfaces(m: WallMap): void {
  map = m;
  surfaces = [];
}

// fresh: the canvas was just drawn, so wipes made so far are replayed onto it.
export function wipeable(canvas: HTMLCanvasElement, kind: WipeKind, m: WallMap, x: number, y: number, dpr: number, fresh: boolean): void {
  const s = { canvas, kind, map: m, x, y, dpr };
  surfaces.push(s);
  if (fresh) for (const d of dabs) if (d.kind === kind) apply(s, d);
}

// The canvas was drawn (or redrawn) after it was registered: give it the wipes made so far.
export function replayWipes(canvas: HTMLCanvasElement): void {
  const s = surfaces.find((s) => s.canvas === canvas);
  if (s) for (const d of dabs) if (d.kind === s.kind) apply(s, d);
}

function apply(s: Surface, d: Dab): void {
  const ppc = s.map.pxPerCm;
  const px = (s.map.embroideryPage.x + (d.x - s.map.embroidery.x) * ppc - s.x) * s.dpr;
  const py = (s.map.embroideryPage.y - (d.y - s.map.embroidery.y) * ppc - s.y) * s.dpr;
  const r = d.r * ppc * s.dpr;
  if (px < -r || py < -r || px > s.canvas.width + r || py > s.canvas.height + r) return;
  const ctx = s.canvas.getContext('2d')!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, `rgba(0,0,0,${d.alpha})`);
  g.addColorStop(0.65, `rgba(0,0,0,${d.alpha})`); // a fingertip: firm middle, soft edge
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
  ctx.restore();
}

const SPACING = 0.25; // dab spacing along a stroke, as a share of its width

// Per dab, so that one pass over a point (about 1/SPACING overlapping dabs) removes `perPass`.
export function dabAlpha(perPass: number): number {
  return 1 - (1 - Math.max(0, Math.min(1, perPass))) ** SPACING;
}

export function startWiping(config: () => Config): void {
  let last: { x: number; y: number } | undefined, moved = 0, startX = 0, startY = 0;
  const dabAt = (clientX: number, clientY: number) => {
    if (!map) return;
    const stageX = document.getElementById('stage')?.getBoundingClientRect().left ?? 0; // the scene's own x (overscan, slides)
    const c = config(), w = wallPoint(map, { x: clientX - stageX, y: clientY + scrollY }), r = c.WIPE_WIDTH_CM / 2;
    const add = (x: number, y: number) => {
      for (const d of [
        { x, y, r, kind: 'dust' as const, alpha: 1 },
        { x, y, r, kind: 'scale' as const, alpha: dabAlpha(1 - c.WIPE_LIMESCALE_STUBBORN) },
      ]) {
        if (d.alpha <= 0) continue;
        dabs.push(d);
        for (const s of surfaces) if (s.kind === d.kind && s.canvas.isConnected) apply(s, d);
      }
    };
    if (!last) add(w.x, w.y);
    else {
      const dist = Math.hypot(w.x - last.x, w.y - last.y), step = Math.max(0.05, c.WIPE_WIDTH_CM * SPACING);
      const n = Math.floor(dist / step);
      for (let i = 1; i <= n; i++) add(last.x + ((w.x - last.x) * i * step) / dist, last.y + ((w.y - last.y) * i * step) / dist);
      if (n === 0) return; // wait until it has moved a dab's spacing
      const t = (n * step) / dist;
      w.x = last.x + (w.x - last.x) * t;
      w.y = last.y + (w.y - last.y) * t;
    }
    last = w;
  };
  const end = () => {
    if (!last) return;
    last = undefined;
    if (moved > 4) addEventListener('click', (e) => (e.preventDefault(), e.stopPropagation()), { capture: true, once: true }); // a wipe isn't a click
  };
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const t = e.target as Element;
    if (t.closest('.frame, .lil-gui, dialog')) return; // the frame has its own drag; the panel and notice are UI
    e.preventDefault(); // no text selection or image drag
    moved = 0;
    startX = e.clientX;
    startY = e.clientY;
    dabAt(e.clientX, e.clientY);
  });
  addEventListener('pointermove', (e) => {
    if (!last || e.pointerType !== 'mouse') return;
    moved = Math.max(moved, Math.hypot(e.clientX - startX, e.clientY - startY));
    dabAt(e.clientX, e.clientY);
  });
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  addEventListener('blur', end);
}
