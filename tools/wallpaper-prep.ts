// Pure helpers for turning a flat wallpaper scan into a seamless repeat and an ink palette.

export interface Gray {
  data: Float32Array;
  w: number;
  h: number;
}

export type Vec = [number, number];

// Normalised correlation of an image with itself shifted by (dx, dy), over the overlap.
export function shiftCorrelation(g: Gray, dx: number, dy: number): number {
  const x0 = Math.max(0, dx), x1 = Math.min(g.w, g.w + dx);
  const y0 = Math.max(0, dy), y1 = Math.min(g.h, g.h + dy);
  if (x1 - x0 < 8 || y1 - y0 < 8) return -1;
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const a = g.data[y * g.w + x], b = g.data[(y - dy) * g.w + (x - dx)];
      sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++;
    }
  }
  const cov = sab / n - (sa / n) * (sb / n);
  const va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
  return cov / Math.sqrt(va * vb + 1e-12);
}

// Best shift within a search window around a guess.
export function refineShift(g: Gray, guess: Vec, radius: number, step = 1): { shift: Vec; score: number } {
  let best: { shift: Vec; score: number } = { shift: guess, score: -Infinity };
  for (let dy = guess[1] - radius; dy <= guess[1] + radius; dy += step) {
    for (let dx = guess[0] - radius; dx <= guess[0] + radius; dx += step) {
      const score = shiftCorrelation(g, dx, dy);
      if (score > best.score) best = { shift: [dx, dy], score };
    }
  }
  return best;
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export interface RGB {
  data: Uint8ClampedArray | Uint8Array; // packed RGB
  w: number;
  h: number;
}

function bilinear(img: RGB, x: number, y: number, out: number[]) {
  const x0 = Math.max(0, Math.min(img.w - 2, Math.floor(x))), y0 = Math.max(0, Math.min(img.h - 2, Math.floor(y)));
  const fx = Math.min(1, Math.max(0, x - x0)), fy = Math.min(1, Math.max(0, y - y0));
  for (let c = 0; c < 3; c++) {
    const i = (y0 * img.w + x0) * 3 + c;
    const top = img.data[i] * (1 - fx) + img.data[i + 3] * fx;
    const bot = img.data[i + img.w * 3] * (1 - fx) + img.data[i + img.w * 3 + 3] * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
}

// Builds a W×H tile that repeats exactly. Tile (u, v) maps to origin + u·a/W + v·c/H, so the
// lattice (a, c) may be slightly sheared, as paper stretch makes it. Within `feather` px of the
// left/top edges, samples crossfade with the next repeat (+a, +c) so print irregularities
// between repeats don't show as seams. The crop must extend feather px past one repeat.
export function seamlessTile(img: RGB, origin: Vec, a: Vec, c: Vec, W: number, H: number, feather: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(W * H * 3);
  const s: number[] = [0, 0, 0];
  for (let v = 0; v < H; v++) {
    const tv = smooth(v / feather);
    for (let u = 0; u < W; u++) {
      const tu = smooth(u / feather);
      const bx = origin[0] + (u / W) * a[0] + (v / H) * c[0];
      const by = origin[1] + (u / W) * a[1] + (v / H) * c[1];
      const acc = [0, 0, 0];
      for (const [wu, ox] of [[tu, 0], [1 - tu, 1]] as const) {
        for (const [wv, oy] of [[tv, 0], [1 - tv, 1]] as const) {
          const w = wu * wv;
          if (w === 0) continue;
          bilinear(img, bx + ox * a[0] + oy * c[0], by + ox * a[1] + oy * c[1], s);
          for (let k = 0; k < 3; k++) acc[k] += w * s[k];
        }
      }
      for (let k = 0; k < 3; k++) out[(v * W + u) * 3 + k] = acc[k];
    }
  }
  return out;
}

export type Vec3 = [number, number, number];

// sRGB (0–255) → CIE Lab (D65). Perceptual distances separate close inks like petal vs ground.
export function rgbToLab([r, g, b]: Vec3): Vec3 {
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389) / 27 / 116 + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// Assigns each pixel to its nearest ink in Lab, refining the seed colours Lloyd-style.
export function classifyInks(pixels: Uint8ClampedArray | Uint8Array, seeds: Vec3[], iterations = 5): { index: Uint8Array; inks: Vec3[] } {
  const n = pixels.length / 3;
  const labs = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) labs.set(rgbToLab([pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]]), i * 3);
  let inks = seeds.map((s) => [...s] as Vec3);
  const index = new Uint8Array(n);
  for (let it = 0; it <= iterations; it++) {
    const centres = inks.map(rgbToLab);
    const sums = inks.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < centres.length; k++) {
        const d = (labs[i * 3] - centres[k][0]) ** 2 + (labs[i * 3 + 1] - centres[k][1]) ** 2 + (labs[i * 3 + 2] - centres[k][2]) ** 2;
        if (d < bd) [best, bd] = [k, d];
      }
      index[i] = best;
      const s = sums[best];
      s[0] += pixels[i * 3]; s[1] += pixels[i * 3 + 1]; s[2] += pixels[i * 3 + 2]; s[3]++;
    }
    if (it < iterations) inks = inks.map((ink, k) => (sums[k][3] ? [sums[k][0] / sums[k][3], sums[k][1] / sums[k][3], sums[k][2] / sums[k][3]] as Vec3 : ink));
  }
  return { index, inks: inks.map((c) => c.map(Math.round) as Vec3) };
}

// Majority filter with wrap-around: removes speckle where noise flips a pixel between close inks.
export function modeFilter(index: Uint8Array, w: number, h: number, k: number, radius = 1): Uint8Array {
  const out = new Uint8Array(index.length);
  const votes = new Uint16Array(k);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      votes.fill(0);
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) votes[index[((y + dy + h) % h) * w + ((x + dx + w) % w)]]++;
      let best = index[y * w + x];
      for (let j = 0; j < k; j++) if (votes[j] > votes[best]) best = j;
      out[y * w + x] = best;
    }
  }
  return out;
}
