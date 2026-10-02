import { describe, expect, it } from 'vitest';
import { blendedLight, lightsAt, parallaxFactor, reflectedWindow, viewAt, type Room } from './room';

const room: Room = {
  tileCm: 15, widthCm: 220, depthCm: 260, ceilingCm: 240, eyeCm: 168, viewCm: 150,
  embroidery: { x: 130, y: 132 },
  window: { x: 90, bottom: 80, width: 70, height: 110 },
  sun: 1,
  fill: 0.35,
  bounce: 0.25,
};

describe('lights', () => {
  it('window light comes from in front (behind the viewer), the left, about level', () => {
    const [win] = lightsAt(room, room.embroidery);
    expect(win.dir[2]).toBeGreaterThan(0.9); // mostly frontal
    expect(win.dir[0]).toBeLessThan(0); // from the left
    expect(Math.abs(win.dir[1])).toBeLessThan(0.1); // window centre ≈ embroidery height
  });

  it('ceiling fill comes from above and is weaker', () => {
    const [, ceiling] = lightsAt(room, room.embroidery);
    expect(ceiling.dir[1]).toBeLessThan(-0.5); // screen y up = negative
    expect(ceiling.weight).toBe(0.35);
  });

  it('lower points on the wall see the window from more steeply above', () => {
    expect(lightsAt(room, { x: 130, y: 30 })[0].dir[1]).toBeLessThan(lightsAt(room, room.embroidery)[0].dir[1]);
  });

  it('blends to a unit vector', () => {
    expect(Math.hypot(...blendedLight(lightsAt(room, room.embroidery)))).toBeCloseTo(1);
  });
});

describe('reflection', () => {
  it("puts a low window's sill on the glass, left of centre", () => {
    const r = reflectedWindow(room);
    expect(r.y0).toBeGreaterThan(124); // sill reflects inside the embroidery's height (≈124–140cm)…
    expect(r.y0).toBeLessThan(140);
    expect(r.x1).toBeLessThan(room.embroidery.x); // …and to the left of its centre
  });

  it('cannot show a window whose sill is 20cm below sternum, from standing eye height', () => {
    const r = reflectedWindow({ ...room, viewCm: 120, window: { ...room.window, bottom: 112 } });
    expect(r.y0).toBeGreaterThan(140); // above the frame: the physics behind choosing a lower window
  });

  it("moves about two-thirds of the eye's movement", () => {
    expect(parallaxFactor(room)).toBeCloseTo(260 / 410);
  });
});

describe('viewAt', () => {
  it('points up towards the eye from below it, mostly out of the wall', () => {
    const [x, y, z] = viewAt(room, { x: 130, y: 120 });
    expect(x).toBeCloseTo(0);
    expect(y).toBeLessThan(-0.2); // screen up
    expect(z).toBeGreaterThan(0.9);
  });
});
