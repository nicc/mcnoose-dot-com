// Clouds passing the sun, like a partly cloudy day: clear spells (the light only drifts, slowly
// and shallowly), then a cloud passes: a few changes of light at the LFO rate (`rateHz`; `smooth`
// eases between levels: 0 = steps, 1 = a continuous glide), deepest in the middle, recovering more
// slowly than it came, then clear again. The gaps between clouds are random (some long, some back
// to back), so it never beats like a clock. The room dims by the window's share of its light: one
// shade layer over the scene (re-shading every surface per frame would be far too heavy), so the
// shapes of shadows and highlights hold while their brightness breathes. The reflections (the window
// in the glass, the room in the tiles) dim with the sky too, through one CSS variable (--glint).
// ROOM_CLOUD_BALANCE splits the effect: 0 the room only, 0.5 both in full, 1 the reflections only.
// Direct sun (the sun patch, --sunlit) goes first: gone once a cloud dims the window by ROOM_SUN_HIDE.
// One cloud level drives all of them, so the patch and the reflections always move together.
// The sunset (sunset.ts) rides the same loop: it dims the room and reflections, and moves the sky on.
// Every change of these layers redraws the whole screen, so the loop only updates when the light
// has moved by a just-noticeable step (ROOM_CLOUD_STEP), and the sunset moves on SUNSET_HZ times a
// second: a clear spell costs about one redraw a second, not fifteen.
import type { Config } from './config';
import { exposure, roomFromConfig } from './room';
import { setSky, sunlit } from './sunlight';
import { skyAt } from './sunset';
import { hash2 } from './wood/noise';

export interface CloudStyle {
  depth: number; // 0–1 how far the thickest cloud dims the window light
  rateHz: number; // changes of light a second while a cloud passes
  smooth: number; // 0–1
  gapS: number; // the clear spells between clouds, on average (s)
  passes: number; // the most changes of light one cloud brings
  drift: number; // 0–1 how far the light wanders in clear spells, as a share of depth
  driftS: number; // seconds between the drift's levels
}

const ease = (f: number, smooth: number) => {
  const w = Math.max(1e-6, Math.min(1, smooth)), e = Math.max(0, Math.min(1, (f - (1 - w)) / w));
  return e * e * (3 - 2 * e);
};

// Time is cut into windows each holding one passing cloud at a random place in it: long enough for
// the longest cloud plus the average clear spell.
const windowS = (s: CloudStyle) => s.gapS + (Math.max(1, s.passes) + 2) / s.rateHz;

// The cloud in window w: when it starts (s), how many changes of light it brings, when it has gone.
export function cloudPass(w: number, s: CloudStyle, seed = 7): { start: number; n: number; end: number } {
  const n = Math.min(Math.max(1, s.passes), 1 + Math.floor(hash2(w, 1, seed) * Math.max(1, s.passes)));
  const length = (n + 2) / s.rateHz, span = windowS(s); // n levels, then a recovery twice as long
  const start = w * span + hash2(w, 2, seed) * Math.max(0, span - length);
  return { start, n, end: start + length };
}

// How far a passing cloud has dimmed the window at t, 0–1 (× depth): 0 outside clouds.
function dip(t: number, s: CloudStyle, seed: number): number {
  const w = Math.floor(t / windowS(s)), p = cloudPass(w, s, seed);
  if (t <= p.start || t >= p.end) return 0;
  const u = (t - p.start) * s.rateHz;
  const level = (i: number) => (i <= 0 || i > p.n ? 0 : 0.25 + 0.75 * hash2(w, 10 + i, seed));
  if (u >= p.n) return level(p.n) * (1 - ease((u - p.n) / 2, s.smooth)); // clearing, slower
  const i = Math.floor(u);
  return level(i) + (level(i + 1) - level(i)) * ease(u - i, s.smooth);
}

// The clear sky's slow wander, 0–1: a new level every driftS seconds, glided to.
function wander(t: number, s: CloudStyle, seed: number): number {
  if (s.drift <= 0 || s.driftS <= 0) return 0;
  const x = t / s.driftS, i = Math.floor(x), a = hash2(i, 0, seed + 101), b = hash2(i + 1, 0, seed + 101);
  return a + (b - a) * ease(x - i, 1);
}

// 1 = full sun … 1 − depth = thickest cloud, at time t (s).
export function cloudLevel(t: number, s: CloudStyle, seed = 7): number {
  if (s.depth <= 0 || s.rateHz <= 0) return 1;
  const loss = 1 - (1 - s.drift * wander(t, s, seed)) * (1 - dip(t, s, seed));
  return 1 - s.depth * loss;
}

const FAST_S = 1 / 15; // the quickest the light is updated: clouds glide over seconds

// Seconds until the light at `level` has changed by more than `step` (looking ahead in doublings
// from FAST_S), at most maxS. Clouds change over seconds, so nothing shorter slips between looks.
export function nextUpdate(t: number, level: (t: number) => number, step: number, maxS: number): number {
  const k = level(t);
  let d = FAST_S;
  for (let next = Math.min(maxS, 2 * FAST_S); ; next = Math.min(maxS, 2 * next)) {
    if (next <= d || Math.abs(level(t + next) - k) > step) return d;
    d = next;
  }
}

export const cloudStyle = (c: Config): CloudStyle => ({
  depth: c.ROOM_CLOUD_DEPTH,
  rateHz: c.ROOM_CLOUD_RATE_HZ,
  smooth: c.ROOM_CLOUD_SMOOTH,
  gapS: c.ROOM_CLOUD_GAP_S,
  passes: c.ROOM_CLOUD_PASSES,
  drift: c.ROOM_CLOUD_DRIFT,
  driftS: c.ROOM_CLOUD_DRIFT_S,
});

// How a cloud level k (1 = full sun) reaches the room's light and the reflections, by balance b.
export function cloudSplit(k: number, b: number): { room: number; reflections: number } {
  const loss = 1 - k;
  return { room: 1 - loss * Math.min(1, 2 * (1 - b)), reflections: 1 - loss * Math.min(1, 2 * b) };
}

// The reflections' strength as last set: a re-render replaces .wall, which takes it at once (main.ts)
// rather than waiting up to a second for the next update.
let glintNow = -1;
const setGlint = (sel: string, v: number) => document.querySelectorAll<HTMLElement>(sel).forEach((e) => e.style.setProperty('--glint', String(v)));
export function reapplyClouds(): void {
  if (glintNow >= 0) setGlint('.wall', glintNow);
}

// Runs for the page's life; reads config live so the panel's sliders apply at the next update. For
// people who ask for reduced motion the clouds hold still (their coming and going is close to
// flicker), but the sunset still runs: a slow change of colour and light over minutes, not movement.
// skyInGlass: repaints the glass's reflected panes when the sky in them changes colour (the sunset).
export function startClouds(config: () => Config, skyInGlass: (sky: { top: number[]; low: number[] }) => void): void {
  const shade = document.createElement('div');
  shade.className = 'cloud-shade';
  shade.setAttribute('aria-hidden', 'true');
  document.body.append(shade);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let last = -1, lastSky = '', lastPanes = '';
  const tick = () => {
    const t = performance.now() / 1000, c = config(), s = cloudStyle(c);
    const level = (x: number) => (still.matches ? 1 - s.depth / 2 : cloudLevel(x, s));
    const k = level(t), hz = Math.max(0.05, c.SUNSET_HZ);
    const { room, reflections } = cloudSplit(k, c.ROOM_CLOUD_BALANCE);
    const sky = skyAt(c, Math.floor(t * hz) / hz), dusk = 1 - sky.dim; // the sunset (sunset.ts), in steps
    const dark = Math.round((1 - exposure(roomFromConfig(c), room) * dusk) * 1000) / 1000;
    if (dark !== last) shade.style.opacity = String((last = dark));
    const glint = Math.round(reflections * (1 - sky.fade) * 1000) / 1000; // the sky in them dims
    if (glint !== glintNow) setGlint('.wall, .glass', (glintNow = glint));
    const sun = Math.round(sunlit(k, c.ROOM_SUN_HIDE) * 1000) / 1000; // direct sun: the sun patch
    const skyKey = `${sun}|${sky.kelvin.toFixed(0)}|${sky.elevation.toFixed(2)}|${sky.azimuth.toFixed(2)}|${sky.patch.toFixed(3)}|${sky.softness.toFixed(2)}|${sky.tint}`;
    if (skyKey !== lastSky) setSky(c, sky, (lastSky = skyKey, sun));
    const panes = `${sky.skyTop}|${sky.skyLow}`;
    if (panes !== lastPanes) skyInGlass({ top: sky.skyTop, low: sky.skyLow }), (lastPanes = panes);
    // No frames are asked for in between: an idle page draws nothing.
    setTimeout(() => requestAnimationFrame(tick), 1000 * nextUpdate(t, level, c.ROOM_CLOUD_STEP, 1 / hz));
  };
  requestAnimationFrame(tick);
}
