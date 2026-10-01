// Tweakable constants. The dev panel (npm run dev) rewrites values in place on
// "save" — keep one `KEY: value,` per line so the writer can find them.
// Units: px unless the name says otherwise; *_TILES = multiples of tile size.

export const CONFIG = {
  // Tiles
  TILE_MAX: 400, // px, largest tile edge
  GROUT: 4, // px
  MIN_PEEK: 0.25, // fraction of a tile always visible on each side of a full tile
  TRAILING_ROWS: 6, // blank rows after the last project row
  TILE_COLOR: '#fbfbf9',
  GROUT_COLOR: '#d4d4d0',
  PRINT_COLOR: '#5a7fb0', // hazy transfer-print blue

  // Header / wallpaper
  HEADER_HEIGHT_TILES: 1,
  WALLPAPER_ZOOM: 1,
  WALLPAPER_COLOR: '#efe6cf',
  FRAME_WIDTH_TILES: 0.7,
  FRAME_TILT_DEG: 10, // clockwise

  // Bull-nose row
  BULLNOSE_WIDTH_RATIO: 1.6, // of tile width
  BULLNOSE_HEIGHT_RATIO: 0.5, // of tile height
  BULLNOSE_OFFSET: 0.37, // 0–1, where the joint pattern falls relative to page centre

  // Skirting
  SKIRTING_HEIGHT_TILES: 0.55,
  SKIRTING_COLOR: '#f4f3ee',
};

export type Config = { -readonly [K in keyof typeof CONFIG]: (typeof CONFIG)[K] };
