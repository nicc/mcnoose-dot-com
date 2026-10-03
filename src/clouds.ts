// Clouds passing the sun: the window light's strength wanders at random within a range, like an
// LFO with a random waveform. A new level is drawn `rateHz` times a second; `smooth` eases between
// levels (0 = steps, 1 = a continuous glide). The room dims by the window's share of its light: one
// shade layer over the scene (re-shading every surface per frame would be far too heavy), so the
// shapes of shadows and highlights hold while their brightness breathes. The reflections (the window
// in the glass, the room in the tiles) dim with the sky too, through one CSS variable (--glint).
// ROOM_CLOUD_BALANCE splits the effect: 0 the room only, 0.5 both in full, 1 the reflections only.
// Direct sun (the sun patch, --sunlit) goes first: it's gone by the deepest cloud.
import type { Config } from './config';
import { exposure, roomFromConfig } from './room';
import { sunlit } from './sunlight';
import { hash2 } from './wood/noise';

export interface CloudStyle {
  depth: number; // 0–1 how far the thickest cloud dims the window light
  rateHz: number;
  smooth: number; // 0–1
}

// 1 = full sun … 1 − depth = thickest cloud, at time t (s).
export function cloudLevel(t: number, s: CloudStyle, seed = 7): number {
  if (s.depth <= 0 || s.rateHz <= 0) return 1;
  const x = t * s.rateHz, i = Math.floor(x), f = x - i;
  const level = (n: number) => 1 - s.depth * hash2(n, 0, seed);
  const w = Math.max(1e-6, Math.min(1, s.smooth)), e = Math.max(0, Math.min(1, (f - (1 - w)) / w));
  return level(i) + (level(i + 1) - level(i)) * e * e * (3 - 2 * e);
}

export const cloudStyle = (c: Config): CloudStyle => ({ depth: c.ROOM_CLOUD_DEPTH, rateHz: c.ROOM_CLOUD_RATE_HZ, smooth: c.ROOM_CLOUD_SMOOTH });

// How a cloud level k (1 = full sun) reaches the room's light and the reflections, by balance b.
export function cloudSplit(k: number, b: number): { room: number; reflections: number } {
  const loss = 1 - k;
  return { room: 1 - loss * Math.min(1, 2 * (1 - b)), reflections: 1 - loss * Math.min(1, 2 * b) };
}

// Runs for the page's life; reads config live so the panel's sliders apply at once. Holds still
// for people who ask for reduced motion.
export function startClouds(config: () => Config): void {
  const shade = document.createElement('div');
  shade.className = 'cloud-shade';
  shade.setAttribute('aria-hidden', 'true');
  document.body.append(shade);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let last = -1, lastGlint = -1, lastSun = -1;
  const tick = (now: number) => {
    const c = config(), s = cloudStyle(c);
    const k = still.matches ? 1 - s.depth / 2 : cloudLevel(now / 1000, s);
    const { room, reflections } = cloudSplit(k, c.ROOM_CLOUD_BALANCE);
    const dark = Math.round((1 - exposure(roomFromConfig(c), room)) * 1000) / 1000;
    if (dark !== last) shade.style.opacity = String((last = dark));
    const glint = Math.round(reflections * 1000) / 1000;
    if (glint !== lastGlint) document.documentElement.style.setProperty('--glint', String((lastGlint = glint)));
    const sun = Math.round(sunlit(k, s.depth) * 1000) / 1000; // direct sun: the sun patch
    if (sun !== lastSun) document.documentElement.style.setProperty('--sunlit', String((lastSun = sun)));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
