import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { configWriter } from './tools/config-writer';
import { wallpaperBake } from './tools/wallpaper-bake';

export default defineConfig({
  plugins: [viteSingleFile(), configWriter(), wallpaperBake()],
  test: { include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
});
