// Screenshot loop for aesthetic iteration: `npm run shots [-- chromium|firefox|webkit]`.
// Runs the dev server, writes viewport + full-page PNGs to shots/<browser>/.
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

const name = (process.argv[2] ?? 'chromium') as 'chromium' | 'firefox' | 'webkit';
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls!.local[0];
const browser = await { chromium, firefox, webkit }[name].launch();
mkdirSync(`shots/${name}`, { recursive: true });
for (const [label, viewport] of Object.entries(VIEWPORTS)) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.goto(url);
  await page.addStyleTag({ content: '.lil-gui { display: none !important }' });
  await page.screenshot({ path: `shots/${name}/${label}.png` });
  await page.screenshot({ path: `shots/${name}/${label}-full.png`, fullPage: true });
  await page.close();
}
await browser.close();
await server.close();
console.log(`shots/${name}/`);
