// Build-time wallpaper: renders the final tile once with config.ts values and serves it as
// `virtual:wallpaper`, so production does no wallpaper compute. In dev the module is null and
// the page renders live (src/wallpaper/index.ts) so panel changes show instantly.
import sharp from 'sharp';
import type { Plugin } from 'vite';
import { CONFIG, type Config } from '../src/config';
import { ASPECT, inkIndex, renderWallpaper } from '../src/wallpaper/render';

// Repeat width in px. Covers 2× desktops; ~0.9× of the largest 3× phone need.
export const BAKE_WIDTH = 1400;

export async function bakeWallpaper(c: Config = CONFIG, width = BAKE_WIDTH): Promise<Buffer> {
  const height = Math.round(width * ASPECT);
  const scan = await sharp('src/wallpaper/scan.webp').resize(width, height, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
  const inks = await sharp('src/wallpaper/inks.png').resize(width, height, { kernel: 'nearest' }).greyscale().raw().toBuffer();
  const pxPerCss = width / (c.WALLPAPER_ZOOM * c.TILE_MAX_PX); // pebbles match the live render at full tile size
  const rgba = renderWallpaper(c, new Uint8ClampedArray(scan), inkIndex(inks, 1), width, height, pxPerCss);
  return sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), { raw: { width, height, channels: 4 } })
    .removeAlpha()
    .webp({ quality: 82 })
    .toBuffer();
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
      const webp = await bakeWallpaper();
      return `export const baked = ${JSON.stringify({ url: `data:image/webp;base64,${webp.toString('base64')}`, aspect: ASPECT })};`;
    },
  };
}
