import { expect, test, type Page } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'mouse drag; touch needs press-and-hold, not simulated here');

const tiltOf = (page: Page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.frame')!).getPropertyValue('--frame-tilt')));
const nailOf = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector('.frame-shadow')!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top, w: r.width, h: r.height };
  });

// Drag from (x, y) by dx; returns how far the frame turned and how far the grabbed point's angle moved.
async function turn(page: Page, fx: number, fy: number, dx: number) {
  const n = await nailOf(page), x = n.x + fx * n.w, y = n.y + fy * n.h;
  const before = await tiltOf(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const expected = ((Math.atan2(y - n.y, x + dx - n.x) - Math.atan2(y - n.y, x - n.x)) * 180) / Math.PI;
  return { turned: (await tiltOf(page)) - before, expected };
}

test('dragging the frame turns it on its nail, keeping the grabbed point under the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const far = await turn(page, 0.45, 0.95, -30); // bottom corner: far from the nail
  expect(far.turned).toBeCloseTo(far.expected, 0);
  await expect(page.locator('.frame-card')).not.toHaveClass(/flipped/); // a drag isn't a click
  const near = await turn(page, 0.1, 0.25, -30); // close to the nail: same drag turns it further
  expect(Math.abs(near.turned)).toBeGreaterThan(Math.abs(far.turned) * 1.5);
  // It stays where it was left, re-lit, through a re-render.
  const left = await tiltOf(page);
  await page.setViewportSize({ width: 1180, height: 800 });
  await page.waitForSelector('html[data-rendered-width="1180"]');
  expect(await tiltOf(page)).toBeCloseTo(left, 3);
});
