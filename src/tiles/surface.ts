// Glazed tile surface: where each tile sits in the room, its slightly different glaze tone, and
// its cushion edge (softly rounded rim) lit by the room's lights. The rim facing a light catches a
// crisp highlight and the far rim falls into soft shade; that edge sparkle is most of what reads
// as gloss on a real tiled wall. Expressed as CSS shadows: crisp at any resolution, nearly free.
import type { Light } from '../room';
import { hash2 } from '../wood/noise';

// The page's geometry mapped onto the wall (cm). The embroidery's centre is the reference point.
export interface WallMap {
  pxPerCm: number;
  embroidery: { x: number; y: number }; // cm
  embroideryPage: { x: number; y: number }; // px: its centre in viewport x / page y
}

export function wallPoint(m: WallMap, page: { x: number; y: number }): { x: number; y: number } {
  return { x: m.embroidery.x + (page.x - m.embroideryPage.x) / m.pxPerCm, y: m.embroidery.y - (page.y - m.embroideryPage.y) / m.pxPerCm };
}

// Batch-to-batch glaze variation: brightness and a touch of warmth, seeded by wall position.
export function tileTone(base: [number, number, number], amount: number, col: number, row: number): string {
  const b = 1 + amount * (hash2(col, row, 71) - 0.5) * 2;
  const warm = amount * (hash2(col, row, 73) - 0.5) * 2;
  const c = [base[0] * b * (1 + warm * 0.4), base[1] * b, base[2] * b * (1 - warm * 0.6)];
  return `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',')})`;
}

export interface EdgeStyle {
  edgePx: number; // cushion radius
  sheen: number; // 0–1 highlight on rims facing a light
  recessPx: number; // how far the grout sits back
  recess: number; // 0–1 shadow the tile casts onto the grout
}

const f = (n: number) => n.toFixed(2);

// One set of rim shadows per light: highlight on the rim facing it, shade on the far rim, a
// hairline glint right at the edge, and the tile's tiny cast shadow on the recessed grout.
export function edgeShadows(lights: Light[], s: EdgeStyle): string {
  const total = lights.reduce((t, l) => t + l.weight, 0);
  const parts: string[] = [`inset 0 0 ${f(s.edgePx)}px rgba(0,0,0,0.05)`]; // rims curve away from frontal light
  for (const { dir: [x, y, z], weight, diffuse } of lights) {
    const n = Math.hypot(x, y) || 1;
    const D = [x / n, y / n];
    const w = weight / total;
    const grazing = Math.min(1, Math.hypot(x, y) / z + 0.25); // frontal light: rims barely differ
    const e = s.edgePx;
    parts.push(
      `inset ${f(-D[0] * e)}px ${f(-D[1] * e)}px ${f(e * 1.2)}px rgba(255,255,255,${f(0.7 * s.sheen * w * grazing)})`,
      `inset ${f(-D[0] * 1.5)}px ${f(-D[1] * 1.5)}px 0.5px rgba(255,255,255,${f(Math.min(1, 1.3 * s.sheen * w * grazing))})`,
      `inset ${f(D[0] * e)}px ${f(D[1] * e)}px ${f(e * 1.4)}px rgba(0,0,0,${f(0.1 * w * grazing)})`,
    );
    if (!diffuse) parts.push(`${f((-x / z) * s.recessPx)}px ${f((-y / z) * s.recessPx)}px ${f(s.recessPx * 0.8)}px rgba(0,0,0,${f(0.25 * s.recess * w)})`);
  }
  return parts.join(', ');
}
