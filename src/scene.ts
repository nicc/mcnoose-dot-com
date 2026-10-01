// Builds the wall: wallpaper header, bull-nose row, tile grid, skirting.
import type { Config } from './config';
import { computeStrip, rowCount, visibleColumns, type Anchor, type Columns } from './layout';
import { printTile } from './halftone/print';
import { baked } from 'virtual:wallpaper';
import { embroidery, SAMPLER_LINES } from './embroidery';
import { lightsAt, pxPerCm, roomFromConfig } from './room';
import { drawAgeing, grimeLevel } from './tiles/glaze';
import { groutTexture } from './tiles/grout';
import { edgeShadows, tileTone, wallPoint, type WallMap } from './tiles/surface';
import { hexToRgb } from './wallpaper/relief';
import type { Project } from './projects';

export interface Viewport {
  width: number;
  height: number;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, kids: Node[] = []) => {
  const n = document.createElement(tag);
  n.className = cls;
  n.append(...kids);
  return n;
};

// Production uses the tile baked at build time; dev renders live so panel changes show.
const live = import.meta.env.DEV ? import('./wallpaper') : undefined;

// Pattern anchored to the wall's world origin so it stays put under resizes and window moves.
function hangWallpaper(el: HTMLElement, c: Config, a: Anchor, topExtra: number, pending: Promise<unknown>[]) {
  const apply = (url: string, width: number, height: number) => {
    el.style.backgroundImage = `url("${url}")`;
    el.style.backgroundSize = `${width}px ${height}px`;
    el.style.backgroundPosition = `${a.originX}px ${topExtra}px`;
  };
  const width = c.WALLPAPER_ZOOM * a.tile;
  if (baked) return apply(baked.url, width, width * baked.aspect);
  if (!live) return;
  pending.push(
    live
      .then(async (m) => {
        const next = m.wallpaper(c, a.tile);
        const wp = m.wallpaperReady() ?? (await next);
        if (el.isConnected) apply(wp.url, wp.width, wp.height);
      })
      .catch((e) => console.warn(e)),
  );
}

// The site title is the embroidery; the h1 carries it for screen readers and search.
function header(c: Config, tile: number): HTMLElement {
  const title = el('h1', 'sr-only', [document.createTextNode(SAMPLER_LINES.join(' '))]);
  const e = embroidery(c, tile);
  const frame = el('figure', 'frame', [e.canvas, e.glass]);
  return el('header', 'wallpaper', [title, el('div', 'frame-shadow', [frame])]);
}

function bullnose(c: Config, vp: Viewport, a: Anchor): HTMLElement {
  const s = computeStrip({ width: vp.width, origin: a.centreX, tile: a.tile, grout: c.GROUT_PX, widthRatio: c.BULLNOSE_WIDTH, offset: c.BULLNOSE_OFFSET });
  const row = el('div', 'bullnose');
  for (let i = 0; i < s.count; i++) {
    const t = el('i', 'bullnose-tile');
    t.style.left = `${s.start + i * s.pitch}px`;
    row.append(t);
  }
  row.style.setProperty('--bn-w', `${s.width}px`);
  return row;
}

// Prints are cached per project so resizes and re-flows move canvases instead of re-printing.
interface Print {
  canvas: HTMLCanvasElement;
  done: Promise<boolean>; // false if printing failed
}
const prints = new Map<string, Print>();
let printsKey = '';

// Re-flow crossfade. The DOM is rebuilt every render, so fades are tracked by start time
// and resumed with a negative animation-delay rather than living on elements.
const placements = new Map<string, string>(); // project id → "row:column"
const arrivals = new Map<string, number>(); // project id → fade-in start
let ghosts: { slot: string; canvas: HTMLCanvasElement; at: number }[] = []; // fading copies at old tiles

const projectId = (p: Project) => `${p.title}\n${p.logoUrl}`;

function ghostOf(canvas: HTMLCanvasElement): HTMLCanvasElement | undefined {
  if (!canvas.width || !canvas.height) return;
  const g = el('canvas', 'tile-print tile-ghost');
  g.width = canvas.width;
  g.height = canvas.height;
  g.getContext('2d')!.drawImage(canvas, 0, 0);
  g.setAttribute('aria-hidden', 'true');
  return g;
}

function place(p: Project, slot: string, canvas: HTMLCanvasElement, now: number) {
  const id = projectId(p);
  const prev = placements.get(id);
  placements.set(id, slot);
  if (prev === undefined || prev === slot) return;
  arrivals.set(id, now);
  const g = ghostOf(canvas);
  if (g) ghosts.push({ slot: prev, canvas: g, at: now });
}

const fading = (el: HTMLElement, at: number, now: number, ms: number) => {
  const t = now - at;
  if (t >= ms) return false;
  el.style.animationDelay = `${-t}ms`;
  return true;
};

function printFor(c: Config, tile: number, p: Project): Print {
  const key = JSON.stringify([tile, devicePixelRatio, Object.entries(c).filter(([k]) => /^(TILE_|HALFTONE_|PRINT_)/.test(k))]);
  if (key !== printsKey) {
    prints.clear();
    placements.clear(); // new prints: nothing to crossfade from
    arrivals.clear();
    ghosts = [];
    printsKey = key;
  }
  const id = projectId(p);
  let pr = prints.get(id);
  if (!pr) {
    const canvas = el('canvas', 'tile-print');
    canvas.setAttribute('aria-hidden', 'true');
    const done = printTile(c, { canvas, title: p.title, logoUrl: p.logoUrl, tile }).then(
      () => true,
      (e) => (console.warn(e), false),
    );
    pr = { canvas, done };
    prints.set(id, pr);
  }
  return pr;
}

// Title stays in the DOM for screen readers; the canvas carries the visible print.
function projectTile(c: Config, tile: number, p: Project, slot: string, now: number, pending: Promise<unknown>[]): HTMLElement {
  const a = el('a', 'tile tile-project');
  a.href = p.url;
  const pr = printFor(c, tile, p);
  place(p, slot, pr.canvas, now);
  const arrived = arrivals.get(projectId(p));
  if (arrived !== undefined && fading(pr.canvas, arrived, now, c.REFLOW_FADE_MS)) a.classList.add('tile-arrive');
  const title = el('span', 'tile-title sr-only', [document.createTextNode(p.title)]);
  a.append(pr.canvas, title);
  pending.push(pr.done.then((ok) => ok || title.classList.remove('sr-only'))); // plain-text fallback
  return a;
}

// Projects fill fully visible tiles row by row; partly visible tiles stay blank.
// Each tile's glaze tone and cushion-edge lighting, from where it sits in the room.
type TileSurface = (row: number, col: number) => { background: string; boxShadow: string };

function tileSurfaces(c: Config, a: Anchor, topExtra: number): TileSurface {
  const room = roomFromConfig(c), ppc = pxPerCm(room, a.tile);
  const map: WallMap = { pxPerCm: ppc, embroidery: room.embroidery, embroideryPage: { x: a.centreX, y: topExtra + (c.HEADER_HEIGHT * a.tile) / 2 } };
  const firstTileTop = topExtra + (c.HEADER_HEIGHT + c.BULLNOSE_HEIGHT) * a.tile + c.GROUT_PX;
  const base = hexToRgb(c.TILE_COLOR);
  const edge = { edgePx: c.TILE_EDGE_CM * ppc, sheen: c.TILE_EDGE_SHEEN, recessPx: GROUT_RECESS_CM * ppc, recess: c.GROUT_RECESS };
  return (row, col) => {
    const at = wallPoint(map, { x: a.originX + col * a.pitch + a.tile / 2, y: firstTileTop + row * a.pitch + a.tile / 2 });
    return { background: tileTone(base, c.TILE_TONE, col, row), boxShadow: edgeShadows(lightsAt(room, at), edge) };
  };
}

const GROUT_RECESS_CM = 0.15; // grout sits this far behind the tile faces

// Ageing canvases (crazing + water marks) cached by wall position, redrawn only when they change.
const ageing = new Map<string, { key: string; canvas: HTMLCanvasElement }>();

function tileAgeing(c: Config, a: Anchor, rows: number) {
  const dpr = Math.min(1.5, devicePixelRatio || 1); // soft detail: no need for full density
  return (row: number, col: number): HTMLCanvasElement => {
    const level = grimeLevel(rows - 1 - row, c.TILE_GRIME_ROWS);
    const age = {
      crazing: c.TILE_CRAZING,
      spots: c.TILE_SPOTS + (c.TILE_SPOTS_LOW - c.TILE_SPOTS) * level,
      limescale: c.TILE_LIMESCALE * level,
      spotSize: c.WATER_SPOT_SIZE * a.tile,
    };
    const key = JSON.stringify([a.tile, dpr, age]);
    const id = `${col}:${row}`;
    let hit = ageing.get(id);
    if (!hit || hit.key !== key) {
      const canvas = el('canvas', 'tile-age');
      canvas.setAttribute('aria-hidden', 'true');
      drawAgeing(canvas, a.tile, dpr, age, Math.imul(col + 1000, 7919) ^ Math.imul(row + 1000, 104729));
      ageing.set(id, (hit = { key, canvas }));
    }
    return hit.canvas;
  };
}

function grid(c: Config, a: Anchor, cols: Columns, projects: Project[], pending: Promise<unknown>[], surface: TileSurface): HTMLElement {
  const g = el('div', 'grid');
  const slot = new Map(cols.full.map((k, i) => [k, i]));
  const n = Math.max(1, cols.full.length);
  const rows = rowCount(projects.length, n, c.TRAILING_ROWS);
  const aged = tileAgeing(c, a, rows);
  const now = performance.now();
  const tiles = new Map<string, HTMLElement>();
  for (let r = 0; r < rows; r++) {
    for (let k = cols.first; k < cols.first + cols.count; k++) {
      const i = slot.get(k);
      const p = i === undefined ? undefined : projects[r * n + i];
      const key = `${r}:${k}`;
      const t = p ? projectTile(c, a.tile, p, key, now, pending) : el('div', 'tile');
      Object.assign(t.style, surface(r, k));
      t.append(aged(r, k));
      tiles.set(key, t);
      g.append(t);
    }
  }
  ghosts = ghosts.filter((gh) => fading(gh.canvas, gh.at, now, c.REFLOW_FADE_MS));
  for (const gh of ghosts) tiles.get(gh.slot)?.append(gh.canvas);
  const wall = el('main', 'wall', [g]);
  wall.style.backgroundImage = `url("${groutTexture(c.GROUT_TEXTURE, Math.min(2, devicePixelRatio || 1))}")`;
  wall.style.backgroundPosition = `${a.originX}px 0`; // anchored to the wall, not the window
  return wall;
}

export interface Frame {
  tile: number;
  columns: number; // fully visible
  peekLeft: number; // px of the left edge tile showing
  peekRight: number;
}

// The frame stands off the wall, so each room light casts its own shadow of it, offset by the
// light's slant (near-frontal window light: short; ceiling fill: longer, fainter, below). In screen
// space: the shadow wrapper isn't rotated.
function frameShadow(c: Config, tile: number): Record<string, string> {
  const room = roomFromConfig(c), d = c.EMBROIDERY_STANDOFF_CM * pxPerCm(room, tile);
  const lights = lightsAt(room, room.embroidery), total = lights.reduce((s, l) => s + l.weight, 0);
  const shadows = lights.map(({ dir: [x, y, z], weight }) => {
    const sx = (-x / z) * d, sy = (-y / z) * d;
    const blur = 2 + Math.hypot(sx, sy) * 0.8 + d * 0.3;
    return `drop-shadow(${sx.toFixed(1)}px ${sy.toFixed(1)}px ${blur.toFixed(1)}px rgb(0 0 0 / ${((0.45 * weight) / total).toFixed(3)}))`;
  });
  return { '--frame-shadow': shadows.join(' ') };
}

let generation = 0;

export function renderScene(root: HTMLElement, c: Config, vp: Viewport, a: Anchor, topExtra: number, projects: Project[]): Frame {
  const cols = visibleColumns(a, vp.width);
  const gridLeft = a.originX + cols.first * a.pitch;
  const vars: Record<string, string> = {
    '--tile': `${a.tile}px`,
    '--grout': `${c.GROUT_PX}px`,
    '--cols-total': String(cols.count),
    '--grid-w': `${cols.count * a.pitch - c.GROUT_PX}px`,
    '--grid-left': `${gridLeft}px`,
    '--wall-x': `${a.originX}px`, // world origin: anchor any future wall texture here, not to the viewport
    '--wall-y': `${topExtra}px`, // wallpaper grown above the original top edge
    '--frame-x': `${a.centreX}px`,
    '--frame-y': `${topExtra + (c.HEADER_HEIGHT * a.tile) / 2}px`,
    '--header-h': `${c.HEADER_HEIGHT * a.tile + topExtra}px`,
    '--frame-tilt': `${c.EMBROIDERY_TILT_DEG}deg`,
    ...frameShadow(c, a.tile),
    '--bn-h': `${c.BULLNOSE_HEIGHT * a.tile}px`,
    '--skirting-h': `${c.SKIRTING_HEIGHT * a.tile}px`,
    '--reflow-fade': `${c.REFLOW_FADE_MS}ms`,
    '--halftone-blur': `${c.HALFTONE_BLUR_PX}px`,
    '--halftone-opacity': String(c.HALFTONE_OPACITY),
    '--tile-color': c.TILE_COLOR,
    '--grout-color': c.GROUT_COLOR,
    '--print-color': c.PRINT_COLOR,
    '--wallpaper-color': c.WALLPAPER_GROUND, // shown until the pattern is ready
    '--skirting-color': c.SKIRTING_COLOR,
  };
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);

  const pending: Promise<unknown>[] = [];
  const gen = ++generation;
  document.documentElement.dataset.printed = 'false';
  document.documentElement.dataset.renderedWidth = String(vp.width); // lets tests wait for a resize render
  const top = header(c, a.tile);
  hangWallpaper(top, c, a, topExtra, pending);
  root.replaceChildren(top, bullnose(c, vp, a), grid(c, a, cols, projects, pending, tileSurfaces(c, a, topExtra)), el('footer', 'skirting'));
  // Signals tests and screenshots that every visible print has settled.
  Promise.all(pending).then(() => gen === generation && (document.documentElement.dataset.printed = 'true'));

  const right = a.originX + (cols.first + cols.count - 1) * a.pitch;
  return { tile: a.tile, columns: cols.full.length, peekLeft: gridLeft + a.tile, peekRight: vp.width - right };
}
