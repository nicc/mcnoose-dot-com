import { chromium, firefox, webkit } from '@playwright/test';
import { createServer } from 'vite';
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
for (const [name, b] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]] as const) {
  const browser = await b.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => localStorage.setItem('mcnoose-wip-seen', '1'));
  await page.goto(server.resolvedUrls!.local[0]);
  await page.waitForSelector('html[data-printed="true"]');
  await page.addStyleTag({ content: '.lil-gui, .cloud-shade { display: none !important } .frame-card { transition: none !important }' });
  const f = (await page.locator('.frame-shadow').boundingBox())!;
  const clip = { x: f.x - 60, y: f.y - 40, width: f.width + 120, height: f.height + 80 };
  for (const deg of [30, 75, 120, 0]) {
    await page.evaluate((d) => ((document.querySelector('.frame-card') as HTMLElement).style.transform = 'rotateY(' + d + 'deg)'), deg);
    await page.waitForTimeout(100);
    await page.screenshot({ path: '/private/tmp/claude-501/-Users-nicyoung-source-play-mcnoose-dot-com/4a6e25ab-b31a-4465-8d11-f3cd8c59e3f7/scratchpad/edge-' + name + '-' + deg + '.png', clip });
  }
  await browser.close();
}
await server.close();
