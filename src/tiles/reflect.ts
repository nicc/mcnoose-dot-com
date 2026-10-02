// What each glazed tile reflects: a ray from the eye bounces off the tile (its own slight tilt
// plus gentle glaze waviness) and is traced into the room model: floor, the window wall behind
// the viewer, side walls, ceiling. Low resolution on purpose: old glaze blurs reflections.
// Wall coordinates in cm: x from the left wall, y up, z out from the tiled wall.
import type { Room, Vec3 } from '../room';
import { fbm, hash2 } from '../wood/noise';

export type RGB = [number, number, number];

export interface RoomLook {
  wall: RGB; // walls facing the tiles and to the sides
  ceiling: RGB;
  floor: RGB;
  sky: [RGB, RGB]; // window panes, top → bottom
  sash: RGB; // painted window frame and bars
}

const SASH_CM = 5;
const GLAZE_R0 = 0.04; // reflectance of glaze head-on (glass-like)

function inWindow(r: Room, x: number, y: number): 'pane' | 'sash' | null {
  const w = r.window;
  const lx = x - (w.x - w.width / 2), ly = y - w.bottom;
  if (lx < 0 || ly < 0 || lx > w.width || ly > w.height) return null;
  const mx = Math.abs(lx - w.width / 2), my = Math.abs(ly - w.height / 2);
  const edge = Math.min(lx, ly, w.width - lx, w.height - ly);
  return edge < SASH_CM || mx < SASH_CM / 2 || my < SASH_CM / 2 ? 'sash' : 'pane';
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Colour seen along a ray from point p (on a tile face) in direction d.
export function roomColour(r: Room, look: RoomLook, p: Vec3, d: Vec3): RGB {
  let best = Infinity, hit: 'back' | 'floor' | 'ceiling' | 'side' | null = null;
  const plane = (axis: number, at: number, name: typeof hit) => {
    if (Math.abs(d[axis]) < 1e-9) return;
    const t = (at - p[axis]) / d[axis];
    if (t > 1e-6 && t < best) [best, hit] = [t, name];
  };
  plane(2, r.depthCm, 'back');
  plane(1, 0, 'floor');
  plane(1, r.ceilingCm, 'ceiling');
  plane(0, 0, 'side');
  plane(0, r.widthCm, 'side');
  if (!hit) return look.wall;
  if (hit === 'floor') return look.floor;
  if (hit === 'ceiling') return look.ceiling;
  const x = p[0] + d[0] * best, y = p[1] + d[1] * best;
  if (hit === 'back') {
    const w = inWindow(r, x, y);
    if (w === 'pane') return mix(look.sky[1], look.sky[0], (y - r.window.bottom) / r.window.height);
    if (w === 'sash') return look.sash;
  }
  return mix(look.wall, mix(look.wall, [0, 0, 0], 0.25), Math.max(0, 1 - y / r.ceilingCm) * 0.6); // walls dim towards the floor
}

export interface TileReflection {
  centre: { x: number; y: number }; // cm on the tiled wall
  wCm: number;
  hCm: number;
  tiltDeg: number; // max per-tile tilt
  waviness: number; // 0–1 glaze undulation
  strength: number; // 0–1
  seed: number;
}

// Per-tile tilt, seeded by wall position: tiles are never perfectly coplanar.
export function tileTilt(seed: number, maxDeg: number): [number, number] {
  const r = (maxDeg * Math.PI) / 180;
  return [(hash2(seed, 1, 301) - 0.5) * 2 * r, (hash2(seed, 2, 301) - 0.5) * 2 * r];
}

// nx×ny RGBA: reflected room colour, alpha = strength boosted at glancing angles (Fresnel).
export function reflectTile(r: Room, look: RoomLook, t: TileReflection, eye: Vec3, nx: number, ny = nx): Uint8ClampedArray {
  const out = new Uint8ClampedArray(nx * ny * 4);
  const [ax, ay] = tileTilt(t.seed, t.tiltDeg);
  const wave = t.waviness * 0.06;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const u = (i + 0.5) / nx - 0.5, v = (j + 0.5) / ny - 0.5;
      const p: Vec3 = [t.centre.x + u * t.wCm, t.centre.y - v * t.hCm, 0];
      // Tilt + low-frequency waviness → this sample's surface normal.
      const sx = Math.tan(ax) + wave * fbm(u * 2 + t.seed * 0.37, v * 2, t.seed, 2);
      const sy = Math.tan(ay) + wave * fbm(u * 2, v * 2 + t.seed * 0.53, t.seed + 9, 2);
      const nl = Math.hypot(sx, sy, 1);
      const N: Vec3 = [sx / nl, sy / nl, 1 / nl];
      let dx = p[0] - eye[0], dy = p[1] - eye[1], dz = p[2] - eye[2];
      const dl = Math.hypot(dx, dy, dz);
      [dx, dy, dz] = [dx / dl, dy / dl, dz / dl];
      const dn = dx * N[0] + dy * N[1] + dz * N[2];
      const R: Vec3 = [dx - 2 * dn * N[0], dy - 2 * dn * N[1], dz - 2 * dn * N[2]];
      const c = roomColour(r, look, p, R);
      // Schlick's Fresnel relative to head-on: flat tiles seen near straight-on stay at ~1×,
      // glancing surfaces (the top of a bull-nose) reflect ten times as much or more.
      const cos = Math.min(1, Math.abs(dn));
      const fresnel = (GLAZE_R0 + (1 - GLAZE_R0) * (1 - cos) ** 5) / GLAZE_R0;
      const k = (j * nx + i) * 4;
      out[k] = c[0];
      out[k + 1] = c[1];
      out[k + 2] = c[2];
      out[k + 3] = Math.min(255, 255 * t.strength * fresnel);
    }
  }
  return out;
}
