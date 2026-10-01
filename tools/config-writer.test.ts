import { describe, expect, it } from 'vitest';
import { rewriteConfig } from './config-writer';

const src = `export const CONFIG = {
  TILE_MAX: 400, // px
  MIN_PEEK: 0.25,
  GROUT_COLOR: '#d4d4d0',
};`;

describe('rewriteConfig', () => {
  it('replaces values and keeps comments', () => {
    const out = rewriteConfig(src, { TILE_MAX: 360, MIN_PEEK: 0.3000000004, GROUT_COLOR: '#cccccc' });
    expect(out).toContain('TILE_MAX: 360, // px');
    expect(out).toContain('MIN_PEEK: 0.3,');
    expect(out).toContain("GROUT_COLOR: '#cccccc',");
  });

  it('throws on unknown keys', () => {
    expect(() => rewriteConfig(src, { NOPE: 1 })).toThrow('NOPE');
  });
});
