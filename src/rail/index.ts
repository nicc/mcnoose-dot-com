// The painted dado rail, built from lengths about one tile wide. Each length is lit by the room's
// lights at its own position on the wall (dynamic lighting: the rail responds to the room like
// every other surface). Grain, brush strokes and wear are generated in wall coordinates, so
// lengths join seamlessly; each is cached by its place on the wall.
import type { Light, Vec3 } from '../room';
import { AMBIENT } from '../room';
import { shadeBoard } from '../wood/board';
import { grainMaps, type RGB } from '../wood/grain';
import { PAINT_BARE, paintMaps, softenProfile } from '../wood/paint';
import { weather } from '../wood/wear';
import { railProfile, type RailDims } from './profile';

export interface RailStyle {
  dims: RailDims;
  colour: RGB;
  paint: { grain: number; brush: number; buildup: number; yellowing: number; sheen: number; gloss: number };
  wear: number;
  grime: number;
}

// Pine under the paint: only its ring relief matters once painted.
const PINE = { early: [215, 185, 140] as RGB, late: [165, 120, 75] as RGB, figure: 0.5, pores: 0, drift: 0, seed: 23 };
const RING_CM = 0.35;
const RELIEF_CM = 0.06; // paint ridges and telegraphed grain: half a millimetre

const cache = new Map<number, { key: string; canvas: HTMLCanvasElement }>();

// index: which length along the wall; lenPx/heightPx in CSS px; pxPerCm: scene scale.
export function railLength(index: number, lenPx: number, heightPx: number, pxPerCm: number, dpr: number, lights: Light[], view: Vec3, s: RailStyle): HTMLCanvasElement {
  const key = JSON.stringify([lenPx, heightPx, pxPerCm, dpr, lights, view, s]);
  const hit = cache.get(index);
  if (hit && hit.key === key) return hit.canvas;

  const len = Math.max(1, Math.round(lenPx * dpr)), wid = Math.max(2, Math.round(heightPx * dpr));
  const scale = pxPerCm * dpr, u0 = index * len;
  const profile = softenProfile(railProfile(s.dims).at, s.paint.buildup);
  const wood = grainMaps(len, wid, { ...PINE, ringPx: RING_CM * scale }, 0, u0);
  const paint = paintMaps(wood, len, wid, profile, { colour: s.colour, grain: s.paint.grain, brush: s.paint.brush, yellowing: s.paint.yellowing, seed: 31 }, u0);
  weather(paint, len, wid, profile, { wear: s.wear, grime: s.grime, patches: 0.7, mitres: false, seed: 61, bare: PAINT_BARE }, 0, u0);
  // Rail coordinates: u along the wall (screen x), v down the rail (screen y), z out of the wall.
  const rgba = shadeBoard(paint, len, wid, {
    profile,
    profileDepth: s.dims.depthCm * scale,
    grainDepth: RELIEF_CM * scale,
    sheen: s.paint.sheen,
    gloss: s.paint.gloss,
    ambient: AMBIENT,
  }, lights.map(({ dir, weight }) => ({ dir, weight })), view);

  const canvas = hit?.canvas ?? document.createElement('canvas');
  canvas.className = 'rail-length';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = len;
  canvas.height = wid;
  canvas.getContext('2d')!.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, len, wid), 0, 0);
  cache.set(index, { key, canvas });
  return canvas;
}
