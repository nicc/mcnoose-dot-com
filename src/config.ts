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
  PIN_SMOOTH_MS: 125, // screen pinning: easing as the window moves

  // Room & light (cm): one physical scene for every surface's light and reflections. Daylight
  // comes from a window on the wall behind the viewer; a ceiling light fills from above. x is
  // measured from the left wall as you face the embroidery. Water marks share one droplet size.
  ROOM_TILE_CM: 15, // real tile edge: sets the px ↔ cm scale
  ROOM_WIDTH_CM: 256,
  ROOM_DEPTH_CM: 161, // embroidery wall to window wall
  ROOM_CEILING_CM: 240,
  ROOM_EYE_CM: 175, // a 180cm viewer, standing
  ROOM_VIEW_CM: 150, // how far from the wall the viewer stands
  ROOM_EMBROIDERY_X_CM: 130,
  ROOM_EMBROIDERY_Y_CM: 132, // sternum height
  ROOM_WINDOW_X_CM: 82, // window centre
  ROOM_WINDOW_BOTTOM_CM: 83, // sill
  ROOM_WINDOW_WIDTH_CM: 74,
  ROOM_WINDOW_HEIGHT_CM: 101,
  ROOM_SUN: 1.22, // window light strength
  ROOM_LIGHT_KELVIN: 5100, // the window light's colour: 2500 golden late light … 6500 neutral … 9000 cool north sky
  ROOM_SUN_PATCH: 0.2, // direct sun throwing the window, bars and all, onto this wall (0 = none)
  ROOM_SUN_ELEVATION_DEG: 4.5, // how steeply the sun comes in: lowers the patch
  ROOM_SUN_AZIMUTH_DEG: -1, // from the side: slides the patch across
  ROOM_SUN_SOFTNESS_CM: 1.2, // the patch's edges
  ROOM_CLOUD_DEPTH: 0.13, // how far passing clouds dim the window light (0 = clear sky)
  ROOM_CLOUD_RATE_HZ: 0.3, // how often the cloud cover changes
  ROOM_CLOUD_SMOOTH: 0.63, // 0 = sudden changes, 1 = slow glides between them
  ROOM_CLOUD_BALANCE: 0.98, // where clouds show: 0 = the room dims, 0.5 = room and reflections, 1 = reflections only
  ROOM_SUN_HIDE: 0.25, // how much a cloud must dim the window light to hide the sun patch completely
  ROOM_FILL: 0.35, // ceiling light strength relative to full sun
  ROOM_BOUNCE: 0.12, // window light bounced up off the floor, as a share of it: lifts undersides
  ROOM_EYE_FOLLOW: 0.67, // how far the eye moves down the wall as you scroll: 1 = like a camera; drives all reflections
  ROOM_WALL_COLOR: '#dbc9a8', // walls reflected in the tiles
  ROOM_CEILING_COLOR: '#dadedf',
  ROOM_FLOOR_COLOR: '#dbdfe0',
  DUST_SHADE: 0.64, // dust grey everywhere in the room: 0 dark → 1 light
  WATER_SPOT_SIZE: 0.008, // droplet radius, in tiles

  // Wallpaper (header) and its seam with the tiles. Ink colours default to the 1875 scan's own.
  HEADER_HEIGHT: 2.2,
  WALLPAPER_ZOOM: 2, // pattern repeat width, in tiles (~32cm at real scale)
  WALLPAPER_GROUND: '#beb091', // ink: ground
  WALLPAPER_FOLIAGE: '#a3a28d', // ink: foliage
  WALLPAPER_VINE: '#9bb0a1', // ink: vine
  WALLPAPER_PETAL: '#c1ab83', // ink: petal
  WALLPAPER_BERRY: '#a68d6e', // ink: berry
  WALLPAPER_OUTLINE: '#817462', // ink: outline
  WALLPAPER_RELIEF: 2.21, // pebble emboss depth
  WALLPAPER_PEBBLE_PX: 1.4, // pebble size
  WALLPAPER_INK_RELIEF: 0.25, // how proud printed inks sit above the ground
  WALLPAPER_AMBIENT: 0.88, // how dark shadowed slopes get (1 = no shadow)
  WALLPAPER_SHEEN: 0.5, // satin highlight
  SEAM_SHADOW: 0.28, // contact shadow on the paper where it meets the tiles
  SEAM_SHADOW_CM: 0.27, // … and how far up the paper it reaches
  SEAM_LINE: 1.5, // the joint line between paper and tile
  PAPER_AGE: true, // the wallpaper's age, laid over the pattern without repeating
  PAPER_AGE_YELLOWING: 0.11, // uneven yellowing, heavier towards the ceiling
  PAPER_AGE_STAINS: 0, // blotches with tide-lines
  PAPER_AGE_SEAMS: 0.2, // seams between rolls, overall (0 = none at all)
  PAPER_AGE_SEAM_OFFSET_CM: 129, // where a seam falls from the embroidery's centre: each 53cm (a roll) brings the next seam there; up to ten rolls to choose from
  PAPER_AGE_SEAM_GAP_MM: 0.8, // the joint between rolls; it wavers, opens and closes (0 = butted tight)
  PAPER_AGE_SEAM_LIFT: 0.6, // edges lifting off the wall: the lip catches light, shadows the paper beside it
  PAPER_AGE_SEAM_TEAR: 0.3, // strips torn back to the plaster
  PAPER_AGE_SEAM_SHARPNESS: 0.5, // paper edges: 0 worn soft, 1 crisply cut
  PAPER_AGE_SEAM_DIRT: 0.4, // paste and handling grime along the joint
  PAPER_AGE_SEAM_SHIFT_MM: 2.5, // hand-hung rolls rarely matched: the pattern steps up or down at each seam
  PAPER_AGE_HALO: 0.12, // grime round where the frame has hung (the paper behind it stayed clean)
  PAPER_AGE_HALO_SPREAD_DEG: 3, // how far the frame's angle has wandered over the years

  // Embroidery (framed cross-stitch on the wallpaper). Hand-charted: stitch size scales the piece.
  EMBROIDERY_STITCH_SIZE: 0.0594, // one cross-stitch, in tiles: sets the detail
  EMBROIDERY_ZOOM: 0.38, // scales the finished framed piece; < 1 shrinks a detailed render
  EMBROIDERY_CLOTH_W: 83, // cloth size in stitches; florals stay in the corners
  EMBROIDERY_CLOTH_H: 55,
  EMBROIDERY_FRAME: 0.2, // moulding width
  EMBROIDERY_TILT_DEG: 1, // clockwise
  EMBROIDERY_SWING_DAMPING: 0.3, // let go, it swings back: 0 = swings on and on, 1 = settles without swinging
  EMBROIDERY_SWING_STICK_DEG: 2.5, // how far off its rest the hanger's friction can hold it
  EMBROIDERY_FALL: true, // experiment: let go (or swung) past EMBROIDERY_FALL_DEG, it falls off the wall
  EMBROIDERY_FALL_DEG: 40, // the angle past which it slips off its nail
  EMBROIDERY_FALL_GRAVITY: 0.63, // 1 = real gravity at the room's scale; lower = slow motion
  EMBROIDERY_FALL_KICK: 1, // how hard catching the rail pitches it forward
  EMBROIDERY_FALL_TUMBLE: 0.1, // how fast it tumbles once caught
  EMBROIDERY_FALL_CATCH: false, // it catches the rail and is kicked off it; off = it tumbles from the moment it leaves the nail
  EMBROIDERY_FALL_BLUR: 0.6, // motion blur as it falls (0 = none)
  EMBROIDERY_STANDOFF_CM: 1.3, // frame depth: how far it stands off the wall; sets its sides and its cast shadows
  EMBROIDERY_DUST_TOP: 1.24, // dust on the frame's upper moulding
  EMBROIDERY_DUST_INNER: 0.93, // dust on the inner bottom lip, against the glass
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
  EMBROIDERY_GLASS_REFLECTION: 0.33, // crisp window reflection
  EMBROIDERY_GLASS_SPOTS: 0.21, // dried water spots

  // Embroidery: back (the about note): click the frame to turn it over
  ABOUT_FLIP_MS: 900, // how long turning it over takes
  ABOUT_PAPER: '#b8946a', // aged kraft dust-cover
  ABOUT_STAINS: 0.45, // water tide-marks and foxing
  ABOUT_EDGE_WEAR: 0.5, // edges darkened, rubbed and torn back
  ABOUT_INK: '#2b2420', // the handwriting's ink
  ABOUT_INK_STRENGTH: 1, // ink density: below 1 fainter, above 1 blacker
  ABOUT_NOTE_ZOOM: 0.96, // 1 = the longest line spans the paper
  ABOUT_NOTE_SPACING: 1.05, // between lines: 1 = as written
  ABOUT_HANGER_TARNISH: 0.6, // the sawtooth hanger's brass: 0 bright, 1 dark patina and verdigris
  ABOUT_HANGER_DROP_CM: 0.3, // how far below the frame's top the hanger was fixed (the nail sits in its notch)
  ABOUT_HANGER_TILT_DEG: 1.5, // and how crookedly

  // Dado rail: painted wooden trim capping the tiles. Geometry in cm.
  RAIL_COLOR: '#bfb093',
  RAIL_DEPTH_CM: 1.95, // how far it stands off the wall
  RAIL_ROUND_CM: 1.35, // rounded top, falling back to the wall
  RAIL_BEAD_CM: 0.6, // routed bead below the round
  RAIL_COVE_CM: 0.3, // cove stepping back to the face
  RAIL_FLAT_CM: 2.2, // flat face: extends the rail's height
  RAIL_WEAR: 0.28, // chipped paint on the raised edges
  RAIL_GRIME: 0.36, // dirt in the routing
  RAIL_DUST: 0.45, // dust settled along the top
  RAIL_SHADOW: 1.14, // shadow it casts onto the top row of tiles

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
  TILE_REFLECTION: 0.12, // how strongly the room shows in the glaze
  TILE_TILT_DEG: 1.3, // tiles sit at slightly different angles, breaking reflections at the grout
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
  PRINT_HOVER_REVEAL: false, // hover shows the original logo
  PRINT_HOVER_FADE_MS: 350, // how fast it opens out from the logo's centre
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

  // Wiping with a finger (mouse): dust on the rail and skirting, limescale and marks on the tiles
  WIPE_WIDTH_CM: 2, // brush width: about a fingertip
  WIPE_LIMESCALE_STUBBORN: 0.6, // 0 = one pass clears it, towards 1 = rub and rub

  // Work-in-progress notice, shown once per browser
  NOTICE_COLOR: '#f7f1e3', // soft cream card
  NOTICE_INK: '#4a4237',
};

export type Config = { -readonly [K in keyof typeof CONFIG]: (typeof CONFIG)[K] };
