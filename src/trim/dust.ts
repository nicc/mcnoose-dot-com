// Dust settled along a ledge: soft overlapping clumps of mixed size and the odd fibre lying along
// it, over a faint haze — fluffy, not speckled. Placed by wall position (never repeats, holds still
// on resize) and drawn in a grey set by `shade`, brightened or dimmed by the room's light on the ledge.
import type { Light } from '../room';
import { hash2 } from '../wood/noise';

export interface Clump {
  x: number; // wall px
  y: number; // px down from the ledge top
  r: number;
  alpha: number;
}

export interface Fibre {
  x: number;
  y: number;
  len: number;
  bend: number; // control-point offset, px
  angle: number;
}

const CELL = 5; // wall px per placement cell

// x0..x1: range to cover; band: dust band height. scale: drawing units per screen px, so dust keeps
// its on-screen size wherever it's drawn (e.g. on a frame rendered large then shrunk).
export function dustLayout(x0: number, x1: number, band: number, amount: number, seed = 433, scale = 1): { clumps: Clump[]; fibres: Fibre[] } {
  const clumps: Clump[] = [], fibres: Fibre[] = [];
  const CELL_ = CELL * scale;
  const h = (i: number, k: number) => hash2(i, k, seed);
  for (let cell = Math.floor(x0 / CELL_) - 2; cell <= Math.ceil(x1 / CELL_) + 2; cell++) {
    // Density drifts along the ledge: heavier patches where it's been left longer.
    const patch = 0.5 + h(Math.floor(cell / 9), 1) * 0.8;
    if (h(cell, 2) > amount * patch) continue;
    const n = 1 + Math.floor(h(cell, 3) * 3);
    for (let k = 0; k < n; k++) {
      const s = cell * 7 + k;
      clumps.push({
        x: cell * CELL_ + h(s, 4) * CELL_ * 1.6,
        y: band * h(s, 5) ** 2.2, // settles at the top
        r: (1 + 3.5 * h(s, 6) ** 2) * scale, // mostly small, some fluffier
        alpha: 0.05 + 0.12 * h(s, 7),
      });
    }
    if (h(cell, 8) < 0.06 * amount) {
      fibres.push({
        x: cell * CELL_,
        y: band * 0.25 * h(cell, 9),
        len: (5 + 12 * h(cell, 10)) * scale,
        bend: (h(cell, 11) - 0.5) * 6 * scale,
        angle: (h(cell, 12) - 0.5) * 0.5, // lies roughly along the ledge
      });
    }
  }
  return { clumps, fibres };
}

// How the room lights a surface facing mostly up (the ledge top), relative to a flat wall face.
export function ledgeLight(lights: Light[]): number {
  const n = [0, -0.9, 0.44];
  let lit = 0, flat = 0;
  for (const { dir, weight } of lights) {
    lit += weight * Math.max(0, n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2]);
    flat += weight * dir[2];
  }
  return Math.max(0.5, Math.min(1.3, lit / flat));
}

// How dust shows: pale fluff — clumps and fibres strong, the even film under them light, the tone
// lifted — so it reads as dust rather than murk. (Was the frame's alone; now every ledge's.)
export const DUST_LOOK = { opacity: 2.6, haze: 0.5, tone: 1.4 };

// look: opacity of the clumps and fibres, haze (the film under them), tone.
export function drawDust(ctx: CanvasRenderingContext2D, originX: number, width: number, band: number, amount: number, shade: number, lights: Light[], seed = 433, scale = 1, look = DUST_LOOK) {
  if (amount <= 0) return;
  const opacity = look.opacity;
  const g = (20 + 200 * shade) * ledgeLight(lights) * look.tone;
  const rgb = [g + 8, g + 4, g].map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',');
  const haze = ctx.createLinearGradient(0, 0, 0, band);
  haze.addColorStop(0, `rgba(${rgb},${Math.min(0.8, 0.2 * amount * look.haze).toFixed(3)})`);
  haze.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, band);
  const { clumps, fibres } = dustLayout(-originX, width - originX, band, amount, seed, scale);
  for (const c of clumps) {
    const x = c.x + originX;
    const soft = ctx.createRadialGradient(x, c.y, 0, x, c.y, c.r);
    soft.addColorStop(0, `rgba(${rgb},${Math.min(0.9, c.alpha * opacity).toFixed(3)})`);
    soft.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = soft;
    ctx.fillRect(x - c.r, c.y - c.r, c.r * 2, c.r * 2);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.35 * scale;
  ctx.strokeStyle = `rgba(${rgb},${Math.min(0.9, 0.3 * opacity).toFixed(3)})`;
  for (const f of fibres) {
    const x = f.x + originX, dx = Math.cos(f.angle) * f.len, dy = Math.sin(f.angle) * f.len;
    ctx.beginPath();
    ctx.moveTo(x, f.y);
    ctx.quadraticCurveTo(x + dx / 2, f.y + dy / 2 + f.bend, x + dx, f.y + dy);
    ctx.stroke();
  }
}
