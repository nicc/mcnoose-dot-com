import { expect, test } from '@playwright/test';

// The wall drawn in pencil while the page loads (src/pencil/): there from the first paint, on the
// same lines as the scene it gives way to, and gone once the scene is ready.
test('the loading drawing traces the wall, then gives way to it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#pencil i[data-part="frame"]').first()).toBeAttached();
  await page.waitForSelector('html[data-printed="true"]');
  // Finish the strokes where they are, then compare them with the scene under them.
  const fit = await page.evaluate(() => {
    const layer = document.getElementById('pencil');
    if (!layer) return undefined;
    layer.getAnimations({ subtree: true }).forEach((a) => a.finish());
    const box = (els: Element[]) => {
      const r = els.map((e) => e.getBoundingClientRect());
      return { left: Math.min(...r.map((b) => b.left)), right: Math.max(...r.map((b) => b.right)), top: Math.min(...r.map((b) => b.top)), bottom: Math.max(...r.map((b) => b.bottom)) };
    };
    const firm = [...layer.querySelectorAll<HTMLElement>('i[data-part="frame"]')].filter((e) => +e.style.opacity > 0.4); // not the guides
    const tile = [...document.querySelectorAll('.grid > .tile')].map((t) => t.getBoundingClientRect()).find((t) => t.left > 10)!; // the scene runs past the window; the drawing doesn't
    const joints = [...layer.querySelectorAll<HTMLElement>('i[data-part="tiles"]')].map((e) => e.getBoundingClientRect());
    return {
      drawn: box(firm),
      frame: box([document.querySelector('.frame-front')!]),
      tileTop: tile.top,
      jointTop: Math.min(...joints.map((j) => j.top)),
      tileLeft: tile.left,
      joint: Math.min(...joints.filter((j) => j.height > j.width).map((j) => Math.abs((j.left + j.right) / 2 - (tile.left - 2)))), // a joint centred in the grout left of a tile
    };
  });
  if (fit) {
    for (const k of ['left', 'right', 'top', 'bottom'] as const) expect(Math.abs(fit.drawn[k] - fit.frame[k])).toBeLessThan(8);
    expect(Math.abs(fit.jointTop - fit.tileTop)).toBeLessThan(7); // joints run a little past the tiles, as firm lines run past their corners
    expect(fit.joint).toBeLessThan(3);
  }
  await page.waitForSelector('html[data-pencil="done"]');
  await expect(page.locator('#pencil')).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
});

test('the drawing is on screen before the main script has arrived', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/\/index-[\w-]+\.js$/, async (route) => (await held, route.continue()));
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#pencil i[data-part="frame"]').first()).toBeAttached();
  expect(await page.evaluate(() => document.querySelector('.grid'))).toBeNull();
  release();
  await page.waitForSelector('html[data-pencil="done"]');
});
