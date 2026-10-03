// Sections of config.ts and the dev panel's folders, in order. A key goes in the first group
// whose test matches; config.ts is laid out in the same order.
export const GROUPS: [string, (key: string) => boolean][] = [
  ['Layout', (k) => ['TILE_MAX_PX', 'GROUT_PX', 'MIN_PEEK', 'TRAILING_ROWS', 'REFLOW_FADE_MS', 'PIN_SMOOTH_MS'].includes(k)],
  ['Room & light', (k) => k.startsWith('ROOM_') || k.startsWith('SUNSET') || k === 'WATER_SPOT_SIZE' || k === 'DUST_SHADE'],
  ['Wallpaper', (k) => k === 'HEADER_HEIGHT' || k.startsWith('WALLPAPER_') || k.startsWith('SEAM_') || k.startsWith('PAPER_AGE')],
  ['Embroidery: oak frame', (k) => k.startsWith('EMBROIDERY_WOOD')],
  ['Embroidery: glass', (k) => k.startsWith('EMBROIDERY_GLASS')],
  ['Embroidery', (k) => k.startsWith('EMBROIDERY_')],
  ['Embroidery: back', (k) => k.startsWith('ABOUT_')],
  ['Rail', (k) => k.startsWith('RAIL_')],
  ['Paint', (k) => k.startsWith('PAINT_')],
  ['Tiles: reflections', (k) => ['TILE_REFLECTION', 'TILE_TILT_DEG', 'TILE_WAVINESS'].includes(k)],
  ['Tiles: ageing', (k) => ['TILE_CRAZING', 'TILE_SPOTS', 'TILE_SPOTS_LOW', 'TILE_LIMESCALE', 'TILE_GRIME_ROWS'].includes(k)],
  ['Grout', (k) => k.startsWith('GROUT_')],
  ['Tile print', (k) => k.startsWith('PRINT_') || k.startsWith('TILE_LOGO') || k.startsWith('TILE_TITLE') || k.startsWith('HALFTONE_')],
  ['Tiles: glaze', (k) => k.startsWith('TILE_')],
  ['Skirting', (k) => k.startsWith('SKIRTING_')],
  ['Wiping', (k) => k.startsWith('WIPE_')],
  ['Notice', (k) => k.startsWith('NOTICE_')],
];

// Display order (config.ts follows it too). Tests match more specific groups first, so the
// order shown differs from the matching order above.
export const ORDER = [
  'Layout', 'Room & light', 'Wallpaper', 'Embroidery', 'Embroidery: oak frame', 'Embroidery: glass', 'Embroidery: back', 'Rail', 'Paint',
  'Tiles: glaze', 'Tiles: reflections', 'Tiles: ageing', 'Grout', 'Tile print', 'Skirting', 'Wiping', 'Notice', 'Other',
];

export function groupOf(key: string): string {
  return GROUPS.find(([, test]) => test(key))?.[0] ?? 'Other';
}
