// Builds the wall: wallpaper header, bull-nose row, tile grid, skirting.
import type { Config } from './config';
import { computeLayout, computeStrip, rowCount, type Layout } from './layout';
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

function bullnose(c: Config, vp: Viewport, l: Layout): HTMLElement {
  const s = computeStrip({ width: vp.width, tile: l.tile, grout: c.GROUT_PX, widthRatio: c.BULLNOSE_WIDTH, offset: c.BULLNOSE_OFFSET });
  const row = el('div', 'bullnose');
  for (let i = 0; i < s.count; i++) {
    const t = el('i', 'bullnose-tile');
    t.style.left = `${s.start + i * s.pitch}px`;
    row.append(t);
  }
  row.style.setProperty('--bn-w', `${s.width}px`);
  return row;
}

// Title stays in the DOM for screen readers; the canvas carries the visible print.
function projectTile(c: Config, l: Layout, p: Project): HTMLElement {
  const a = el('a', 'tile tile-project');
  a.href = p.url;
  const canvas = el('canvas', 'tile-print');
  canvas.setAttribute('aria-hidden', 'true');
  const title = el('span', 'tile-title sr-only', [document.createTextNode(p.title)]);
  a.append(canvas, title);
  pending.push(
    printTile(c, { canvas, title: p.title, logoUrl: p.logoUrl, tile: l.tile }).catch((e) => {
      console.warn(e);
      title.classList.remove('sr-only'); // fall back to plain text
    }),
  );
  return a;
}

let pending: Promise<void>[] = [];

function grid(c: Config, l: Layout, projects: Project[]): HTMLElement {
  const g = el('div', 'grid');
  const rows = rowCount(projects.length, l.columns, c.TRAILING_ROWS);
  for (let r = 0; r < rows; r++) {
    for (let col = -1; col <= l.columns; col++) {
      const edge = col < 0 || col === l.columns;
      const p = edge ? undefined : projects[r * l.columns + col];
      g.append(p ? projectTile(c, l, p) : el('div', edge ? 'tile tile-edge' : 'tile'));
    }
  }
  return el('main', 'wall', [g]);
}

export function renderScene(root: HTMLElement, c: Config, vp: Viewport, projects: Project[]): Layout {
  const l = computeLayout({ width: vp.width, height: vp.height, tileMax: c.TILE_MAX_PX, grout: c.GROUT_PX, minPeek: c.MIN_PEEK });
  const vars: Record<string, string> = {
    '--tile': `${l.tile}px`,
    '--grout': `${c.GROUT_PX}px`,
    '--cols-total': String(l.columns + 2),
    '--grid-w': `${l.gridWidth}px`,
    '--grid-left': `${l.gridLeft}px`,
    '--header-h': `${c.HEADER_HEIGHT * l.tile}px`,
    '--frame-w': `${c.EMBROIDERY_WIDTH * l.tile}px`,
    '--stitch-text': `${c.EMBROIDERY_TEXT_SIZE * l.tile}px`,
    '--stitch-size': `${c.EMBROIDERY_STITCH_SIZE * l.tile}px`,
    '--accent-size': `${c.EMBROIDERY_FLORAL_SIZE * l.tile}px`,
    '--frame-tilt': `${c.EMBROIDERY_TILT_DEG}deg`,
    '--wallpaper-zoom': String(c.WALLPAPER_ZOOM),
    '--bn-h': `${c.BULLNOSE_HEIGHT * l.tile}px`,
    '--skirting-h': `${c.SKIRTING_HEIGHT * l.tile}px`,
    '--halftone-blur': `${c.HALFTONE_BLUR_PX}px`,
    '--halftone-opacity': String(c.HALFTONE_OPACITY),
    '--tile-color': c.TILE_COLOR,
    '--grout-color': c.GROUT_COLOR,
    '--print-color': c.PRINT_COLOR,
    '--wallpaper-color': c.WALLPAPER_COLOR,
    '--skirting-color': c.SKIRTING_COLOR,
  };
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  pending = [];
  document.documentElement.dataset.printed = 'false';
  root.replaceChildren(header(), bullnose(c, vp, l), grid(c, l, projects), el('footer', 'skirting'));
  const batch = pending;
  // Signals tests and screenshots that every tile print has settled.
  Promise.all(batch).then(() => batch === pending && (document.documentElement.dataset.printed = 'true'));
  return l;
}
