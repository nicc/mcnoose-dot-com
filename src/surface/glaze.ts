// Reflection on a flat glossy surface (glass, tile glaze): a soft brightening towards the lit
// side and two diagonal glare bands running across the light direction. Lit by the scene light,
// so every glossy surface on the page catches it the same way.

export interface GlazeOptions {
  reflection: number; // 0–1
  light: [number, number]; // unit 2D vector towards the light, in the surface's own coordinates
}

export function drawGlaze(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: GlazeOptions) {
  if (o.reflection <= 0) return;
  const [lx, ly] = o.light;
  // Gradient axis runs from the lit corner across the surface.
  const half = (Math.abs(lx) * w + Math.abs(ly) * h) / 2;
  const cx = x + w / 2, cy = y + h / 2;
  const g = ctx.createLinearGradient(cx + lx * half, cy + ly * half, cx - lx * half, cy - ly * half);
  const a = (k: number) => `rgba(255,255,255,${(k * o.reflection).toFixed(3)})`;
  g.addColorStop(0, a(0.3));
  g.addColorStop(0.14, a(0.08));
  g.addColorStop(0.2, a(0.34)); // broad glare band
  g.addColorStop(0.31, a(0.06));
  g.addColorStop(0.37, a(0.2)); // thin second band
  g.addColorStop(0.41, a(0.03));
  g.addColorStop(1, a(0.02));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}
