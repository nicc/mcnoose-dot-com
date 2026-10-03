import { describe, expect, it } from 'vitest';
import { CONFIG } from './config';
import { skyAt } from './sunset';

const c = { ...CONFIG, SUNSET: true, SUNSET_DELAY_S: 10, SUNSET_MINUTES: 1, ROOM_LIGHT_KELVIN: 6500, SUNSET_KELVIN: 2500, SUNSET_KELVIN_CURVE: 2, SUNSET_DIM: 0.4, SUNSET_DIM_CURVE: 1 };

describe('sunset', () => {
  it('holds the daylight until it starts, and dusk once it has passed', () => {
    expect(skyAt(c, 5)).toMatchObject({ kelvin: 6500, dim: 0, patch: 1 });
    expect(skyAt(c, 999)).toMatchObject({ kelvin: 2500, dim: 0.4, patch: c.SUNSET_PATCH });
  });

  it('follows each channel’s curve', () => {
    const half = skyAt(c, 10 + 30);
    expect(half.dim).toBeCloseTo(0.2); // curve 1: halfway
    expect(half.kelvin).toBeCloseTo(6500 - 4000 * 0.25); // curve 2: a quarter of the way
  });

  it('stays at the daylight when it is off', () => {
    expect(skyAt({ ...c, SUNSET: false }, 999)).toMatchObject({ kelvin: 6500, dim: 0, patch: 1 });
  });
});
