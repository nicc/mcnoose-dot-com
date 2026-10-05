// The README's picture of the wall: `npm run readme:wall` → docs/readme/wall.jpg.
// Same view as the desktop shot (npm run shots), taken once printed, before the sun starts to set.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { createServer } from 'vite';

const OUT = 'docs/readme/wall.jpg';
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript(() => localStorage.setItem('mcnoose-wip-seen', '1')); // no notice
await page.goto(server.resolvedUrls!.local[0]);
await page.waitForSelector('html[data-printed="true"]');
await page.addStyleTag({ content: '.lil-gui { display: none !important }' });
const png = await page.screenshot();
await sharp(png).resize({ width: 1600 }).jpeg({ quality: 84, mozjpeg: true }).toFile(OUT);
await browser.close();
await server.close();
console.log(OUT);
