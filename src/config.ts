// Tweakable constants. The dev panel (npm run dev) rewrites values in place on
// "save" — keep one `KEY: value,` per line so the writer can find them.
// Units: px unless the name says otherwise; *_TILES = multiples of tile size.

export const CONFIG = {
  // Tiles
  TILE_MAX: 250, // px, largest tile edge
  GROUT: 4, // px
  MIN_PEEK: 0.25, // fraction of a tile always visible on each side of a full tile
  TRAILING_ROWS: 6, // blank rows after the last project row
  TILE_COLOR: '#fbfbf9',
  GROUT_COLOR: '#d4d4d0',
  PRINT_COLOR: '#5a7fb0', // hazy transfer-print blue

  // Header / wallpaper
  HEADER_HEIGHT_TILES: 1.3,
  WALLPAPER_ZOOM: 2.5,
  WALLPAPER_COLOR: '#efe6cf',
  FRAME_WIDTH_TILES: 0.7,
  STITCH_TEXT_TILES: 0.084, // embroidered lettering height
  STITCH_SIZE_TILES: 0.012, // one cross-stitch; unused until mcn-xsf
  ACCENT_SIZE_TILES: 0.11, // corner florals
  FRAME_TILT_DEG: 3, // clockwise

  // Bull-nose row
  BULLNOSE_WIDTH_RATIO: 1.5, // of tile width
  BULLNOSE_HEIGHT_RATIO: 0.3, // of tile height
  BULLNOSE_OFFSET: 0.4, // 0–1, where the joint pattern falls relative to page centre

  // Skirting
  SKIRTING_HEIGHT_TILES: 0.55,
  SKIRTING_COLOR: '#f4f3ee',
};

export type Config = { -readonly [K in keyof typeof CONFIG]: (typeof CONFIG)[K] };
