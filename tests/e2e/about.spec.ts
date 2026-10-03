import { expect, test } from '@playwright/test';

test('clicking the frame turns it over to the handwritten note; clicking again turns it back', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const card = page.locator('.frame-card'), back = page.locator('.frame-back');
  await expect(back).toHaveAttribute('aria-hidden', 'true');
  await page.locator('.frame').click();
  await expect(card).toHaveClass(/flipped/);
  await expect(back).toHaveAttribute('aria-hidden', 'false');
  await expect(card).toHaveCSS('transform', /^matrix3d\(-1,/); // finished turning over
  // The handwriting is inked onto the paper.
  await page.waitForSelector('.note[data-inked="true"]');
  const inked = await page.locator('.note canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
    return n;
  });
  expect(inked).toBeGreaterThan(1000);
  // Screen readers get the words; the email is a mailto link over its line.
  await expect(page.locator('.note .sr-only')).toContainText('Thank you for visiting.');
  const link = page.locator('.note-link');
  await expect(link).toHaveAttribute('href', 'mailto:nic@mcnoose.com');
  const [lb, nb] = [await link.boundingBox(), await page.locator('.note').boundingBox()];
  expect(lb!.width).toBeGreaterThan(20);
  expect(lb!.x).toBeGreaterThanOrEqual(nb!.x - 1);
  await page.locator('.frame').click({ position: { x: 5, y: 5 } });
  await expect(card).not.toHaveClass(/flipped/);
});

test('the frame turns over from the keyboard too', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.skirting');
  await page.locator('.frame').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.frame-card')).toHaveClass(/flipped/);
  await expect(page.locator('.frame')).toHaveAttribute('aria-pressed', 'true');
});

test('the frame is a solid: four wooden sides as deep as it stands off the wall', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.skirting');
  await expect(page.locator('.frame-card .frame-edge')).toHaveCount(4);
  const depth = await page.locator('.frame-card').evaluate((c) => parseFloat(getComputedStyle(c).getPropertyValue('--frame-depth')));
  expect(depth).toBeGreaterThan(0);
  expect(await page.locator('.frame-edge-top').evaluate((e) => e.getBoundingClientRect().width)).toBeGreaterThan(0);
});
