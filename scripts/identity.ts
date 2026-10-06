// Pixel-identity check for the procedural drawing: runs each surface's drawing function from the
// working tree and from a git ref (default: HEAD) in one Chromium page, with the same inputs, and
// reports any byte that differs. Gate for optimisations of the hot loops: a change that is meant
// to be invisible must report no diffs. usage: node scripts/identity.ts [ref] [case filter]
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
const root = process.cwd();
const ref = process.argv[2] ?? 'HEAD', filter = process.argv[3] ?? '';
const S = mkdtempSync(join(tmpdir(), 'identity-')); // the ref's src, as served to the page
execSync(`git archive ${ref} src | tar -x -C ${S}`, { cwd: root });
const server = await createServer({ root, server: { port: 0, fs: { allow: [root, S] } }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls!.local[0];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 2 });
page.on('console', (m) => /^\[vite\]|^Canvas2D/.test(m.text()) || console.log('  [page]', m.text()));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(url + 'index.html');
await page.waitForSelector('.skirting');
const results = await page.evaluate(async ({ orig, filter }) => {
  const NEW = '/src/', OLD = `/@fs${orig}/src/`;
  const pix = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  type Case = { name: string; run: (base: string) => Promise<ArrayLike<number> | { a: ArrayLike<number>; b?: ArrayLike<number>; c?: ArrayLike<number> }> };
  const m = async (base: string, p: string) => import(/* @vite-ignore */ base + p);
  const { CONFIG } = await m(NEW, 'config.ts');
  const room0 = await m(OLD, 'room.ts');
  const room = room0.roomFromConfig(CONFIG);
  const lightsAt = (x: number, y: number) => room0.lightsAt(room, { x, y });
  const viewAt = (x: number, y: number) => room0.viewAt(room, { x, y });
  const push = (out: number[], arr: ArrayLike<number>) => { for (let i = 0; i < arr.length; i++) out.push(arr[i]); return out; };
  const flat = (o: any): number[] => (Array.isArray(o) || ArrayBuffer.isView(o) ? push([], o as any) : push(push(push([], o.a), o.b ?? []), o.c ?? []));
  const cases: Case[] = [
    { name: 'noise grid', run: async (b) => { const n = await m(b, 'wood/noise.ts'); const out: number[] = []; for (let i = 0; i < 4000; i++) { const x = (i % 80) * 0.37 - 3, y = Math.floor(i / 80) * 0.53 - 2; out.push(n.hash2(i, i * 3, 7), n.noise(x, y, 11), n.noise(x, y, 11, 7), n.fbm(x, y, 13, 3), n.fbm(x, y, 13, 4, 5), n.fbm(x * 9, y * 9, 17, 2)); } return out; } },
    { name: 'grainMaps frame', run: async (b) => { const g = await m(b, 'wood/grain.ts'); const r = g.grainMaps(600, 60, { early: [113, 72, 46], late: [84, 50, 25], ringPx: 8.7, figure: 0.14, pores: 0.6, drift: 0.4, seed: 48 }); return { a: r.albedo, b: r.gloss, c: r.relief }; } },
    { name: 'grainMaps periodic offset', run: async (b) => { const g = await m(b, 'wood/grain.ts'); const r = g.grainMaps(300, 270, { early: [215, 185, 140], late: [165, 120, 75], figure: 0.5, pores: 0, drift: 0, seed: 23, ringPx: 7 }, 0, 900); return { a: r.albedo, b: r.gloss, c: r.relief }; } },
    { name: 'paintMaps', run: async (b) => { const g = await m(OLD, 'wood/grain.ts'), p = await m(b, 'wood/paint.ts'), pr = await m(OLD, 'trim/profile.ts'); const prof = pr.skirtingProfile({ depthCm: 2.25, torusCm: 2.5, reliefCm: 0.3, flatCm: 10.7 }); const soft = p.softenProfile(prof.at, 0.74, prof.heightCm); const wood = g.grainMaps(300, 270, { early: [215, 185, 140], late: [165, 120, 75], figure: 0.5, pores: 0, drift: 0, seed: 23, ringPx: 7 }, 0, 900); const r = p.paintMaps(wood, 300, 270, soft, { colour: [219, 214, 203], grain: 0.36, brush: 0.49, yellowing: 0.2, buildup: 0.74, pxPerCm: 20, seed: 31 }, 900); return { a: r.albedo, b: r.gloss, c: r.relief }; } },
    { name: 'weather', run: async (b) => { const g = await m(OLD, 'wood/grain.ts'), w = await m(b, 'wood/wear.ts'), bd = await m(OLD, 'wood/board.ts'); const maps = g.grainMaps(400, 50, { early: [113, 72, 46], late: [84, 50, 25], ringPx: 8.7, figure: 0.14, pores: 0.6, drift: 0.4, seed: 48 }); const r = w.weather(maps, 400, 50, bd.frameProfile, { wear: 0.26, grime: 0.71, patches: 0.5, mitres: true, seed: 78 }); return { a: r.albedo, b: r.gloss, c: r.relief }; } },
    { name: 'scuff', run: async (b) => { const g = await m(OLD, 'wood/grain.ts'), sc = await m(b, 'trim/scuffs.ts'); const maps = g.grainMaps(300, 270, { early: [215, 185, 140], late: [165, 120, 75], figure: 0.5, pores: 0, drift: 0, seed: 23, ringPx: 7 }, 0, 900); const r = sc.scuff(maps, 300, 270, { amount: 0.2, low: 0.27, faceTop: 56 }, 900, 20, 71); return { a: r.albedo, b: r.gloss, c: r.relief }; } },
    { name: 'scuff spread', run: async (b) => { const g = await m(OLD, 'wood/grain.ts'), sc = await m(b, 'trim/scuffs.ts'); const maps = g.grainMaps(300, 270, { early: [215, 185, 140], late: [165, 120, 75], figure: 0.5, pores: 0, drift: 0, seed: 23, ringPx: 7 }, 0, 1200); const r = sc.scuff(maps, 300, 270, { amount: 0.9, low: 0.0, faceTop: 56 }, 1200, 20, 73); return { a: r.albedo, b: r.gloss, c: r.relief }; } },
    { name: 'shadeBoard trim', run: async (b) => { const g = await m(OLD, 'wood/grain.ts'), p = await m(OLD, 'wood/paint.ts'), pr = await m(OLD, 'trim/profile.ts'), bd = await m(b, 'wood/board.ts'); const prof = pr.railProfile({ depthCm: 1.8, roundCm: 1.45, beadCm: 0.6, coveCm: 0.1, flatCm: 2.2 }); const soft = p.softenProfile(prof.at, 0.74, prof.heightCm); const wood = g.grainMaps(300, 95, { early: [215, 185, 140], late: [165, 120, 75], figure: 0.5, pores: 0, drift: 0, seed: 23, ringPx: 7 }, 0, 600); const paint = p.paintMaps(wood, 300, 95, soft, { colour: [219, 214, 203], grain: 0.36, brush: 0.49, yellowing: 0.2, buildup: 0.74, pxPerCm: 20, seed: 31 }, 600); const L = (x: number) => lightsAt(x, 100).map((l: any) => ({ dir: l.dir, weight: l.weight })); return bd.shadeBoard(paint, 300, 95, { profile: soft, profileDepth: 36, grainDepth: 1.2, sheen: 0.19, gloss: 0.9, ambient: 0.6, shadowSoftness: 0.2 }, L(120), viewAt(120, 100), { lights: L(135), view: viewAt(135, 100) }); } },
    { name: 'shadeBoard frame', run: async (b) => { const g = await m(OLD, 'wood/grain.ts'), bd = await m(b, 'wood/board.ts'); const maps = g.grainMaps(400, 50, { early: [113, 72, 46], late: [84, 50, 25], ringPx: 8.7, figure: 0.14, pores: 0.6, drift: 0.4, seed: 48 }); return bd.shadeBoard(maps, 400, 50, { profile: bd.frameProfile, profileDepth: 17.5, grainDepth: 1.6, sheen: 0.25, gloss: 0.48, ambient: 0.6 }, lightsAt(130, 132).map((l: any) => ({ dir: l.dir, weight: l.weight })), viewAt(130, 132)); } },
    { name: 'reflectTile', run: async (b) => { const r = await m(b, 'tiles/reflect.ts'); const look = { wall: [206, 189, 161], ceiling: [237, 228, 206], floor: [219, 223, 224], sky: [[205, 222, 240], [236, 241, 244]], sash: [220, 218, 211] }; const out: number[] = []; for (let k = 0; k < 40; k++) { const t = { centre: { x: 20 + k * 11, y: 30 + (k % 7) * 15 }, wCm: 15, hCm: 15, tiltDeg: 1.3, waviness: 0.89, strength: 0.12, seed: k * 7919 ^ 104729 }; push(out, r.reflectTile(room, look, t, [130, 175 - k * 2, 150], 20, 20)); } return out; } },
    { name: 'drawTint', run: async (b) => { const a = await m(b, 'wallpaper/age.ts'); const c = a.drawTint({ x0: -100, x1: 400, yBottom: 130, yTop: 185 }, { yellowing: 0.11, stains: 0.4, seams: 0.2, seam: { gapMm: 0.8, lift: 0.6, tear: 0.3, sharpness: 0.5, dirt: 0.4 }, seamOrigin: 259, halo: 0.12, haloSpreadDeg: 3 }, { wCm: 60, hCm: 42, nail: { x: 130, y: 153 } }); return pix(c); } },
    { name: 'drawSeam', run: async (b) => { const a = await m(b, 'wallpaper/age.ts'); const L = room0.blendedLight(lightsAt(130, 132)); const out: number[] = []; for (const k of [-2, 0, 1, 3]) push(out, pix(a.drawSeam(k, { x0: -100, x1: 400, yBottom: 130, yTop: 185 }, 0.2, { gapMm: 0.8, lift: 0.6, tear: 0.3, sharpness: 0.5, dirt: 0.4 }, 10, 2, L))); push(out, pix(a.drawSeam(2, { x0: -100, x1: 400, yBottom: 130, yTop: 185 }, 1, { gapMm: 2, lift: 1, tear: 1, sharpness: 0.1, dirt: 1 }, 10, 2, L))); return out; } },
    { name: 'drawAgeing', run: async (b) => { const gl = await m(b, 'tiles/glaze.ts'); const out: number[] = []; for (const [col, row, level] of [[3, 0, 0], [5, 4, 0.5], [7, 7, 1]]) { const f = document.createElement('canvas'), mk = document.createElement('canvas'); gl.drawAgeing(f, mk, 150, 150, 1.5, { crazing: 0.26, spots: 0.62 + (0.47 - 0.62) * level, limescale: 0.7 * level, spotSize: 1.2 }, Math.imul(col + 1000, 7919) ^ Math.imul(row + 1000, 104729), { g: 4, topG: row === 0 ? 1 : 4, bottomG: 1, lastRow: row === 7, age: { age: 0.35, grime: 0.52, mould: 0.39, limescale: 0.85, erosion: 0.55, cracks: 0.63, level } }); push(push(out, pix(f)), pix(mk)); } return out; } },
    { name: 'drawDust', run: async (b) => { const d = await m(b, 'trim/dust.ts'); const c = document.createElement('canvas'); c.width = 1200; c.height = 40; const ctx = c.getContext('2d')!; ctx.scale(2, 2); d.drawDust(ctx, -210, 600, 20, 1.21, 0.64, lightsAt(100, 90), 433, 1, undefined, [1, 1, 1, 0.8, 0.5, 0.2, 0.05]); d.drawDust(ctx, -210, 600, 20, 0.5, 0.64, lightsAt(100, 90), 811, 0.7); return pix(c); } },
    { name: 'drawBack', run: async (b) => { const bk = await m(b, 'embroidery/back.ts'); const c = document.createElement('canvas'); const wood = { early: [113, 72, 46], late: [84, 50, 25], ring: 3.3, figure: 0.14, pores: 0.6, drift: 0.4, variation: 0.2, depth: 0.35, sheen: 0.25, gloss: 0.48, wear: 0.26, grime: 0.71, patches: 0.5 }; bk.drawBack(c, 220, 150, 11.4, { wood, view: viewAt(130, 132), tiltDeg: 1, lights: lightsAt(130, 132) }, { paper: [184, 148, 106], stains: 0.3, wear: 0.04, tarnish: 0.48, pxPerCm: 10, hangerDropCm: 0.1, hangerTiltDeg: -0.5 }, 2); return pix(c); } },
    { name: 'drawEmbroidery', run: async (b) => { const dr = await m(b, 'embroidery/draw.ts'), ch = await m(OLD, 'embroidery/chart.ts'); const chart = ch.layoutSampler(['Snickers', 'McNoose'], { w: 83, h: 55 }); const c = document.createElement('canvas'); const style = { stitch: 8.9, frame: 30, colors: { cloth: '#f6f3ea', T: '#2f4f8f', P: '#e8a283', L: '#3f9c94' }, wood: { early: [113, 72, 46], late: [84, 50, 25], ring: 4.35, figure: 0.14, pores: 0.6, drift: 0.4, variation: 0.2, depth: 0.35, sheen: 0.25, gloss: 0.48, wear: 0.26, grime: 0.71, patches: 0.5 }, glass: { tint: 0.38, spots: 0.22, spotSize: 3.2 }, lights: lightsAt(130, 132), view: viewAt(130, 132), dust: { top: 1.24, inner: 0.93, shade: 0.64 }, tiltDeg: 1, dpr: 2 }; dr.drawEmbroidery(c, chart, style, 0.38); return pix(c); } },
    { name: 'trimLength', run: async (b) => { const tl = await m(b, 'trim/length.ts'), pr = await m(OLD, 'trim/profile.ts'); const prof = pr.skirtingProfile({ depthCm: 2.25, torusCm: 2.5, reliefCm: 0.3, flatCm: 10.7 }); const style = { profile: prof, colour: [219, 214, 203], paint: { grain: 0.36, brush: 0.49, buildup: 0.74, yellowing: 0.2, sheen: 0.19, gloss: 0.9 }, wear: 0.11, grime: 0.1, ledgeCm: 0.4, scuffs: { amount: 0.2, low: 0.27, faceTop: prof.heightCm - 10.7 } }; const lit = (x: number) => ({ lights: lightsAt(x, 10), view: viewAt(x, 10) }); const c = tl.trimLength('skirting', 4, 150, prof.heightCm * 10 + 4, 10, 2, lit(60), lit(75), style); return pix(c); } },
    { name: 'wallpaper shade', run: async (b) => { const r = await m(b, 'wallpaper/relief.ts'); const w = 200, h = 160; const hm = r.pebbles(w, h, 2.8); const alb = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < alb.length; i++) alb[i] = (i * 37) & 255; return r.shade(hm, w, h, { albedo: alb, relief: 3.1, lights: lightsAt(130, 132), ambient: 0.88, sheen: 0.5, view: viewAt(130, 132) }); } },
  ];
  const out: { name: string; len: [number, number]; diffs: number; max: number }[] = [];
  for (const c of cases) {
    if (filter && !c.name.includes(filter)) continue;
    const a = flat(await c.run(OLD)), b = flat(await c.run(NEW));
    let diffs = 0, max = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = Math.abs((a[i] ?? NaN) - (b[i] ?? NaN)); if (!(d === 0)) { diffs++; max = Math.max(max, d || Infinity); } }
    out.push({ name: c.name, len: [a.length, b.length], diffs, max });
  }
  return out;
}, { orig: S, filter });
let bad = 0;
for (const r of results) { if (r.diffs) bad++; console.log(`${r.diffs ? 'DIFF' : ' ok '} ${r.name.padEnd(26)} n=${r.len[0]}${r.len[0] !== r.len[1] ? '/' + r.len[1] : ''} diffs=${r.diffs} max=${r.max}`); }
await browser.close(); await server.close();
rmSync(S, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
