// Reflections on flat glossy surfaces (glass now, tile glaze later). Flat glass is a mirror, so
// it shows something specific with crisp edges: the room's window, placed by mirror geometry
// (room.ts). Drawn on its own layer and screen-blended, so it brightens without greying, and slid
// with parallax as the view moves so it reads as glass, not a print.

export interface WindowReflection {
  strength: number; // 0–1
  rect: { x0: number; y0: number; x1: number; y1: number }; // the window's reflection, surface px (y down)
  bars: number; // sash frame and glazing bar width, px
  sky?: { top: number[]; low: number[] }; // the sky through the panes (sunset.ts), else daylight
}

export const SKY_TOP = [214, 228, 242]; // daylight
export const SKY_LOW = [238, 242, 244];

// Draws the reflected window: four daylit panes, the sash frame and bars left dark (they reflect
// nothing bright). Caller sets any rotation (a level window in tilted glass) and parallax offset.
export function drawWindowReflection(ctx: CanvasRenderingContext2D, o: WindowReflection) {
  if (o.strength <= 0) return;
  const { x0, y0, x1, y1 } = o.rect, b = o.bars;
  const pw = (x1 - x0 - 3 * b) / 2, ph = (y1 - y0 - 3 * b) / 2;
  if (pw <= 0 || ph <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, o.strength);
  for (const i of [0, 1])
    for (const j of [0, 1]) {
      const x = x0 + b + i * (pw + b), y = y0 + b + j * (ph + b);
      const g = ctx.createLinearGradient(0, y, 0, y + ph);
      g.addColorStop(0, `rgb(${o.sky?.top ?? SKY_TOP})`);
      g.addColorStop(1, `rgb(${o.sky?.low ?? SKY_LOW})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, pw, ph);
    }
  ctx.restore();
}

// How far the reflection slides within the surface when the surface has moved by delta on screen
// (i.e. the eye has moved by −delta relative to it): `amount` of the eye's movement (physically
// room.parallaxFactor). Rotated into the surface's tilt and clamped to the drawn margin.
export function parallaxOffset(delta: [number, number], amount: number, tiltDeg: number, max: number): [number, number] {
  const t = (tiltDeg * Math.PI) / 180;
  const [dx, dy] = [-delta[0] * amount, -delta[1] * amount];
  const lx = dx * Math.cos(t) + dy * Math.sin(t), ly = -dx * Math.sin(t) + dy * Math.cos(t);
  const clamp = (v: number) => Math.max(-max, Math.min(max, v));
  return [clamp(lx), clamp(ly)];
}
