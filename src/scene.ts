// Builds the wall: wallpaper header, bull-nose row, tile grid, skirting.
import type { Config } from './config';
import { computeStrip, rowCount, visibleColumns, type Anchor, type Columns } from './layout';
import { printTile } from './halftone/print';
import { wallpaper, wallpaperReady, type Wallpaper } from './wallpaper';
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

// Pattern anchored to the wall's world origin so it stays put under resizes and window moves.
function hangWallpaper(el: HTMLElement, c: Config, a: Anchor, topExtra: number, pending: Promise<unknown>[]) {
  const apply = (wp: Wallpaper) => {
    el.style.backgroundImage = `url("${wp.url}")`;
    el.style.backgroundSize = `${wp.width}px ${wp.height}px`;
    el.style.backgroundPosition = `${a.originX}px ${topExtra}px`;
  };
  const p = wallpaper(c, a.tile);
  const ready = wallpaperReady();
  if (ready) apply(ready);
  else pending.push(p.then((wp) => el.isConnected && apply(wp), (e) => console.warn(e)));
}

function header(): HTMLElement {
  const name = el('div', 'stitch', [el('span', '', [document.createTextNode('Snickers')]), el('span', '', [document.createTextNode('McNoose')])]);
  const frame = el('figure', 'frame', [el('i', 'floral floral-tl'), name, el('i', 'floral floral-br')]);
  return el('header', 'wallpaper', [frame]);
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
function grid(c: Config, a: Anchor, cols: Columns, projects: Project[], pending: Promise<unknown>[]): HTMLElement {
  const g = el('div', 'grid');
  const slot = new Map(cols.full.map((k, i) => [k, i]));
  const n = Math.max(1, cols.full.length);
  const rows = rowCount(projects.length, n, c.TRAILING_ROWS);
  const now = performance.now();
  const tiles = new Map<string, HTMLElement>();
  for (let r = 0; r < rows; r++) {
    for (let k = cols.first; k < cols.first + cols.count; k++) {
      const i = slot.get(k);
      const p = i === undefined ? undefined : projects[r * n + i];
      const key = `${r}:${k}`;
      const t = p ? projectTile(c, a.tile, p, key, now, pending) : el('div', 'tile');
      tiles.set(key, t);
      g.append(t);
    }
  }
  ghosts = ghosts.filter((gh) => fading(gh.canvas, gh.at, now, c.REFLOW_FADE_MS));
  for (const gh of ghosts) tiles.get(gh.slot)?.append(gh.canvas);
  return el('main', 'wall', [g]);
}

export interface Frame {
  tile: number;
  columns: number; // fully visible
  peekLeft: number; // px of the left edge tile showing
  peekRight: number;
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
    '--frame-w': `${c.EMBROIDERY_WIDTH * a.tile}px`,
    '--stitch-text': `${c.EMBROIDERY_TEXT_SIZE * a.tile}px`,
    '--stitch-size': `${c.EMBROIDERY_STITCH_SIZE * a.tile}px`,
    '--accent-size': `${c.EMBROIDERY_FLORAL_SIZE * a.tile}px`,
    '--frame-tilt': `${c.EMBROIDERY_TILT_DEG}deg`,
    '--bn-h': `${c.BULLNOSE_HEIGHT * a.tile}px`,
    '--skirting-h': `${c.SKIRTING_HEIGHT * a.tile}px`,
    '--reflow-fade': `${c.REFLOW_FADE_MS}ms`,
    '--halftone-blur': `${c.HALFTONE_BLUR_PX}px`,
    '--halftone-opacity': String(c.HALFTONE_OPACITY),
    '--tile-color': c.TILE_COLOR,
    '--grout-color': c.GROUT_COLOR,
    '--print-color': c.PRINT_COLOR,
    '--wallpaper-color': c.WALLPAPER_COLOR,
    '--skirting-color': c.SKIRTING_COLOR,
  };
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);

  const pending: Promise<unknown>[] = [];
  const gen = ++generation;
  document.documentElement.dataset.printed = 'false';
  document.documentElement.dataset.renderedWidth = String(vp.width); // lets tests wait for a resize render
  const top = header();
  hangWallpaper(top, c, a, topExtra, pending);
  root.replaceChildren(top, bullnose(c, vp, a), grid(c, a, cols, projects, pending), el('footer', 'skirting'));
  // Signals tests and screenshots that every visible print has settled.
  Promise.all(pending).then(() => gen === generation && (document.documentElement.dataset.printed = 'true'));

  const right = a.originX + (cols.first + cols.count - 1) * a.pitch;
  return { tile: a.tile, columns: cols.full.length, peekLeft: gridLeft + a.tile, peekRight: vp.width - right };
}
