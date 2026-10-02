// Painted trim cross-sections (dado rail, skirting). Heights in cm; `at(t)` gives depth off the
// wall as a fraction of `depthCm`, the deepest point, for t from 0 (top) to 1 (bottom).

export interface Profile {
  heightCm: number;
  depthCm: number;
  faceDepthCm: number; // depth of the bottom edge: what overhangs whatever is below
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
  return { heightCm: H, depthCm: D, faceDepthCm: F - RAIL_BOTTOM_CM, at: (t) => z(t * H) / D };
}

export interface SkirtingDims {
  depthCm: number; // the flat face's distance off the wall
  torusCm: number; // height of the half-round moulding along the top
  flatCm: number; // flat face down to the floor
}

const QUIRK_CM = 0.25;

// Skirting, top to bottom: a half-round torus moulding standing proud of the face, a small groove,
// then the tall flat face down to the floor.
export function skirtingProfile(d: SkirtingDims): Profile {
  const F = d.depthCm, T = d.torusCm, r = T / 2;
  const D = F + 0.5 * T; // the torus's front is the deepest point
  const H = T + QUIRK_CM + d.flatCm;
  const z = (y: number): number => {
    if (y < T) return F + Math.sqrt(Math.max(0, r * r - (y - r) ** 2)); // torus: a true half-round
    if (y < T + QUIRK_CM) return F - 0.15; // groove under it
    return F;
  };
  return { heightCm: H, depthCm: D, faceDepthCm: F, at: (t) => z(t * H) / D };
}
