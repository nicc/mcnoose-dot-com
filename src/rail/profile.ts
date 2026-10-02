// The dado rail's cross-section, top to bottom: a rounded top falling back to the wall, a quirk
// and bead, a cove, the flat face (extendable), and a small rounded bottom edge standing proud of
// the tiles. Heights in cm; `at(t)` gives depth off the wall as a fraction of the full depth.

export interface RailDims {
  depthCm: number; // how far the rail stands off the wall
  roundCm: number; // rounded top radius
  beadCm: number;
  coveCm: number;
  flatCm: number;
}

export const RAIL_BOTTOM_CM = 0.4;
const COVE_DEPTH = 0.45; // of the cove's height: how far the flat face sits back from the top

export function railProfile(d: RailDims): { heightCm: number; faceDepthCm: number; at: (t: number) => number } {
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
  return { heightCm: H, faceDepthCm: F - RAIL_BOTTOM_CM, at: (t) => z(t * H) / D };
}
