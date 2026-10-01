import { describe, expect, it } from 'vitest';
import { classifyInks, modeFilter, refineShift, rgbToLab, seamlessTile } from './wallpaper-prep';

describe('lattice', () => {
  it('finds a known repeat in a periodic image', () => {
    const w = 120, h = 90, period = 37;
    const data = Float32Array.from({ length: w * h }, (_, i) => Math.sin(((i % w) * 2 * Math.PI) / period) + Math.sin(Math.floor(i / w) * 0.7) * 0.1);
    expect(refineShift({ data, w, h }, [35, 0], 4).shift).toEqual([37, 0]);
  });

  it('reproduces a perfectly periodic source exactly, including in the feathered edge zones', () => {
    const w = 64, h = 64;
    const val = (x: number, y: number) => ((x % 16) * 13 + (y % 8) * 7) & 255;
    const data = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.fill(val(x, y), (y * w + x) * 3, (y * w + x) * 3 + 3);
    const t = seamlessTile({ data, w, h }, [4, 4], [16, 0], [0, 8], 16, 8, 3);
    for (let v = 0; v < 8; v++) for (let u = 0; u < 16; u++) expect(t[(v * 16 + u) * 3]).toBe(val(4 + u, 4 + v));
  });
});

describe('inks', () => {
  it('converts white and black to Lab extremes', () => {
    expect(rgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 0);
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 0);
  });

  it('separates close inks in Lab and refines their colours', () => {
    const ground: [number, number, number] = [190, 176, 144], petal: [number, number, number] = [197, 173, 133];
    const px = new Uint8Array([...ground, ...ground, ...petal, ...petal]);
    const { index, inks } = classifyInks(px, [[185, 175, 145], [200, 170, 130]]);
    expect([...index]).toEqual([0, 0, 1, 1]);
    expect(inks).toEqual([ground, petal]);
  });

  it('mode filter removes isolated speckle', () => {
    const idx = new Uint8Array(25);
    idx[12] = 1; // single flipped pixel in the middle of a 5×5
    expect(modeFilter(idx, 5, 5, 2)[12]).toBe(0);
  });

});
