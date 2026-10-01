# mcnoose-dot-com

Portfolio site: a bathroom wall. Wallpaper header with framed cross-stitch → bull-nose row → white tile grid (one project per tile) → skirting board. Builds to a single `dist/index.html`.

## Token efficiency
Use tokens efficiently at all times — in this file, in replies, in tool use. Read only what the task needs; don't restate diffs.

## Aesthetics are the product
The vibe is the key outcome, not a finish. Treat look and feel with the same rigour as function:
- Iterate visually: `npm run shots [-- firefox|webkit] [--fixtures]` → read `shots/<browser>[-fixtures]/*.png` (incl. per-tile close-ups) before and after every visual change.
- `?fixtures` (dev only) swaps in `src/dev/fixtures/` test logos: solid, fine lines, tone, small text, colour, moiré, no-size SVG, PNGs.
- Communicate in felt terms first (what it's like to look at), then mechanism. Show screenshots.
- Name register conflicts early; don't split the difference.
- Expect many rounds, especially halftone print, wallpaper, skirting, hover effects.

## Constants
- Every tweakable value lives in `src/config.ts` → CSS vars set in `src/scene.ts`. No magic numbers in CSS/TS.
- One `KEY: value,` per line: the dev panel's save rewrites them in place (`tools/config-writer.ts`).
- New keys appear in the panel automatically; add a slider range in `src/dev/panel.ts` `RANGES`.
- Units: sizes in tiles (1 = one tile edge) unless suffixed `_PX` / `_DEG`. Group keys by prefix (`EMBROIDERY_*`, `BULLNOSE_*`).

## Layout rules (tested in `src/layout.test.ts`, `tests/e2e/`)
- Portal, not responsive: the wall is anchored once (centred) and stays put across resizes. Tiles, grout, bull-nose joints, embroidery and any wall texture never move; resizing reveals/hides wall. Anchor textures to `--wall-x`, never the viewport.
- Desktop (`hover: hover` + `pointer: fine`): also pinned to the physical screen via `screenX/Y` (polled per frame; no move event), smoothed by `PinFilter` (`src/pin.ts`: velocity prediction `PIN_PREDICT_MS` + easing `PIN_SMOOTH_MS`). Tests wait on `html[data-pin=settled]`. Left-edge drags/window moves reveal wall; top-edge moves scroll to compensate, growing wallpaper upwards (`--wall-y`) past the top.
- Projects crossfade (`REFLOW_FADE_MS`) when they change tiles; fades resume across re-renders via negative `animation-delay`.
- Tests wait on `html[data-rendered-width]` after resizes (resize event lags the viewport change in Chromium).
- Re-anchor only when tile geometry config changes or one full tile + `MIN_PEEK` either side no longer fits (`anchorFits`).
- Tiles square, ≤ `TILE_MAX_PX`; sized at anchor time to fit width and height (svh) with `MIN_PEEK` peeks. Never grow back until re-anchor.
- Projects fill fully visible tiles row by row; partial tiles blank; `TRAILING_ROWS` after; page ends at skirting.
- Halftone prints are cached per project; resizes move canvases, never re-print.

## Projects
`src/projects.json` (ordered `{title, url, logo}`) + logo files in `src/logos/` (SVG/PNG, any colour; darker + more opaque = more ink). Test fails on missing fields/logos.

## Halftone (`src/halftone/`)
Per tile: logo + title drawn to a source canvas → ink density → dots on a rotated screen (`screen.ts`, pure, tested) → output canvas. Pitch fixed in CSS px. Title stays in DOM as `.sr-only`; shown as plain text if printing fails. `html[data-printed=true]` when all prints settle.

## Browser support
Chrome, Firefox, Safari on desktop and mobile, always. Check support before using new CSS/JS. `npm run test:e2e` covers chromium/firefox/webkit + Pixel/iPhone emulation; Playwright WebKit ≠ real iOS Safari.

## Commands
`npm run dev` (with tweak panel) · `npm test` · `npm run test:e2e` · `npm run shots` · `npm run build`

## Tracking
Beads (`bd`); run `bd prime` for commands (auto-run at session start). `bd ready` → claim → note → close.
Issues live in local Dolt, not git; sync with `bd dolt push`.

## Done = committed + pushed
When work is done and typecheck, unit and e2e tests pass: commit, `git push`, `bd dolt push`. Ask before ever committing a broken state.
