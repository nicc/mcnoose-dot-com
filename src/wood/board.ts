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
  shadowSoftness?: number; // set: the profile shades itself — cast shadows (penumbra widening per px of distance) and occlusion of the room's diffuse light in hollows
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
// Self-shadowing across the profile (it is constant along the board, so only v matters): for each
// row, how much of the light reaches it past the profile between it and the light. Soft-edged, the
// penumbra widening with distance like a window's.
function profileShadow(height: (v: number) => number, wid: number, dir: [number, number, number], softness: number): Float32Array {
  const vis = new Float32Array(wid).fill(1);
  if (Math.abs(dir[1]) < 1e-3 || dir[2] <= 0) return vis;
  const step = dir[1] < 0 ? -1 : 1, rise = dir[2] / Math.abs(dir[1]); // ray height gained per row towards the light
  for (let v = 0; v < wid; v++) {
    let clear = Infinity;
    for (let k = 1, w = v + step; w >= 0 && w < wid; k++, w += step) clear = Math.min(clear, (height(v) + k * rise - height(w)) / (k * softness));
    vis[v] = clear === Infinity ? 1 : Math.max(0, Math.min(1, 0.5 + 0.5 * clear));
  }
  return vis;
}

// How much of the room's diffuse light reaches a surface: the open part of its hemisphere (2D view
// factor, since the profile is constant along the board), plus some light reflected back by what
// blocks the rest — tiles and paint, not black. 1 for an unobstructed surface facing the room.
const INTERREFLECT = 0.4;
export function diffuseReach(open: number): number {
  return open + INTERREFLECT * (1 - open);
}

// Per row: the sector of directions (in the v–z plane, angle from +z, positive upwards) not blocked
// by the profile above or below, intersected with the hemisphere around the row's own normal.
// Nothing rises behind the wall plane, so the sector never passes straight up or down the wall.
function profileOcclusion(height: (v: number) => number, wid: number): Float32Array {
  const half = Math.PI / 2;
  return Float32Array.from({ length: wid }, (_, v) => {
    const horizon = (step: number) => {
      let angle = half;
      for (let k = 1, w = v + step; w >= 0 && w < wid; k++, w += step) angle = Math.min(angle, Math.atan2(k, height(w) - height(v)));
      return angle;
    };
    const up = horizon(-1), down = -horizon(1);
    const phi = Math.atan((height(Math.min(wid - 1, v + 1)) - height(Math.max(0, v - 1))) / 2); // normal's tilt: up when height grows downwards
    const lo = Math.max(down, phi - half), hi = Math.min(up, phi + half);
    return diffuseReach(hi > lo ? (Math.sin(hi - phi) - Math.sin(lo - phi)) / 2 : 0);
  });
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const unit = (x: number, y: number, z: number): [number, number, number] => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

// lights/view apply at the board's start (u = 0); `end`, if given, at its far end, blended across so
// lengths lit at their own ends join without a step.
export function shadeBoard(maps: GrainMaps, len: number, wid: number, f: Finish, lights: BoardLight[], view: [number, number, number] = [0, 0, 1], end?: { lights: BoardLight[]; view: [number, number, number] }): Uint8ClampedArray {
  const exponent = 6 + 120 * f.gloss * f.gloss;
  const rows = Float64Array.from({ length: wid }, (_, v) => f.profile((v + 0.5) / wid) * f.profileDepth); // the profile, once per row
  const profileHeight = (v: number) => rows[v];
  const shadows = (ls: BoardLight[]) => ls.map((l) => (f.shadowSoftness ? profileShadow(profileHeight, wid, l.dir, f.shadowSoftness) : null));
  const startShadow = shadows(lights), endShadow = end ? shadows(end.lights) : startShadow;
  const occlusion = f.shadowSoftness ? profileOcclusion(profileHeight, wid) : null;
  const shaded = f.shadowSoftness ? startShadow.every(Boolean) && endShadow.every(Boolean) : false;
  const sheen = f.sheen > 0; // no finish highlight at all: the specular term is skipped (it's multiplied to nothing anyway)
  const { relief, albedo, gloss } = maps, gd = f.grainDepth, ambient = f.ambient, nLights = lights.length;
  const [t0, t1, t2] = SHEEN_TINT;
  // This column's lights and half-vectors, flat for the inner loop: dir xyz, weight, half xyz.
  const L = new Float64Array(nLights * 7);
  const out = new Uint8ClampedArray(len * wid * 4);
  for (let u = 0; u < len; u++) {
    // Lighting at this column, blended from start to end.
    const t = end && len > 1 ? u / (len - 1) : 0;
    const vw = end ? unit(lerp(view[0], end.view[0], t), lerp(view[1], end.view[1], t), lerp(view[2], end.view[2], t)) : view;
    let flat = 0;
    for (let k = 0; k < nLights; k++) {
      const l = lights[k], e = end?.lights[k] ?? l;
      const dir = unit(lerp(l.dir[0], e.dir[0], t), lerp(l.dir[1], e.dir[1], t), lerp(l.dir[2], e.dir[2], t)), weight = lerp(l.weight, e.weight, t);
      const h = unit(dir[0] + vw[0], dir[1] + vw[1], dir[2] + vw[2]);
      flat += weight * dir[2];
      L[k * 7] = dir[0], L[k * 7 + 1] = dir[1], L[k * 7 + 2] = dir[2], L[k * 7 + 3] = weight, L[k * 7 + 4] = h[0], L[k * 7 + 5] = h[1], L[k * 7 + 6] = h[2];
    }
    const uL = u > 0 ? u - 1 : 0, uR = u < len - 1 ? u + 1 : len - 1;
    for (let v = 0; v < wid; v++) {
      const i = v * len + u, vU = v > 0 ? v - 1 : 0, vD = v < wid - 1 ? v + 1 : wid - 1;
      // Height = profile row + grain relief; central differences for the slope (clamped at the edges).
      const rv = rows[v];
      const du = (rv + relief[v * len + uR] * gd - (rv + relief[v * len + uL] * gd)) * 0.5;
      const dv = (rows[vD] + relief[vD * len + u] * gd - (rows[vU] + relief[vU * len + u] * gd)) * 0.5;
      const nl = Math.sqrt(du * du + dv * dv + 1), sl = Math.sqrt((du * ALONG_GRAIN) ** 2 + dv * dv + 1); // not Math.hypot: far slower, per pixel
      let lambert = 0, spec = 0;
      for (let k = 0; k < nLights; k++) {
        const o = k * 7, weight = L[o + 3];
        const lit = shaded ? lerp(startShadow[k]![v], endShadow[k]![v], t) : 1;
        lambert += lit * weight * Math.max(0, (-du * L[o] - dv * L[o + 1] + L[o + 2]) / nl);
        if (sheen) spec += lit * weight * Math.max(0, (-du * ALONG_GRAIN * L[o + 4] - dv * L[o + 5] + L[o + 6]) / sl) ** exponent;
      }
      const light = ambient * (occlusion ? occlusion[v] : 1) + (1 - ambient) * (lambert / flat);
      spec *= f.sheen * gloss[i];
      const k = i * 4, a = i * 3;
      out[k] = albedo[a] * light + 255 * spec * t0;
      out[k + 1] = albedo[a + 1] * light + 255 * spec * t1;
      out[k + 2] = albedo[a + 2] * light + 255 * spec * t2;
      out[k + 3] = 255;
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
