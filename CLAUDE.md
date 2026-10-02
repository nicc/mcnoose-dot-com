# mcnoose-dot-com

Portfolio site: a bathroom wall. Wallpaper header with framed cross-stitch → painted dado rail → white tile grid (one project per tile) → skirting board. Builds to a single `dist/index.html`.

## Token efficiency
Use tokens efficiently at all times — in this file, in replies, in tool use. Read only what the task needs; don't restate diffs.

## Aesthetics are the product
The vibe is the key outcome, not a finish. Treat look and feel with the same rigour as function:
- Iterate visually: `npm run shots [-- firefox|webkit] [--fixtures]` → read `shots/<browser>[-fixtures]/*.png` (incl. per-tile close-ups) before and after every visual change.
- `?fixtures` (dev only) swaps in `src/dev/fixtures/` test logos: solid, fine lines, tone, small text, colour, moiré, no-size SVG, PNGs.
- Communicate in felt terms first (what it's like to look at), then mechanism. Show screenshots.
- Name register conflicts early; don't split the difference.
- One coherent scene: every surface (wallpaper, embroidery, frame, tiles, rail, skirting, prints) is lit by the same physical room (`src/room.ts`, `ROOM_*` in cm): a window on the wall behind the viewer (key) and a ceiling light (fill). Reflections come from the same window by mirror geometry.
- **Always light dynamically — a must, for everything.** Every surface computes its shading from `lightsAt(room, its own wall position)`, so it responds to the room controls and varies across the wall. Never bake a fixed light direction, never paint highlights or shadows by hand, never share one lighting across a wide surface (split it into lengths/tiles lit at their own positions).
- Expect many rounds, especially halftone print, wallpaper, skirting, hover effects.

## Constants
- Every tweakable value lives in `src/config.ts` → CSS vars set in `src/scene.ts`. No magic numbers in CSS/TS.
- One `KEY: value,` per line: the dev panel's save rewrites them in place (`tools/config-writer.ts`).
- New keys appear in the panel automatically, in the folder `src/config-groups.ts` assigns; add the key to that section of config.ts (a test enforces section order) and a slider range in `src/dev/panel.ts` `RANGES`.
- Units: sizes in tiles (1 = one tile edge) unless suffixed `_PX` / `_DEG`. Group keys by prefix (`EMBROIDERY_*`, `BULLNOSE_*`).

## Layout rules (tested in `src/layout.test.ts`, `tests/e2e/`)
- Portal, not responsive: the wall is anchored once (centred) and stays put across resizes. Tiles, grout, rail lengths, embroidery and any wall texture never move; resizing reveals/hides wall. Anchor textures to `--wall-x`, never the viewport.
- Desktop (`hover: hover` + `pointer: fine`): also pinned to the physical screen via `screenX/Y` (polled per frame; no move event), smoothed by `PinFilter` (`src/pin.ts`: easing `PIN_SMOOTH_MS`, steady-drag lag cancelled). Tests wait on `html[data-pin=settled]`. Left-edge drags/window moves reveal wall; top-edge moves scroll to compensate, growing wallpaper upwards (`--wall-y`) past the top.
- Projects crossfade (`REFLOW_FADE_MS`) when they change tiles; fades resume across re-renders via negative `animation-delay`.
- Tests wait on `html[data-rendered-width]` after resizes (resize event lags the viewport change in Chromium).
- Re-anchor only when tile geometry config changes or one full tile + `MIN_PEEK` either side no longer fits (`anchorFits`).
- Tiles square, ≤ `TILE_MAX_PX`; sized at anchor time to fit width and height (svh) with `MIN_PEEK` peeks. Never grow back until re-anchor.
- Projects fill fully visible tiles row by row; partial tiles blank; `TRAILING_ROWS` after; page ends at skirting.
- Halftone prints are cached per project; resizes move canvases, never re-print.

## Projects
`src/projects.json` (ordered `{title, url, logo}`) + logo files in `src/logos/` (SVG/PNG, any colour; darker + more opaque = more ink). Test fails on missing fields/logos.

## Wallpaper (`src/wallpaper/`)
Cooper Hewitt scan 1939-45-7 (CC0, ca. 1875). `npm run prepare:wallpaper` (scripts/prepare-wallpaper.ts, tools/wallpaper-prep.ts) → seamless half-drop `scan.webp` + per-pixel ink map `inks.png` + `palette.json`. `render.ts` (pure): recolour per ink (`WALLPAPER_<INK>` colours, shift-based so print grain survives), procedural pebble emboss + ink relief, lit by `shade()`. Production: baked at build by `tools/wallpaper-bake.ts` (`virtual:wallpaper`, config.ts values, no runtime compute). Dev: rendered live (`index.ts`) for the panel. Background anchored to wall origin.

## Embroidery (`src/embroidery/`)
Hand-charted sampler (`chart.ts`: glyphs for the letters used, corner sprig, auto layout) painted on canvas (`draw.ts`: aida, X stitches, mitred wood frame) lit by the room's lights rotated into the frame's tilt; window reflection placed by `reflectedWindow` and slid by `parallaxFactor`. Size = `EMBROIDERY_STITCH_SIZE` × chart. New letters need new glyphs. Site title is a visually hidden h1.

## Wood (`src/wood/`)
Shared by frame and (later) skirting. `grain.ts`: flat-sawn oak growth rings with cathedral figure, pores, colour drift → albedo/gloss/relief (optionally periodic along the length). `board.ts`: lights a board from a cross-section profile + grain relief; finish sheen is scaled by the gloss map and streaks along the grain. `wear.ts`: rubbing on convex/high profile, grime in hollows and mitre joints, patchy along the length. Lit by a list of room lights.

## Surfaces (`src/surface/`)
Shared by glass now and tile glaze later. `spots.ts`: dried water, `limescale` 0 (droplet rings) → 1 (crust + drips); seeded per surface and clustered like splashes, so never a repeating texture. Size from shared `WATER_SPOT_SIZE` (same physical droplets everywhere). `reflection.ts`: crisp daylit-window reflection placed by the scene light, on its own screen-blended layer, slid with parallax as the view scrolls (`parallaxOffset`; window moves under screen pinning don't count). Dried marks are stains, not wet: never light them.

## Tiles (`src/tiles/`)
`surface.ts`: page px → wall cm (`WallMap`), per-tile glaze tone, cushion-edge CSS shadows per room light. `glaze.ts`: per-tile ageing canvas (crazing + dried marks, worse over the bottom `TILE_GRIME_ROWS`), extended over the joints the tile owns (left, above, and below on the last row) for grout ageing (`grout.ts`: discolouration, grime, mould, limescale, erosion, cracks — soft marks, clipped to joints). `reflect.ts`: each tile traces the room (plain floor, window wall, walls, ceiling — no floor pattern) through its own tilt + waviness; 20×20 canvas, blurred, re-traced on scroll for on-screen tiles only, from the eye (`ROOM_EYE_FOLLOW`, shared with the glass). Per-tile seeds from wall position: nothing repeats. Tiles stand `TILE_THICK_CM` proud of the wallpaper; rays bent back into the wall hit the paper above the seam (sampled from the real pattern, `tiles/paper.ts`). Fresnel is Schlick relative to head-on. 

## Rail (`src/rail/`)
Painted dado rail capping the tiles. `profile.ts`: routed cross-section in cm (round top back to the wall, quirk + bead, cove, flat face `RAIL_FLAT_CM`, rounded bottom). `index.ts`: tile-wide lengths, each lit by `lightsAt` + `viewAt` at its own wall position, grain/paint/wear in wall coordinates so lengths join seamlessly; cached per length. Painted finish shared in `wood/paint.ts` (`PAINT_*`, for the skirting too). Highlights use the real eye direction (`viewAt`), so flat faces below eye level stay matte. Seam with the paper (contact shadow, joint line), dust (wall-seeded, never repeats), cast shadow onto the top tile row.

## Halftone
Dots come from the `halftone-print` package (our own: ~/source/play/halftone-print, github nicc/halftone-print; changes go there, released by tag). `src/halftone/print.ts` composes logo + title per tile and calls `renderHalftone`. Pitch fixed in CSS px. Title stays in DOM as `.sr-only`; shown as plain text if printing fails. `html[data-printed=true]` when all prints settle.

## Browser support
Chrome, Firefox, Safari on desktop and mobile, always. Check support before using new CSS/JS. `npm run test:e2e` covers chromium/firefox/webkit + Pixel/iPhone emulation; Playwright WebKit ≠ real iOS Safari.

## Commands
`npm run dev` (with tweak panel) · `npm test` · `npm run test:e2e` · `npm run shots` · `npm run build`

## Tracking
Beads (`bd`); run `bd prime` for commands (auto-run at session start). `bd ready` → claim → note → close.
Issues live in local Dolt, not git; sync with `bd dolt push`.

## Done = committed + pushed
When work is done and typecheck, unit and e2e tests pass: commit, `git push`, `bd dolt push`. Ask before ever committing a broken state. Gate commits on each test command's exit code (`cmd && git commit`), never on grepped output: grep succeeds when it finds "failed".
