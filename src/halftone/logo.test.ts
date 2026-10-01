import { describe, expect, it } from 'vitest';
import { withIntrinsicSize } from './logo';

describe('withIntrinsicSize', () => {
  it('adds width/height from the viewBox, keeping aspect', () => {
    const out = withIntrinsicSize('<svg xmlns="x" viewBox="0 0 400 100"><rect stroke-width="2"/></svg>');
    expect(out).toMatch(/<svg width="1024" height="256"/);
  });

  it('leaves sized SVGs alone and ignores stroke-width', () => {
    const sized = '<svg width="10" height="10" viewBox="0 0 1 1"></svg>';
    expect(withIntrinsicSize(sized)).toBe(sized);
    expect(withIntrinsicSize('<svg stroke-width="1" viewBox="0 0 2 2"></svg>')).toMatch(/width="1024" height="1024"/);
  });
});
