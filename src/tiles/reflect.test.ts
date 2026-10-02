import { describe, expect, it } from 'vitest';
import type { Room } from '../room';
import { reflectTile, roomColour, tileTilt, type RoomLook } from './reflect';

const room: Room = {
  tileCm: 15, widthCm: 220, depthCm: 260, ceilingCm: 240, eyeCm: 168, viewCm: 150,
  embroidery: { x: 130, y: 132 },
  window: { x: 90, bottom: 80, width: 70, height: 110 },
  fill: 0.35,
};
const look: RoomLook = {
  wall: [200, 190, 170], ceiling: [240, 240, 235], floor: [120, 115, 105],
  sky: [[210, 225, 240], [235, 240, 244]], sash: [215, 215, 210],
};

describe('roomColour', () => {
  it('sees the floor when looking down and out', () => {
    expect(roomColour(room, look, [10, 50, 0], [0, -1, 1])).toEqual(look.floor);
  });

  it('sees the window pane straight across at its height, and the sash at its edge', () => {
    expect(roomColour(room, look, [70, 110, 0], [0, 0, 1])[2]).toBeGreaterThan(235); // lower-left pane: sky
    expect(roomColour(room, look, [90 - 35 + 1, 140, 0], [0, 0, 1])).toEqual(look.sash);
  });

  it('sees the ceiling looking up', () => {
    expect(roomColour(room, look, [100, 200, 0], [0, 1, 0.2])).toEqual(look.ceiling);
  });
});

describe('reflectTile', () => {
  const tile = { centre: { x: 130, y: 60 }, wCm: 15, hCm: 15, tiltDeg: 0, waviness: 0, strength: 0.2, seed: 3 };
  const eye: [number, number, number] = [130, 168, 150];

  it('a low tile reflects the floor, and more strongly than a tile at eye level (Fresnel)', () => {
    const low = reflectTile(room, look, { ...tile, centre: { x: 130, y: 10 } }, eye, 4); // near the floor: glancing
    const level = reflectTile(room, look, { ...tile, centre: { x: 130, y: 168 } }, eye, 4);
    expect([low[0], low[1], low[2]]).toEqual(look.floor);
    expect(low[3]).toBeGreaterThan(level[3]);
  });

  it('tilts differ per tile and are bounded', () => {
    const [a, b] = tileTilt(1, 0.6), [c] = tileTilt(2, 0.6);
    expect(a).not.toBe(c);
    for (const v of [a, b]) expect(Math.abs(v)).toBeLessThanOrEqual((0.6 * Math.PI) / 180);
  });

  it('a tilted tile reflects a different part of the room', () => {
    const high = { ...tile, centre: { x: 130, y: 120 } }; // sees the wall/window region, where tilt shows
    expect(reflectTile(room, look, { ...high, tiltDeg: 6 }, eye, 6)).not.toEqual(reflectTile(room, look, high, eye, 6));
  });
});
