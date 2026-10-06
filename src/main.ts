import './styles/main.css';
import { CONFIG, type Config } from './config';
import { loadProjects } from './projects';
import { anchorFits, compensateTop, initialAnchor, shiftAnchor, projectMargin, visibleColumns, type Anchor } from './layout';
import { PinFilter, zoomScale, type Point } from './pin';
import { embroideryLost, resetReflection, skyInGlass, updateReflection } from './embroidery';
import { startClouds } from './clouds';
import { onFrameTurned } from './frame';
import { showNotice } from './notice';
import { startWiping } from './wipe';
import { forgetCanvases, reflowProjects, renderScene, slideStage, updateTileReflections, type Frame, type Viewport } from './scene';

// The wall renders into a stage a margin wider than the window each side (overscan); #app clips
// it. Window moves within the margin just slide the stage (a GPU transform, no redraw); past it,
// or on any other change, the scene is rebuilt — cheaply, as everything's cached.
const app = document.getElementById('app')!;
const stage = document.createElement('div');
stage.id = 'stage';
app.append(stage);
const overscan = (tile: number) => Math.round(1.5 * tile);
const DENSITY_SETTLE_MS = 300; // a run of zoom steps redraws once
const probe = document.getElementById('svh-probe')!;
// ?fixtures swaps in the dev test logos; the branch is dropped from production builds.
const projects =
  import.meta.env.DEV && new URLSearchParams(location.search).has('fixtures')
    ? (await import('./dev/fixtures')).fixtureProjects()
    : await loadProjects(); // the wall's height depends on how many, so wait before drawing it
const state: Config = { ...CONFIG };

// Small viewport height (svh) stays put while mobile URL bars show/hide, so tiles don't jitter.
const viewport = (): Viewport => ({ width: document.documentElement.clientWidth, height: probe.offsetHeight });

// The wall is anchored once and only re-anchored (re-centred) when tile geometry config
// changes or the window gets too small to show one full tile with MIN_PEEK either side.
// On desktop it is also pinned to the physical screen: dragging the left/top edge or
// moving the window reveals more wall instead of moving it.
const pinToScreen = matchMedia('(hover: hover) and (pointer: fine)').matches;
let zoom = pinToScreen ? zoomScale(innerWidth, outerWidth, devicePixelRatio) : 1; // page px per screen unit (browser zoom)
const screenPos = (): Point => {
  const w = window as Window & { mozInnerScreenX?: number; mozInnerScreenY?: number };
  return pinToScreen ? { x: (w.mozInnerScreenX ?? w.screenX) * zoom, y: (w.mozInnerScreenY ?? w.screenY) * zoom } : { x: 0, y: 0 };
};
let pin = new PinFilter(screenPos(), performance.now());
let shown = screenPos(); // smoothed screen position the wall is drawn against

// Zoomed (or moved to a screen of another density): screen positions are now in other page px, so
// restart the pin there (no easing across the jump); render() re-centres the wall at the new scale.
// Firefox zooms its screen positions too, so only the pixel density shows its zoom.
let density = devicePixelRatio;
function syncZoom() {
  const z = pinToScreen ? zoomScale(innerWidth, outerWidth, devicePixelRatio) : 1;
  if (z === zoom && devicePixelRatio === density) return;
  zoom = z;
  density = devicePixelRatio;
  pin = new PinFilter(screenPos(), performance.now());
  shown = screenPos();
}

let anchor: Anchor | undefined;
let anchorKey = '';
let anchorScreenX = 0;
let lastScreenY = 0;
let topExtra = 0; // wallpaper grown above the header by top-edge drags
let intendedScroll = 0; // unrounded scroll we last set, so small eased corrections don't lose fractions
let last = '';
let lastFull = ''; // which columns hold projects, as last laid out
let rendered: Anchor | undefined; // the wall as the scene was last built (window coords)
let renderedDensity = 0; // devicePixelRatio it was built at
export const renderCounts = { rebuilds: 0, slides: 0 }; // dev panel readout: spot unexpected re-renders
let frame: Frame;

function render(force = false): Frame {
  syncZoom();
  const vp = viewport();
  const pos = shown;
  const geometry = JSON.stringify([state.TILE_MAX_PX, state.GROUT_PX, state.MIN_PEEK, density]); // zoomed: re-centred at the new scale
  let wall = anchor && shiftAnchor(anchor, pos.x - anchorScreenX);
  if (!wall || geometry !== anchorKey || !anchorFits(wall, vp.width, vp.height, state.MIN_PEEK)) {
    wall = anchor = initialAnchor({ ...vp, tileMax: state.TILE_MAX_PX, grout: state.GROUT_PX, minPeek: state.MIN_PEEK });
    anchorKey = geometry;
    resetReflection(); // the wall moved: the reflection starts at rest again
    anchorScreenX = pos.x;
    lastScreenY = pos.y;
    topExtra = 0;
  }

  let scrollTarget: number | undefined;
  if (pos.y !== lastScreenY) {
    const base = Math.abs(scrollY - intendedScroll) < 1 ? intendedScroll : scrollY; // else the user scrolled
    ({ scrollY: scrollTarget, topExtra } = compensateTop(base, pos.y - lastScreenY, topExtra));
    intendedScroll = scrollTarget;
    lastScreenY = pos.y;
  }

  // Everything but the window's sideways position: if only that changed, and not past the margin,
  // slide the stage. If a tile also gained or lost its place for a project, the projects move to
  // the tiles that now qualify (their prints are moved, not redrawn).
  const full = JSON.stringify(visibleColumns(wall, vp.width, projectMargin(wall, state.PROJECT_PEEK)).full);
  const m = overscan(wall.tile), key = JSON.stringify([vp, state, wall.tile, wall.pitch, wall.originX - wall.centreX, topExtra]);
  const dx = rendered ? wall.originX - rendered.originX : 0;
  let rebuild = force || key !== last || !rendered || Math.abs(dx) > m;
  const reflowed = !rebuild && full !== lastFull ? reflowProjects({ anchor: wall, width: vp.width }) : undefined;
  if (!rebuild && full !== lastFull && !reflowed) rebuild = true; // needs another row
  lastFull = full;
  if (rebuild) {
    Object.assign(stage.style, { left: `${-m}px`, width: `${vp.width + 2 * m}px`, transform: '' });
    frame = renderScene(stage, state, { width: vp.width + 2 * m, height: vp.height }, shiftAnchor(wall, -m), topExtra, projects, { anchor: wall, width: vp.width });
    rendered = wall;
    renderedDensity = devicePixelRatio;
    renderCounts.rebuilds++;
  } else {
    stage.style.transform = dx ? `translate3d(${dx}px, 0, 0)` : ''; // composited only while it slides
    slideStage(dx);
    if (reflowed) frame = reflowed;
    renderCounts.slides++;
  }
  last = key;
  if (scrollTarget !== undefined) scrollTo(scrollX, scrollTarget);
  updateReflection(shown);
  return frame;
}

const reflect = () => {
  updateReflection(shown);
  updateTileReflections();
};

// Reflections slide as the view scrolls; one update per frame at most.
let reflecting = false;
addEventListener(
  'scroll',
  () => {
    if (reflecting) return;
    reflecting = true;
    requestAnimationFrame(() => {
      reflecting = false;
      reflect();
    });
  },
  { passive: true },
);

render();
addEventListener('resize', () => render());
onFrameTurned(() => render(true)); // re-light the frame at its new angle
startClouds(() => state, skyInGlass);

// Canvases are drawn once and kept, but a GPU reset (Firefox when a monitor is plugged in, say) can
// wipe them, and nothing reliably reports that for 2D canvases. So check one kept canvas now and
// then (one pixel, ~free), and redraw everything if it has gone blank.
const recover = () => {
  if (document.hidden || !embroideryLost()) return;
  forgetCanvases();
  render(true);
};
setInterval(recover, 2000);
document.addEventListener('visibilitychange', recover);

// Another pixel density (zoomed, or moved to another screen): redraw sharp for it, once the zooming
// stops (each step would otherwise be a full redraw), and only if no rebuild has done so already.
let densityTimer = 0;
const watchDensity = () =>
  matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => {
    clearTimeout(densityTimer);
    densityTimer = window.setTimeout(() => devicePixelRatio !== renderedDensity && render(true), DENSITY_SETTLE_MS);
    watchDensity();
  }, { once: true });
watchDensity();
startWiping(() => state);
if (state.NOTICE_SHOW) showNotice();

// No event fires when a window moves, so watch its screen position each frame.
// data-pin tells tests when the smoothed position has caught up.
if (pinToScreen) {
  const watch = (t: number) => {
    const { pos, settled } = pin.step(screenPos(), t, state.PIN_SMOOTH_MS);
    if (pos.x !== shown.x || pos.y !== shown.y) {
      shown = pos;
      render();
    }
    const pinState = settled ? 'settled' : 'moving';
    if (document.documentElement.dataset.pin !== pinState) document.documentElement.dataset.pin = pinState; // a write each frame would dirty style
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
}

if (import.meta.env.DEV) {
  import('./dev/panel').then(({ mountPanel }) => mountPanel(state, render, renderCounts));
}
