// Builds the wall: wallpaper header, bull-nose row, tile grid, skirting.
import type { Config } from './config';
import { computeStrip, rowCount, visibleColumns, type Anchor, type Columns } from './layout';
import { printTile } from './halftone/print';
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

function printFor(c: Config, tile: number, p: Project): Print {
  const key = JSON.stringify([tile, devicePixelRatio, Object.entries(c).filter(([k]) => /^(TILE_|HALFTONE_|PRINT_)/.test(k))]);
  if (key !== printsKey) {
    prints.clear();
    printsKey = key;
  }
  const id = `${p.title}\n${p.logoUrl}`;
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
function projectTile(c: Config, tile: number, p: Project, pending: Promise<unknown>[]): HTMLElement {
  const a = el('a', 'tile tile-project');
  a.href = p.url;
  const pr = printFor(c, tile, p);
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
  for (let r = 0; r < rows; r++) {
    for (let k = cols.first; k < cols.first + cols.count; k++) {
      const i = slot.get(k);
      const p = i === undefined ? undefined : projects[r * n + i];
      g.append(p ? projectTile(c, a.tile, p, pending) : el('div', 'tile'));
    }
  }
  return el('main', 'wall', [g]);
}

export interface Frame {
  tile: number;
  columns: number; // fully visible
  peekLeft: number; // px of the left edge tile showing
  peekRight: number;
}

let generation = 0;

export function renderScene(root: HTMLElement, c: Config, vp: Viewport, a: Anchor, projects: Project[]): Frame {
  const cols = visibleColumns(a, vp.width);
  const gridLeft = a.originX + cols.first * a.pitch;
  const vars: Record<string, string> = {
    '--tile': `${a.tile}px`,
    '--grout': `${c.GROUT_PX}px`,
    '--cols-total': String(cols.count),
    '--grid-w': `${cols.count * a.pitch - c.GROUT_PX}px`,
    '--grid-left': `${gridLeft}px`,
    '--wall-x': `${a.originX}px`, // world origin: anchor any future wall texture here, not to the viewport
    '--frame-x': `${a.centreX}px`,
    '--header-h': `${c.HEADER_HEIGHT * a.tile}px`,
    '--frame-w': `${c.EMBROIDERY_WIDTH * a.tile}px`,
    '--stitch-text': `${c.EMBROIDERY_TEXT_SIZE * a.tile}px`,
    '--stitch-size': `${c.EMBROIDERY_STITCH_SIZE * a.tile}px`,
    '--accent-size': `${c.EMBROIDERY_FLORAL_SIZE * a.tile}px`,
    '--frame-tilt': `${c.EMBROIDERY_TILT_DEG}deg`,
    '--wallpaper-zoom': String(c.WALLPAPER_ZOOM),
    '--bn-h': `${c.BULLNOSE_HEIGHT * a.tile}px`,
    '--skirting-h': `${c.SKIRTING_HEIGHT * a.tile}px`,
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
  root.replaceChildren(header(), bullnose(c, vp, a), grid(c, a, cols, projects, pending), el('footer', 'skirting'));
  // Signals tests and screenshots that every visible print has settled.
  Promise.all(pending).then(() => gen === generation && (document.documentElement.dataset.printed = 'true'));

  const right = a.originX + (cols.first + cols.count - 1) * a.pitch;
  return { tile: a.tile, columns: cols.full.length, peekLeft: gridLeft + a.tile, peekRight: vp.width - right };
}
