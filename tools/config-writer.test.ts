import { describe, expect, it } from 'vitest';
import { rewriteConfig } from './config-writer';

const src = `export const CONFIG = {
  TILE_MAX: 400, // px
  MIN_PEEK: 0.25,
  GROUT_COLOR: '#d4d4d0',
  FONT: 'Georgia, serif', // note
  AFTER: 1,
};`;

describe('rewriteConfig', () => {
  it('replaces values and keeps comments', () => {
    const out = rewriteConfig(src, { TILE_MAX: 360, MIN_PEEK: 0.3000000004, GROUT_COLOR: '#cccccc' });
    expect(out).toContain('TILE_MAX: 360, // px');
    expect(out).toContain('MIN_PEEK: 0.3,');
    expect(out).toContain("GROUT_COLOR: '#cccccc',");
  });

  it('handles strings containing commas, quotes and $', () => {
    const out = rewriteConfig(src, { FONT: "Baskerville, 'Times New Roman', $1 serif", AFTER: 2 });
    expect(out).toContain("FONT: 'Baskerville, \\'Times New Roman\\', $1 serif', // note");
    expect(out).toContain('AFTER: 2,');
  });

  it('throws on unknown keys', () => {
    expect(() => rewriteConfig(src, { NOPE: 1 })).toThrow('NOPE');
  });
});
