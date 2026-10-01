// Builds the wall: wallpaper header, bull-nose row, tile grid, skirting.
import type { Config } from './config';
import { computeLayout, computeStrip, rowCount, type Layout } from './layout';
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
  const s = computeStrip({ width: vp.width, tile: l.tile, grout: c.GROUT, widthRatio: c.BULLNOSE_WIDTH_RATIO, offset: c.BULLNOSE_OFFSET });
  const row = el('div', 'bullnose');
  for (let i = 0; i < s.count; i++) {
    const t = el('i', 'bullnose-tile');
    t.style.left = `${s.start + i * s.pitch}px`;
    row.append(t);
  }
  row.style.setProperty('--bn-w', `${s.width}px`);
  return row;
}

function projectTile(p: Project): HTMLElement {
  const a = el('a', 'tile tile-project');
  a.href = p.url;
  // Logo used as a mask so it takes the print colour; replaced by the halftone renderer later.
  const logo = el('i', 'tile-logo');
  logo.style.setProperty('--logo', `url("${p.logoUrl}")`);
  a.append(logo, el('span', 'tile-title', [document.createTextNode(p.title)]));
  return a;
}

function grid(c: Config, l: Layout, projects: Project[]): HTMLElement {
  const g = el('div', 'grid');
  const rows = rowCount(projects.length, l.columns, c.TRAILING_ROWS);
  for (let r = 0; r < rows; r++) {
    for (let col = -1; col <= l.columns; col++) {
      const edge = col < 0 || col === l.columns;
      const p = edge ? undefined : projects[r * l.columns + col];
      g.append(p ? projectTile(p) : el('div', edge ? 'tile tile-edge' : 'tile'));
    }
  }
  return el('main', 'wall', [g]);
}

export function renderScene(root: HTMLElement, c: Config, vp: Viewport, projects: Project[]): Layout {
  const l = computeLayout({ width: vp.width, height: vp.height, tileMax: c.TILE_MAX, grout: c.GROUT, minPeek: c.MIN_PEEK });
  const vars: Record<string, string> = {
    '--tile': `${l.tile}px`,
    '--grout': `${c.GROUT}px`,
    '--cols-total': String(l.columns + 2),
    '--grid-w': `${l.gridWidth}px`,
    '--grid-left': `${l.gridLeft}px`,
    '--header-h': `${c.HEADER_HEIGHT_TILES * l.tile}px`,
    '--frame-w': `${c.FRAME_WIDTH_TILES * l.tile}px`,
    '--stitch-text': `${c.STITCH_TEXT_TILES * l.tile}px`,
    '--stitch-size': `${c.STITCH_SIZE_TILES * l.tile}px`,
    '--accent-size': `${c.ACCENT_SIZE_TILES * l.tile}px`,
    '--frame-tilt': `${c.FRAME_TILT_DEG}deg`,
    '--wallpaper-zoom': String(c.WALLPAPER_ZOOM),
    '--bn-h': `${c.BULLNOSE_HEIGHT_RATIO * l.tile}px`,
    '--skirting-h': `${c.SKIRTING_HEIGHT_TILES * l.tile}px`,
    '--tile-color': c.TILE_COLOR,
    '--grout-color': c.GROUT_COLOR,
    '--print-color': c.PRINT_COLOR,
    '--wallpaper-color': c.WALLPAPER_COLOR,
    '--skirting-color': c.SKIRTING_COLOR,
  };
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  root.replaceChildren(header(), bullnose(c, vp, l), grid(c, l, projects), el('footer', 'skirting'));
  return l;
}
