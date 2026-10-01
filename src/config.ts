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

  // Screen pinning (desktop): smooths the wall's correction while the window moves
  PIN_SMOOTH_MS: 35, // easing time constant
  TILE_COLOR: '#fbfbf9',
  GROUT_COLOR: '#d4d4d0',

  // Tile print: logo + title as halftone dots
  PRINT_COLOR: '#26c1ed', // hazy transfer-print blue
  TILE_LOGO_SIZE: 0.32,
  TILE_TITLE_SIZE: 0.075,
  TILE_TITLE_GAP: 0.06,
  TILE_TITLE_FONT: 'Georgia, serif',
  TILE_TITLE_WEIGHT: 900,
  HALFTONE_PITCH_PX: 0.6, // dot spacing; fixed in CSS px so dots look the same on every screen
  HALFTONE_ANGLE_DEG: 76.5,
  HALFTONE_GAIN: 1.27, // ink spread: >1 fattens dots so solids close up
  HALFTONE_MIN_DOT: 0, // fraction of pitch; smaller dots don't print
  HALFTONE_JITTER: 0.09, // dot position wobble, fraction of pitch
  HALFTONE_NOISE: 0.09, // dot size wobble
  HALFTONE_BLUR_PX: 0.4, // ink bleed under the glaze
  HALFTONE_OPACITY: 0.8,

  // Header wallpaper
  HEADER_HEIGHT: 1.4,
  WALLPAPER_ZOOM: 2, // pattern repeat width, in tiles (~32cm at real scale)
  // Ink colours (defaults: the 1875 scan's own)
  WALLPAPER_GROUND: '#beb091', // ink: ground
  WALLPAPER_FOLIAGE: '#a3a28d', // ink: foliage
  WALLPAPER_VINE: '#9bb0a1', // ink: vine
  WALLPAPER_PETAL: '#c1ab83', // ink: petal
  WALLPAPER_BERRY: '#a68d6e', // ink: berry
  WALLPAPER_OUTLINE: '#817462', // ink: outline
  WALLPAPER_RELIEF: 0.62, // pebble emboss depth
  WALLPAPER_PEBBLE_PX: 3, // pebble size
  WALLPAPER_INK_RELIEF: 0.25, // how proud printed inks sit above the ground
  WALLPAPER_LIGHT_DEG: 125, // direction light comes from: 90 = above, 180 = left
  WALLPAPER_AMBIENT: 0.75, // how dark shadowed slopes get (1 = no shadow)
  WALLPAPER_SHEEN: 0.1, // satin highlight

  // Embroidery (framed cross-stitch on the wallpaper). Hand-charted: stitch size scales the piece.
  EMBROIDERY_STITCH_SIZE: 0.06, // one cross-stitch, in tiles: sets the detail
  EMBROIDERY_ZOOM: 0.29, // scales the finished framed piece; < 1 shrinks a detailed render
  EMBROIDERY_CLOTH_W: 76, // cloth size in stitches; florals stay in the corners
  EMBROIDERY_CLOTH_H: 53,
  EMBROIDERY_FRAME: 0.2, // moulding width
  EMBROIDERY_TILT_DEG: 3, // clockwise
  EMBROIDERY_SHADOW: 0.012, // cast-shadow distance, away from WALLPAPER_LIGHT_DEG
  EMBROIDERY_CLOTH: '#f6f3ea',
  EMBROIDERY_THREAD: '#2f4f8f', // blue lettering
  EMBROIDERY_PETAL: '#e8a283', // peach
  EMBROIDERY_LEAF: '#3f9c94', // teal
  // Oak frame
  EMBROIDERY_WOOD: '#613e27', // base colour
  EMBROIDERY_WOOD_LATE: '#2c1a0d', // growth-ring colour
  EMBROIDERY_WOOD_RINGS: 0.025, // ring spacing, in tiles (before EMBROIDERY_ZOOM)
  EMBROIDERY_WOOD_FIGURE: 0.6, // how strongly rings arch (cathedral figure)
  EMBROIDERY_WOOD_PORES: 0.5, // open-pore flecks
  EMBROIDERY_WOOD_DRIFT: 0.4, // colour variation along each board
  EMBROIDERY_WOOD_VARIATION: 0.2, // tone difference between the four boards
  EMBROIDERY_WOOD_DEPTH: 0.35, // moulding profile depth
  EMBROIDERY_WOOD_SHEEN: 0.5, // finish highlight strength, broken up by the grain
  EMBROIDERY_WOOD_GLOSS: 0.44, // highlight tightness

  // Bull-nose row
  BULLNOSE_WIDTH: 1.25,
  BULLNOSE_HEIGHT: 0.25,
  BULLNOSE_OFFSET: 0.2, // 0–1 of a bull-nose tile: where joints fall relative to page centre

  // Skirting
  SKIRTING_HEIGHT: 0.55,
  SKIRTING_COLOR: '#f4f3ee',
};

export type Config = { -readonly [K in keyof typeof CONFIG]: (typeof CONFIG)[K] };
