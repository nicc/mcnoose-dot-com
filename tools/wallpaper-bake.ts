// Build-time wallpaper: renders the final tile once with config.ts values, so production does no
// wallpaper compute. It ships as its own files beside index.html (AVIF, WebP for browsers without
// AVIF), not inlined: inlined it was three quarters of the page, and nothing painted until it had
// all arrived. `virtual:wallpaper` names the files. In dev the module is null and the page renders
// live (src/wallpaper/index.ts) so panel changes show instantly.
import { createHash } from 'node:crypto';
import sharp, { type Sharp } from 'sharp';
import type { Plugin } from 'vite';
import { CONFIG, type Config } from '../src/config';
import { ASPECT, inkIndex, renderWallpaper } from '../src/wallpaper/render';

// Repeat width in px. Covers 2× desktops; ~0.9× of the largest 3× phone need.
export const BAKE_WIDTH = 1400;

async function render(c: Config, width: number): Promise<() => Sharp> {
  const height = Math.round(width * ASPECT);
  const scan = await sharp('src/wallpaper/scan.webp').resize(width, height, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
  const inks = await sharp('src/wallpaper/inks.png').resize(width, height, { kernel: 'nearest' }).greyscale().raw().toBuffer();
  const pxPerCss = width / (c.WALLPAPER_ZOOM * c.TILE_MAX_PX); // pebbles match the live render at full tile size
  const rgba = renderWallpaper(c, new Uint8ClampedArray(scan), inkIndex(inks, 1), width, height, pxPerCss);
  return () => sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), { raw: { width, height, channels: 4 } }).removeAlpha();
}

// Encodings, best first. AVIF keeps the print grain and the outline ink at half WebP's size (WebP's
// colour subsampling smears both); WebP for Safari on macOS before Ventura, which has no AVIF.
const FORMATS = {
  avif: (s: Sharp) => s.avif({ quality: 50, effort: 6 }),
  webp: (s: Sharp) => s.webp({ quality: 82 }),
};

export async function bakeWallpaper(c: Config = CONFIG, width = BAKE_WIDTH, format: keyof typeof FORMATS = 'avif'): Promise<Buffer> {
  return FORMATS[format]((await render(c, width))()).toBuffer();
}

const ID = 'virtual:wallpaper';
const RESOLVED = '\0' + ID;

export function wallpaperBake(): Plugin {
  let serve = false;
  return {
    name: 'wallpaper-bake',
    configResolved(config) {
      serve = config.command === 'serve';
    },
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    async load(id) {
      if (id !== RESOLVED) return;
      if (serve) return 'export const baked = null;';
      const image = await render(CONFIG, BAKE_WIDTH);
      const urls: string[] = [];
      for (const [ext, encode] of Object.entries(FORMATS)) {
        const source = await encode(image()).toBuffer();
        const fileName = `wallpaper-${createHash('sha1').update(source).digest('hex').slice(0, 8)}.${ext}`; // a changed bake is never served stale
        this.emitFile({ type: 'asset', fileName, source });
        urls.push(fileName);
      }
      const mean = (await image().stats()).channels.slice(0, 3).map((ch) => Math.round(ch.mean)); // shown until the pattern arrives, so it fades up without the wall changing tone
      return `export const baked = ${JSON.stringify({ urls, aspect: ASPECT, colour: `rgb(${mean.join(',')})` })};`;
    },
  };
}
