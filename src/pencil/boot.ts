// The page's first paint: the wall drawn in pencil on drafting paper while the rest of it loads.
// Its own small script, inlined into index.html (tools/pencil-inline.ts), so it runs as soon as the
// HTML arrives, while the main bundle is still downloading. The frame is drawn at once; the rail once
// the main script runs; the tile joints and skirting as the scene's work settles (prints, paper, trim,
// sampler), each at a hand's pace, so the drawing advances when loading does and slows when it does.
// When loading moves on, what earlier stages released hurries to finish within PENCIL_CATCH_UP_MS,
// so the drawing never trails loading by more than a stage. Once the scene is ready and the drawing
// has caught up, the scene crossfades in.
//
// Strokes are revealed by transform animations, which the compositor keeps running while the main
// thread is busy building the scene.
import { CONFIG, type Config } from '../config';
import { initialAnchor } from '../layout';
import { wallPlan } from '../plan';
import { loadProjects } from '../projects';
import { rng } from '../wood/noise';
import { releaseAt, sketch, type Stroke } from './strokes';
import type { Pencil } from './index';

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

  // level: how far loading has got (-1 the page, 0 the main script running, then the share of the
  // scene's work settled, 1 all of it). Each stroke waits for its own (strokes.ts releaseAt).
  const running: Animation[] = [], rates = new WeakMap<Animation, number>(), queue: { s: Stroke; at: number }[] = [];
  let level = -1, pen = performance.now(), known = false, finishing = false; // pen: when it's next free
  const pump = () => {
    while (queue.length && queue[0].at <= level) {
      const { s } = queue.shift()!, now = performance.now(), start = Math.max(pen, now) + s.gap;
      running.push(place(layer, c, s, start - now));
      pen = start + s.ms;
    }
  };
  // Hurry what's been released so it's all drawn within PENCIL_CATCH_UP_MS from now.
  const catchUp = () => {
    const now = performance.now(), behind = pen - now, budget = Math.max(1, c.PENCIL_CATCH_UP_MS);
    if (behind <= budget) return;
    for (const a of running) {
      if (a.playState === 'finished') continue;
      const rate = (rates.get(a) ?? 1) * (behind / budget);
      rates.set(a, rate); // updatePlaybackRate applies later: playbackRate still reads the old rate till then
      a.updatePlaybackRate(rate);
    }
    pen = now + budget;
  };
  // Loading has moved on (or the projects arrived): hurry what the stages loading has finished
  // released, then draw what this one releases at a hand's pace (so the rail spans the scene's
  // build rather than racing ahead of it). Once everything's in, all of it catches up and the
  // scene takes over.
  const advance = () => {
    if (level >= 0) catchUp(); // before the main script runs, the frame just goes at a hand's pace
    pump();
    if (level >= 1) catchUp();
    if (known && !queue.length && level >= 1 && !finishing) finish();
  };
  const finish = () => {
    finishing = true;
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
  queue.push(...strokes(0).filter((s) => s.part === 'frame').map((s) => ({ s, at: -1 })));
  pump();
  projects.then((n) => {
    const all = strokes(n), at = releaseAt(all);
    all.forEach((s, i) => s.part !== 'frame' && queue.push({ s, at: at[i] }));
    known = true;
    advance();
  });

  return (reached: number) => {
    if (reached <= level) return; // a re-render starts its count again: what's drawn stays drawn
    level = reached;
    advance();
  };
}

const projects = loadProjects();
let reach = draw(CONFIG, projects.then((p) => p.length), Math.floor(Math.random() * 2 ** 32));
const printed = new MutationObserver(() => {
  if (root.dataset.printed !== 'true') return;
  printed.disconnect();
  reach(1);
});
printed.observe(root, { attributes: true, attributeFilter: ['data-printed'] });

const api: Pencil = { projects, started: () => reach(0), progress: (share) => reach(Math.max(0, Math.min(1, share))) };
if (import.meta.env.DEV)
  // As if the main script ran at once and the scene's work settled in a few uneven steps over loadMs.
  api.replay = (c, loadMs) => {
    reach = draw(c, projects.then((p) => p.length), Math.floor(Math.random() * 2 ** 32));
    reach(0);
    const steps = Array.from({ length: 6 }, () => Math.random() * loadMs).sort((a, b) => a - b);
    steps.forEach((t, i) => setTimeout(() => reach((i + 1) / steps.length), i === steps.length - 1 ? loadMs : t));
  };
window.__pencil = api;
