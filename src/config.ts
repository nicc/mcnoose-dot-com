// Tweakable constants. The dev panel (npm run dev) rewrites values in place on
// "save" — keep one `KEY: value,` per line so the writer can find them.
// Units: sizes are in tiles (1 = one tile edge) unless the name ends in _PX or _DEG.

export const CONFIG = {
  // Tiles
  TILE_MAX_PX: 200, // largest tile edge
  GROUT_PX: 4,
  MIN_PEEK: 0.25, // fraction of a tile always visible on each side of a full tile
  TRAILING_ROWS: 6, // blank rows after the last project row
  REFLOW_FADE_MS: 220, // crossfade when projects move tiles as columns appear/disappear
  TILE_COLOR: '#fbfbf9',
  GROUT_COLOR: '#d4d4d0',

  // Tile print: logo + title as halftone dots
  PRINT_COLOR: '#5a7fb0', // hazy transfer-print blue
  TILE_LOGO_SIZE: 0.32,
  TILE_TITLE_SIZE: 0.075,
  TILE_TITLE_GAP: 0.06,
  TILE_TITLE_FONT: 'Georgia, serif',
  TILE_TITLE_WEIGHT: 400,
  HALFTONE_PITCH_PX: 2.2, // dot spacing; fixed in CSS px so dots look the same on every screen
  HALFTONE_ANGLE_DEG: 45,
  HALFTONE_GAIN: 1.2, // ink spread: >1 fattens dots so solids close up
  HALFTONE_MIN_DOT: 0.12, // fraction of pitch; smaller dots don't print
  HALFTONE_JITTER: 0.08, // dot position wobble, fraction of pitch
  HALFTONE_NOISE: 0.15, // dot size wobble
  HALFTONE_BLUR_PX: 0.3, // ink bleed under the glaze
  HALFTONE_OPACITY: 0.85,

  // Header wallpaper
  HEADER_HEIGHT: 1.4,
  WALLPAPER_ZOOM: 2.5,
  WALLPAPER_COLOR: '#efe6cf',

  // Embroidery (framed cross-stitch on the wallpaper)
  EMBROIDERY_WIDTH: 0.92, // outer frame width
  EMBROIDERY_TEXT_SIZE: 0.102, // lettering height
  EMBROIDERY_STITCH_SIZE: 0.012, // one cross-stitch; unused until mcn-xsf
  EMBROIDERY_FLORAL_SIZE: 0.08, // corner florals
  EMBROIDERY_TILT_DEG: 3, // clockwise

  // Bull-nose row
  BULLNOSE_WIDTH: 1.25,
  BULLNOSE_HEIGHT: 0.25,
  BULLNOSE_OFFSET: 0.2, // 0–1 of a bull-nose tile: where joints fall relative to page centre

  // Skirting
  SKIRTING_HEIGHT: 0.55,
  SKIRTING_COLOR: '#f4f3ee',
};

export type Config = { -readonly [K in keyof typeof CONFIG]: (typeof CONFIG)[K] };
