// Builds the wall: wallpaper header, bull-nose row, tile grid, skirting.
import type { Config } from './config';
import { computeStrip, rowCount, visibleColumns, type Anchor, type Columns } from './layout';
import { printTile } from './halftone/print';
import { baked } from 'virtual:wallpaper';
import { embroidery, SAMPLER_LINES } from './embroidery';
import { lightsAt, pxPerCm, roomFromConfig, type Room, type Vec3 } from './room';
import { drawAgeing, grimeLevel, type Ageing } from './tiles/glaze';
import { groutTexture } from './tiles/grout';
import { reflectTile, type RoomLook, type TileReflection } from './tiles/reflect';
import { edgeShadows, roundedTop, tileTone, wallPoint, type WallMap } from './tiles/surface';
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

// The capping row: same glaze, crazing, marks and reflections as the field tiles, plus the
// rounded top where it meets the wallpaper, lit from the room. High on the wall: marks stay light.
function bullnose(c: Config, vp: Viewport, a: Anchor, topExtra: number): HTMLElement {
  const s = computeStrip({ width: vp.width, origin: a.centreX, tile: a.tile, grout: c.GROUT_PX, widthRatio: c.BULLNOSE_WIDTH, offset: c.BULLNOSE_OFFSET });
  const room = roomFromConfig(c), ppc = pxPerCm(room, a.tile), map = wallMap(c, a, topExtra);
  const h = c.BULLNOSE_HEIGHT * a.tile, top = topExtra + c.HEADER_HEIGHT * a.tile;
  const base = hexToRgb(c.TILE_COLOR);
  const edge = { edgePx: c.TILE_EDGE_CM * ppc, sheen: c.TILE_EDGE_SHEEN, recessPx: GROUT_RECESS_CM * ppc, recess: c.GROUT_RECESS };
  const row = el('div', 'bullnose');
  for (let i = 0; i < s.count; i++) {
    const left = s.start + i * s.pitch;
    const index = Math.round((left - (a.centreX + c.BULLNOSE_OFFSET * s.pitch)) / s.pitch); // its place on the wall
    const at = wallPoint(map, { x: left + s.width / 2, y: top + h / 2 });
    const lights = lightsAt(room, at);
    const t = el('i', 'bullnose-tile');
    t.style.left = `${left}px`;
    t.style.background = `${roundedTop(lights, c.BULLNOSE_ROUND_CM * ppc, c.TILE_EDGE_SHEEN)}, ${tileTone(base, c.TILE_TONE, index, -1)}`;
    t.style.boxShadow = edgeShadows(lights, edge);
    const seed = tileSeed(index, -1);
    t.append(
      reflectionLayer(`bn:${index}`, top, { centre: at, wCm: s.width / ppc, hCm: h / ppc, roundTopCm: c.BULLNOSE_ROUND_CM, tiltDeg: c.TILE_TILT_DEG, waviness: c.TILE_WAVINESS, strength: c.TILE_REFLECTION, seed }),
      ageLayer(`bn:${index}`, s.width, h, ageAt(c, a.tile, 0), seed),
    );
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
type TileSurface = (row: number, col: number) => { background: string; boxShadow: string; at: { x: number; y: number } };

const wallMap = (c: Config, a: Anchor, topExtra: number): WallMap => {
  const room = roomFromConfig(c);
  return { pxPerCm: pxPerCm(room, a.tile), embroidery: room.embroidery, embroideryPage: { x: a.centreX, y: topExtra + (c.HEADER_HEIGHT * a.tile) / 2 } };
};

function tileSurfaces(c: Config, a: Anchor, topExtra: number): TileSurface {
  const room = roomFromConfig(c), ppc = pxPerCm(room, a.tile);
  const map = wallMap(c, a, topExtra);
  const firstTileTop = topExtra + (c.HEADER_HEIGHT + c.BULLNOSE_HEIGHT) * a.tile + c.GROUT_PX;
  const base = hexToRgb(c.TILE_COLOR);
  const edge = { edgePx: c.TILE_EDGE_CM * ppc, sheen: c.TILE_EDGE_SHEEN, recessPx: GROUT_RECESS_CM * ppc, recess: c.GROUT_RECESS };
  return (row, col) => {
    const at = wallPoint(map, { x: a.originX + col * a.pitch + a.tile / 2, y: firstTileTop + row * a.pitch + a.tile / 2 });
    return { background: tileTone(base, c.TILE_TONE, col, row), boxShadow: edgeShadows(lightsAt(room, at), edge), at };
  };
}

const GROUT_RECESS_CM = 0.15; // grout sits this far behind the tile faces

const tileSeed = (col: number, row: number) => Math.imul(col + 1000, 7919) ^ Math.imul(row + 1000, 104729);

// Room reflections in each tile: tiny canvases, cached by wall position and re-traced as the eye
// moves (scrolling), only for tiles on or near the screen. See tiles/reflect.ts.
const REFLECT_SAMPLES = 20;
const reflectCanvases = new Map<string, HTMLCanvasElement>();
let reflecting: { canvas: HTMLCanvasElement; tile: TileReflection; top: number }[] = []; // top: page px
let reflectScene: { room: Room; look: RoomLook; ppc: number; follow: number; size: number } | undefined;

function reflectionLayer(id: string, top: number, tile: TileReflection): HTMLCanvasElement {
  let canvas = reflectCanvases.get(id);
  if (!canvas) {
    canvas = el('canvas', 'tile-reflect');
    canvas.width = canvas.height = REFLECT_SAMPLES;
    canvas.setAttribute('aria-hidden', 'true');
    reflectCanvases.set(id, canvas);
  }
  reflecting.push({ canvas, tile, top });
  return canvas;
}

export function updateTileReflections(scroll = scrollY) {
  if (!reflectScene) return;
  const { room, look, ppc, follow, size } = reflectScene;
  const eye: Vec3 = [room.embroidery.x, room.eyeCm - (follow * scroll) / ppc, room.viewCm];
  const lo = scroll - size, hi = scroll + innerHeight + size; // the rest keep their last image
  for (const { canvas, tile, top } of reflecting) {
    if (top + size < lo || top > hi) continue;
    const px = reflectTile(room, look, tile, eye, REFLECT_SAMPLES);
    canvas.getContext('2d')!.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, REFLECT_SAMPLES, REFLECT_SAMPLES), 0, 0);
  }
}

const roomLook = (c: Config): RoomLook => ({
  wall: hexToRgb(c.ROOM_WALL_COLOR),
  ceiling: hexToRgb(c.ROOM_CEILING_COLOR),
  floor: hexToRgb(c.ROOM_FLOOR_COLOR),
  sky: [[205, 222, 240], [236, 241, 244]],
  sash: [220, 218, 211],
});

// Ageing canvases (crazing + water marks) cached by wall position, redrawn only when they change.
const ageing = new Map<string, { key: string; canvas: HTMLCanvasElement }>();

function ageLayer(id: string, w: number, h: number, age: Ageing, seed: number): HTMLCanvasElement {
  const dpr = Math.min(1.5, devicePixelRatio || 1); // soft detail: no need for full density
  const key = JSON.stringify([w, h, dpr, age]);
  let hit = ageing.get(id);
  if (!hit || hit.key !== key) {
    const canvas = el('canvas', 'tile-age');
    canvas.setAttribute('aria-hidden', 'true');
    drawAgeing(canvas, w, h, dpr, age, seed);
    ageing.set(id, (hit = { key, canvas }));
  }
  return hit.canvas;
}

// grime: 0 high on the wall … 1 bottom row
const ageAt = (c: Config, tile: number, grime: number): Ageing => ({
  crazing: c.TILE_CRAZING,
  spots: c.TILE_SPOTS + (c.TILE_SPOTS_LOW - c.TILE_SPOTS) * grime,
  limescale: c.TILE_LIMESCALE * grime,
  spotSize: c.WATER_SPOT_SIZE * tile,
});

function tileAgeing(c: Config, a: Anchor, rows: number) {
  return (row: number, col: number) =>
    ageLayer(`${col}:${row}`, a.tile, a.tile, ageAt(c, a.tile, grimeLevel(rows - 1 - row, c.TILE_GRIME_ROWS)), tileSeed(col, row));
}

function grid(c: Config, a: Anchor, cols: Columns, projects: Project[], pending: Promise<unknown>[], surface: TileSurface, firstTileTop: number): HTMLElement {
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
      const { at, ...style } = surface(r, k);
      Object.assign(t.style, style);
      t.append(
        reflectionLayer(`${k}:${r}`, firstTileTop + r * a.pitch, {
          centre: at,
          wCm: c.ROOM_TILE_CM,
          hCm: c.ROOM_TILE_CM,
          tiltDeg: c.TILE_TILT_DEG,
          waviness: c.TILE_WAVINESS,
          strength: c.TILE_REFLECTION,
          seed: tileSeed(k, r),
        }),
        aged(r, k),
      );
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
    '--reflect-blur': `${(a.tile * 0.01 * (0.5 + c.TILE_WAVINESS)).toFixed(2)}px`, // wavy glaze blurs reflections
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
  const room = roomFromConfig(c);
  reflecting = []; // the bull-nose row and the grid both register reflecting tiles
  reflectScene = { room, look: roomLook(c), ppc: pxPerCm(room, a.tile), follow: c.ROOM_EYE_FOLLOW, size: a.tile };
  root.replaceChildren(top, bullnose(c, vp, a, topExtra), grid(c, a, cols, projects, pending, tileSurfaces(c, a, topExtra), topExtra + (c.HEADER_HEIGHT + c.BULLNOSE_HEIGHT) * a.tile + c.GROUT_PX), el('footer', 'skirting'));
  // Signals tests and screenshots that every visible print has settled.
  updateTileReflections();
  Promise.all(pending).then(() => gen === generation && (document.documentElement.dataset.printed = 'true'));

  const right = a.originX + (cols.first + cols.count - 1) * a.pitch;
  return { tile: a.tile, columns: cols.full.length, peekLeft: gridLeft + a.tile, peekRight: vp.width - right };
}
