import { expect, test } from '@playwright/test';

// A GPU reset can wipe canvases that are drawn once and kept (Firefox, plugging in a monitor). The
// page notices the frame's canvas has gone blank and redraws everything.
test('canvases wiped by a GPU reset are redrawn', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('html[data-printed="true"]');
  const centreAlpha = () =>
    page.evaluate(() => {
      const c = document.querySelector('canvas.embroidery') as HTMLCanvasElement;
      return c.getContext('2d')!.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3];
    });
  expect(await centreAlpha()).toBeGreaterThan(0);
  const railBefore = await page.evaluate(() => {
    const c = document.querySelector('.rail .trim-length') as HTMLCanvasElement;
    (window as unknown as { wiped: HTMLCanvasElement }).wiped = c;
    for (const k of document.querySelectorAll<HTMLCanvasElement>('canvas.embroidery, .rail .trim-length')) {
      const ctx = k.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, k.width, k.height);
    }
    return c.width;
  });
  expect(railBefore).toBeGreaterThan(0);
  expect(await centreAlpha()).toBe(0);
  await expect.poll(centreAlpha, { timeout: 6000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.querySelector('.rail .trim-length') !== (window as unknown as { wiped: HTMLCanvasElement }).wiped)).toBe(true);
});
