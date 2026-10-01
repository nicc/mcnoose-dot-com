import { describe, expect, it } from 'vitest';
import { parallaxOffset } from './reflection';

describe('parallaxOffset', () => {
  it('slides the reflection with the eye: opposite to the surface moving on screen', () => {
    expect(parallaxOffset([0, -100], 0.5, 0, 1000)).toEqual([0, 50]); // scrolled down: surface moved up
    expect(parallaxOffset([40, 0], 0.5, 0, 1000)[0]).toBeCloseTo(-20);
  });

  it('is still at amount 0 and clamped to the margin', () => {
    expect(parallaxOffset([300, 300], 0, 0, 50).map(Math.abs)).toEqual([0, 0]);
    expect(parallaxOffset([0, -1000], 1, 0, 50)).toEqual([0, 50]);
  });

  it('rotates into a tilted surface', () => {
    const [x, y] = parallaxOffset([0, -100], 1, 90, 1000);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(0);
  });
});
