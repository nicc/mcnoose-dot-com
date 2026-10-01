// Pure halftone maths: ink density map → dots on a rotated screen.

export interface ScreenOptions {
  pitch: number; // dot spacing, in source px
  angleDeg: number;
  gain: number; // ink spread: scales dot radius
  minDot: number; // dots smaller than this fraction of pitch aren't printed
  jitter: number; // position wobble, fraction of pitch
  noise: number; // radius wobble, fraction of radius
  seed: number;
}

// Ink density 0–1 per pixel: darker and more opaque = more ink. Colour maps to tone.
export function densityFromRGBA(data: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(data.length / 4);
  for (let i = 0; i < out.length; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    const lum = (2126 * r + 7152 * g + 722 * b) / 2550000; // Rec. 709 weights as integers: white is exactly 1
    out[i] = (a / 255) * (1 - lum);
  }
  return out;
}

// Summed-area table, (w+1)×(h+1), so any box average is four lookups.
export function integral(density: Float32Array, w: number, h: number): Float64Array {
  const s = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += density[y * w + x];
      s[(y + 1) * (w + 1) + x + 1] = s[y * (w + 1) + x + 1] + row;
    }
  }
  return s;
}

export function boxMean(s: Float64Array, w: number, h: number, cx: number, cy: number, half: number): number {
  const x0 = Math.max(0, Math.floor(cx - half)), x1 = Math.min(w, Math.ceil(cx + half));
  const y0 = Math.max(0, Math.floor(cy - half)), y1 = Math.min(h, Math.ceil(cy + half));
  if (x1 <= x0 || y1 <= y0) return 0;
  const area = (x1 - x0) * (y1 - y0);
  const W = w + 1;
  return (s[y1 * W + x1] - s[y0 * W + x1] - s[y1 * W + x0] + s[y0 * W + x0]) / area;
}

// Dot area ∝ density; gain lets solids close up the way spreading ink does.
export function dotRadius(density: number, pitch: number, gain: number): number {
  return Math.min(pitch * 0.75, pitch * Math.sqrt(density / Math.PI) * gain);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Returns packed [x, y, r, ...] in source px.
export function screenDots(density: Float32Array, w: number, h: number, o: ScreenOptions): Float32Array {
  const sat = integral(density, w, h);
  const rand = mulberry32(o.seed);
  const a = (o.angleDeg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const cx = w / 2, cy = h / 2;
  const n = Math.ceil(Math.hypot(w, h) / 2 / o.pitch) + 1;
  const out: number[] = [];
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      // Draw randoms for every cell so the pattern is stable regardless of content.
      const jx = (rand() * 2 - 1) * o.jitter * o.pitch;
      const jy = (rand() * 2 - 1) * o.jitter * o.pitch;
      const jr = 1 + (rand() * 2 - 1) * o.noise;
      const x = cx + (i * cos - j * sin) * o.pitch;
      const y = cy + (i * sin + j * cos) * o.pitch;
      if (x < -o.pitch || y < -o.pitch || x > w + o.pitch || y > h + o.pitch) continue;
      const d = boxMean(sat, w, h, x, y, o.pitch / 2);
      if (d <= 0) continue;
      const r = dotRadius(d, o.pitch, o.gain) * jr;
      if (r < o.minDot * o.pitch) continue;
      out.push(x + jx, y + jy, r);
    }
  }
  return Float32Array.from(out);
}
