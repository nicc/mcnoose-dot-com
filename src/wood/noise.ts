// Seeded 2D value noise and fBm. Optional period along x makes it repeat seamlessly, so a board
// texture can tile along its length (the skirting).

export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * (3 - 2 * t);

// Value noise in [0, 1). periodX (in noise cells) wraps the lattice horizontally.
export function noise(x: number, y: number, seed: number, periodX = 0): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = fade(x - x0), fy = fade(y - y0);
  const wrap = (i: number) => (periodX > 0 ? ((i % periodX) + periodX) % periodX : i);
  const a = hash2(wrap(x0), y0, seed), b = hash2(wrap(x0 + 1), y0, seed);
  const c = hash2(wrap(x0), y0 + 1, seed), d = hash2(wrap(x0 + 1), y0 + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

// Fractal sum, centred on 0 (≈ −0.5…0.5). Octave periods double with frequency so wrapping holds.
export function fbm(x: number, y: number, seed: number, octaves = 4, periodX = 0): number {
  let sum = 0, amp = 0.5, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += (noise(x * f, y * f, seed + o * 101, periodX * f) - 0.5) * amp * 2;
    amp *= 0.5;
    f *= 2;
  }
  return sum * 0.5;
}
