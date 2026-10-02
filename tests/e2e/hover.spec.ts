import { expect, test } from '@playwright/test';

test('project links open in a new tab', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const link = page.locator('.tile-project').first();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
});

test('hovering a project tile fades the print to the original logo', async ({ page, isMobile }) => {
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
  await expect(tile.locator('.tile-clean')).toHaveCSS('opacity', '0');
  await tile.hover();
  await expect(tile.locator('.tile-clean')).toHaveCSS('opacity', '1');
  await expect(tile.locator('.tile-ink')).toHaveCSS('opacity', '0');
  await page.mouse.move(5, 5);
  await expect(tile.locator('.tile-ink')).toHaveCSS('opacity', '1');
});
