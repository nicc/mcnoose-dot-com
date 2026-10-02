// Painted trim cross-sections (dado rail, skirting). Heights in cm; `at(t)` gives depth off the
// wall as a fraction of `depthCm`, the deepest point, for t from 0 (top) to 1 (bottom).

export interface Profile {
  heightCm: number;
  depthCm: number;
  faceDepthCm: number; // depth of the bottom edge: what overhangs whatever is below
  topDepthCm: number; // depth at the top edge: the board's top runs back from here to the wall
  at: (t: number) => number;
}

// Dado rail, top to bottom: a rounded top falling back to the wall, a quirk and bead, a cove, the
// flat face (extendable), and a small rounded bottom edge standing proud of the tiles.

export interface RailDims {
  depthCm: number; // how far the rail stands off the wall
  roundCm: number; // rounded top radius
  beadCm: number;
  coveCm: number;
  flatCm: number;
}

export const RAIL_BOTTOM_CM = 0.4;
const COVE_DEPTH = 0.45; // of the cove's height: how far the flat face sits back from the top

export function railProfile(d: RailDims): Profile {
  const D = d.depthCm, R = Math.min(d.roundCm, D), B = d.beadCm, C = d.coveCm;
  const beadBase = D - B / 2;
  const F = beadBase - COVE_DEPTH * C; // flat face depth
  const H = R + B + C + d.flatCm + RAIL_BOTTOM_CM;
  const z = (y: number): number => {
    if (y < R) return D - R + Math.sqrt(Math.max(0, R * R - (R - y) ** 2)); // rounded top
    y -= R;
    if (y < B) {
      const r = B / 2, quirk = B * 0.12;
      if (y < quirk) return beadBase - (B * 0.1 * y) / quirk; // the quirk: a small groove above the bead
      return beadBase + Math.sqrt(Math.max(0, r * r - (y - B / 2) ** 2)) * 0.95;
    }
    y -= B;
    if (y < C) {
      const s = y / C, k = beadBase - F;
      return F + k * (1 - Math.sqrt(Math.max(0, 1 - (1 - s) ** 2))); // concave cove
    }
    y -= C;
    if (y < d.flatCm) return F;
    y -= d.flatCm;
    const b = RAIL_BOTTOM_CM;
    return F - b + Math.sqrt(Math.max(0, b * b - y * y)); // rounded bottom edge
  };
  return { heightCm: H, depthCm: D, faceDepthCm: F - RAIL_BOTTOM_CM, topDepthCm: z(0), at: (t) => z(t * H) / D };
}

export interface SkirtingDims {
  depthCm: number; // board thickness: the torus's front, its furthest point off the wall
  torusCm: number; // diameter of the round along the top
  reliefCm: number; // how far the round stands proud of the face: small = a lip, its radius = a full half-round
  flatCm: number; // flat face down to the floor
}

const QUIRK_CM = 0.3; // routed hollow where the round meets the face
const QUIRK_DEPTH_CM = 0.2;

// Skirting, top to bottom, as routed from one board: the top edge rounded over into a torus, the
// face cut back by `reliefCm` below it (the round's underside meets the face partway round when the
// relief is less than its radius), a small rounded quirk, then the tall flat face to the floor.
export function skirtingProfile(d: SkirtingDims): Profile {
  const D = d.depthCm, r = d.torusCm / 2, relief = Math.max(0.05, Math.min(r, d.reliefCm));
  const c = D - r, F = D - relief; // depth of the round's centre; of the face
  const meet = r + Math.sqrt(Math.max(0, r * r - (F - c) ** 2)); // where the round's underside reaches the face
  const H = meet + QUIRK_CM + d.flatCm;
  const z = (y: number): number => {
    if (y < meet) return c + Math.sqrt(Math.max(0, r * r - (y - r) ** 2)); // the round
    if (y < meet + QUIRK_CM) return F - QUIRK_DEPTH_CM * Math.sin((Math.PI * (y - meet)) / QUIRK_CM); // quirk, rising back to a lip at the face
    return F;
  };
  return { heightCm: H, depthCm: D, faceDepthCm: F, topDepthCm: c, at: (t) => z(t * H) / D };
}
