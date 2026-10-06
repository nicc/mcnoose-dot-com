import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { configWriter } from './tools/config-writer';
import { wallpaperBake } from './tools/wallpaper-bake';

// Everything a painted trim length is drawn from, hashed: the OPFS cache of painted lengths
// (src/trim/worker.ts) is keyed by it, so a change to any of this code invalidates them.
function trimCode(): string {
  const h = createHash('sha1');
  const add = (p: string) => (statSync(p).isDirectory() ? readdirSync(p).sort().forEach((f) => add(join(p, f))) : /\.test\.ts$/.test(p) || h.update(readFileSync(p)));
  for (const p of ['src/trim', 'src/wood', 'src/colour.ts', 'src/room.ts']) add(p);
  return h.digest('hex').slice(0, 12);
}

export default defineConfig({
  define: { __TRIM_CODE__: JSON.stringify(trimCode()) },
  plugins: [viteSingleFile(), configWriter(), wallpaperBake()],
  test: { include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
});
