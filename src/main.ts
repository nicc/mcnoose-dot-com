import './styles/main.css';
import { CONFIG, type Config } from './config';
import { loadProjects } from './projects';
import type { Layout } from './layout';
import { renderScene, type Viewport } from './scene';

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

let last = '';
let layout: Layout;
function render(force = false): Layout {
  const vp = viewport();
  const key = JSON.stringify([vp, state]);
  if (force || key !== last) layout = renderScene(root, state, vp, projects);
  last = key;
  return layout;
}

render();
addEventListener('resize', () => render());

if (import.meta.env.DEV) {
  import('./dev/panel').then(({ mountPanel }) => mountPanel(state, render));
}
