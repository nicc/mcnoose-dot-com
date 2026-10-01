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
  color: [number, number, number]; // 0–255, the colour of flat areas
  relief: number; // height-to-slope scale
  lightDeg: number; // azimuth the light comes from: 0 = right, 90 = above, 135 = upper left
  elevationDeg: number;
  ambient: number; // 0–1: how dark slopes facing away can get
  sheen: number; // satin paint highlight strength
}

// Lambert shading normalised so flat areas come out exactly `color`, plus a soft sheen.
export function shade(height: Float32Array, w: number, h: number, o: ShadeOptions): Uint8ClampedArray {
  const az = (o.lightDeg * Math.PI) / 180, el = (o.elevationDeg * Math.PI) / 180;
  const lx = Math.cos(az) * Math.cos(el), ly = -Math.sin(az) * Math.cos(el), lz = Math.sin(el); // screen y points down
  const flat = lz;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const up = ((y - 1 + h) % h) * w, down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = (height[y * w + ((x + 1) % w)] - height[y * w + ((x - 1 + w) % w)]) * 0.5 * o.relief;
      const dy = (height[down + x] - height[up + x]) * 0.5 * o.relief;
      const len = Math.hypot(dx, dy, 1);
      const nx = -dx / len, ny = -dy / len, nz = 1 / len;
      const lambert = Math.max(0, nx * lx + ny * ly + nz * lz) / flat;
      const light = o.ambient + (1 - o.ambient) * lambert;
      const spec = o.sheen * Math.max(0, lambert - 1) ** 2; // only slopes tilted toward the light
      for (let c = 0; c < 3; c++) out[i * 4 + c] = o.color[c] * light + 255 * spec;
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Seeded stipple: fine sand texture in the background of the relief.
export function stipple(w: number, h: number, amount: number, seed = 7): Float32Array {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = rand() * amount;
  return out;
}
