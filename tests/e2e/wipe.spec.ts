import { expect, test, type Page } from '@playwright/test';

// Wiping is mouse-only: on touch a drag scrolls.
test.skip(({ isMobile }) => isMobile, 'mouse only');

// Total alpha of a canvas within a css-px box (viewport coords).
const alphaIn = (page: Page, sel: string, box: { x0: number; x1: number }) =>
  page.evaluate(([sel, box]) => {
    const c = document.querySelector(sel as string) as HTMLCanvasElement, r = c.getBoundingClientRect(), k = c.width / r.width;
    const { x0, x1 } = box as { x0: number; x1: number };
    const d = c.getContext('2d')!.getImageData(Math.round((x0 - r.left) * k), 0, Math.round((x1 - x0) * k), c.height).data;
    let a = 0;
    for (let i = 3; i < d.length; i += 4) a += d[i];
    return a;
  }, [sel, box] as const);

const drag = async (page: Page, y: number, x0: number, x1: number, passes = 1) => {
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let p = 0; p < passes; p++) await page.mouse.move(p % 2 ? x0 : x1, y, { steps: 20 });
  await page.mouse.up();
};

test('a finger stroke clears the rail dust it passes over, and it stays clear after a re-render', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const dust = await page.locator('.rail .trim-dust').boundingBox();
  const inside = { x0: 400, x1: 600 }, outside = { x0: 800, x1: 1000 };
  const before = await alphaIn(page, '.rail .trim-dust', outside);
  expect(await alphaIn(page, '.rail .trim-dust', inside)).toBeGreaterThan(0);
  await drag(page, dust!.y + dust!.height / 2, 380, 620);
  expect(await alphaIn(page, '.rail .trim-dust', inside)).toBe(0);
  expect(await alphaIn(page, '.rail .trim-dust', outside)).toBe(before);
  await page.setViewportSize({ width: 1180, height: 800 }); // re-render: canvases redrawn, wipes replayed
  await page.waitForSelector('html[data-rendered-width="1180"]');
  expect(await alphaIn(page, '.rail .trim-dust', inside)).toBe(0);
});

test('limescale on the tiles takes more than one pass, and a wipe is not a click', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await page.waitForSelector('.skirting');
  // The bottom row has the most limescale.
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  // A bottom-row tile inside the window (the scene renders a margin wider than it: overscan).
  const n = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.grid > .tile')], vw = document.documentElement.clientWidth;
    const bottom = Math.max(...tiles.map((t) => t.getBoundingClientRect().top));
    let last = -1;
    tiles.forEach((t, i) => {
      const r = t.getBoundingClientRect();
      if (r.top === bottom && r.left >= 0 && r.right <= vw) last = i;
    });
    return last + 1;
  });
  const box = (await page.locator(`.grid > .tile:nth-child(${n})`).boundingBox())!;
  const marks = `.grid > .tile:nth-child(${n}) .tile-age:last-of-type`;
  const span = { x0: box.x + 10, x1: box.x + box.width - 10 };
  const start = await alphaIn(page, marks, span);
  expect(start).toBeGreaterThan(0);
  await drag(page, box.y + box.height * 0.85, span.x0 - 10, span.x1 + 10);
  const once = await alphaIn(page, marks, span);
  expect(once).toBeLessThan(start);
  expect(once).toBeGreaterThan(0);
  await drag(page, box.y + box.height * 0.85, span.x0 - 10, span.x1 + 10, 6);
  expect(await alphaIn(page, marks, span)).toBeLessThan(once);

  // A stroke that ends on a project tile doesn't follow its link.
  await page.evaluate(() => scrollTo(0, 0));
  const project = (await page.locator('.tile-project').first().boundingBox())!;
  let opened = 0;
  page.context().on('page', () => opened++);
  await drag(page, project.y + project.height / 2, project.x - 40, project.x + project.width / 2);
  await page.waitForTimeout(300);
  expect(opened).toBe(0);
});
