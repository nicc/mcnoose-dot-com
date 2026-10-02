import { expect, test } from '@playwright/test';

// projects.json sits next to index.html and is read at load time: no rebuild to add a project.
test('the wall shows whatever projects.json says when the page loads', async ({ page }) => {
  await page.route('**/projects.json', (route) =>
    route.fulfill({ json: [{ title: 'Only One', url: 'https://example.com', logo: 'placeholder.svg' }, { title: 'Bad entry' }] }),
  );
  await page.goto('/');
  await page.waitForSelector('html[data-printed="true"]');
  await expect(page.locator('.tile-project')).toHaveCount(1);
  await expect(page.locator('.tile-project .tile-title')).toHaveText('Only One');
});

test('without projects.json the wall still draws, empty', async ({ page }) => {
  await page.route('**/projects.json', (route) => route.fulfill({ status: 404 }));
  await page.goto('/');
  await expect(page.locator('.grid > .tile').first()).toBeVisible();
  await expect(page.locator('.skirting')).toBeVisible();
  await expect(page.locator('.tile-project')).toHaveCount(0);
});
