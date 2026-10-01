import type { Light } from '../room';
// Pure relief maths for embossed wallpaper: a tileable height map → lit RGBA.
// Everything wraps at the edges so the result repeats seamlessly.

// Separable box blur, repeated: ~gaussian softening of the relief (paint build-up).
export function blurWrap(src: Float32Array, w: number, h: number, radius: number, passes = 3): Float32Array {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return src.slice();
  const a = src.slice();
  const b = new Float32Array(a.length);
  const n = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += a[y * w + ((k % w) + w) % w];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = sum / n;
        sum += a[y * w + ((x + r + 1) % w)] - a[y * w + ((x - r) % w + w) % w];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += b[(((k % h) + h) % h) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = sum / n;
        sum += b[((y + r + 1) % h) * w + x] - b[(((y - r) % h) + h) % h * w + x];
      }
    }
  }
  return a;
}

export interface ShadeOptions {
  albedo: Uint8ClampedArray; // RGBA per pixel: the colour flat areas render as
  relief: number; // height-to-slope scale
  lights: Light[]; // the room's lights at this surface (screen coords: y down, z towards viewer)
  ambient: number; // 0–1: how dark slopes facing away can get
  sheen: number; // satin paint highlight strength
}

// Lambert shading over the room's lights, normalised so flat areas come out exactly their albedo,
// plus a soft sheen on slopes turned towards the light.
export function shade(height: Float32Array, w: number, h: number, o: ShadeOptions): Uint8ClampedArray {
  const flat = o.lights.reduce((s, l) => s + l.weight * l.dir[2], 0);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const up = ((y - 1 + h) % h) * w, down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = (height[y * w + ((x + 1) % w)] - height[y * w + ((x - 1 + w) % w)]) * 0.5 * o.relief;
      const dy = (height[down + x] - height[up + x]) * 0.5 * o.relief;
      const len = Math.hypot(dx, dy, 1);
      const nx = -dx / len, ny = -dy / len, nz = 1 / len;
      let lambert = 0;
      for (const { dir, weight } of o.lights) lambert += weight * Math.max(0, nx * dir[0] + ny * dir[1] + nz * dir[2]);
      lambert /= flat;
      const light = o.ambient + (1 - o.ambient) * lambert;
      const spec = o.sheen * Math.max(0, lambert - 1) ** 2; // only slopes tilted toward the light
      for (let c = 0; c < 3; c++) out[i * 4 + c] = o.albedo[i * 4 + c] * light + 255 * spec;
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Seeded pebble emboss: a jittered dome per cell, tileable because cells wrap at the edges.
export function pebbles(w: number, h: number, cell: number, seed = 7): Float32Array {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const cols = Math.max(1, Math.round(w / cell)), rows = Math.max(1, Math.round(h / cell));
  const cw = w / cols, ch = h / rows;
  const px = new Float32Array(cols * rows), py = new Float32Array(cols * rows), pr = new Float32Array(cols * rows);
  for (let i = 0; i < px.length; i++) {
    px[i] = (0.2 + 0.6 * rand()) * cw;
    py[i] = (0.2 + 0.6 * rand()) * ch;
    pr[i] = 0.62 * Math.min(cw, ch) * (0.8 + 0.4 * rand());
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const cy = Math.floor(y / ch);
    for (let x = 0; x < w; x++) {
      const cx = Math.floor(x / cw);
      let best = 0;
      for (let j = -1; j <= 1; j++) {
        const ry = (cy + j + rows) % rows;
        const oy = (cy + j) * ch - y;
        for (let k = -1; k <= 1; k++) {
          const rx = (cx + k + cols) % cols;
          const i = ry * cols + rx;
          const dx = (cx + k) * cw + px[i] - x, dy = oy + py[i];
          const t = 1 - (dx * dx + dy * dy) / (pr[i] * pr[i]);
          if (t > best) best = t;
        }
      }
      out[y * w + x] = Math.sqrt(best); // rounded dome
    }
  }
  return out;
}
