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
- Tiles square, ≤ `TILE_MAX_PX`; one full tile + `MIN_PEEK` of each neighbour fits both axes (height = svh).
- Column added only if it still leaves `MIN_PEEK` visible each side; grout counted once per joint.
- Edge partial columns always blank; last project row padded with blanks; `TRAILING_ROWS` after; page ends at skirting.
- Bull-nose joints anchored at page centre + `BULLNOSE_OFFSET` — deliberately not centred.

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
