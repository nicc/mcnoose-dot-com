// Real page-load times of the production build (vite preview of dist/, gzipped as a host would).
// usage: npm run build && node scripts/loadtime.ts
// Desktop unthrottled; phone at 4x CPU throttle on fast and slow 4G (Lighthouse's presets).
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const server = spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const url = 'http://localhost:4175/';
const runs: { name: string; mobile: boolean; cpu: number; net?: { latency: number; down: number } }[] = [
  { name: 'desktop, broadband', mobile: false, cpu: 1 },
  { name: 'phone (4x CPU), fast 4G', mobile: true, cpu: 4, net: { latency: 40, down: 9_000_000 } },
  { name: 'phone (4x CPU), slow 4G', mobile: true, cpu: 4, net: { latency: 150, down: 1_600_000 } },
];
const browser = await chromium.launch();
for (const r of runs) {
  const times: Record<string, number>[] = [];
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext(r.mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('mcnoose-wip-seen', '1');
      (window as any).__long = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => ((window as any).__long += Math.max(0, e.duration - 50)))).observe({ type: 'longtask', buffered: true });
    });
    const cdp = await context.newCDPSession(page);
    if (r.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: r.cpu });
    if (r.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: r.net.latency, downloadThroughput: r.net.down / 8, uploadThroughput: 750_000 / 8 });
    const t0 = Date.now();
    await page.goto(url);
    await page.waitForSelector('html[data-printed="true"]', { timeout: 120000 });
    const printed = Date.now() - t0;
    await page.waitForTimeout(1500); // deferred work (back of frame, skirting) runs in here
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? NaN;
      return { download: nav.responseEnd, fcp, blocking: (window as any).__long };
    });
    times.push({ ...m, printed });
    await context.close();
  }
  const med = (k: string) => times.map((t) => t[k]).sort((a, b) => a - b)[1];
  console.log(`${r.name.padEnd(26)} html downloaded ${med('download').toFixed(0).padStart(5)} ms · first paint ${med('fcp').toFixed(0).padStart(5)} ms · all prints in ${med('printed').toFixed(0).padStart(5)} ms · long-task blocking ${med('blocking').toFixed(0).padStart(5)} ms`);
}
await browser.close();
server.kill();
