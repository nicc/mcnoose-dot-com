import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { initialAnchor } from '../layout';
import { wallPlan } from '../plan';
import { rng } from '../wood/noise';
import { drawingMs, releaseAt, sketch } from './strokes';

const view = { width: 1440, height: 900 };
const anchor = initialAnchor({ ...view, tileMax: CONFIG.TILE_MAX_PX, grout: CONFIG.GROUT_PX, minPeek: CONFIG.MIN_PEEK });
const plan = wallPlan(CONFIG, anchor, 0, 8, view.width);
const strokes = sketch(CONFIG, plan, view, rng(1));

describe('pencil sketch', () => {
  it('draws the frame first, then the rail, tiles and skirting', () => {
    const order = ['frame', 'rail', 'tiles', 'skirting'];
    const parts = strokes.map((s) => order.indexOf(s.part));
    expect(parts[0]).toBe(0);
    expect(parts).toEqual([...parts].sort((a, b) => a - b));
    expect(new Set(strokes.map((s) => s.part))).toEqual(new Set(['frame', 'rail', 'tiles']));
  });

  it('spreads the vertical joints out from the frame', () => {
    const verticals = strokes.filter((s) => s.part === 'tiles' && Math.abs(s.x0 - s.x1) < 2);
    const d = verticals.map((s) => Math.abs((s.x0 + s.x1) / 2 - plan.frame.x));
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1] - 2);
  });

  it('puts the frame where the scene hangs it', () => {
    const xs = strokes.filter((s) => s.part === 'frame').flatMap((s) => [s.x0, s.x1]);
    const slack = plan.frame.height * 0.03 + CONFIG.PENCIL_OVERSHOOT * anchor.tile * 9; // its tilt, and the guides' overshoot
    expect(Math.min(...xs)).toBeGreaterThan(plan.frame.x - plan.frame.width / 2 - slack);
    expect(Math.max(...xs)).toBeLessThan(plan.frame.x + plan.frame.width / 2 + slack);
  });

  it('draws nothing wholly off screen', () => {
    for (const s of strokes) expect(Math.min(s.y0, s.y1)).toBeLessThan(view.height);
  });

  it('takes a few seconds unhurried', () => {
    const ms = drawingMs(strokes);
    expect(ms).toBeGreaterThan(2000);
    expect(ms).toBeLessThan(9000);
  });

  it('draws the frame at once, the rail when the script runs, the rest as loading gets on', () => {
    const at = releaseAt(strokes);
    strokes.forEach((s, i) => expect(at[i]).toBe(s.part === 'frame' ? -1 : s.part === 'rail' ? 0 : at[i]));
    const rest = at.filter((x) => x > 0);
    expect(rest).toEqual([...rest].sort((a, b) => a - b));
    expect(rest.at(-1)).toBe(1);
    expect(rest[0]).toBeLessThan(0.2);
  });
});
