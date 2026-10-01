// Tweakable constants. The dev panel (npm run dev) rewrites values in place on
// "save" — keep one `KEY: value,` per line so the writer can find them.
// Units: sizes are in tiles (1 = one tile edge) unless the name ends in _PX or _DEG.

export const CONFIG = {
  // Tiles
  TILE_MAX_PX: 250, // largest tile edge
  GROUT_PX: 4,
  MIN_PEEK: 0.25, // fraction of a tile always visible on each side of a full tile
  TRAILING_ROWS: 6, // blank rows after the last project row
  TILE_COLOR: '#fbfbf9',
  GROUT_COLOR: '#d4d4d0',
  PRINT_COLOR: '#5a7fb0', // hazy transfer-print blue

  // Header wallpaper
  HEADER_HEIGHT: 1.3,
  WALLPAPER_ZOOM: 2.5,
  WALLPAPER_COLOR: '#efe6cf',

  // Embroidery (framed cross-stitch on the wallpaper)
  EMBROIDERY_WIDTH: 0.7, // outer frame width
  EMBROIDERY_TEXT_SIZE: 0.084, // lettering height
  EMBROIDERY_STITCH_SIZE: 0.012, // one cross-stitch; unused until mcn-xsf
  EMBROIDERY_FLORAL_SIZE: 0.11, // corner florals
  EMBROIDERY_TILT_DEG: 3, // clockwise

  // Bull-nose row
  BULLNOSE_WIDTH: 1.5,
  BULLNOSE_HEIGHT: 0.3,
  BULLNOSE_OFFSET: 0.4, // 0–1 of a bull-nose tile: where joints fall relative to page centre

  // Skirting
  SKIRTING_HEIGHT: 0.55,
  SKIRTING_COLOR: '#f4f3ee',
};

export type Config = { -readonly [K in keyof typeof CONFIG]: (typeof CONFIG)[K] };
