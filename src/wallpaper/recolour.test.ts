import { describe, expect, it } from 'vitest';
import { recolour, type RGB } from './recolour';

const scan = () => Uint8ClampedArray.from([100, 100, 100, 255, 102, 98, 101, 255, 200, 50, 50, 255, 198, 52, 49, 255]);
const index = Uint8Array.from([0, 0, 1, 1]);
const original: RGB[] = [[100, 100, 100], [200, 50, 50]];

describe('recolour', () => {
  it('leaves the scan untouched when targets equal the original inks', () => {
    expect(recolour(scan(), index, 4, 1, original, original, 0)).toEqual(scan());
  });

  it('shifts each ink by its own delta, keeping per-pixel variation', () => {
    const out = recolour(scan(), index, 4, 1, original, [[110, 100, 90], [200, 50, 50]], 0);
    expect([...out.slice(0, 8)]).toEqual([110, 100, 90, 255, 112, 98, 91, 255]); // grain kept
    expect([...out.slice(8)]).toEqual([...scan().slice(8)]); // other ink unchanged
  });
});
