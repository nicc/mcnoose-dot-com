import { expect, test } from '@playwright/test';
import { CONFIG } from '../../src/config';

test('project links open in a new tab', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const link = page.locator('.tile-project').first();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
});

test('hovering a project tile crossfades to the original logo and back (when PRINT_HOVER_REVEAL is on)', async ({ page, isMobile }) => {
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
  const opacity = (part: string) => () => tile.locator(part).evaluate((e) => parseFloat(getComputedStyle(e).opacity));
  const clean = opacity('.tile-clean'), ink = opacity('.tile-ink');
  expect(await clean()).toBe(0);
  expect(await ink()).toBe(1);
  await tile.hover();
  if (!CONFIG.PRINT_HOVER_REVEAL) {
    await page.waitForTimeout(CONFIG.PRINT_HOVER_FADE_MS + 100);
    expect(await clean()).toBe(0); // toggled off: the print stays
    return;
  }
  await expect.poll(clean).toBe(1);
  await expect.poll(ink).toBe(0);
  await page.mouse.move(5, 5);
  // The fade back starts at once: a running transition by the next frame, nothing holding it back.
  const fading = await tile.locator('.tile-clean').evaluate(async (e) => {
    await new Promise((r) => requestAnimationFrame(r));
    return e.getAnimations().some((a) => a.playState === 'running' && Number(a.effect?.getTiming().delay) === 0);
  });
  expect(fading).toBe(true);
  await expect.poll(clean).toBe(0);
  await expect.poll(ink).toBe(1);
});
