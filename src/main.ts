import './styles/main.css';
import { CONFIG, type Config } from './config';
import { loadProjects } from './projects';
import { anchorFits, initialAnchor, type Anchor } from './layout';
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
let anchor: Anchor | undefined;
let anchorKey = '';
let last = '';
let frame: Frame;
function render(force = false): Frame {
  const vp = viewport();
  const geometry = JSON.stringify([state.TILE_MAX_PX, state.GROUT_PX, state.MIN_PEEK]);
  if (!anchor || geometry !== anchorKey || !anchorFits(anchor, vp.width, vp.height, state.MIN_PEEK)) {
    anchor = initialAnchor({ ...vp, tileMax: state.TILE_MAX_PX, grout: state.GROUT_PX, minPeek: state.MIN_PEEK });
    anchorKey = geometry;
  }
  const key = JSON.stringify([vp, state, anchor]);
  if (force || key !== last) frame = renderScene(root, state, vp, anchor, projects);
  last = key;
  return frame;
}

render();
addEventListener('resize', () => render());

if (import.meta.env.DEV) {
  import('./dev/panel').then(({ mountPanel }) => mountPanel(state, render));
}
