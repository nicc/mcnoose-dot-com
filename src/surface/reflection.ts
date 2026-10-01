// Reflections on flat glossy surfaces (glass now, tile glaze later). Flat glass is a mirror, so
// it shows something specific with crisp edges: here a daylit sash window, behind the viewer on
// the side the scene light comes from. Drawn on its own layer and screen-blended, so it brightens
// without greying, and slid with parallax as the view moves so it reads as glass, not a print.

export interface WindowReflection {
  strength: number; // 0–1
  light: [number, number]; // unit 2D vector towards the light, surface coordinates
}

const SKY_TOP = [214, 228, 242];
const SKY_LOW = [238, 242, 244];

// Draws in surface coordinates (0…w, 0…h); the caller translates for any parallax margin.
export function drawWindowReflection(ctx: CanvasRenderingContext2D, w: number, h: number, o: WindowReflection) {
  if (o.strength <= 0) return;
  const [lx, ly] = o.light;
  const ww = w * 0.62, wh = h * 1.05; // window, mostly off the lit edge
  const cx = w / 2 + lx * w * 0.55, cy = h / 2 + ly * h * 0.6;
  const skew = -lx * 0.18; // seen at an angle: verticals lean away from the light
  const frame = ww * 0.06, bar = ww * 0.035;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.transform(1, 0, skew, 1, 0, 0);
  ctx.globalAlpha = Math.min(1, o.strength);
  const panes: [number, number, number, number][] = [];
  const pw = (ww - 2 * frame - bar) / 2, ph = (wh - 2 * frame - bar) / 2;
  for (const i of [0, 1]) for (const j of [0, 1]) panes.push([-ww / 2 + frame + i * (pw + bar), -wh / 2 + frame + j * (ph + bar), pw, ph]);
  for (const [x, y, pw_, ph_] of panes) {
    const g = ctx.createLinearGradient(0, y, 0, y + ph_);
    g.addColorStop(0, `rgb(${SKY_TOP})`);
    g.addColorStop(1, `rgb(${SKY_LOW})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, pw_, ph_);
  }
  ctx.restore();
}

// How far the reflection slides within the surface when the surface has moved by delta on screen
// (i.e. the eye has moved by −delta relative to it). Physically about 0.7 of the eye's movement;
// `amount` scales it. Rotated into the surface's tilt and clamped to the drawn margin.
export function parallaxOffset(delta: [number, number], amount: number, tiltDeg: number, max: number): [number, number] {
  const t = (tiltDeg * Math.PI) / 180;
  const [dx, dy] = [-delta[0] * amount, -delta[1] * amount];
  const lx = dx * Math.cos(t) + dy * Math.sin(t), ly = -dx * Math.sin(t) + dy * Math.cos(t);
  const clamp = (v: number) => Math.max(-max, Math.min(max, v));
  return [clamp(lx), clamp(ly)];
}
