import { expect, test, type Page } from '@playwright/test';
import { CONFIG } from '../../src/config';

test.skip(({ isMobile }) => isMobile, 'mouse drag; touch needs press-and-hold, not simulated here');

const tiltOf = (page: Page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.frame')!).getPropertyValue('--frame-tilt')));
const nailOf = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector('.frame-shadow')!.getBoundingClientRect();
    const drop = parseFloat((document.querySelector('.frame') as HTMLElement).style.getPropertyValue('--nail-y')) || 0; // the nail, in its hanger's notch
    return { x: r.left + r.width / 2, y: r.top + drop, w: r.width, h: r.height };
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
  const held = await tiltOf(page);
  expect(Math.abs(held - rest)).toBeGreaterThan(15);
  await page.mouse.up();
  if (CONFIG.EMBROIDERY_FALL && Math.abs(held) > CONFIG.EMBROIDERY_FALL_DEG) {
    // The experiment's on and that's past its angle: it falls off the wall, leaving the nail.
    await expect(page.locator('header .nail')).toBeVisible();
    await expect(page.locator('header .frame')).toHaveCount(0);
    return;
  }
  // Wait until it has stopped moving, then it should be near where it hangs.
  await page.waitForSelector('html[data-frame="still"]', { timeout: 15000 });
  const left = await tiltOf(page);
  expect(Math.abs(left - rest)).toBeLessThan(4);
  await page.setViewportSize({ width: 1180, height: 800 });
  await page.waitForSelector('html[data-rendered-width="1180"]');
  expect(await tiltOf(page)).toBeCloseTo(left, 3);
});

test('the mouse brushing onto the frame nudges it, then it settles (EMBROIDERY_BRUSH)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const rest = await tiltOf(page);
  const n = await nailOf(page), x = n.x - n.w * 0.45, y = n.y + n.h * 0.9;
  // The real cursor just beside it: Firefox synthesises moves at the real cursor when the page changes.
  await page.mouse.move(x - 12, y);
  await page.waitForTimeout(100);
  // The pointer arriving on the frame's lower edge and moving on, within the brush's moment. Dispatched
  // directly: real move timing under test load can miss a window this short.
  await page.evaluate(({ x, y }) => {
    const opts = (cx: number) => ({ pointerType: 'mouse', isPrimary: true, clientX: cx, clientY: y, buttons: 0, bubbles: true });
    document.querySelector('.frame')!.dispatchEvent(new PointerEvent('pointerenter', { ...opts(x), bubbles: false }));
    for (const dx of [10, 20, 30]) window.dispatchEvent(new PointerEvent('pointermove', opts(x + dx)));
  }, { x, y });
  if (!CONFIG.EMBROIDERY_BRUSH) {
    await page.waitForTimeout(300);
    expect(await tiltOf(page)).toBe(rest);
    return;
  }
  // Turned by the pointer's sweep about the nail, geared down by the brush ratio (then swinging)
  await expect.poll(async () => Math.abs((await tiltOf(page)) - rest)).toBeGreaterThan(0.01);
  await page.waitForSelector('html[data-frame="still"]', { timeout: 15000 });
  expect(Math.abs((await tiltOf(page)) - rest)).toBeLessThan(CONFIG.EMBROIDERY_SWING_STICK_DEG + 0.5); // a nudge, not a throw
  await expect(page.locator('.frame-card')).not.toHaveClass(/flipped/);
});
