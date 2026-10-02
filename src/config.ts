// Tweakable constants. The dev panel (npm run dev) rewrites values in place on
// "save" — keep one `KEY: value,` per line so the writer can find them.
// Units: sizes are in tiles (1 = one tile edge) unless the name ends in _PX or _DEG.

export const CONFIG = {
  // Layout
  TILE_MAX_PX: 150, // largest tile edge
  GROUT_PX: 4,
  MIN_PEEK: 0.25, // fraction of a tile always visible on each side of a full tile
  TRAILING_ROWS: 6, // blank rows after the last project row
  REFLOW_FADE_MS: 220, // crossfade when projects move tiles as columns appear/disappear
  PIN_SMOOTH_MS: 35, // screen pinning: easing as the window moves

  // Room & light (cm): one physical scene for every surface's light and reflections. Daylight
  // comes from a window on the wall behind the viewer; a ceiling light fills from above. x is
  // measured from the left wall as you face the embroidery. Water marks share one droplet size.
  ROOM_TILE_CM: 15, // real tile edge: sets the px ↔ cm scale
  ROOM_WIDTH_CM: 220,
  ROOM_DEPTH_CM: 260, // embroidery wall to window wall
  ROOM_CEILING_CM: 240,
  ROOM_EYE_CM: 168, // a 180cm viewer, standing
  ROOM_VIEW_CM: 150, // how far from the wall the viewer stands
  ROOM_EMBROIDERY_X_CM: 130,
  ROOM_EMBROIDERY_Y_CM: 132, // sternum height
  ROOM_WINDOW_X_CM: 90, // window centre
  ROOM_WINDOW_BOTTOM_CM: 80, // sill
  ROOM_WINDOW_WIDTH_CM: 70,
  ROOM_WINDOW_HEIGHT_CM: 110,
  ROOM_FILL: 0.35, // ceiling light strength relative to the window
  ROOM_BOUNCE: 0.25, // daylight bounced up off the floor: lifts undersides
  ROOM_EYE_FOLLOW: 0.67, // how far the eye moves down the wall as you scroll: 1 = like a camera; drives all reflections
  ROOM_WALL_COLOR: '#beae90', // walls reflected in the tiles
  ROOM_CEILING_COLOR: '#f1efe9',
  ROOM_FLOOR_COLOR: '#9d624d',
  DUST_SHADE: 0.64, // dust grey everywhere in the room: 0 dark → 1 light
  WATER_SPOT_SIZE: 0.008, // droplet radius, in tiles

  // Wallpaper (header) and its seam with the tiles. Ink colours default to the 1875 scan's own.
  HEADER_HEIGHT: 2,
  WALLPAPER_ZOOM: 2, // pattern repeat width, in tiles (~32cm at real scale)
  WALLPAPER_GROUND: '#beb091', // ink: ground
  WALLPAPER_FOLIAGE: '#a3a28d', // ink: foliage
  WALLPAPER_VINE: '#9bb0a1', // ink: vine
  WALLPAPER_PETAL: '#c1ab83', // ink: petal
  WALLPAPER_BERRY: '#a68d6e', // ink: berry
  WALLPAPER_OUTLINE: '#817462', // ink: outline
  WALLPAPER_RELIEF: 0.62, // pebble emboss depth
  WALLPAPER_PEBBLE_PX: 3, // pebble size
  WALLPAPER_INK_RELIEF: 0.25, // how proud printed inks sit above the ground
  WALLPAPER_AMBIENT: 0.75, // how dark shadowed slopes get (1 = no shadow)
  WALLPAPER_SHEEN: 0.1, // satin highlight
  SEAM_SHADOW: 0.28, // contact shadow on the paper where it meets the tiles
  SEAM_SHADOW_CM: 0.27, // … and how far up the paper it reaches
  SEAM_LINE: 1.5, // the joint line between paper and tile

  // Embroidery (framed cross-stitch on the wallpaper). Hand-charted: stitch size scales the piece.
  EMBROIDERY_STITCH_SIZE: 0.06, // one cross-stitch, in tiles: sets the detail
  EMBROIDERY_ZOOM: 0.38, // scales the finished framed piece; < 1 shrinks a detailed render
  EMBROIDERY_CLOTH_W: 76, // cloth size in stitches; florals stay in the corners
  EMBROIDERY_CLOTH_H: 53,
  EMBROIDERY_FRAME: 0.2, // moulding width
  EMBROIDERY_TILT_DEG: 1, // clockwise
  EMBROIDERY_STANDOFF_CM: 2, // how far the frame sits off the wall: sets its cast shadows
  EMBROIDERY_DUST_TOP: 1.28, // dust on the frame's upper moulding
  EMBROIDERY_DUST_INNER: 1.46, // dust on the inner bottom lip, against the glass
  EMBROIDERY_CLOTH: '#f6f3ea',
  EMBROIDERY_THREAD: '#2f4f8f', // blue lettering
  EMBROIDERY_PETAL: '#e8a283', // peach
  EMBROIDERY_LEAF: '#3f9c94', // teal

  // Embroidery: oak frame
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
  EMBROIDERY_WOOD_WEAR: 0.15, // finish rubbed off raised edges
  EMBROIDERY_WOOD_GRIME: 0.25, // dirt in hollows and corner joints
  EMBROIDERY_WOOD_PATCHES: 0.5, // how unevenly wear and grime vary along each board

  // Embroidery: glass over the cloth
  EMBROIDERY_GLASS_TINT: 0.45, // slight green colour cast
  EMBROIDERY_GLASS_REFLECTION: 0.24, // crisp window reflection
  EMBROIDERY_GLASS_SPOTS: 0.18, // dried water spots

  // Dado rail: painted wooden trim capping the tiles. Geometry in cm.
  RAIL_COLOR: '#bfb093',
  RAIL_DEPTH_CM: 1.95, // how far it stands off the wall
  RAIL_ROUND_CM: 1.35, // rounded top, falling back to the wall
  RAIL_BEAD_CM: 0.6, // routed bead below the round
  RAIL_COVE_CM: 0.3, // cove stepping back to the face
  RAIL_FLAT_CM: 1.3, // flat face: extends the rail's height
  RAIL_WEAR: 0.28, // chipped paint on the raised edges
  RAIL_GRIME: 0.36, // dirt in the routing
  RAIL_DUST: 0.45, // dust settled along the top
  RAIL_SHADOW: 0.6, // shadow it casts onto the top row of tiles

  // Paint: shared by every painted surface (rail, skirting)
  PAINT_GRAIN: 0.36, // wood grain telegraphing through the paint
  PAINT_BRUSH: 0.49, // brush-stroke ridges
  PAINT_BUILDUP: 0.85, // layers of old paint softening the routing
  PAINT_YELLOWING: 0.31, // aged oil paint, most in the recesses
  PAINT_SHEEN: 0.26, // satin highlight: catches on the curved top and bead, not the flat face
  PAINT_GLOSS: 0.63, // highlight tightness

  // Tiles: glaze
  TILE_COLOR: '#f1efe9', // warm white glaze, a little below pure white so rims can catch the light
  TILE_TONE: 0.012, // glaze tone variation between tiles
  TILE_EDGE_CM: 0.35, // cushion edge radius
  TILE_EDGE_SHEEN: 0.6, // highlight on rims facing a light

  // Tiles: the room reflected in the glaze
  TILE_REFLECTION: 0.06, // how strongly the room shows in the glaze
  TILE_TILT_DEG: 1.5, // tiles sit at slightly different angles, breaking reflections at the grout
  TILE_WAVINESS: 0.89, // glaze undulation: reflections wobble softly within a tile

  // Tiles: ageing (crazing, dried water marks)
  TILE_CRAZING: 0.3, // hairline crack network in the old glaze
  TILE_SPOTS: 0.12, // dried water marks on tiles high up
  TILE_SPOTS_LOW: 0.6, // … and on the bottom row
  TILE_LIMESCALE: 0.7, // limescale reached on the bottom row
  TILE_GRIME_ROWS: 5, // how many rows up from the skirting the marks build

  // Grout: colour, recess and age
  GROUT_COLOR: '#cbcbcb',
  GROUT_RECESS: 0.93, // shadow tiles cast onto the recessed grout
  GROUT_EDGE_CM: 0.1, // the fine caulked joints against the rail and the skirting
  GROUT_AGE: 0.35, // uneven yellowing/greying per joint
  GROUT_GRIME: 0.48, // dirt: more in horizontal joints and low down
  GROUT_MOULD: 0.3, // dark spots at crossings, low down
  GROUT_LIMESCALE: 0.55, // whitish crust along low horizontal joints
  GROUT_EROSION: 0.55, // worn edges, crumbled crossings, soft pitting
  GROUT_CRACKS: 0.63, // the odd hairline crack

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

  // Skirting: painted board along the floor (the page ends with it). Geometry in cm.
  SKIRTING_COLOR: '#bfb093', // same paint as the rail
  SKIRTING_DEPTH_CM: 0.75, // board thickness at the round; beyond ~1.9 its top shows as a ledge above the round
  SKIRTING_TORUS_CM: 1.9, // diameter of the round along the top
  SKIRTING_RELIEF_CM: 0.3, // how far the round stands proud of the face: small = a lip, half the torus = a full half-round
  SKIRTING_FLAT_CM: 10.7, // face height down to the floor
  SKIRTING_WEAR: 0.28, // chipped paint on the torus
  SKIRTING_GRIME: 0.28, // dirt in the groove
  SKIRTING_SCUFFS: 0.51, // rub line, shoe scuffs and chips on the face
  SKIRTING_SCUFF_LOW: 0.65, // 1 = scuffs and chips hug the floor; 0 = kicks and knocks all over the face
  SKIRTING_DUST: 0.75, // dust along the top

  // Work-in-progress notice, shown once per browser
  NOTICE_COLOR: '#f7f1e3', // soft cream card
  NOTICE_INK: '#4a4237',
};

export type Config = { -readonly [K in keyof typeof CONFIG]: (typeof CONFIG)[K] };
