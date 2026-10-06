// Builds the wall: wallpaper header, dado rail, tile grid, skirting.
import type { Config } from './config';
import { projectMargin, visibleColumns, wallRows, type Anchor, type Columns } from './layout';
import { printTile } from './halftone/print';
import { baked } from 'virtual:wallpaper';
import { embroidery, forgetEmbroidery, SAMPLER_LINES } from './embroidery';
import { blendedLight, lightsAt, pxPerCm, roomFromConfig, viewAt, type Light, type Room, type Vec3 } from './room';
import { drawAgeing, grimeLevel, type Ageing, type GroutAround } from './tiles/glaze';
import { reflectTile, type RoomLook, type TileReflection } from './tiles/reflect';
import { edgeShadows, tileTone, wallPoint, type WallMap } from './tiles/surface';
import { beginSurfaces, replayWipes, wipeable } from './wipe';
import { flush, later, soon, soonSettled } from './later';
import { ageLayers, forgetAge, rollShift, rollsIn } from './wallpaper/age';
import { applyTint, sunPatch } from './sunlight';
import { noteElement } from './about';
import { isFallen, resetFall } from './fall';
import { bindFrame, frameTilt } from './frame';
import { fbm } from './wood/noise';
import { drawDust } from './trim/dust';
import { forgetLengths, promoteLengths, trimLength, type TrimStyle } from './trim/length';
import { railProfile, skirtingProfile, type Profile, type RailDims, type SkirtingDims } from './trim/profile';
import { hexToRgb } from './colour';
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
// A reference seam's wall x: PAPER_AGE_SEAM_OFFSET_CM from the embroidery's centre.
const seamOrigin = (c: Config) => roomFromConfig(c).embroidery.x + c.PAPER_AGE_SEAM_OFFSET_CM;

// The wallpaper, anchored to the wall. With the seams' pattern mismatch on, it's hung as one strip
// per roll (CSS backgrounds of the same baked image, no canvas work), each nudged up or down a
// millimetre or two off the pattern's match, so the pattern steps at each seam.
function hangWallpaper(el: HTMLElement, c: Config, a: Anchor, topExtra: number, pending: Promise<unknown>[], vp: Viewport) {
  const ppc = pxPerCm(roomFromConfig(c), a.tile), map = wallMap(c, a, topExtra);
  const shift = c.PAPER_AGE ? (c.PAPER_AGE_SEAM_SHIFT_MM / 10) * Math.min(1, c.PAPER_AGE_SEAMS) * ppc : 0;
  const pageX = (xCm: number) => map.embroideryPage.x + (xCm - map.embroidery.x) * ppc;
  const strips =
    shift > 0
      ? rollsIn(wallPoint(map, { x: 0, y: 0 }).x, wallPoint(map, { x: vp.width, y: 0 }).x, seamOrigin(c)).map((r) => {
          const strip = document.createElement('div');
          strip.className = 'paper-roll';
          strip.setAttribute('aria-hidden', 'true');
          const left = pageX(r.x0);
          Object.assign(strip.style, { left: `${left}px`, width: `${pageX(r.x1) - left}px` });
          return { strip, left, dy: rollShift(r.k) * shift };
        })
      : [];
  if (strips.length) el.firstElementChild!.after(...strips.map((s) => s.strip)); // under the age layers and the frame
  const apply = (url: string, width: number, height: number) => {
    for (const [target, x, y] of strips.length ? strips.map((s) => [s.strip, a.originX - s.left, topExtra + s.dy] as const) : [[el, a.originX, topExtra] as const]) {
      target.style.backgroundImage = `url("${url}")`;
      target.style.backgroundSize = `${width}px ${height}px`;
      target.style.backgroundPosition = `${x}px ${y}px`;
    }
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
const NAIL_CM = 0.35; // head diameter

// The wallpaper's age (wallpaper/age.ts): its own wall-anchored layers over the pattern. The frame's
// mark is where it hangs at 0°, its top centre on the nail.
function paperAge(c: Config, a: Anchor, topExtra: number, vp: Viewport): HTMLElement[] {
  const room = roomFromConfig(c), ppc = pxPerCm(room, a.tile), e = embroidery(c, a.tile);
  const frame = { wCm: e.width / ppc, hCm: e.height / ppc, nail: { x: room.embroidery.x, y: room.embroidery.y + e.height / ppc / 2 } };
  const seam = { gapMm: c.PAPER_AGE_SEAM_GAP_MM, lift: c.PAPER_AGE_SEAM_LIFT, tear: c.PAPER_AGE_SEAM_TEAR, sharpness: c.PAPER_AGE_SEAM_SHARPNESS, dirt: c.PAPER_AGE_SEAM_DIRT };
  const style = { yellowing: c.PAPER_AGE_YELLOWING, stains: c.PAPER_AGE_STAINS, seams: c.PAPER_AGE_SEAMS, seam, seamOrigin: seamOrigin(c), halo: c.PAPER_AGE_HALO, haloSpreadDeg: c.PAPER_AGE_HALO_SPREAD_DEG };
  const light = blendedLight(lightsAt(room, room.embroidery));
  return ageLayers(wallMap(c, a, topExtra), vp.width, topExtra + c.HEADER_HEIGHT * a.tile, style, frame, light, Math.min(2, devicePixelRatio || 1), (key, job) => void soon(key, job));
}

// Click the frame to turn it over: on the back, the about note (about.ts).
function header(c: Config, tile: number): HTMLElement {
  const title = el('h1', 'sr-only', [document.createTextNode(SAMPLER_LINES.join(' '))]);
  const e = embroidery(c, tile);
  const room = roomFromConfig(c), ppc = pxPerCm(room, tile);
  if (!c.EMBROIDERY_FALL) resetFall(); // the experiment off: it's back on its nail
  // Fallen: just the nail it hung from. (Don't build the frame: its canvases are shared, and the
  // falling one is still using them.)
  if (isFallen()) return el('header', 'wallpaper', [title, nail(e.height, e.nail, room, ppc), el('div', 'seam-shadow')]);
  // Inside the paper, clear of its worn edges.
  const pad = Math.min(e.paper.w, e.paper.h) * 0.08, box = { x: e.paper.x + pad, y: e.paper.y + pad, w: e.paper.w - 2 * pad, h: e.paper.h - 2 * pad };
  const note = noteElement(box, { zoom: c.ABOUT_NOTE_ZOOM, spacing: c.ABOUT_NOTE_SPACING, ink: c.ABOUT_INK, strength: c.ABOUT_INK_STRENGTH }, Math.min(3, devicePixelRatio || 1));
  const back = el('div', 'frame-face frame-back', [e.back, note]);
  const card = el('div', 'frame-card', [el('div', 'frame-face frame-front', [e.canvas, e.glass]), back, ...e.edges]);
  card.style.setProperty('--frame-depth', `${e.depth}px`);
  const frame = el('figure', 'frame', [card]);
  frame.style.setProperty('--nail-y', `${e.nail}px`); // it turns and swings about the nail
  bindFrame(frame, card, back, c, ppc);
  return el('header', 'wallpaper', [title, el('div', 'frame-shadow', [frame]), el('div', 'seam-shadow')]);
}

// The nail the frame hung from (in its hanger's notch, just below its top edge), lit like everything else.
function nail(frameH: number, drop: number, room: Room, ppc: number): HTMLElement {
  const L = blendedLight(lightsAt(room, room.embroidery));
  const n = el('div', 'nail');
  Object.assign(n.style, { width: `${NAIL_CM * ppc}px`, height: `${NAIL_CM * ppc}px`, top: `calc(var(--frame-y) - ${frameH / 2 - drop}px)` });
  for (const [k, v] of Object.entries({
    '--nail-hx': `${50 + L[0] * 35}%`,
    '--nail-hy': `${50 + L[1] * 35}%`,
    '--nail-sx': `${((-L[0] / L[2]) * 0.25 * ppc).toFixed(1)}px`,
    '--nail-sy': `${((-L[1] / L[2]) * 0.25 * ppc).toFixed(1)}px`,
  }))
    n.style.setProperty(k, v);
  return n;
}

// Painted trim (dado rail, skirting) in tile-wide lengths, each lit by the room at its own place on
// the wall. The rail stands proud of the tiles and casts a soft shadow onto the top row.
const railDims = (c: Config): RailDims => ({ depthCm: c.RAIL_DEPTH_CM, roundCm: c.RAIL_ROUND_CM, beadCm: c.RAIL_BEAD_CM, coveCm: c.RAIL_COVE_CM, flatCm: c.RAIL_FLAT_CM });
const skirtingDims = (c: Config): SkirtingDims => ({ depthCm: c.SKIRTING_DEPTH_CM, torusCm: c.SKIRTING_TORUS_CM, reliefCm: c.SKIRTING_RELIEF_CM, flatCm: c.SKIRTING_FLAT_CM });
const TILE_FACE_CM = 0.9; // tile faces stand this far off the wall
// From eye height you look down onto a trim's top: the ledge from where its front rounds over back
// to whatever hides it (`behindCm` off the wall: the tile face, or the wall itself above the rail),
// foreshortened by the view angle. It's what a deep board's thickness looks like.
function ledgeCm(c: Config, a: Anchor, topExtra: number, top: number, profile: Profile, behindCm: number): number {
  const view = viewAt(roomFromConfig(c), wallPoint(wallMap(c, a, topExtra), { x: a.centreX, y: top }));
  return (Math.max(0, profile.topDepthCm - behindCm) * Math.max(0, -view[1])) / view[2];
}
const railTop = (c: Config, a: Anchor, topExtra: number) => topExtra + c.HEADER_HEIGHT * a.tile;
const railLedgeCm = (c: Config, a: Anchor, topExtra: number) => ledgeCm(c, a, topExtra, railTop(c, a, topExtra), railProfile(railDims(c)), 0);
const railHeight = (c: Config, a: Anchor, topExtra: number) => (railProfile(railDims(c)).heightCm + railLedgeCm(c, a, topExtra)) * (a.tile / c.ROOM_TILE_CM);
// The well-fitted joints where the tiles meet the rail and the skirting: a fine caulked line.
const edgeJoint = (c: Config, tile: number) => c.GROUT_EDGE_CM * (tile / c.ROOM_TILE_CM);

const paintOf = (c: Config) => ({ grain: c.PAINT_GRAIN, brush: c.PAINT_BRUSH, buildup: c.PAINT_BUILDUP, yellowing: c.PAINT_YELLOWING, sheen: c.PAINT_SHEEN, gloss: c.PAINT_GLOSS });

// A strip of painted lengths across the window at page y `top`, clipped to the window, with dust
// on its top (the visible ledge, when it has one). Returns the strip and the height it occupies.
// The lengths are painted in workers: those on screen now are awaited by `pending` (so tests and
// screenshots see them); the rest (overscan, below the fold) fill in behind them.
function paintedStrip(trim: string, c: Config, vp: Viewport, a: Anchor, topExtra: number, top: number, style: TrimStyle, dust: number, pending: Promise<unknown>[], deferred = false): { strip: HTMLElement; h: number } {
  const room = roomFromConfig(c), ppc = pxPerCm(room, a.tile), map = wallMap(c, a, topExtra);
  const ledge = (style.ledgeCm ?? 0) * ppc, h = style.profile.heightCm * ppc + ledge, seg = a.tile, dpr = Math.min(2, devicePixelRatio || 1);
  const strip = el('div', 'trim-strip');
  const first = Math.floor(-a.originX / seg), last = Math.ceil((vp.width - a.originX) / seg);
  for (let k = first; k <= last; k++) {
    const left = a.originX + k * seg;
    const lit = (x: number) => {
      // Rounded: the same wall point every render, so moving the window (which shifts page x and
      // the map together) doesn't change the cache key by float noise and re-render every length.
      const p = wallPoint(map, { x, y: top + h / 2 }), at = { x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 };
      return { lights: lightsAt(room, at), view: viewAt(room, at) };
    };
    const offScreen = left + seg < onScreen.x0 || left > onScreen.x1; // in the overscan margin: painted after what's on screen
    const urgent = !(deferred || offScreen);
    const length = trimLength(trim, k, seg, h, ppc, dpr, lit(left), lit(left + seg), style, urgent);
    if (urgent) pending.push(length.done);
    Object.assign(length.canvas.style, { left: `${left}px`, width: `${seg}px`, height: `${h}px` });
    strip.append(length.canvas);
  }
  const settle = settleRows(style.profile, ledge, ppc);
  strip.append(trimDust(c, vp, a, settle.length, dust, lightsAt(room, wallPoint(map, { x: a.centreX, y: top })), map, top, settle));
  return { strip, h };
}

function rail(c: Config, vp: Viewport, a: Anchor, topExtra: number, pending: Promise<unknown>[]): HTMLElement {
  const room = roomFromConfig(c), ppc = pxPerCm(room, a.tile), map = wallMap(c, a, topExtra);
  const top = railTop(c, a, topExtra);
  const profile = railProfile(railDims(c));
  // Its ledge runs back to the wall: nothing hides it.
  const style: TrimStyle = { profile, colour: hexToRgb(c.RAIL_COLOR), paint: paintOf(c), wear: c.RAIL_WEAR, grime: c.RAIL_GRIME, ledgeCm: railLedgeCm(c, a, topExtra) };
  const { strip, h } = paintedStrip('rail', c, vp, a, topExtra, top, style, c.RAIL_DUST, pending);
  const row = el('div', 'rail');
  row.style.height = `${h}px`;
  // Its cast shadow on the tiles: how far the rail's bottom overhangs them, along each light's slant.
  const overhang = Math.max(0, profile.faceDepthCm - TILE_FACE_CM) * ppc;
  const lights = lightsAt(room, wallPoint(map, { x: a.centreX, y: top + h }));
  const total = lights.reduce((s, l) => s + l.weight, 0);
  const reach = lights.reduce((s, { dir, weight, diffuse }) => s + (diffuse ? 0 : (Math.max(0, -dir[1]) / dir[2]) * overhang * (weight / total)), 0);
  const shadow = el('div', 'rail-shadow');
  shadow.style.height = `${(reach * 1.6 + 2).toFixed(1)}px`;
  shadow.style.setProperty('--rail-shadow-a', String(0.32 * c.RAIL_SHADOW)); // custom properties need setProperty
  row.append(strip, seamLine(c, vp, a), shadow); // outside the strip: its feathered mask would clip the paper side
  return row;
}

// The skirting along the floor, directly below the last row of tiles; the page ends with it. Its
// ledge runs back to the tile face, which hides the rest.
function skirting(c: Config, vp: Viewport, a: Anchor, topExtra: number, top: number, pending: Promise<unknown>[]): HTMLElement {
  const profile = skirtingProfile(skirtingDims(c));
  const style: TrimStyle = { profile, colour: hexToRgb(c.SKIRTING_COLOR), paint: paintOf(c), wear: c.SKIRTING_WEAR, grime: c.SKIRTING_GRIME, ledgeCm: ledgeCm(c, a, topExtra, top, profile, TILE_FACE_CM),
    scuffs: { amount: c.SKIRTING_SCUFFS, low: c.SKIRTING_SCUFF_LOW, faceTopCm: profile.heightCm - c.SKIRTING_FLAT_CM } };
  // Below the fold on load: painted after what's on screen, or at once as it nears the screen.
  const below = belowFold(top, vp);
  const { strip, h } = paintedStrip('skirting', c, vp, a, topExtra, top, style, c.SKIRTING_DUST, pending, below);
  const footer = el('footer', 'skirting', [strip]);
  footer.style.height = `${h}px`;
  if (below) whenNear(footer, () => promoteLengths('skirting:'));
  return footer;
}

// Drawing held back until the browser is idle, for what's below the fold at load (the skirting, the
// lower tiles' ageing): drawn sooner if it comes within EARLY_PX of the screen. One observer per
// render (re-renders replace every element).
const EARLY_PX = 600;
const belowFold = (top: number, vp: Viewport) => top > scrollY + vp.height + EARLY_PX;
let nearWatch: IntersectionObserver | undefined;
const nearJobs = new Map<Element, () => void>();
function whenNear(target: Element, then: () => void) {
  nearWatch ??= new IntersectionObserver((seen) => {
    for (const e of seen) {
      if (!e.isIntersecting) continue;
      nearWatch!.unobserve(e.target);
      const job = nearJobs.get(e.target);
      nearJobs.delete(e.target);
      job?.();
    }
  }, { rootMargin: `${EARLY_PX}px 0px` });
  nearJobs.set(target, then);
  nearWatch.observe(target);
}
function resetNear() {
  nearWatch?.disconnect();
  nearWatch = undefined;
  nearJobs.clear();
}

const DUST_PX_PER_CM = 10; // dust sizes in trim/dust.ts are px at this scene scale (desktop)

// Where dust can lie on a trim, per css px row from its top: how much each row faces up (squared,
// so it thins quickly as a round steepens). The visible ledge above a skirting's round (ledge px)
// is flat, so it all holds dust; then the profile's own slope (depth gained per cm down).
function settleRows(profile: Profile, ledge: number, ppc: number): number[] {
  const rows: number[] = Array.from({ length: Math.round(ledge) }, () => 1);
  const hPx = profile.heightCm * ppc, dt = 0.5 / hPx;
  for (let v = 0; v < Math.min(hPx, 40); v++) {
    const t = (v + 0.5) / hPx, slope = ((profile.at(Math.min(1, t + dt)) - profile.at(Math.max(0, t - dt))) * profile.depthCm) / (2 * dt * profile.heightCm);
    const up = slope > 0 ? slope / Math.hypot(slope, 1) : 0;
    if (up < 0.3 && v > 2) break; // past the part of the round that faces up
    rows.push(up * up);
  }
  return rows.length ? rows : [1];
}

// Dust on a trim's top ledge, lit by the room at the ledge (see trim/dust.ts).
function trimDust(c: Config, vp: Viewport, a: Anchor, band: number, amount: number, lights: Light[], map: WallMap, top: number, settle?: number[]): HTMLCanvasElement {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const canvas = el('canvas', 'trim-dust');
  canvas.width = Math.ceil(vp.width * dpr);
  canvas.height = Math.ceil(band * dpr);
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.height = `${band}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawDust(ctx, a.originX, vp.width, band, amount, c.DUST_SHADE, lights, 433, pxPerCm(roomFromConfig(c), a.tile) / DUST_PX_PER_CM, undefined, settle);
  wipeable(canvas, 'dust', map, 0, top, dpr, true);
  return canvas;
}

// The joint where tile meets paper: a thin, slightly wavering shadow line with the caulk's lit
// lip just below it. Wobble keyed to wall position, so it holds still under resizes.
const SEAM_ABOVE_PX = 3; // of the seam canvas's 7, over the paper (.seam-line in main.css)
const seamColumns = new Map<number, Uint8Array>();
let seamKey = '';
// One device-pixel column of the paper/rail crevice at wall x (CSS px from the wall origin): alphas.
function seamColumn(x: number, dpr: number, H: number, k: number): Uint8Array {
  const out = new Uint8Array(H);
  // The paper was trimmed to the rail by hand: its edge drifts either side of the joint.
  const yc = SEAM_ABOVE_PX + 0.4 + 0.7 * fbm(x / 40, 0.5, 17, 3) + 0.5 * fbm(x / 9, 2.5, 23, 2) + 0.2 * fbm(x / 2.5, 6.5, 43, 1);
  const gap = 0.22 + 0.4 * Math.max(0, fbm(x / 18, 3.5, 29, 3) + 0.35); // crevice half-width, px
  const bridged = Math.min(1, Math.max(0, (fbm(x / 60, 4.5, 31, 2) - 0.05) * 4)); // paint filled it
  const depth = (1 - 0.9 * bridged) * Math.min(1, 0.3 + 1.2 * Math.max(0, fbm(x / 90, 1.5, 19, 2) + 0.4));
  const grime = 0.4 + Math.max(0, fbm(x / 35, 5.5, 37, 3)) * 2;
  for (let py = 0; py < H; py++) {
    const y = (py + 0.5) / dpr, d = y - yc, fibre = 0.9 + 0.25 * fbm(x / 1.5, y / 0.8, 41, 2);
    const core = Math.exp(-0.5 * (d / gap) ** 2) * 0.55 * depth;
    const above = d < 0 ? Math.exp(d / 0.7) * 0.04 * grime : 0; // into the paper
    const alpha = Math.min(1, (core + above) * fibre * k);
    out[py] = Math.round(alpha * 255);
  }
  return out;
}

function seamLine(c: Config, vp: Viewport, a: Anchor): HTMLCanvasElement {
  const dpr = Math.min(2, devicePixelRatio || 1), hpx = 7;
  const canvas = el('canvas', 'seam-line');
  canvas.width = Math.ceil(vp.width * dpr);
  canvas.height = hpx * dpr;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d')!;
  // The crevice where the paper meets the rail, built per pixel so nothing about it is ruled: it
  // wanders, the gap opens and closes, paint has bridged it in places, a little grime has crept up
  // into the paper above, and the paper's fibres break its edge. A shadow, so only ever darkening.
  // Columns are kept by wall device-pixel, so rebuilds (window drags) copy rather than recompute.
  const W = canvas.width, H = canvas.height, img = ctx.createImageData(W, H), k = c.SEAM_LINE;
  const key = `${dpr}|${k}`;
  if (key !== seamKey || seamColumns.size > 20000) (seamKey = key), seamColumns.clear(); // bounded: the wall seen so far
  for (let px = 0; px < W; px++) {
    const ix = Math.round((px / dpr - a.originX) * dpr);
    let column = seamColumns.get(ix);
    if (!column) seamColumns.set(ix, (column = seamColumn(ix / dpr, dpr, H, k)));
    for (let py = 0; py < H; py++) {
      const i = (py * W + px) * 4;
      img.data[i] = 52, img.data[i + 1] = 42, img.data[i + 2] = 32, img.data[i + 3] = column[py];
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Prints are cached per project so resizes and re-flows move canvases instead of re-printing.
interface Print {
  canvas: HTMLCanvasElement;
  clean: HTMLCanvasElement; // shown on hover: the original logo
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
const holds = new WeakMap<HTMLElement, string>(); // tile → the project it shows

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

// What the prints depend on: a change to any of it reprints every tile.
const printsKeyFor = (c: Config, tile: number) => JSON.stringify([tile, devicePixelRatio, Object.entries(c).filter(([k]) => /^(TILE_|HALFTONE_|PRINT_)/.test(k) && k !== 'PRINT_HOVER_FADE_MS')]);

function printFor(c: Config, tile: number, p: Project, key = printsKeyFor(c, tile)): Print {
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
    const canvas = el('canvas', 'tile-print'), clean = el('canvas', 'tile-clean');
    canvas.setAttribute('aria-hidden', 'true');
    clean.setAttribute('aria-hidden', 'true');
    const done = printTile(c, { canvas, clean, title: p.title, logoUrl: p.logoUrl, tile }).then(
      () => true,
      (e) => (console.warn(e), false),
    );
    pr = { canvas, clean, done };
    prints.set(id, pr);
  }
  return pr;
}

// Title stays in the DOM for screen readers; the canvas carries the visible print. On hover the
// print fades to the original logo (its wrapper fades, so the re-flow crossfade on the print itself
// is untouched). Links open in a new tab.
function projectTile(c: Config, tile: number, p: Project, slot: string, now: number, pending: Promise<unknown>[], key: string): HTMLElement {
  const a = el('a', 'tile tile-project');
  holds.set(a, projectId(p));
  a.href = p.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  const pr = printFor(c, tile, p, key);
  place(p, slot, pr.canvas, now);
  const arrived = arrivals.get(projectId(p));
  if (arrived !== undefined && fading(pr.canvas, arrived, now, c.REFLOW_FADE_MS)) a.classList.add('tile-arrive');
  const title = el('span', 'tile-title sr-only', [document.createTextNode(p.title)]);
  a.append(el('div', 'tile-art', [el('div', 'tile-ink', [pr.canvas]), pr.clean]), title);
  pending.push(pr.done.then((ok) => ok || title.classList.remove('sr-only'))); // plain-text fallback
  return a;
}

// Projects fill full tiles (showing PROJECT_PEEK of each neighbour) row by row; the rest stay blank.
// Each tile's glaze tone and cushion-edge lighting, from where it sits in the room.
type TileSurface = (row: number, col: number) => { background: string; boxShadow: string; at: { x: number; y: number } };

const wallMap = (c: Config, a: Anchor, topExtra: number): WallMap => {
  const room = roomFromConfig(c);
  return { pxPerCm: pxPerCm(room, a.tile), embroidery: room.embroidery, embroideryPage: { x: a.centreX, y: topExtra + (c.HEADER_HEIGHT * a.tile) / 2 } };
};

function tileSurfaces(c: Config, a: Anchor, topExtra: number): TileSurface {
  const room = roomFromConfig(c), ppc = pxPerCm(room, a.tile);
  const map = wallMap(c, a, topExtra);
  const firstTileTop = topExtra + c.HEADER_HEIGHT * a.tile + railHeight(c, a, topExtra) + edgeJoint(c, a.tile);
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
let reflecting: { canvas: HTMLCanvasElement; tile: TileReflection; top: number; x: number; nx: number; ny: number }[] = []; // top: page px; x: stage px
let reflectScene: { room: Room; look: RoomLook; ppc: number; follow: number; size: number } | undefined;
let reflectSceneKey = '';

function reflectionLayer(id: string, top: number, x: number, tile: TileReflection, nx = REFLECT_SAMPLES, ny = REFLECT_SAMPLES): HTMLCanvasElement {
  let canvas = reflectCanvases.get(id);
  if (!canvas) {
    canvas = el('canvas', 'tile-reflect');
    canvas.setAttribute('aria-hidden', 'true');
    reflectCanvases.set(id, canvas);
  }
  if (canvas.width !== nx || canvas.height !== ny) [canvas.width, canvas.height] = [nx, ny];
  reflecting.push({ canvas, tile, top, x, nx, ny });
  return canvas;
}

// What each canvas was last traced for: re-renders (window moves, resizes) don't move the eye, so
// they needn't re-trace; only scrolling does.
const traced = new WeakMap<HTMLCanvasElement, { scene: string; eyeY: number; x: number; y: number; seed: number; nx: number }>();
const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

export function updateTileReflections(scroll = scrollY, viewH = innerHeight) {
  if (!reflectScene) return;
  const { room, look, ppc, follow, size } = reflectScene;
  const eye: Vec3 = [room.embroidery.x, room.eyeCm - (follow * scroll) / ppc, room.viewCm];
  const lo = scroll - size, hi = scroll + viewH + size; // the rest keep their last image
  const left = onScreen.x0 - slid - size, right = onScreen.x1 - slid + size; // only what's in (or at) the window
  for (const { canvas, tile, top, x, nx, ny } of reflecting) {
    if (top + size < lo || top > hi || x + size < left || x > right) continue;
    const was = traced.get(canvas); // tile settings are part of the scene key; position by number
    if (was && was.scene === reflectSceneKey && same(was.eyeY, eye[1]) && same(was.x, tile.centre.x) && same(was.y, tile.centre.y) && was.seed === tile.seed && was.nx === nx) continue;
    traced.set(canvas, { scene: reflectSceneKey, eyeY: eye[1], x: tile.centre.x, y: tile.centre.y, seed: tile.seed, nx });
    const px = reflectTile(room, look, tile, eye, nx, ny);
    canvas.getContext('2d')!.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, nx, ny), 0, 0);
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
const ageing = new Map<string, { key: string; fixed: HTMLCanvasElement; marks: HTMLCanvasElement }>();

// Every kept canvas's pixels were lost (a GPU reset): drop them all so the next render redraws.
export function forgetCanvases() {
  forgetLengths();
  forgetEmbroidery();
  forgetAge();
  prints.clear();
  printsKey = '';
  reflectCanvases.clear();
  ageing.clear();
}

// fresh: just drawn (so wipes are replayed onto its marks). defer: below the fold at load, so drawn
// when the browser is idle (keyed `tile-age:<id>`; the wipes so far are replayed then).
function ageLayer(id: string, w: number, h: number, age: Ageing, seed: number, grout: GroutAround | undefined, defer: boolean): { fixed: HTMLCanvasElement; marks: HTMLCanvasElement; dpr: number; fresh: boolean } {
  const dpr = Math.min(1.5, devicePixelRatio || 1); // soft detail: no need for full density
  const key = JSON.stringify([w, h, dpr, age, grout]);
  let hit = ageing.get(id);
  let fresh = !hit || hit.key !== key;
  if (!hit || fresh) {
    const fixed = el('canvas', 'tile-age'), marks = el('canvas', 'tile-age');
    const draw = () => drawAgeing(fixed, marks, w, h, dpr, age, seed, grout);
    if (defer) {
      later(`tile-age:${id}`, () => (draw(), replayWipes(marks)));
      fresh = false; // nothing to replay onto yet
    } else draw();
    // Extends over the joints the tile owns: left and above (and below on the bottom row).
    const g = grout?.g ?? 0;
    for (const canvas of [fixed, marks]) {
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, { left: `${-g}px`, top: `${-g}px`, width: `${w + g}px`, height: `${h + g + (grout?.lastRow ? grout.bottomG : 0)}px` });
    }
    ageing.set(id, (hit = { key, fixed, marks }));
  }
  return { fixed: hit.fixed, marks: hit.marks, dpr, fresh };
}

// grime: 0 high on the wall … 1 bottom row
const ageAt = (c: Config, tile: number, grime: number): Ageing => ({
  crazing: c.TILE_CRAZING,
  spots: c.TILE_SPOTS + (c.TILE_SPOTS_LOW - c.TILE_SPOTS) * grime,
  limescale: c.TILE_LIMESCALE * grime,
  spotSize: c.WATER_SPOT_SIZE * tile,
});

function tileAgeing(c: Config, a: Anchor, rows: number) {
  return (row: number, col: number, defer: boolean) => {
    const level = grimeLevel(rows - 1 - row, c.TILE_GRIME_ROWS);
    const grout: GroutAround = {
      g: c.GROUT_PX,
      topG: row === 0 ? edgeJoint(c, a.tile) : c.GROUT_PX,
      bottomG: edgeJoint(c, a.tile),
      lastRow: row === rows - 1,
      age: { age: c.GROUT_AGE, grime: c.GROUT_GRIME, mould: c.GROUT_MOULD, limescale: c.GROUT_LIMESCALE, erosion: c.GROUT_EROSION, cracks: c.GROUT_CRACKS, level },
    };
    return ageLayer(`${col}:${row}`, a.tile, a.tile, ageAt(c, a.tile, level), tileSeed(col, row), grout, defer);
  };
}

function grid(c: Config, a: Anchor, cols: Columns, projects: Project[], pending: Promise<unknown>[], surface: TileSurface, firstTileTop: number, map: WallMap, vp: Viewport): HTMLElement {
  const g = el('div', 'grid');
  const slot = new Map(cols.full.map((k, i) => [k, i]));
  const n = Math.max(1, cols.full.length);
  const rows = wallRows(projects.length, a, n, c.TRAILING_ROWS);
  const aged = tileAgeing(c, a, rows);
  const now = performance.now(), printsKey = printsKeyFor(c, a.tile);
  const tiles = new Map<string, HTMLElement>();
  for (let r = 0; r < rows; r++) {
    for (let k = cols.first; k < cols.first + cols.count; k++) {
      const i = slot.get(k);
      const p = i === undefined ? undefined : projects[r * n + i];
      const key = `${r}:${k}`;
      const t = p ? projectTile(c, a.tile, p, key, now, pending, printsKey) : el('div', 'tile');
      const { at, ...style } = surface(r, k);
      Object.assign(t.style, style);
      t.append(
        reflectionLayer(`${k}:${r}`, firstTileTop + r * a.pitch, a.originX + k * a.pitch, {
          centre: at,
          wCm: c.ROOM_TILE_CM,
          hCm: c.ROOM_TILE_CM,
          tiltDeg: c.TILE_TILT_DEG,
          waviness: c.TILE_WAVINESS,
          strength: c.TILE_REFLECTION,
          seed: tileSeed(k, r),
        }),
      );
      const defer = belowFold(firstTileTop + r * a.pitch, vp), age = aged(r, k, defer);
      t.append(age.fixed, age.marks);
      wipeable(age.marks, 'scale', map, a.originX + k * a.pitch - c.GROUT_PX, firstTileTop + r * a.pitch - c.GROUT_PX, age.dpr, age.fresh);
      if (defer) whenNear(t, () => flush(`tile-age:${k}:${r}`));
      tiles.set(key, t);
      g.append(t);
    }
  }
  ghosts = ghosts.filter((gh) => fading(gh.canvas, gh.at, now, c.REFLOW_FADE_MS));
  for (const gh of ghosts) tiles.get(gh.slot)?.append(gh.canvas);
  built = { c, a, rows, projects, tiles };
  return el('main', 'wall', [g]);
}

// The grid as last built, so a window move can re-flow projects without rebuilding the scene.
let built: { c: Config; a: Anchor; rows: number; projects: Project[]; tiles: Map<string, HTMLElement> } | undefined;
const PROJECT_PARTS = ['tile-art', 'tile-title'];

// A window move changed which tiles fully show: move the projects (their cached prints) to the tiles
// that now qualify, crossfading as any re-flow does, keeping every tile's own layers (reflection,
// ageing, fading ghosts). Undefined if it can't — the wall would need another row: rebuild then.
export function reflowProjects(visible: { anchor: Anchor; width: number }): Frame | undefined {
  if (!built) return;
  const { c, a, projects, tiles } = built;
  const shown = visibleColumns(visible.anchor, visible.width, projectMargin(visible.anchor, c.PROJECT_PEEK));
  const n = Math.max(1, shown.full.length);
  if (wallRows(projects.length, a, n, c.TRAILING_ROWS) !== built.rows) return;
  const slot = new Map(shown.full.map((k, i) => [k, i]));
  const now = performance.now(), pending: Promise<unknown>[] = [], printsKey = printsKeyFor(c, a.tile);
  for (const [key, t] of tiles) {
    const [r, k] = key.split(':').map(Number), i = slot.get(k);
    const p = i === undefined ? undefined : projects[r * n + i];
    if ((p && projectId(p)) === holds.get(t)) continue;
    const next = p ? projectTile(c, a.tile, p, key, now, pending, printsKey) : el('div', 'tile');
    next.style.cssText = t.style.cssText; // its glaze tone and edge lighting
    next.append(...[...t.children].filter((e) => !PROJECT_PARTS.some((cls) => e.classList.contains(cls))));
    t.replaceWith(next);
    tiles.set(key, next);
  }
  ghosts = ghosts.filter((gh) => fading(gh.canvas, gh.at, now, c.REFLOW_FADE_MS) || void gh.canvas.remove());
  for (const gh of ghosts) if (!gh.canvas.isConnected) tiles.get(gh.slot)?.append(gh.canvas);
  if (pending.length) {
    const gen = ++generation;
    document.documentElement.dataset.printed = 'false';
    printed = Promise.all([printed, ...pending]);
    printed.then(() => gen === generation && (document.documentElement.dataset.printed = 'true'));
  }
  return frameFor(a.tile, shown, visible);
}

let printed: Promise<unknown> = Promise.resolve(); // what data-printed waits on
const frameFor = (tile: number, shown: Columns, visible: { anchor: Anchor; width: number }): Frame => {
  const vis = visible.anchor, right = vis.originX + (shown.first + shown.count - 1) * vis.pitch;
  return { tile, columns: shown.full.length, peekLeft: vis.originX + shown.first * vis.pitch + vis.tile, peekRight: visible.width - right };
};

export interface Frame {
  tile: number;
  columns: number; // holding projects
  peekLeft: number; // px of the left edge tile showing
  peekRight: number;
}

// The frame stands off the wall, so each room light casts its own shadow of it, offset by the
// light's slant (near-frontal window light: short; ceiling fill: longer, fainter, below). In screen
// space: the shadow wrapper isn't rotated.
function frameShadow(c: Config, tile: number): Record<string, string> {
  const room = roomFromConfig(c), d = c.EMBROIDERY_STANDOFF_CM * pxPerCm(room, tile);
  const lights = lightsAt(room, room.embroidery), total = lights.reduce((s, l) => s + l.weight, 0);
  const shadows = lights.filter((l) => !l.diffuse).map(({ dir: [x, y, z], weight }) => {
    const sx = (-x / z) * d, sy = (-y / z) * d;
    const blur = 2 + Math.hypot(sx, sy) * 0.8 + d * 0.3;
    return `drop-shadow(${sx.toFixed(1)}px ${sy.toFixed(1)}px ${blur.toFixed(1)}px rgb(0 0 0 / ${((0.45 * weight) / total).toFixed(3)}))`;
  });
  return { '--frame-shadow': shadows.join(' ') };
}

let generation = 0;
let onScreen = { x0: 0, x1: Infinity }; // the window's span in stage x (see renderScene)
let slid = 0; // how far the stage has slid since it was built (main.ts)
// The stage slid by dx (window moved within the overscan margin): trace whatever newly came into view.
export function slideStage(dx: number) {
  slid = dx;
  updateTileReflections();
}

// Rendered over `vp`, which may be wider than the window (overscan, see main.ts): `visible` is the
// window itself (its anchor and width) — projects fill only the tiles fully inside it, and
// off-screen painted lengths are drawn later.
export function renderScene(root: HTMLElement, c: Config, vp: Viewport, a: Anchor, topExtra: number, projects: Project[], visible = { anchor: a, width: vp.width }): Frame {
  const shown = visibleColumns(visible.anchor, visible.width, projectMargin(visible.anchor, c.PROJECT_PEEK));
  const cols = { ...visibleColumns(a, vp.width), full: shown.full }; // column k is the same tile in both
  onScreen = { x0: a.originX - visible.anchor.originX, x1: a.originX - visible.anchor.originX + visible.width };
  slid = 0;
  const gridLeft = a.originX + cols.first * a.pitch;
  const vars: Record<string, string> = {
    '--tile': `${a.tile}px`,
    '--grout': `${c.GROUT_PX}px`,
    '--grout-edge': `${edgeJoint(c, a.tile).toFixed(2)}px`,
    '--cols-total': String(cols.count),
    '--grid-w': `${cols.count * a.pitch - c.GROUT_PX}px`,
    '--grid-left': `${gridLeft}px`,
    '--wall-x': `${a.originX}px`, // world origin: anchor any future wall texture here, not to the viewport
    '--wall-y': `${topExtra}px`, // wallpaper grown above the original top edge
    '--frame-x': `${a.centreX}px`,
    '--frame-y': `${topExtra + (c.HEADER_HEIGHT * a.tile) / 2}px`,
    '--header-h': `${c.HEADER_HEIGHT * a.tile + topExtra}px`,
    '--frame-tilt': `${frameTilt(c)}deg`,
    '--flip-ms': `${c.ABOUT_FLIP_MS}ms`,
    '--hover-fade': `${c.PRINT_HOVER_FADE_MS}ms`,
    ...frameShadow(c, a.tile),
    '--reflow-fade': `${c.REFLOW_FADE_MS}ms`,
    '--seam-shadow-h': `${(c.SEAM_SHADOW_CM * a.tile) / c.ROOM_TILE_CM}px`, // the concave corner above the tiles
    '--seam-shadow-a': String(0.22 * c.SEAM_SHADOW),
    '--reflect-blur': `${(a.tile * 0.01 * (0.5 + c.TILE_WAVINESS)).toFixed(2)}px`, // wavy glaze blurs reflections
    '--halftone-blur': `${c.HALFTONE_BLUR_PX}px`,
    '--halftone-opacity': String(c.HALFTONE_OPACITY),
    '--tile-color': c.TILE_COLOR,
    '--grout-color': c.GROUT_COLOR,
    '--print-color': c.PRINT_COLOR,
    '--wallpaper-color': c.WALLPAPER_GROUND, // shown until the pattern is ready
    '--skirting-color': c.SKIRTING_COLOR,
    '--rail-color': c.RAIL_COLOR, // the rail shows as plain paint until its lengths are drawn
    '--notice-color': c.NOTICE_COLOR,
    '--notice-ink': c.NOTICE_INK,
  };
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  document.documentElement.toggleAttribute('data-reveal', c.PRINT_HOVER_REVEAL);

  const pending: Promise<unknown>[] = [];
  const gen = ++generation;
  resetNear(); // re-renders replace every element the last render was watching
  document.documentElement.dataset.printed = 'false';
  document.documentElement.dataset.renderedWidth = String(visible.width); // lets tests wait for a resize render
  const top = header(c, a.tile);
  if (c.PAPER_AGE) top.firstElementChild!.after(...paperAge(c, a, topExtra, vp)); // under the frame
  hangWallpaper(top, c, a, topExtra, pending, vp);
  const room = roomFromConfig(c);
  reflecting = []; // the bull-nose row and the grid both register reflecting tiles
  reflectScene = { room, look: roomLook(c), ppc: pxPerCm(room, a.tile), follow: c.ROOM_EYE_FOLLOW, size: a.tile };
  reflectSceneKey = JSON.stringify([reflectScene, c.TILE_TILT_DEG, c.TILE_WAVINESS, c.TILE_REFLECTION]);
  beginSurfaces(wallMap(c, a, topExtra)); // wipeable canvases register as they're placed
  const firstTileTop = topExtra + c.HEADER_HEIGHT * a.tile + railHeight(c, a, topExtra) + edgeJoint(c, a.tile);
  const rows = wallRows(projects.length, a, cols.full.length, c.TRAILING_ROWS);
  const skirtingTop = firstTileTop + rows * a.pitch - c.GROUT_PX + edgeJoint(c, a.tile);
  root.replaceChildren(
    top,
    rail(c, vp, a, topExtra, pending),
    grid(c, a, cols, projects, pending, tileSurfaces(c, a, topExtra), firstTileTop, wallMap(c, a, topExtra), vp),
    skirting(c, vp, a, topExtra, skirtingTop, pending),
  );
  const patch = sunPatch(c, wallMap(c, a, topExtra));
  if (patch) root.append(patch);
  applyTint(c);
  // Signals tests and screenshots that every visible print has settled.
  updateTileReflections(scrollY, vp.height); // viewport height passed in: reading it here would force a layout
  pending.push(soonSettled()); // the sampler and the paper's age, just after the first paint
  printed = Promise.all(pending);
  printed.then(() => gen === generation && (document.documentElement.dataset.printed = 'true'));
  return frameFor(a.tile, shown, visible);
}
