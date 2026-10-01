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
  for (const { dir: [x, y, z], weight } of lights) {
    const n = Math.hypot(x, y) || 1;
    const D = [x / n, y / n];
    const w = weight / total;
    const grazing = Math.min(1, Math.hypot(x, y) / z + 0.25); // frontal light: rims barely differ
    const e = s.edgePx;
    parts.push(
      `inset ${f(-D[0] * e)}px ${f(-D[1] * e)}px ${f(e * 1.2)}px rgba(255,255,255,${f(0.7 * s.sheen * w * grazing)})`,
      `inset ${f(-D[0] * 1.5)}px ${f(-D[1] * 1.5)}px 0.5px rgba(255,255,255,${f(Math.min(1, 1.3 * s.sheen * w * grazing))})`,
      `inset ${f(D[0] * e)}px ${f(D[1] * e)}px ${f(e * 1.4)}px rgba(0,0,0,${f(0.1 * w * grazing)})`,
      `${f((-x / z) * s.recessPx)}px ${f((-y / z) * s.recessPx)}px ${f(s.recessPx * 0.8)}px rgba(0,0,0,${f(0.25 * s.recess * w)})`,
    );
  }
  return parts.join(', ');
}

// A bull-nose's rounded top: the surface turns from facing you (normal frontal) to facing the
// ceiling (normal up) over radius px. Shade each angle from the room's lights, relative to the flat
// face, plus a glint where the curve mirrors a light at the viewer. Returns a CSS gradient to layer
// over the tile colour.
export function roundedTop(lights: Light[], radiusPx: number, sheen: number): string {
  const flat = lights.reduce((s, l) => s + l.weight * l.dir[2], 0);
  const stops: string[] = [];
  const STEPS = 12;
  for (let k = 0; k <= STEPS; k++) {
    const phi = (Math.PI / 2) * (1 - k / STEPS); // 90° at the very top → 0° where it meets the face
    const n = [0, -Math.sin(phi), Math.cos(phi)];
    let diffuse = 0, spec = 0;
    for (const { dir, weight } of lights) {
      diffuse += weight * Math.max(0, n[1] * dir[1] + n[2] * dir[2]);
      const h = [dir[0], dir[1], dir[2] + 1], hl = Math.hypot(...h);
      spec += weight * Math.max(0, (n[1] * h[1] + n[2] * h[2]) / hl) ** 40;
    }
    const b = diffuse / flat - 1; // brighter or darker than the flat face
    const white = Math.max(0, b) * 0.5 + spec * sheen * 0.8, black = Math.max(0, -b) * 0.45;
    const y = radiusPx * (1 - Math.sin(phi));
    stops.push(`rgba(${white >= black ? '255,255,255' : '0,0,0'},${f(Math.min(1, Math.max(white, black)))}) ${f(y)}px`);
  }
  stops.push(`rgba(0,0,0,0) ${f(radiusPx)}px`);
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}
