import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { configWriter } from './tools/config-writer';

export default defineConfig({
  plugins: [viteSingleFile(), configWriter()],
  test: { include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
});
