// What each glazed tile reflects: a ray from the eye bounces off the tile (its own slight tilt
// plus gentle glaze waviness) and is traced into the room model: floor, the window wall behind
// the viewer, side walls, ceiling. Low resolution on purpose: old glaze blurs reflections.
// Wall coordinates in cm: x from the left wall, y up, z out from the tiled wall.
// Traced for every tile near the window on every scroll frame: the inner loops allocate nothing.
import type { Room, Vec3 } from '../room';
import type { RGB } from '../colour';
import { fbm, hash2 } from '../wood/noise';

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

// Colour seen along a ray from point p (on a tile face) in direction d.
export function roomColour(r: Room, look: RoomLook, p: Vec3, d: Vec3): RGB {
  const out: RGB = [0, 0, 0];
  roomColourInto(r, look, p[0], p[1], p[2], d[0], d[1], d[2], out);
  return out;
}

// The same, without allocating: writes the colour into `out`.
function roomColourInto(r: Room, look: RoomLook, px: number, py: number, pz: number, dx: number, dy: number, dz: number, out: RGB): void {
  let best = Infinity, hit = 0; // 1 back, 2 floor, 3 ceiling, 4 side
  // The nearest plane the ray reaches (inline: this runs for every sample of every tile).
  let t: number;
  if (Math.abs(dz) >= 1e-9 && (t = (r.depthCm - pz) / dz) > 1e-6 && t < best) (best = t), (hit = 1);
  if (Math.abs(dy) >= 1e-9 && (t = (0 - py) / dy) > 1e-6 && t < best) (best = t), (hit = 2);
  if (Math.abs(dy) >= 1e-9 && (t = (r.ceilingCm - py) / dy) > 1e-6 && t < best) (best = t), (hit = 3);
  if (Math.abs(dx) >= 1e-9 && (t = (0 - px) / dx) > 1e-6 && t < best) (best = t), (hit = 4);
  if (Math.abs(dx) >= 1e-9 && (t = (r.widthCm - px) / dx) > 1e-6 && t < best) (best = t), (hit = 4);
  let c: RGB;
  if (!hit) c = look.wall;
  else if (hit === 2) c = look.floor;
  else if (hit === 3) c = look.ceiling;
  else {
    const x = px + dx * best, y = py + dy * best;
    const w = hit === 1 ? inWindow(r, x, y) : null;
    if (w === 'pane') {
      const k = (y - r.window.bottom) / r.window.height, a = look.sky[1], b = look.sky[0];
      out[0] = a[0] + (b[0] - a[0]) * k;
      out[1] = a[1] + (b[1] - a[1]) * k;
      out[2] = a[2] + (b[2] - a[2]) * k;
      return;
    }
    if (w === 'sash') c = look.sash;
    else {
      // Walls dim towards the floor.
      const k = Math.max(0, 1 - y / r.ceilingCm) * 0.6, a = look.wall;
      out[0] = a[0] + (a[0] + (0 - a[0]) * 0.25 - a[0]) * k;
      out[1] = a[1] + (a[1] + (0 - a[1]) * 0.25 - a[1]) * k;
      out[2] = a[2] + (a[2] + (0 - a[2]) * 0.25 - a[2]) * k;
      return;
    }
  }
  out[0] = c[0], out[1] = c[1], out[2] = c[2];
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
// A tile's reflection of the room, nx × ny samples. Cells that straddle an edge in the room (the
// window's frame, where wall meets ceiling) are re-sampled 3×3 and averaged, so edges come out
// smooth rather than stepped; flat cells, most of them, cost nothing extra.
const EDGE = 28; // colour difference (sum over channels) that marks a cell as straddling an edge
// A tile's normals at its cell centres don't depend on the eye: kept per tile across re-traces.
const normalCache = new Map<string, Float64Array>();
const colour: RGB = [0, 0, 0]; // scratch for the sample being traced
const sampled = [0, 0, 0, 0]; // … and its RGBA result
export function reflectTile(r: Room, look: RoomLook, t: TileReflection, eye: Vec3, nx: number, ny = nx): Uint8ClampedArray {
  const out = new Uint8ClampedArray(nx * ny * 4);
  const [ax, ay] = tileTilt(t.seed, t.tiltDeg);
  const wave = t.waviness * 0.06;
  const nKey = `${t.seed}|${t.tiltDeg}|${t.waviness}|${nx}|${ny}`;
  let normals = normalCache.get(nKey);
  if (!normals) {
    // Tilt + low-frequency waviness → the surface normal at each cell centre (u, v).
    normals = new Float64Array(nx * ny * 3);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const u = (i + 0.5) / nx - 0.5, v = (j + 0.5) / ny - 0.5;
        const sx = Math.tan(ax) + wave * fbm(u * 2 + t.seed * 0.37, v * 2, t.seed, 2);
        const sy = Math.tan(ay) + wave * fbm(u * 2, v * 2 + t.seed * 0.53, t.seed + 9, 2);
        const nl = Math.hypot(sx, sy, 1), k = (j * nx + i) * 3;
        normals[k] = sx / nl, normals[k + 1] = sy / nl, normals[k + 2] = 1 / nl;
      }
    if (normalCache.size > 4000) normalCache.clear(); // bounded: a few hundred tiles at a time
    normalCache.set(nKey, normals);
  }
  const [ex, ey, ez] = eye, cx = t.centre.x, cy = t.centre.y;
  // Traces one sample at (u, v) on the tile with the normal at `n` (an index into normals), into `sampled`.
  const sample = (u: number, v: number, n: number) => {
    const N0 = normals![n], N1 = normals![n + 1], N2 = normals![n + 2];
    const px = cx + u * t.wCm, py = cy - v * t.hCm, pz = 0;
    let dx = px - ex, dy = py - ey, dz = pz - ez;
    const dl = Math.sqrt(dx * dx + dy * dy + dz * dz); // not Math.hypot: far slower, per sample
    dx = dx / dl, dy = dy / dl, dz = dz / dl;
    const dn = dx * N0 + dy * N1 + dz * N2;
    roomColourInto(r, look, px, py, pz, dx - 2 * dn * N0, dy - 2 * dn * N1, dz - 2 * dn * N2, colour);
    // Schlick's Fresnel relative to head-on: flat tiles seen near straight-on stay at ~1×,
    // glancing surfaces (the top of a bull-nose) reflect ten times as much or more.
    const cos = Math.min(1, Math.abs(dn));
    const fresnel = (GLAZE_R0 + (1 - GLAZE_R0) * (1 - cos) ** 5) / GLAZE_R0;
    sampled[0] = colour[0], sampled[1] = colour[1], sampled[2] = colour[2], sampled[3] = Math.min(255, 255 * t.strength * fresnel);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 4;
      sample((i + 0.5) / nx - 0.5, (j + 0.5) / ny - 0.5, (j * nx + i) * 3);
      out[k] = sampled[0];
      out[k + 1] = sampled[1];
      out[k + 2] = sampled[2];
      out[k + 3] = sampled[3];
    }
  }
  // Edge cells: compared with their neighbours on the first pass, then supersampled.
  const diff = (a: number, b: number) => Math.abs(out[a] - out[b]) + Math.abs(out[a + 1] - out[b + 1]) + Math.abs(out[a + 2] - out[b + 2]);
  const edges: number[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 4;
      if ((i + 1 < nx && diff(k, k + 4) > EDGE) || (i > 0 && diff(k, k - 4) > EDGE) || (j + 1 < ny && diff(k, k + nx * 4) > EDGE) || (j > 0 && diff(k, k - nx * 4) > EDGE)) edges.push(i, j);
    }
  }
  const acc = [0, 0, 0, 0];
  for (let e = 0; e < edges.length; e += 2) {
    const i = edges[e], j = edges[e + 1];
    acc[0] = acc[1] = acc[2] = acc[3] = 0;
    const n = (j * nx + i) * 3; // waviness is slow: one normal per cell
    for (let sj = 0; sj < 3; sj++)
      for (let si = 0; si < 3; si++) {
        sample((i + (si + 0.5) / 3) / nx - 0.5, (j + (sj + 0.5) / 3) / ny - 0.5, n);
        for (let q = 0; q < 4; q++) acc[q] += sampled[q] / 9;
      }
    const k = (j * nx + i) * 4;
    for (let q = 0; q < 4; q++) out[k + q] = acc[q];
  }
  return out;
}
