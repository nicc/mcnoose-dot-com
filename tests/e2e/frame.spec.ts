import { expect, test, type Page } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'mouse drag; touch needs press-and-hold, not simulated here');

const tiltOf = (page: Page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.frame')!).getPropertyValue('--frame-tilt')));
const nailOf = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector('.frame-shadow')!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top, w: r.width, h: r.height };
  });

// Grab at (fx, fy) of the frame and drag by dx, holding on: how far it turned, and how far the
// grabbed point's angle about the nail moved.
async function hold(page: Page, fx: number, fy: number, dx: number) {
  const n = await nailOf(page), x = n.x + fx * n.w, y = n.y + fy * n.h;
  const before = await tiltOf(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 10 });
  const expected = ((Math.atan2(y - n.y, x + dx - n.x) - Math.atan2(y - n.y, x - n.x)) * 180) / Math.PI;
  return { turned: (await tiltOf(page)) - before, expected };
}

test('dragging the frame turns it on its nail, keeping the grabbed point under the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const far = await hold(page, 0.45, 0.95, -30); // bottom corner: far from the nail
  expect(far.turned).toBeCloseTo(far.expected, 0);
  // The glass reflection holds still on screen: turned back by as much as the frame turned.
  const counter = await page.locator('.reflection').evaluate((r) => parseFloat(/rotate\((-?[\d.]+)deg\)/.exec((r as HTMLElement).style.transform)![1]));
  expect(counter).toBeCloseTo(-far.turned, 1);
  await page.mouse.up();
  await expect(page.locator('.frame-card')).not.toHaveClass(/flipped/); // a drag isn't a click
  const near = await hold(page, 0.1, 0.25, -30); // close to the nail: the same drag turns it further
  expect(Math.abs(near.turned)).toBeGreaterThan(Math.abs(far.turned) * 1.5);
  await page.mouse.up();
});

test('let go at a steep angle, it swings back and settles near where it hangs', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const rest = await tiltOf(page);
  await hold(page, 0.1, 0.3, -60);
  expect(Math.abs((await tiltOf(page)) - rest)).toBeGreaterThan(15);
  await page.mouse.up();
  // Wait until it has stopped moving, then it should be near where it hangs.
  let last = NaN;
  await expect
    .poll(async () => {
      const now = await tiltOf(page), still = now === last;
      last = now;
      return still;
    }, { timeout: 15000, intervals: [400] })
    .toBe(true);
  const left = await tiltOf(page);
  expect(Math.abs(left - rest)).toBeLessThan(4);
  await page.setViewportSize({ width: 1180, height: 800 });
  await page.waitForSelector('html[data-rendered-width="1180"]');
  expect(await tiltOf(page)).toBeCloseTo(left, 3);
});
