// Painted trim (dado rail, skirting), built from lengths about one tile wide. Each length is lit by
// the room's lights at its own position on the wall (dynamic lighting, like every other surface):
// at both its ends, blended across, so neighbouring lengths meet without a step.
// Grain, brush strokes, wear and scuffs are generated in wall coordinates, so lengths join
// seamlessly; each is cached by its trim and its place on the wall.
import type { Light, Vec3 } from '../room';
import { AMBIENT } from '../room';
import { diffuseReach, shadeBoard } from '../wood/board';
import { grainMaps, type RGB } from '../wood/grain';
import { PAINT_BARE, paintMaps, softenProfile } from '../wood/paint';
import { weather } from '../wood/wear';
import type { Profile } from './profile';
import { scuff } from './scuffs';
import { later, soon } from '../later';

export interface TrimStyle {
  profile: Profile;
  colour: RGB;
  paint: { grain: number; brush: number; buildup: number; yellowing: number; sheen: number; gloss: number };
  wear: number;
  grime: number;
  scuffs?: { amount: number; low: number; faceTopCm: number }; // knocks on the flat face (skirting; see scuffs.ts)
  ledgeCm?: number; // the top ledge seen from above, foreshortened (skirting): drawn above the profile
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

// An upward-facing ledge lit by the room, relative to the vertical face (which shows its albedo).
// The tile wall rising behind it fills half its view of the room (same model as the board).
export function ledgeShade(lights: Light[]): number {
  let lit = 0, flat = 0;
  for (const { dir, weight } of lights) {
    lit += weight * Math.max(0, -dir[1]);
    flat += weight * dir[2];
  }
  return AMBIENT * diffuseReach(0.5) + (1 - AMBIENT) * (lit / flat);
}

const board = (lights: Light[]) => lights.map(({ dir, weight }) => ({ dir, weight }));

const cache = new Map<string, { key: string; canvas: HTMLCanvasElement }>();

// trim: which piece ('rail', 'skirting'); index: which length along the wall; lenPx/heightPx in
// CSS px; pxPerCm: scene scale; start/end: the room's light at its left and right ends.
// deferred: hand back the (sized) canvas now and paint it later (later.ts), keyed `trim:<trim>:<index>`:
// 'idle' when the browser is idle (off screen), 'soon' just after the first paint (on screen).
export function trimLength(trim: string, index: number, lenPx: number, heightPx: number, pxPerCm: number, dpr: number, start: TrimLight, end: TrimLight, s: TrimStyle, deferred: false | 'soon' | 'idle' = false): HTMLCanvasElement {
  const key = JSON.stringify([lenPx, heightPx, pxPerCm, dpr, start, end, s, s.profile.heightCm, s.profile.depthCm]);
  const id = `${trim}:${index}`;
  const hit = cache.get(id);
  if (hit && hit.key === key) return hit.canvas;
  const len = Math.max(1, Math.round(lenPx * dpr)), total = Math.max(2, Math.round(heightPx * dpr));
  const canvas = hit?.canvas ?? document.createElement('canvas');
  canvas.className = 'trim-length';
  canvas.setAttribute('aria-hidden', 'true');
  [canvas.width, canvas.height] = [len, total];
  cache.set(id, { key, canvas });
  const draw = () => paintLength(canvas, trim, index, len, total, dpr, pxPerCm, start, end, s);
  if (deferred === 'idle') later(`trim:${id}`, draw);
  else if (deferred === 'soon') void soon(`trim:${id}`, draw);
  else draw();
  return canvas;
}

function paintLength(canvas: HTMLCanvasElement, trim: string, index: number, len: number, total: number, dpr: number, pxPerCm: number, start: TrimLight, end: TrimLight, s: TrimStyle) {
  const scale = pxPerCm * dpr, u0 = index * len;
  const ledge = Math.min(total - 2, Math.round((s.ledgeCm ?? 0) * scale)), wid = total - ledge;
  const profile = softenProfile(s.profile.at, s.paint.buildup, s.profile.heightCm);
  const wood = grainMaps(len, wid, { ...PINE, ringPx: RING_CM * scale }, 0, u0);
  const paint = paintMaps(wood, len, wid, profile, { colour: s.colour, grain: s.paint.grain, brush: s.paint.brush, yellowing: s.paint.yellowing, buildup: s.paint.buildup, pxPerCm: scale, seed: 31 }, u0);
  weather(paint, len, wid, profile, { wear: s.wear, grime: s.grime, patches: 0.7, mitres: false, seed: 61, bare: PAINT_BARE }, 0, u0);
  if (s.scuffs) scuff(paint, len, wid, { amount: s.scuffs.amount, low: s.scuffs.low, faceTop: Math.round(wid * (s.scuffs.faceTopCm / s.profile.heightCm)) }, u0, scale, trim === 'skirting' ? 71 : 73);
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

  // The ledge: the face's paint, turned up to the light, lit start → end like the board.
  const out = new Uint8ClampedArray(len * total * 4);
  out.set(rgba, len * ledge * 4);
  if (ledge > 0) {
    const a = ledgeShade(start.lights), b = ledgeShade(end.lights), from = Math.floor(wid * 0.4);
    for (let v = 0; v < ledge; v++) {
      for (let u = 0; u < len; u++) {
        // Darker at the back, where it meets the tiles above (they hide part of the room from it).
        const shade = (a + (b - a) * (len > 1 ? u / (len - 1) : 0)) * (0.78 + 0.22 * ((v + 0.5) / ledge)), src = ((from + v) * len + u) * 3, i = (v * len + u) * 4;
        for (let c = 0; c < 3; c++) out[i + c] = paint.albedo[src + c] * shade;
        out[i + 3] = 255;
      }
    }
  }

  canvas.getContext('2d')!.putImageData(new ImageData(out as Uint8ClampedArray<ArrayBuffer>, len, total), 0, 0);
}
