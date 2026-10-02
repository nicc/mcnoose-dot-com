import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('a first visit sees the work-in-progress notice once; it closes and stays closed', async ({ page }) => {
  await page.goto('/');
  const notice = page.locator('dialog.notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('This site is still being built.');
  await notice.getByRole('button', { name: 'OK' }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('html[data-printed="true"]');
  await expect(page.locator('dialog.notice')).toHaveCount(0);
});
