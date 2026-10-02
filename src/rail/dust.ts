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

// x0..x1: wall px range to cover; band: dust band height, px.
export function dustLayout(x0: number, x1: number, band: number, amount: number): { clumps: Clump[]; fibres: Fibre[] } {
  const clumps: Clump[] = [], fibres: Fibre[] = [];
  for (let cell = Math.floor(x0 / CELL) - 2; cell <= Math.ceil(x1 / CELL) + 2; cell++) {
    // Density drifts along the ledge: heavier patches where it's been left longer.
    const patch = 0.5 + hash2(Math.floor(cell / 9), 1, 433) * 0.8;
    if (hash2(cell, 2, 433) > amount * patch) continue;
    const n = 1 + Math.floor(hash2(cell, 3, 433) * 3);
    for (let k = 0; k < n; k++) {
      const s = cell * 7 + k;
      clumps.push({
        x: cell * CELL + hash2(s, 4, 433) * CELL * 1.6,
        y: band * hash2(s, 5, 433) ** 2.2, // settles at the top
        r: 1 + 3.5 * hash2(s, 6, 433) ** 2, // mostly small, some fluffier
        alpha: 0.05 + 0.12 * hash2(s, 7, 433),
      });
    }
    if (hash2(cell, 8, 433) < 0.06 * amount) {
      fibres.push({
        x: cell * CELL,
        y: band * 0.25 * hash2(cell, 9, 433),
        len: 5 + 12 * hash2(cell, 10, 433),
        bend: (hash2(cell, 11, 433) - 0.5) * 6,
        angle: (hash2(cell, 12, 433) - 0.5) * 0.5, // lies roughly along the ledge
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

export function drawDust(ctx: CanvasRenderingContext2D, originX: number, width: number, band: number, amount: number, shade: number, lights: Light[]) {
  const g = (20 + 200 * shade) * ledgeLight(lights);
  const rgb = [g + 8, g + 4, g].map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',');
  const haze = ctx.createLinearGradient(0, 0, 0, band);
  haze.addColorStop(0, `rgba(${rgb},${(0.2 * amount).toFixed(3)})`);
  haze.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, band);
  const { clumps, fibres } = dustLayout(-originX, width - originX, band, amount);
  for (const c of clumps) {
    const x = c.x + originX;
    const soft = ctx.createRadialGradient(x, c.y, 0, x, c.y, c.r);
    soft.addColorStop(0, `rgba(${rgb},${c.alpha.toFixed(3)})`);
    soft.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = soft;
    ctx.fillRect(x - c.r, c.y - c.r, c.r * 2, c.r * 2);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.35;
  ctx.strokeStyle = `rgba(${rgb},0.3)`;
  for (const f of fibres) {
    const x = f.x + originX, dx = Math.cos(f.angle) * f.len, dy = Math.sin(f.angle) * f.len;
    ctx.beginPath();
    ctx.moveTo(x, f.y);
    ctx.quadraticCurveTo(x + dx / 2, f.y + dy / 2 + f.bend, x + dx, f.y + dy);
    ctx.stroke();
  }
}
