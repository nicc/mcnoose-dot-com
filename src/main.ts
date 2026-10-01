import './styles/main.css';
import { CONFIG, type Config } from './config';
import { loadProjects } from './projects';
import { anchorFits, compensateTop, initialAnchor, shiftAnchor, type Anchor } from './layout';
import { PinFilter, type Point } from './pin';
import { resetReflection, updateReflection } from './embroidery';
import { renderScene, updateTileReflections, type Frame, type Viewport } from './scene';

const root = document.getElementById('app')!;
const probe = document.getElementById('svh-probe')!;
// ?fixtures swaps in the dev test logos; the branch is dropped from production builds.
const projects =
  import.meta.env.DEV && new URLSearchParams(location.search).has('fixtures')
    ? (await import('./dev/fixtures')).fixtureProjects()
    : loadProjects();
const state: Config = { ...CONFIG };

// Small viewport height (svh) stays put while mobile URL bars show/hide, so tiles don't jitter.
const viewport = (): Viewport => ({ width: document.documentElement.clientWidth, height: probe.offsetHeight });

// The wall is anchored once and only re-anchored (re-centred) when tile geometry config
// changes or the window gets too small to show one full tile with MIN_PEEK either side.
// On desktop it is also pinned to the physical screen: dragging the left/top edge or
// moving the window reveals more wall instead of moving it.
const pinToScreen = matchMedia('(hover: hover) and (pointer: fine)').matches;
const screenPos = (): Point => {
  const w = window as Window & { mozInnerScreenX?: number; mozInnerScreenY?: number };
  return pinToScreen ? { x: w.mozInnerScreenX ?? w.screenX, y: w.mozInnerScreenY ?? w.screenY } : { x: 0, y: 0 };
};
const pin = new PinFilter(screenPos(), performance.now());
let shown = screenPos(); // smoothed screen position the wall is drawn against

let anchor: Anchor | undefined;
let anchorKey = '';
let anchorScreenX = 0;
let lastScreenY = 0;
let topExtra = 0; // wallpaper grown above the header by top-edge drags
let intendedScroll = 0; // unrounded scroll we last set, so small eased corrections don't lose fractions
let last = '';
let frame: Frame;

function render(force = false): Frame {
  const vp = viewport();
  const pos = shown;
  const geometry = JSON.stringify([state.TILE_MAX_PX, state.GROUT_PX, state.MIN_PEEK]);
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

  const key = JSON.stringify([vp, state, wall, topExtra]);
  if (force || key !== last) frame = renderScene(root, state, vp, wall, topExtra, projects);
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

// No event fires when a window moves, so watch its screen position each frame.
// data-pin tells tests when the smoothed position has caught up.
if (pinToScreen) {
  const watch = (t: number) => {
    const { pos, settled } = pin.step(screenPos(), t, state.PIN_SMOOTH_MS);
    if (pos.x !== shown.x || pos.y !== shown.y) {
      shown = pos;
      render();
    }
    document.documentElement.dataset.pin = settled ? 'settled' : 'moving';
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
}

if (import.meta.env.DEV) {
  import('./dev/panel').then(({ mountPanel }) => mountPanel(state, render));
}
