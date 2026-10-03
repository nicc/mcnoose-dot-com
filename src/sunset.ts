// The sun going down: a single pass from the daylight set in ROOM_* (colour, the sun's angle, its
// patch on the wall) to dusk, then held there. Nothing is redrawn: the window light's tint warms,
// the sun patch slides up the wall (a lower sun) and across, and fades, and the room and its
// reflections dim — all layers that exist already (sunlight.ts, clouds.ts). Each channel has its
// own curve: value = start + (end − start) · progress^curve (1 = even, above 1 = holds, then goes).
import type { Config } from './config';

export interface Sky {
  kelvin: number;
  elevation: number; // degrees
  azimuth: number;
  patch: number; // the sun patch's strength, × its daylight strength
  dim: number; // 0–1 how much the room (and its reflections) has darkened
  softness: number; // cm: the sun patch's edges
  tint: number; // ROOM_LIGHT_TINT, carried so a change to it re-tints at once
}

export const progressAt = (c: Config, seconds: number) => (c.SUNSET ? Math.max(0, Math.min(1, (seconds - c.SUNSET_DELAY_S) / Math.max(1, c.SUNSET_MINUTES * 60))) : 0);

export function skyAt(c: Config, seconds: number): Sky {
  const p = progressAt(c, seconds), at = (a: number, b: number, curve: number) => a + (b - a) * p ** Math.max(0.05, curve);
  return {
    kelvin: at(c.ROOM_LIGHT_KELVIN, c.SUNSET_KELVIN, c.SUNSET_KELVIN_CURVE),
    elevation: at(c.ROOM_SUN_ELEVATION_DEG, c.SUNSET_ELEVATION_DEG, c.SUNSET_ELEVATION_CURVE),
    azimuth: at(c.ROOM_SUN_AZIMUTH_DEG, c.SUNSET_AZIMUTH_DEG, c.SUNSET_AZIMUTH_CURVE),
    patch: at(1, c.SUNSET_PATCH, c.SUNSET_PATCH_CURVE),
    dim: at(0, c.SUNSET_DIM, c.SUNSET_DIM_CURVE),
    softness: at(c.ROOM_SUN_SOFTNESS_CM, c.SUNSET_SOFTNESS_CM, c.SUNSET_SOFTNESS_CURVE),
    tint: c.ROOM_LIGHT_TINT,
  };
}
