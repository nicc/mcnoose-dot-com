// Painted trim (dado rail, skirting), built from lengths about one tile wide. Each length is lit by
// the room's lights at its own position on the wall (dynamic lighting, like every other surface):
// at both its ends, blended across, so neighbouring lengths meet without a step.
// Grain, brush strokes, wear and scuffs are generated in wall coordinates, so lengths join
// seamlessly; each is cached by its trim and its place on the wall.
import type { Light, Vec3 } from '../room';
import { AMBIENT } from '../room';
import { shadeBoard } from '../wood/board';
import { grainMaps, type RGB } from '../wood/grain';
import { PAINT_BARE, paintMaps, softenProfile } from '../wood/paint';
import { weather } from '../wood/wear';
import type { Profile } from './profile';
import { scuff } from './scuffs';

export interface TrimStyle {
  profile: Profile;
  colour: RGB;
  paint: { grain: number; brush: number; buildup: number; yellowing: number; sheen: number; gloss: number };
  wear: number;
  grime: number;
  scuffs: number; // 0–1 knocks and smudges low on the face (skirting)
}

// Pine under the paint: only its ring relief matters once painted.
const PINE = { early: [215, 185, 140] as RGB, late: [165, 120, 75] as RGB, figure: 0.5, pores: 0, drift: 0, seed: 23 };
const RING_CM = 0.35;
const RELIEF_CM = 0.06; // paint ridges and telegraphed grain: half a millimetre
const SHADOW_SOFTNESS = 0.2; // penumbra widening per unit distance: a window-sized light, not a point

// The room's light at one end of a length.
export interface TrimLight {
  lights: Light[];
  view: Vec3;
}

const board = (lights: Light[]) => lights.map(({ dir, weight }) => ({ dir, weight }));

const cache = new Map<string, { key: string; canvas: HTMLCanvasElement }>();

// trim: which piece ('rail', 'skirting'); index: which length along the wall; lenPx/heightPx in
// CSS px; pxPerCm: scene scale; start/end: the room's light at its left and right ends.
export function trimLength(trim: string, index: number, lenPx: number, heightPx: number, pxPerCm: number, dpr: number, start: TrimLight, end: TrimLight, s: TrimStyle): HTMLCanvasElement {
  const key = JSON.stringify([lenPx, heightPx, pxPerCm, dpr, start, end, s, s.profile.heightCm, s.profile.depthCm]);
  const id = `${trim}:${index}`;
  const hit = cache.get(id);
  if (hit && hit.key === key) return hit.canvas;

  const len = Math.max(1, Math.round(lenPx * dpr)), wid = Math.max(2, Math.round(heightPx * dpr));
  const scale = pxPerCm * dpr, u0 = index * len;
  const profile = softenProfile(s.profile.at, s.paint.buildup, s.profile.heightCm);
  const wood = grainMaps(len, wid, { ...PINE, ringPx: RING_CM * scale }, 0, u0);
  const paint = paintMaps(wood, len, wid, profile, { colour: s.colour, grain: s.paint.grain, brush: s.paint.brush, yellowing: s.paint.yellowing, seed: 31 }, u0);
  weather(paint, len, wid, profile, { wear: s.wear, grime: s.grime, patches: 0.7, mitres: false, seed: 61, bare: PAINT_BARE }, 0, u0);
  scuff(paint, len, wid, s.scuffs, u0, scale, trim === 'skirting' ? 71 : 73);
  // Trim coordinates: u along the wall (screen x), v down the rail (screen y), z out of the wall.
  const rgba = shadeBoard(paint, len, wid, {
    profile,
    profileDepth: s.profile.depthCm * scale,
    grainDepth: RELIEF_CM * scale,
    sheen: s.paint.sheen,
    gloss: s.paint.gloss,
    ambient: AMBIENT,
    shadowSoftness: SHADOW_SOFTNESS,
  }, board(start.lights), start.view, { lights: board(end.lights), view: end.view });

  const canvas = hit?.canvas ?? document.createElement('canvas');
  canvas.className = 'trim-length';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = len;
  canvas.height = wid;
  canvas.getContext('2d')!.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, len, wid), 0, 0);
  cache.set(id, { key, canvas });
  return canvas;
}
