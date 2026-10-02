// Lights a board: moulding profile across its width plus fine grain relief, with diffuse light
// and a finish highlight whose strength follows the grain's gloss map. The highlight's normal
// has its along-grain tilt damped, so sheen streaks lengthwise like real varnished wood.
import type { GrainMaps } from './grain';

export interface Finish {
  profile: (t: number) => number; // height 0–1 across the width; t: 0 outer edge → 1 inner edge
  profileDepth: number; // px of height at profile = 1
  grainDepth: number; // px of height for grain relief
  sheen: number; // 0–1 finish highlight strength
  gloss: number; // 0–1 highlight tightness (0 broad and soft, 1 tight)
  ambient: number; // 0–1 how dark faces turned from the light get
}

// A light in board coordinates: u along the grain, v across (inwards), z out towards the viewer.
export interface BoardLight {
  dir: [number, number, number];
  weight: number;
}

const SHEEN_TINT = [1, 0.95, 0.86]; // warm highlight from an amber finish
const ALONG_GRAIN = 0.25; // how much along-grain tilt the highlight sees

// view: unit vector towards the viewer's eye in board coordinates. Highlights land where the
// geometry mirrors a light towards the eye, so a flat face below eye level stays matte while
// upward-curving edges catch the window.
export function shadeBoard(maps: GrainMaps, len: number, wid: number, f: Finish, lights: BoardLight[], view: [number, number, number] = [0, 0, 1]): Uint8ClampedArray {
  const flat = lights.reduce((s, l) => s + l.weight * l.dir[2], 0);
  const halves = lights.map(({ dir: [lx, ly, lz], weight }) => {
    const h = [lx + view[0], ly + view[1], lz + view[2]], hl = Math.hypot(h[0], h[1], h[2]);
    return { h: [h[0] / hl, h[1] / hl, h[2] / hl], weight };
  });
  const exponent = 6 + 120 * f.gloss * f.gloss;
  const height = (u: number, v: number) => {
    const uu = Math.min(len - 1, Math.max(0, u)), vv = Math.min(wid - 1, Math.max(0, v));
    return f.profile((vv + 0.5) / wid) * f.profileDepth + maps.relief[vv * len + uu] * f.grainDepth;
  };
  const out = new Uint8ClampedArray(len * wid * 4);
  for (let v = 0; v < wid; v++) {
    for (let u = 0; u < len; u++) {
      const i = v * len + u;
      const du = (height(u + 1, v) - height(u - 1, v)) * 0.5;
      const dv = (height(u, v + 1) - height(u, v - 1)) * 0.5;
      const nl = Math.hypot(du, dv, 1);
      let lambert = 0;
      for (const { dir, weight } of lights) lambert += weight * Math.max(0, (-du * dir[0] - dv * dir[1] + dir[2]) / nl);
      const light = f.ambient + (1 - f.ambient) * (lambert / flat);
      const sl = Math.hypot(du * ALONG_GRAIN, dv, 1);
      let spec = 0;
      for (const { h, weight } of halves) spec += weight * Math.max(0, (-du * ALONG_GRAIN * h[0] - dv * h[1] + h[2]) / sl) ** exponent;
      spec *= f.sheen * maps.gloss[i];
      for (let c = 0; c < 3; c++) out[i * 4 + c] = maps.albedo[i * 3 + c] * light + 255 * spec * SHEEN_TINT[c];
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

// Picture-frame moulding: rounded outer edge, flat face, cove, small bead, then the rebate drop.
export function frameProfile(t: number): number {
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (t < 0.2) return 0.9 * Math.sin((t / 0.2) * (Math.PI / 2));
  if (t < 0.62) return 0.9 + 0.1 * ease((t - 0.2) / 0.42);
  if (t < 0.78) return 1 - 0.55 * ease((t - 0.62) / 0.16);
  if (t < 0.9) return 0.45 + 0.15 * Math.sin(((t - 0.78) / 0.12) * Math.PI);
  return 0.45 - 0.3 * ease((t - 0.9) / 0.1);
}
