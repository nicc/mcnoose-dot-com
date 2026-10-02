import { expect, test } from '@playwright/test';

test('clicking the frame turns it over to the note from about.md; clicking again turns it back', async ({ page }) => {
  await page.route('**/about.md', (route) => route.fulfill({ body: '# Hi there\n\nA line\nand another\n\n- [a link](https://example.com)' }));
  await page.goto('/');
  await page.waitForSelector('.skirting');
  const card = page.locator('.frame-card'), back = page.locator('.frame-back');
  await expect(back).toHaveAttribute('aria-hidden', 'true');
  await page.locator('.frame').click();
  await expect(card).toHaveClass(/flipped/);
  await expect(back).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.note h2')).toHaveText('Hi there');
  await expect(page.locator('.note p br')).toHaveCount(1);
  await expect(card).toHaveCSS('transform', /^matrix3d\(-1,/); // finished turning over
  const link = page.locator('.note a');
  await expect(link).toHaveAttribute('target', '_blank');
  // Following the note's link opens it and leaves the frame turned over.
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  await popup.close();
  await expect(card).toHaveClass(/flipped/);
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

test('the note fits its paper', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.skirting');
  await page.locator('.frame').click();
  const fits = await page.locator('.note').evaluate((n) => n.scrollHeight <= n.clientHeight + 1 && parseFloat(getComputedStyle(n).fontSize) > 4);
  expect(fits).toBe(true);
});
