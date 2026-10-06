# mcnoose.com

My portfolio site — a bathroom wall. I wanted the scene to feel alive. Most of the work went into lighting and ageing it, and introducing subtle interactions.

<a href="https://mcnoose.com" target="_blank" rel="noopener noreferrer">It's here.</a> Desktop is best, but it works on phones too.

![The wall](docs/readme/wall.jpg)

## How it works

### Simulating the room

The scene is dynamically lit as a coherent room (`src/room.ts`). There's a window on the wall behind you, a ceiling light, and light bouncing up off the floor. Every surface works out its own shading from its position on the wall, so the wallpaper, the frame, each tile, and each length of rail and skirting are lit slightly differently. Nothing has highlights or shadows painted on.

The light moves. Clouds pass the window at random, which you mostly see in the reflections. The sun throws a soft patch of light onto the wall. The patch moves and warms for a few minutes as the sun sets. The room settles at dusk.

Reflections come from the same window. They slide with parallax as you scroll. Each tile traces the room through its own slight tilt and waviness, so no two reflect quite the same thing.

The wallpaper has yellowed, with a cleaner patch behind the frame and grime around it, and seams that have lifted and torn a little. The tiles are crazed, with dried water marks and limescale. The grout is discoloured and in places mouldy. Dust sits on the rail and skirting, and the skirting is scuffed by shoes.

### Controls

Every value that shapes the scene is a constant in `src/config.ts`, about 200 of them. In development, a panel (lil-gui) gives each one a slider. I tuned the scene by eye with that panel. Most of the design happened this way.

### Generating the site

`npm run build` produces a single `index.html` with everything inlined, beside `projects.json` and `logos/`. The wallpaper is expensive to render, so it's baked at build time. The scanned pattern is recoloured ink by ink, embossed, and lit with the configured values.

### Keeping the simulation in the page

Only the wallpaper is baked. The room itself still runs in the browser. Lighting, clouds, the sunset and reflections are computed live on canvas. Heavy, per-pixel work (wood, paint, wear, scuffs) runs in worker threads to avoid blocking the main thread, so the wallpaper and tiles paint first and the trim fills in a moment behind them.

The wall isn't responsive. It stays in place, as if you're looking at it through a portal. Resizing or moving the window affects what you can see, but the wall keeps a fixed position and isn't rearranged. This is only evident on desktop.

Projects appear on wall tiles and reflow onto what's visible as you look around the room.

### Interactions

I wanted the cross-stitch embroidery frame to be evidently interactive because my contact details are on a handwritten note on the back. Moving over it with the mouse tilts it slightly, as if you bumped it. Clicking on it flips it over. Clicking and dragging tilts it on its nail. Drag physics is applied and the frame falls off the wall if you angle it too far.

You can also clean the space a little. Dust is easy to wipe off. Limescale requires more persistence.

### Printed projects

Each logo is printed onto its tile as a halftone. The dots come from <a href="https://github.com/nicc/halftone-print" target="_blank" rel="noopener noreferrer">halftone-print</a>, a small package made for this project. Darker, more opaque parts of a logo print more ink.

## Stack

TypeScript and Canvas 2D, with no framework, built by Vite. Tests are Vitest for units and Playwright for end-to-end runs in Chromium, Firefox and WebKit, plus phone emulation. Screenshots (`npm run shots`) are for checking visual changes.

## Development

```sh
npm install
npm run dev                  # with the tweak panel
npm test
npm run test:e2e
npm run identity [-- <ref>]  # byte-compares surfaces from the working tree and a git ref
npm run shots                # screenshots of the wall and each tile, in shots/
npm run readme:wall          # regenerate the picture at the top of this README
npm run build
```

`?fixtures` in dev swaps in a set of test logos (fine lines, tone, small text, colour, moiré).

## Adding a project

Edit `projects.json` (next to `index.html` on the server; `public/projects.json` in the repo) and drop the logo into `logos/` beside it. No rebuild needed.

```json
{ "title": "My Project", "url": "https://example.com", "logo": "my-project.svg" }
```

Logos are SVG or PNG on the same site.

## The about note

The note on the back of the embroidery frame is real handwriting, cut from a photo. Put the photo at `note-src/note-photo.png` (kept out of git), set which lines to keep in `tools/prepare-note.py`, and run `python3 tools/prepare-note.py` (numpy, scipy, Pillow). It writes ink-only line images and their layout to `src/about/`.

## Deployment

Build, then upload the contents of `dist/` (`index.html`, `projects.json`, `logos/`) to any static host. It has to be served over http(s). Opening `index.html` from disk won't load the projects.

## Acknowledgements / built with

- <a href="https://claude.com/claude-code" target="_blank" rel="noopener noreferrer">Claude Code</a> wrote the code.
- The wallpaper is a scan of a sidewall from about 1875 in the <a href="https://www.si.edu/object/sidewall:chndm_1939-45-7-a_b" target="_blank" rel="noopener noreferrer">Cooper Hewitt, Smithsonian Design Museum</a> collection (1939-45-7), released under CC0.
- <a href="https://github.com/nicc/halftone-print" target="_blank" rel="noopener noreferrer">halftone-print</a> prints the halftones.
- <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">Vite</a> and <a href="https://github.com/richardtallent/vite-plugin-singlefile" target="_blank" rel="noopener noreferrer">vite-plugin-singlefile</a> do the build.
- <a href="https://lil-gui.georgealways.com" target="_blank" rel="noopener noreferrer">lil-gui</a> runs the tweak panel.
- <a href="https://sharp.pixelplumbing.com" target="_blank" rel="noopener noreferrer">sharp</a> prepares and bakes the wallpaper.
- <a href="https://playwright.dev" target="_blank" rel="noopener noreferrer">Playwright</a> and <a href="https://vitest.dev" target="_blank" rel="noopener noreferrer">Vitest</a> run the tests.
