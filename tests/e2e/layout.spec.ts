import { expect, test } from '@playwright/test';

const SIZES = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1000, height: 800 },
  { width: 1440, height: 900 },
];

for (const size of SIZES) {
  test(`layout holds at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    const m = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const row = [...document.querySelectorAll('.grid > .tile')].slice(0, Number(getComputedStyle(document.documentElement).getPropertyValue('--cols-total')));
      const boxes = row.map((t) => t.getBoundingClientRect());
      const first = boxes[0], last = boxes[boxes.length - 1];
      const skirting = document.querySelector('.skirting')!.getBoundingClientRect();
      return {
        vw,
        scrollW: document.documentElement.scrollWidth,
        tile: boxes[1].width,
        square: boxes.every((b) => Math.abs(b.width - b.height) < 0.5),
        leftPeek: first.right,
        rightPeek: vw - last.left,
        innerFits: boxes.slice(1, -1).every((b) => b.left >= -0.5 && b.right <= vw + 0.5),
        edgesBlank: row[0].children.length === 0 && row[row.length - 1].children.length === 0,
        pageEnd: Math.abs(skirting.bottom + scrollY - document.documentElement.scrollHeight) < 1,
      };
    });
    expect(m.scrollW).toBeLessThanOrEqual(m.vw);
    expect(m.square).toBe(true);
    expect(m.innerFits).toBe(true);
    expect(m.edgesBlank).toBe(true);
    expect(m.leftPeek).toBeGreaterThanOrEqual(0.25 * m.tile - 0.5);
    expect(m.rightPeek).toBeGreaterThanOrEqual(0.25 * m.tile - 0.5);
    expect(m.tile).toBeLessThanOrEqual(400);
    expect(m.pageEnd).toBe(true);
  });
}

test('projects render as links in order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tile-project .tile-title').first()).toHaveText('Project One');
});
