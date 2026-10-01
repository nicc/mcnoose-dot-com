import { describe, expect, it } from 'vitest';
import type { Light } from '../room';
import { edgeShadows, roundedTop, tileTone, wallPoint } from './surface';

describe('wallPoint', () => {
  const m = { pxPerCm: 10, embroidery: { x: 130, y: 132 }, embroideryPage: { x: 700, y: 200 } };
  it('maps page px to wall cm around the embroidery', () => {
    expect(wallPoint(m, { x: 700, y: 200 })).toEqual({ x: 130, y: 132 });
    expect(wallPoint(m, { x: 800, y: 700 })).toEqual({ x: 140, y: 82 }); // right and lower down the wall
  });
});

describe('tileTone', () => {
  it('varies per tile, deterministically, within the amount', () => {
    const a = tileTone([250, 250, 248], 0.03, 1, 2);
    expect(a).toBe(tileTone([250, 250, 248], 0.03, 1, 2));
    expect(a).not.toBe(tileTone([250, 250, 248], 0.03, 2, 2));
    expect(tileTone([250, 250, 248], 0, 5, 5)).toBe('rgb(250,250,248)');
  });
});

describe('edgeShadows', () => {
  const style = { edgePx: 5, sheen: 0.6, recessPx: 2, recess: 0.5 };
  const fromLeft: Light = { dir: [-0.6, 0, 0.8], weight: 1 };

  it('highlights the rim facing the light and casts the grout shadow away from it', () => {
    const s = edgeShadows([fromLeft], style);
    expect(s).toMatch(/inset 5\.00px 0\.00px [\d.]+px rgba\(255,255,255/); // left rim lit (positive x offset)
    expect(s).toMatch(/inset -5\.00px 0\.00px [\d.]+px rgba\(0,0,0/); // right rim shaded
    expect(s).toMatch(/(^|, )1\.50px 0\.00px/); // cast shadow falls right
  });

  it('flattens rim contrast under frontal light', () => {
    const alpha = (s: string) => Number(s.match(/inset [-\d.]+px [-\d.]+px [\d.]+px rgba\(255,255,255,([\d.]+)\)/)![1]);
    const frontal = edgeShadows([{ dir: [-0.05, 0, 0.999], weight: 1 }], style);
    expect(alpha(frontal)).toBeLessThan(alpha(edgeShadows([fromLeft], style)));
  });
});

describe('roundedTop', () => {
  it('shades the curve, tucks a shadow into the top corner, and eases out to nothing at the face', () => {
    const g = roundedTop([{ dir: [0, -0.8, 0.6], weight: 1 }], 10);
    expect(g).toMatch(/^linear-gradient\(to bottom, rgba\(0,0,0,0\.16\) 0px/);
    expect(g).toMatch(/rgba\([\d,]+,0\.00\) 10\.00px\)$/);
  });
});
