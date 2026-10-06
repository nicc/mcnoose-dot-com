// Recolours a scan through its ink map: each pixel moves by its ink's (target − original) shift,
// so print irregularities and paper grain survive any palette change. The shift field is
// softened across ink edges so boundaries stay anti-aliased.
import type { RGB } from '../colour';
import { blurWrap } from './relief';

export function recolour(
  scan: Uint8ClampedArray, // RGBA, modified in place
  index: Uint8Array, // ink per pixel
  w: number,
  h: number,
  original: RGB[],
  target: RGB[],
  soften: number, // edge softening radius, px
): Uint8ClampedArray {
  const shifts = original.map((o, k) => [target[k][0] - o[0], target[k][1] - o[1], target[k][2] - o[2]]);
  if (shifts.every((s) => s.every((v) => v === 0))) return scan;
  for (let c = 0; c < 3; c++) {
    const field = blurWrap(Float32Array.from(index, (k) => shifts[k][c]), w, h, soften, 1);
    for (let i = 0; i < field.length; i++) scan[i * 4 + c] += field[i];
  }
  return scan;
}
