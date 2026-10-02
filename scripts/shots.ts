// Screenshot loop for aesthetic iteration: `npm run shots [-- chromium|firefox|webkit] [--fixtures]`.
// Runs the dev server, writes viewport, full-page and per-tile close-up PNGs to shots/<browser>[-fixtures]/.
import { chromium, firefox, webkit } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
  'phone-landscape': { width: 844, height: 390 },
};

const args = process.argv.slice(2);
const fixtures = args.includes('--fixtures');
const name = (args.find((a) => !a.startsWith('--')) ?? 'chromium') as 'chromium' | 'firefox' | 'webkit';
const dir = `shots/${name}${fixtures ? '-fixtures' : ''}`;
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls!.local[0] + (fixtures ? '?fixtures' : '');
const browser = await { chromium, firefox, webkit }[name].launch();
mkdirSync(dir, { recursive: true });
for (const [label, viewport] of Object.entries(VIEWPORTS)) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.addInitScript(() => localStorage.setItem('mcnoose-wip-seen', '1')); // no notice in shots
  await page.goto(url);
  await page.waitForSelector('html[data-printed="true"]');
  await page.addStyleTag({ content: '.lil-gui { display: none !important }' });
  await page.screenshot({ path: `${dir}/${label}.png` });
  await page.screenshot({ path: `${dir}/${label}-full.png`, fullPage: true });
  if (label === 'desktop' || label === 'phone') {
    const tiles = page.locator('.tile-project');
    for (let i = 0; i < (await tiles.count()); i++) await tiles.nth(i).screenshot({ path: `${dir}/${label}-tile-${i}.png` });
  }
  await page.close();
}
await browser.close();
await server.close();
console.log(dir);
