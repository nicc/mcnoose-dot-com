// The scene's single light. Every surface derives its shading from this (with WALLPAPER_LIGHT_DEG
// as the direction it comes from), so the page reads as one room.
export const LIGHT_ELEVATION_DEG = 55; // room light from above, not raking
export const AMBIENT = 0.6; // how dark faces turned from the light get, for surfaces without their own control

// Unit vector towards the light, screen coords (x right, y down, z towards the viewer).
export function lightVector(lightDeg: number): [number, number, number] {
  const a = (lightDeg * Math.PI) / 180, e = (LIGHT_ELEVATION_DEG * Math.PI) / 180;
  return [Math.cos(a) * Math.cos(e), -Math.sin(a) * Math.cos(e), Math.sin(e)];
}
