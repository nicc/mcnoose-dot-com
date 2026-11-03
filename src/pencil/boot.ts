// The page's first paint: the wall drawn in pencil on drafting paper while the rest of it loads.
// Its own small script, inlined into index.html (tools/pencil-inline.ts), so it runs as soon as the
// HTML arrives, while the main bundle is still downloading. The frame is drawn first; the rail and
// tiles once the main script runs; the last strokes once the scene is ready, or, if it's ready
// sooner, what's left speeds up to finish. Then the scene crossfades in over the drawing.
//
// Strokes are revealed by transform animations, which the compositor keeps running while the main
// thread is busy building the scene.
import { CONFIG, type Config } from '../config';
import { initialAnchor } from '../layout';
import { wallPlan } from '../plan';
import { loadProjects } from '../projects';
import { rng } from '../wood/noise';
import { heldFrom, sketch, type Stroke } from './strokes';
import type { Gate, Pencil } from './index';

const root = document.documentElement;
const style = document.createElement('style');
style.textContent = 'html.pencil{overflow:hidden}#pencil{position:fixed;inset:0;z-index:900;pointer-events:none;overflow:hidden;contain:strict}#pencil i{position:absolute;transform-origin:0 50%;box-sizing:border-box}';
document.head.append(style);

// The small viewport height, as main.ts measures it (#svh-probe), so the wall is anchored alike.
function viewport() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;width:0;height:100vh;height:100svh;visibility:hidden';
  document.body.append(probe);
  const vp = { width: root.clientWidth, height: probe.offsetHeight };
  probe.remove();
  return vp;
}

// Pressure along a line: set down lightly, full weight, lifted off at the end.
const TAPER = 'linear-gradient(90deg,rgba(0,0,0,.35),#000 6%,#000 90%,rgba(0,0,0,.25))';

function place(layer: HTMLElement, c: Config, s: Stroke, delay: number): Animation {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, h = s.pair ? s.pair + s.width : s.width;
  const e = document.createElement('i');
  e.dataset.part = s.part;
  e.style.cssText = `left:${s.x0}px;top:${s.y0 - h / 2}px;width:${Math.hypot(dx, dy)}px;height:${h}px;opacity:${s.alpha};-webkit-mask-image:${TAPER};mask-image:${TAPER};` +
    (s.pair ? `border:solid ${c.PENCIL_GRAPHITE};border-width:${s.width}px 0` : `background:${c.PENCIL_GRAPHITE}`); // a joint: both tiles' edges
  layer.append(e);
  const turn = `rotate(${Math.atan2(dy, dx)}rad)`;
  return e.animate([{ transform: `${turn} scaleX(0)` }, { transform: `${turn} scaleX(1)` }], { duration: s.ms, delay, easing: s.ease, fill: 'both' });
}

function draw(c: Config, projects: Promise<number>, seed: number) {
  document.getElementById('pencil')?.remove();
  const layer = document.createElement('div');
  layer.id = 'pencil';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.background = c.PENCIL_PAPER;
  document.body.append(layer);
  root.classList.add('pencil');
  root.dataset.pencil = 'drawing';

  const vp = viewport(), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anchor = initialAnchor({ ...vp, tileMax: c.TILE_MAX_PX, grout: c.GROUT_PX, minPeek: c.MIN_PEEK });
  const strokes = (n: number) => sketch(c, wallPlan(c, anchor, 0, n, vp.width), vp, rng(seed)).map((s) => (still ? { ...s, ms: 0, gap: 0 } : s));

  const open = new Set<Gate>(), running: Animation[] = [];
  const queue: { s: Stroke; gate?: Gate }[] = [];
  let pen = performance.now(), known = false, finishing = false; // pen: when it's next free
  const pump = () => {
    while (queue.length && (!queue[0].gate || open.has(queue[0].gate))) {
      const { s } = queue.shift()!, now = performance.now(), start = Math.max(pen, now) + s.gap;
      running.push(place(layer, c, s, start - now));
      pen = start + s.ms;
    }
    if (known && !queue.length && open.has('printed') && !finishing) finish();
  };
  const finish = () => {
    finishing = true;
    const rate = Math.max(1, (pen - performance.now()) / Math.max(1, c.PENCIL_FINISH_MS));
    for (const a of running) if (a.playState !== 'finished') a.updatePlaybackRate(rate);
    Promise.all(running.map((a) => a.finished)).then(() =>
      layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: still ? 0 : c.PENCIL_FADE_MS, easing: 'ease-in-out', fill: 'forwards' }).finished.then(() => {
        if (!layer.isConnected) return; // replaced by a replay (dev)
        layer.remove();
        root.classList.remove('pencil');
        root.dataset.pencil = 'done';
      }),
    );
  };

  // The frame needs nothing but the window; the rest waits for the projects (the wall's height).
  // The same seed draws the same frame either way.
  queue.push(...strokes(0).filter((s) => s.part === 'frame').map((s) => ({ s })));
  pump();
  projects.then((n) => {
    const all = strokes(n), held = heldFrom(all, c.PENCIL_HELD);
    all.forEach((s, i) => s.part !== 'frame' && queue.push({ s, gate: i >= held ? 'printed' : 'bundle' }));
    known = true;
    pump();
  });

  return (gate: Gate) => {
    open.add(gate);
    if (gate === 'printed') open.add('bundle');
    pump();
  };
}

const projects = loadProjects();
let reach = draw(CONFIG, projects.then((p) => p.length), Math.floor(Math.random() * 2 ** 32));
const printed = new MutationObserver(() => {
  if (root.dataset.printed !== 'true') return;
  printed.disconnect();
  reach('printed');
});
printed.observe(root, { attributes: true, attributeFilter: ['data-printed'] });

const api: Pencil = { projects, reach: (gate) => reach(gate) };
if (import.meta.env.DEV)
  api.replay = (c, loadMs) => {
    reach = draw(c, projects.then((p) => p.length), Math.floor(Math.random() * 2 ** 32));
    reach('bundle');
    setTimeout(() => reach('printed'), loadMs);
  };
window.__pencil = api;
