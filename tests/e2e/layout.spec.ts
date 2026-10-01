import { expect, test } from '@playwright/test';

const SIZES = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1000, height: 800 },
  { width: 1440, height: 900 },
];

for (const size of SIZES) {
  test(`layout holds at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const m = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const row = [...document.querySelectorAll('.grid > .tile')].slice(0, Number(getComputedStyle(document.documentElement).getPropertyValue('--cols-total')));
      const boxes = row.map((t) => t.getBoundingClientRect());
      const first = boxes[0], last = boxes[boxes.length - 1];
      const skirting = document.querySelector('.skirting')!.getBoundingClientRect();
      return {
        vw,
        scrollW: document.documentElement.scrollWidth,
        tile: boxes[1].width,
        square: boxes.every((b) => Math.abs(b.width - b.height) < 0.5),
        leftPeek: first.right,
        rightPeek: vw - last.left,
        innerFits: boxes.slice(1, -1).every((b) => b.left >= -0.5 && b.right <= vw + 0.5),
        edgesBlank: row[0].children.length === 0 && row[row.length - 1].children.length === 0,
        pageEnd: Math.abs(skirting.bottom + scrollY - document.documentElement.scrollHeight) < 1,
      };
    });
    expect(m.scrollW).toBeLessThanOrEqual(m.vw);
    expect(m.square).toBe(true);
    expect(m.innerFits).toBe(true);
    expect(m.edgesBlank).toBe(true);
    expect(m.leftPeek).toBeGreaterThanOrEqual(0.25 * m.tile - 0.5);
    expect(m.rightPeek).toBeGreaterThanOrEqual(0.25 * m.tile - 0.5);
    expect(m.tile).toBeLessThanOrEqual(400);
    expect(m.pageEnd).toBe(true);
  });
}

test('projects render as links in order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tile-project .tile-title').first()).toHaveText('Project One');
});

test('every project tile prints halftone ink, with the title kept for screen readers', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('html[data-printed="true"]');
  const tiles = await page.$$eval('.tile-project', (els) =>
    els.map((a) => {
      const c = a.querySelector('canvas')!;
      const px = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let inked = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 0) inked++;
      return { inked, srOnly: a.querySelector('.tile-title')!.classList.contains('sr-only') };
    }),
  );
  expect(tiles.length).toBeGreaterThan(0);
  for (const t of tiles) {
    expect(t.inked).toBeGreaterThan(500);
    expect(t.srOnly).toBe(true);
  }
});

// Positions that must not move while the window resizes (unless re-anchoring is forced).
const wallState = () => {
  const lefts = (sel: string) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect().left);
  const cols = Number(getComputedStyle(document.documentElement).getPropertyValue('--cols-total'));
  const row = [...document.querySelectorAll('.grid > .tile')].slice(0, cols);
  const f = document.querySelector('.frame')!.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  return {
    tile: row[0].getBoundingClientRect().width,
    pitch: row[1].getBoundingClientRect().left - row[0].getBoundingClientRect().left,
    tiles: lefts('.grid > .tile').slice(0, cols),
    bullnose: lefts('.bullnose-tile'),
    bullnosePitch: lefts('.bullnose-tile')[1] - lefts('.bullnose-tile')[0],
    frameX: f.left + f.width / 2,
    fullTiles: row.filter((t) => t.getBoundingClientRect().left >= -0.5 && t.getBoundingClientRect().right <= vw + 0.5),
    projectsShown: document.querySelectorAll('.tile-project').length,
  };
};

const onLattice = (xs: number[], ref: number, pitch: number) =>
  xs.every((x) => Math.abs(((x - ref) / pitch) - Math.round((x - ref) / pitch)) < 0.01);

test('the wall stays where it first rendered while the window resizes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('html[data-printed="true"]');
  const first = await page.evaluate(wallState);
  await page.evaluate(() => document.querySelectorAll('canvas.tile-print').forEach((c) => ((c as HTMLElement).dataset.mark = '1')));

  for (const size of [{ width: 1100, height: 900 }, { width: 1800, height: 700 }, { width: 900, height: 1000 }]) {
    await page.setViewportSize(size);
    await page.waitForSelector(`html[data-rendered-width="${size.width}"]`);
    const now = await page.evaluate(wallState);
    expect(now.tile).toBeCloseTo(first.tile);
    expect(onLattice(now.tiles, first.tiles[0], first.pitch)).toBe(true);
    expect(onLattice(now.bullnose, first.bullnose[0], first.bullnosePitch)).toBe(true);
    expect(now.frameX).toBeCloseTo(first.frameX, 0);
    expect(now.projectsShown).toBe(first.projectsShown); // every project still on the wall
    // Prints are moved, not redrawn.
    expect(await page.$$eval('canvas.tile-print:not(.tile-ghost)', (cs) => cs.every((c) => (c as HTMLElement).dataset.mark === '1'))).toBe(true);
  }
});

test('projects fill exactly the fully visible tiles of the first row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.waitForSelector('html[data-rendered-width="1000"]');
  const { full, projectInFull, partialsBlank } = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const cols = Number(getComputedStyle(document.documentElement).getPropertyValue('--cols-total'));
    const row = [...document.querySelectorAll('.grid > .tile')].slice(0, cols);
    const isFull = (t: Element) => t.getBoundingClientRect().left >= -0.5 && t.getBoundingClientRect().right <= vw + 0.5;
    return {
      full: row.filter(isFull).length,
      projectInFull: row.filter(isFull).every((t) => t.classList.contains('tile-project')),
      partialsBlank: row.filter((t) => !isFull(t)).every((t) => !t.classList.contains('tile-project')),
    };
  });
  expect(full).toBeGreaterThan(0);
  expect(projectInFull).toBe(true);
  expect(partialsBlank).toBe(true);
});

test('re-anchors, centred, only when a full tile with peeks no longer fits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForSelector('html[data-rendered-width="360"]');
  const s = await page.evaluate(wallState);
  expect(s.fullTiles.length).toBeGreaterThanOrEqual(1);
  const left = s.tiles[0] + s.tile; // visible part of the leftmost tile
  expect(left).toBeGreaterThanOrEqual(0.25 * s.tile - 0.5);
  expect(s.frameX).toBeCloseTo(180, 0);
});

// Simulates the window moving on screen (or its left/top edge being dragged) by faking its screen position.
const moveWindowBy = (page: import('@playwright/test').Page, dx: number, dy: number) =>
  page.evaluate(
    ([dx, dy]) => {
      const w = window as unknown as Record<string, number>;
      for (const [k, d] of [['screenX', dx], ['screenY', dy], ['mozInnerScreenX', dx], ['mozInnerScreenY', dy]] as const) {
        if (!(k in w)) continue;
        const v = w[k] + d;
        Object.defineProperty(window, k, { get: () => v, configurable: true });
      }
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    },
    [dx, dy],
  ).then(() => page.waitForSelector('html[data-pin="settled"]'));

test('pinned to the screen: left/top edge moves reveal wall instead of moving it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  test.skip(!(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)), 'desktop only');
  await page.waitForSelector('html[data-printed="true"]');
  const at = () => page.evaluate(() => ({
    tile: document.querySelector('.grid > .tile')!.getBoundingClientRect().left,
    frame: document.querySelector('.frame')!.getBoundingClientRect(),
    bullnose: document.querySelector('.bullnose-tile')!.getBoundingClientRect().left,
    scrollY,
  }));
  const before = await at();
  const pitch = await page.evaluate(() => {
    const [a, b] = document.querySelectorAll('.grid > .tile');
    return b.getBoundingClientRect().left - a.getBoundingClientRect().left;
  });

  // Viewport moves 200 left and 80 up on screen (e.g. left and top edges dragged outwards).
  await moveWindowBy(page, -200, -80);
  const out = await at();
  const lattice = (x: number, ref: number) => Math.abs(((x - ref) / pitch) - Math.round((x - ref) / pitch)) < 0.01;
  expect(lattice(out.tile, before.tile + 200)).toBe(true);
  // Within 1px: eased corrections end on sub-pixel scroll positions.
  expect(Math.abs(out.frame.left - (before.frame.left + 200))).toBeLessThan(1);
  expect(Math.abs(out.frame.top - (before.frame.top + 80))).toBeLessThan(1); // wallpaper grew upwards

  // Viewport moves 160 down: the page scrolls so the wall stays put on screen.
  await moveWindowBy(page, 0, 160);
  const down = await at();
  expect(down.scrollY).toBeGreaterThan(70); // the cut-off top became scroll area
  expect(Math.abs(down.frame.top - (before.frame.top - 80))).toBeLessThan(1);
});

test('projects crossfade when they move tiles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForSelector('html[data-printed="true"]');
  await page.evaluate(() => {
    const seen = ((window as unknown as { seen: Set<string> }).seen = new Set());
    new MutationObserver(() => {
      if (document.querySelector('.tile-arrive')) seen.add('arrive');
      if (document.querySelector('.tile-ghost')) seen.add('ghost');
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.setViewportSize({ width: 800, height: 900 }); // fewer full columns: projects move
  await page.waitForSelector('html[data-rendered-width="800"]');
  const seen = await page.evaluate(() => [...(window as unknown as { seen: Set<string> }).seen].sort());
  expect(seen).toEqual(['arrive', 'ghost']);
});
