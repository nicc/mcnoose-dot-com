// One-off asset prep: scan → seamless half-drop repeat (src/wallpaper/scan.webp), a per-pixel
// ink map (src/wallpaper/inks.png) and the ink palette (src/wallpaper/palette.json).
// Source: Sidewall, ca. 1875, Cooper Hewitt, Smithsonian Design Museum, 1939-45-7-a/b (CC0).
// Run: node scripts/prepare-wallpaper.ts [previewDir]
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { classifyInks, modeFilter, refineShift, seamlessTile, type Gray, type Vec, type Vec3 } from '../tools/wallpaper-prep.ts';

const SRC = 'wallpaper-src/chndm-1939-45-7.jpg';
const CROP = { left: 320, top: 40, width: 3080, height: 3380 }; // printed area: excludes selvedge, annotation, smudge
const GUESS_A: Vec = [2106, 0]; // horizontal repeat, from eyeballing flower positions
const GUESS_B: Vec = [1092, 1423]; // half-drop step
const COARSE = 4;
const FEATHER = 160;
const OUT_WIDTH = 1200;
// Seeds sampled from the scan; refined by classification. Order = index in inks.png.
const INKS: [string, Vec3][] = [
  ['ground', [190, 176, 144]],
  ['foliage', [163, 162, 140]], // grey-green background sprigs
  ['vine', [156, 176, 161]], // aqua stems and leaves
  ['petal', [197, 173, 133]],
  ['berry', [168, 143, 111]], // tan berries, buds and flower centres
  ['outline', [122, 110, 91]],
];
const INDEX_STEP = 40; // ink i stored as grey i·40: robust to colour management when decoded

const gray = async (scale: number): Promise<Gray> => {
  const { data, info } = await sharp(SRC).extract(CROP).resize(Math.round(CROP.width / scale)).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data: Float32Array.from(data), w: info.width, h: info.height };
};

const coarse = await gray(COARSE);
const scaled = (v: Vec): Vec => [Math.round(v[0] / COARSE), Math.round(v[1] / COARSE)];
const ca = refineShift(coarse, scaled(GUESS_A), 25);
const cb = refineShift(coarse, scaled(GUESS_B), 25);
const fine = await gray(1);
const a = refineShift(fine, [ca.shift[0] * COARSE, ca.shift[1] * COARSE], COARSE + 1);
const b = refineShift(fine, [cb.shift[0] * COARSE, cb.shift[1] * COARSE], COARSE + 1);
const c: Vec = [2 * b.shift[0] - a.shift[0], 2 * b.shift[1] - a.shift[1]]; // vertical repeat of the half-drop
console.log('a', a, 'b', b, 'c', c);

const rgb = await sharp(SRC).extract(CROP).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = a.shift[0], H = c[1];
const tile = seamlessTile({ data: rgb.data, w: rgb.info.width, h: rgb.info.height }, [24, 24], a.shift, c, W, H, FEATHER);
if (24 + W + FEATHER + Math.abs(c[0]) > CROP.width || 24 + H + FEATHER > CROP.height) throw new Error('crop too small for one repeat + feather');

const outH = Math.round((OUT_WIDTH * H) / W);
const out = await sharp(Buffer.from(tile), { raw: { width: W, height: H, channels: 3 } }).resize(OUT_WIDTH, outH, { kernel: 'lanczos3' });
await out.clone().webp({ quality: 86 }).toFile('src/wallpaper/scan.webp');

const small = await out.clone().raw().toBuffer();
const { index, inks } = classifyInks(small, INKS.map(([, rgb]) => rgb));
const clean = modeFilter(modeFilter(index, OUT_WIDTH, outH, INKS.length), OUT_WIDTH, outH, INKS.length);
await sharp(Buffer.from(clean.map((i) => i * INDEX_STEP)), { raw: { width: OUT_WIDTH, height: outH, channels: 1 } })
  .png({ compressionLevel: 9, palette: false })
  .toFile('src/wallpaper/inks.png');

const hex = (c: Vec3) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const share = (k: number) => clean.reduce((n, i) => n + (i === k ? 1 : 0), 0) / clean.length;
const palette = INKS.map(([name], k) => ({ name, rgb: inks[k], hex: hex(inks[k]), share: Number(share(k).toFixed(4)) }));
writeFileSync(
  'src/wallpaper/palette.json',
  JSON.stringify({ source: 'Sidewall, ca. 1875, Cooper Hewitt, Smithsonian Design Museum, 1939-45-7 (CC0)', indexStep: INDEX_STEP, inks: palette }, null, 2) + '\n',
);
console.log(palette.map((p) => `${p.name.padEnd(8)} ${p.hex} ${(p.share * 100).toFixed(1)}%`).join('\n'));

const preview = process.argv[2];
if (preview) {
  // 2×2 repeat to inspect seams by eye.
  const one = await out.clone().png().toBuffer();
  await sharp(Buffer.from(clean.map((i) => i * INDEX_STEP)), { raw: { width: OUT_WIDTH, height: outH, channels: 1 } }).resize(OUT_WIDTH / 2).png().toFile(`${preview}/wallpaper-inks.png`);
  await sharp({ create: { width: OUT_WIDTH * 2, height: outH * 2, channels: 3, background: '#000' } })
    .composite([0, 1].flatMap((i) => [0, 1].map((j) => ({ input: one, left: i * OUT_WIDTH, top: j * outH }))))
    .resize(OUT_WIDTH)
    .png()
    .toFile(`${preview}/wallpaper-2x2.png`);
}
