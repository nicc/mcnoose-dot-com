import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { ASPECT } from '../src/wallpaper/render';
import { bakeWallpaper } from './wallpaper-bake';

describe('bakeWallpaper', () => {
  it('renders a webp repeat at the requested width, recoloured by config', async () => {
    const meta = await sharp(await bakeWallpaper(CONFIG, 200)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 200, Math.round(200 * ASPECT)]);

    const mean = async (c: typeof CONFIG) => (await sharp(await bakeWallpaper(c, 200)).stats()).channels.map((ch) => ch.mean);
    const red = await mean({ ...CONFIG, WALLPAPER_GROUND: '#ff0000' });
    const original = await mean(CONFIG);
    expect(red[0] - original[0]).toBeGreaterThan(20); // ground is most of the sheet
  });
});
