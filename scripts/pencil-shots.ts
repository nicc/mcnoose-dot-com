// The loading drawing, frame by frame, as a production load on a throttled connection sees it.
// usage: npm run build && node scripts/pencil-shots.ts [desktop|phone] [slow|fast|none]
// Writes shots/pencil/<device>-<network>-<ms>.png every STEP_MS until the drawing has faded away.
// Recorded from the compositor (CDP screencast), so it keeps going while the main thread is busy
// building the scene, as the drawing does; screenshots would stall there.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const STEP_MS = 250;
const [device = 'desktop', network = 'slow'] = process.argv.slice(2);
const NETWORKS: Record<string, { latency: number; down: number } | undefined> = { slow: { latency: 150, down: 1_600_000 }, fast: { latency: 40, down: 9_000_000 }, none: undefined };
const phone = device === 'phone';
const dir = 'shots/pencil';
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const context = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.addInitScript(() => localStorage.setItem('mcnoose-wip-seen', '1'));
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const net = NETWORKS[network];
if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: net.down / 8, uploadThroughput: 750_000 / 8 });
const t0 = Date.now();
let next = 0;
cdp.on('Page.screencastFrame', (f) => {
  const ms = Date.now() - t0;
  if (ms >= next) {
    writeFileSync(`${dir}/${device}-${network}-${String(ms).padStart(5, '0')}.png`, Buffer.from(f.data, 'base64'));
    next = ms + STEP_MS;
  }
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'png' });
await page.goto('http://localhost:4176/');
await page.waitForSelector('html[data-pencil="done"]', { timeout: 30000 });
const marks = await page.evaluate(() => (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map((r) => `${r.name.split('/').pop()} ${Math.round(r.responseEnd)}ms`));
console.log(dir, '\n' + marks.join('\n'));
await browser.close();
server.kill();
