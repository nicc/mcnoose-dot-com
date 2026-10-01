import './styles/main.css';
import { CONFIG, type Config } from './config';
import { loadProjects } from './projects';
import { anchorFits, compensateTop, initialAnchor, shiftAnchor, type Anchor } from './layout';
import { renderScene, type Frame, type Viewport } from './scene';

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
const screenPos = () => {
  const w = window as Window & { mozInnerScreenX?: number; mozInnerScreenY?: number };
  return pinToScreen ? { x: w.mozInnerScreenX ?? w.screenX, y: w.mozInnerScreenY ?? w.screenY } : { x: 0, y: 0 };
};

let anchor: Anchor | undefined;
let anchorKey = '';
let anchorScreenX = 0;
let lastScreenY = 0;
let topExtra = 0; // wallpaper grown above the header by top-edge drags
let last = '';
let frame: Frame;

function render(force = false): Frame {
  const vp = viewport();
  const pos = screenPos();
  const geometry = JSON.stringify([state.TILE_MAX_PX, state.GROUT_PX, state.MIN_PEEK]);
  let wall = anchor && shiftAnchor(anchor, pos.x - anchorScreenX);
  if (!wall || geometry !== anchorKey || !anchorFits(wall, vp.width, vp.height, state.MIN_PEEK)) {
    wall = anchor = initialAnchor({ ...vp, tileMax: state.TILE_MAX_PX, grout: state.GROUT_PX, minPeek: state.MIN_PEEK });
    anchorKey = geometry;
    anchorScreenX = pos.x;
    lastScreenY = pos.y;
    topExtra = 0;
  }

  let scrollTarget: number | undefined;
  if (pos.y !== lastScreenY) {
    ({ scrollY: scrollTarget, topExtra } = compensateTop(scrollY, pos.y - lastScreenY, topExtra));
    lastScreenY = pos.y;
  }

  const key = JSON.stringify([vp, state, wall, topExtra]);
  if (force || key !== last) frame = renderScene(root, state, vp, wall, topExtra, projects);
  last = key;
  if (scrollTarget !== undefined) scrollTo(scrollX, scrollTarget);
  return frame;
}

render();
addEventListener('resize', () => render());

// No event fires when a window moves, so watch its screen position each frame.
if (pinToScreen) {
  let seen = screenPos();
  const watch = () => {
    const pos = screenPos();
    if (pos.x !== seen.x || pos.y !== seen.y) render();
    seen = pos;
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
}

if (import.meta.env.DEV) {
  import('./dev/panel').then(({ mountPanel }) => mountPanel(state, render));
}
