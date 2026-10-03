import { expect, test, type Page } from '@playwright/test';

// Left open, the page must not keep eating resources. Each cycle drives everything that creates
// work — window drags (pinned redraws), resizes, a scroll to the bottom and back, turning the frame
// over and back, and idle time with the clouds running — then measures heap, DOM nodes and
// listeners after a full garbage collection. Caches fill on the first cycle; after that, repeating
// the same things must not grow anything.
test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'needs Chrome DevTools Protocol, desktop pinning');

test('repeating the same things, or idling, does not grow memory', async ({ page, context }) => {
  test.slow();
  await page.addInitScript(() => {
    let x = 200;
    Object.defineProperty(window, 'screenX', { get: () => x });
    (window as unknown as { __moveBy: (d: number) => void }).__moveBy = (d) => (x += d);
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForSelector('html[data-printed="true"]');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const measure = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
    return { heapMB: m.JSHeapUsedSize / 2 ** 20, nodes: m.Nodes, listeners: m.JSEventListeners };
  };

  const cycle = async (p: Page) => {
    // Drag the window right and back (the same positions each time).
    await p.evaluate(() => new Promise<void>((done) => {
      let n = 0;
      const step = () => {
        (window as unknown as { __moveBy: (d: number) => void }).__moveBy(n < 30 ? 6 : -6);
        if (++n < 60) requestAnimationFrame(step);
        else setTimeout(done, 200);
      };
      requestAnimationFrame(step);
    }));
    await p.waitForSelector('html[data-pin="settled"]');
    for (const w of [1240, 1280]) {
      await p.setViewportSize({ width: w, height: 800 });
      await p.waitForSelector(`html[data-rendered-width="${w}"]`);
    }
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(150);
    await p.evaluate(() => scrollTo(0, 0));
    await p.locator('.frame').click();
    await p.waitForTimeout(300);
    await p.locator('.frame').click({ position: { x: 5, y: 5 } });
    await p.waitForTimeout(1500); // idle, clouds running
  };

  await cycle(page); // warm: caches fill
  const first = await measure();
  for (let i = 0; i < 4; i++) await cycle(page);
  const last = await measure();
  console.log('memory', JSON.stringify({ first, last }));
  expect(last.heapMB - first.heapMB).toBeLessThan(3);
  expect(last.nodes - first.nodes).toBeLessThan(300);
  expect(last.listeners - first.listeners).toBeLessThan(50);
});
