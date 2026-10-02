// The physical room, in centimetres. Every surface takes its light and reflections from here so
// the page reads as one place: daylight from a window on the wall behind the viewer (key), a
// ceiling light (fill), and daylight bounced up off the floor, which keeps undersides from going
// black. Wall coordinates: x from the left wall as you face the embroidery, y up from the floor,
// z out from the wall towards the viewer.
import type { Config } from './config';

export type Vec3 = [number, number, number];

export const AMBIENT = 0.6; // how dark faces turned from the light get, for surfaces without their own control

export interface Room {
  tileCm: number; // real tile edge: sets px per cm
  widthCm: number;
  depthCm: number; // embroidery wall to window wall
  ceilingCm: number;
  eyeCm: number;
  viewCm: number; // how far from the wall the viewer stands
  embroidery: { x: number; y: number }; // centre on the wall; the viewer stands in front of it
  window: { x: number; bottom: number; width: number; height: number }; // on the wall behind the viewer
  fill: number; // ceiling light strength relative to the window
  bounce: number; // light bounced off the floor, relative to the window
}

export function roomFromConfig(c: Config): Room {
  return {
    tileCm: c.ROOM_TILE_CM,
    widthCm: c.ROOM_WIDTH_CM,
    depthCm: c.ROOM_DEPTH_CM,
    ceilingCm: c.ROOM_CEILING_CM,
    eyeCm: c.ROOM_EYE_CM,
    viewCm: c.ROOM_VIEW_CM,
    embroidery: { x: c.ROOM_EMBROIDERY_X_CM, y: c.ROOM_EMBROIDERY_Y_CM },
    window: { x: c.ROOM_WINDOW_X_CM, bottom: c.ROOM_WINDOW_BOTTOM_CM, width: c.ROOM_WINDOW_WIDTH_CM, height: c.ROOM_WINDOW_HEIGHT_CM },
    fill: c.ROOM_FILL,
    bounce: c.ROOM_BOUNCE,
  };
}

export interface Light {
  dir: Vec3; // unit vector towards the light, screen coords: x right, y down, z towards the viewer
  weight: number;
  diffuse?: boolean; // a broad source (the floor): shades by facing, casts no visible shadow
}

const unitScreen = ([x, y, z]: Vec3): Vec3 => {
  const n = Math.hypot(x, y, z);
  return [x / n, -y / n, z / n]; // wall y is up, screen y is down
};

// Window (key), ceiling light (fill) and floor bounce as seen from a point on the wall. The floor is
// a broad source filling the lower half of the view from the wall; its light arrives on average
// from about 45° below.
export function lightsAt(r: Room, p: { x: number; y: number }): Light[] {
  const w = r.window;
  const win: Vec3 = [w.x - p.x, w.bottom + w.height / 2 - p.y, r.depthCm];
  const ceiling: Vec3 = [r.widthCm / 2 - p.x, r.ceilingCm - p.y, r.depthCm / 2];
  const floor: Vec3 = [0, -1, 1];
  const lights: Light[] = [
    { dir: unitScreen(win), weight: 1 },
    { dir: unitScreen(ceiling), weight: r.fill },
  ];
  if (r.bounce > 0) lights.push({ dir: unitScreen(floor), weight: r.bounce, diffuse: true });
  return lights;
}

// Unit vector from a point on the wall towards the viewer's eye (screen coords). Highlights depend
// on where you're standing, not just where the light is.
export function viewAt(r: Room, p: { x: number; y: number }): Vec3 {
  return unitScreen([r.embroidery.x - p.x, r.eyeCm - p.y, r.viewCm]);
}

// One direction standing in for both lights, for small details (stitch shadows, sheen offsets).
export function blendedLight(lights: Light[]): Vec3 {
  const v = lights.reduce<Vec3>((s, l) => [s[0] + l.dir[0] * l.weight, s[1] + l.dir[1] * l.weight, s[2] + l.dir[2] * l.weight], [0, 0, 0]);
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
}

// Fraction of the eye's distance to the wall along the line to the window's mirror image.
const mirrorT = (r: Room) => r.viewCm / (r.viewCm + r.depthCm);

export const pxPerCm = (r: Room, tilePx: number) => tilePx / r.tileCm;

// Where the window appears in a flat glossy surface on the wall: the line from the eye to the
// window's mirror image crosses the wall. Returns the window's outline in wall cm (y up).
export function reflectedWindow(r: Room, eye = { x: r.embroidery.x, y: r.eyeCm }) {
  const t = mirrorT(r), w = r.window;
  const at = (x: number, y: number) => ({ x: eye.x + (x - eye.x) * t, y: eye.y + (y - eye.y) * t });
  const lo = at(w.x - w.width / 2, w.bottom), hi = at(w.x + w.width / 2, w.bottom + w.height);
  return { x0: lo.x, x1: hi.x, y0: lo.y, y1: hi.y, scale: t };
}

// How far the reflection moves across the wall per unit of eye movement.
export function parallaxFactor(r: Room): number {
  return 1 - mirrorT(r);
}
