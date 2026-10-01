// Sanded grout: fine light and dark grains over the grout colour, as a small repeating image.
// Grain this fine never reads as a repeat.
import { hash2 } from '../wood/noise';

const SIZE = 96; // CSS px per repeat
let key = '';
let url = '';

export function groutTexture(amount: number, dpr: number): string {
  const k = `${amount}:${dpr}`;
  if (k === key) return url;
  const n = Math.round(SIZE * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d')!;
  const grains = Math.round(n * n * 0.05 * amount);
  for (let i = 0; i < grains; i++) {
    const x = hash2(i, 1, 9) * n, y = hash2(i, 2, 9) * n, v = hash2(i, 3, 9);
    ctx.fillStyle = v < 0.55 ? `rgba(0,0,0,${0.05 + 0.12 * v})` : `rgba(255,255,255,${0.1 + 0.25 * (v - 0.55)})`;
    const r = (0.4 + hash2(i, 4, 9) * 0.6) * dpr;
    ctx.fillRect(x, y, r, r);
  }
  key = k;
  url = canvas.toDataURL();
  return url;
}
