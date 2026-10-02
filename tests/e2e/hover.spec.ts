import { expect, test } from '@playwright/test';
import { CONFIG } from '../../src/config';

test('project links open in a new tab', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const link = page.locator('.tile-project').first();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
});

test('hovering a project tile opens the original logo out from its centre (when PRINT_HOVER_REVEAL is on)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'no hover on touch');
  await page.goto('/');
  await page.waitForSelector('html[data-printed="true"]');
  const tile = page.locator('.tile-project').first();
  // The clean version is drawn (has ink) and hidden until hover.
  const inked = await tile.locator('.tile-clean').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  expect(inked).toBeGreaterThan(500);
  const reveal = () => tile.evaluate((t) => parseFloat(getComputedStyle(t).getPropertyValue('--reveal')));
  expect(await reveal()).toBe(0);
  await tile.hover();
  if (!CONFIG.PRINT_HOVER_REVEAL) {
    await page.waitForTimeout(CONFIG.PRINT_HOVER_FADE_MS + 100);
    expect(await reveal()).toBe(0); // toggled off: the print stays
    return;
  }
  await expect.poll(reveal).toBe(120); // opened out past the corners
  await page.mouse.move(5, 5);
  await expect.poll(reveal).toBe(0);
});

test('the reveal opens from the logo, not the tile centre', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const y = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--logo-y')));
  expect(y).toBeGreaterThan(30);
  expect(y).toBeLessThan(50); // the logo sits above the title
});
