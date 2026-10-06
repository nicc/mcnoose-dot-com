// The pixels of one painted length (rail or skirting): grain, paint, wear, scuffs, then the board
// lit by the room at its two ends. Pure typed-array work on plain data, so it runs in a worker
// (worker.ts) and never holds up the page; length.ts queues the jobs and places the results.
import type { RGB } from '../colour';
import { AMBIENT, type Light, type Vec3 } from '../room';
import { diffuseReach, shadeBoard } from '../wood/board';
import { grainMaps } from '../wood/grain';
import { PAINT_BARE, paintMaps, softenProfile } from '../wood/paint';
import { weather } from '../wood/wear';
import { scuff } from './scuffs';

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

// Everything a length is drawn from, as data that can cross to a worker.
export interface LengthJob {
  trim: string;
  len: number; // canvas px along the wall
  total: number; // canvas px down, ledge included
  dpr: number;
  pxPerCm: number;
  start: TrimLight;
  end: TrimLight;
  colour: RGB;
  paint: { grain: number; brush: number; buildup: number; yellowing: number; sheen: number; gloss: number };
  wear: number;
  grime: number;
  scuffs?: { amount: number; low: number; faceTopCm: number }; // knocks on the flat face (skirting; see scuffs.ts)
  ledgeCm: number; // the top ledge seen from above, foreshortened: drawn above the profile
  profile: { samples: Float32Array; heightCm: number; depthCm: number }; // the cross-section, sampled (wood/paint.ts sampleProfile)
  u0: number; // where this length starts along the whole board, canvas px
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

export function paintPixels(j: LengthJob): Uint8ClampedArray {
  const { len, total, dpr, start, end } = j;
  const scale = j.pxPerCm * dpr, u0 = j.u0;
  const ledge = Math.min(total - 2, Math.round(j.ledgeCm * scale)), wid = total - ledge;
  const profile = softenProfile(j.profile.samples, j.paint.buildup, j.profile.heightCm);
  const wood = grainMaps(len, wid, { ...PINE, ringPx: RING_CM * scale }, 0, u0);
  const paint = paintMaps(wood, len, wid, profile, { colour: j.colour, grain: j.paint.grain, brush: j.paint.brush, yellowing: j.paint.yellowing, buildup: j.paint.buildup, pxPerCm: scale, seed: 31 }, u0);
  weather(paint, len, wid, profile, { wear: j.wear, grime: j.grime, patches: 0.7, mitres: false, seed: 61, bare: PAINT_BARE }, 0, u0);
  if (j.scuffs) scuff(paint, len, wid, { amount: j.scuffs.amount, low: j.scuffs.low, faceTop: Math.round(wid * (j.scuffs.faceTopCm / j.profile.heightCm)) }, u0, scale, j.trim === 'skirting' ? 71 : 73);
  // Trim coordinates: u along the wall (screen x), v down the rail (screen y), z out of the wall.
  const rgba = shadeBoard(paint, len, wid, {
    profile,
    profileDepth: j.profile.depthCm * scale,
    grainDepth: RELIEF_CM * scale,
    sheen: j.paint.sheen,
    gloss: j.paint.gloss,
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
  return out;
}
