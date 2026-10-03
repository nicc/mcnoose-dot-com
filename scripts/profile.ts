// Profiles load, idle, scroll and a simulated window drag (dev server, Chrome CPU profiler + timing
// metrics; the drag fakes window.screenX). usage: node scripts/profile.ts [mobile]  (mobile: phone
// viewport, CPU throttled 4x)
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
const mobile = process.argv[2] === 'mobile';
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem('mcnoose-wip-seen', '1');
  let x = 100;
  Object.defineProperty(window, 'screenX', { get: () => x });
  (window as any).__moveBy = (d: number) => (x += d);
});
const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable');
if (mobile) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m: any) => [m.name, m.value]));
const report = (name: string, profile: any, m0: any, m1: any, ms: number) => {
  const self = new Map<string, number>();
  const dt = profile.timeDeltas as number[];
  const byId = new Map(profile.nodes.map((n: any) => [n.id, n]));
  const counts = new Map<number, number>();
  profile.samples.forEach((id: number, i: number) => counts.set(id, (counts.get(id) ?? 0) + (dt[i] ?? 0)));
  for (const [id, us] of counts) {
    const n: any = byId.get(id);
    const f = n.callFrame, key = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + us / 1000);
  }
  const top = [...self.entries()].filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)')).sort((a, b) => b[1] - a[1]).slice(0, 14);
  const d = (k: string) => ((m1[k] - m0[k]) * 1000).toFixed(0);
  console.log(`\n== ${name} (${ms.toFixed(0)} ms wall) script ${d('ScriptDuration')}ms, style ${d('RecalcStyleDuration')}ms (${(m1.RecalcStyleCount - m0.RecalcStyleCount)}x), layout ${d('LayoutDuration')}ms (${m1.LayoutCount - m0.LayoutCount}x), task ${d('TaskDuration')}ms`);
  for (const [k, v] of top) console.log(`  ${v.toFixed(1).padStart(7)} ms  ${k}`);
};
const phase = async (name: string, fn: () => Promise<void>) => {
  const m0 = await metrics(), t0 = Date.now();
  await cdp.send('Profiler.start');
  await fn();
  const { profile } = await cdp.send('Profiler.stop');
  report(name, profile, m0, await metrics(), Date.now() - t0);
};
await phase('load', async () => {
  await page.goto(server.resolvedUrls!.local[0]);
  await page.waitForSelector('html[data-printed="true"]', { timeout: 120000 });
});
await page.addStyleTag({ content: '.lil-gui { display: none !important }' });
await page.waitForTimeout(1500);
await phase('idle 4s', () => page.waitForTimeout(4000));
await phase('scroll', async () => {
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 25); await page.waitForTimeout(16); }
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, -25); await page.waitForTimeout(16); }
});
if (!mobile) await phase('window drag (60 frames, 4px/frame)', async () => {
  await page.evaluate(() => new Promise<void>((done) => {
    let n = 0;
    const step = () => { (window as any).__moveBy(4); if (++n < 60) requestAnimationFrame(step); else setTimeout(done, 300); };
    requestAnimationFrame(step);
  }));
});
await browser.close(); await server.close();
