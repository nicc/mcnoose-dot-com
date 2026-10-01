// Hand-charted cross-stitch: a sampler alphabet (only the letters we use), corner florals, and
// a layout that places them on the cloth. Each cell is one X stitch: T thread, P petal, L leaf.

export type Ink = 'T' | 'P' | 'L';

export interface Chart {
  w: number; // cloth width in stitches
  h: number;
  cells: (Ink | null)[]; // row-major
}

// 9 rows: caps fill rows 0–8, lowercase x-height rows 3–8, baseline at row 8.
const GLYPHS: Record<string, string[]> = {
  S: ['.####.', '##..##', '##....', '.##...', '..##..', '...##.', '....##', '##..##', '.####.'],
  M: ['##.....##', '###...###', '####.####', '##.###.##', '##..#..##', '##.....##', '##.....##', '##.....##', '##.....##'],
  N: ['##....##', '###...##', '####..##', '##.##.##', '##..####', '##...###', '##....##', '##....##', '##....##'],
  c: ['.....', '.....', '.....', '.###.', '##..#', '##...', '##...', '##..#', '.###.'],
  e: ['.....', '.....', '.....', '.###.', '##.##', '#####', '##...', '##..#', '.###.'],
  i: ['..', '##', '..', '##', '##', '##', '##', '##', '##'],
  k: ['##...', '##...', '##...', '##.##', '####.', '###..', '####.', '##.##', '##.##'],
  n: ['.....', '.....', '.....', '####.', '##.##', '##.##', '##.##', '##.##', '##.##'],
  o: ['.....', '.....', '.....', '.###.', '##.##', '##.##', '##.##', '##.##', '.###.'],
  r: ['.....', '.....', '.....', '##.##', '####.', '##...', '##...', '##...', '##...'],
  s: ['.....', '.....', '.....', '.####', '##...', '.###.', '...##', '...##', '####.'],
};
export const GLYPH_ROWS = 9;
const LETTER_GAP = 1;
const LINE_GAP = 3;

// Corner sprig for the top-left; the bottom-right is the same rotated 180°.
const FLORAL = [
  '..P.P.......',
  '.PPPPP......',
  'PPPLPPP.....',
  '.PPPPP......',
  '..P.PL......',
  '......L.....',
  '...LL..L....',
  '..LLLLLL....',
  '...LL...L.LL',
  '........LLLL',
  '.........LL.',
  '............',
];

type Block = { w: number; h: number; at: (x: number, y: number) => Ink | null };

function fromRows(rows: string[]): Block {
  return { w: rows[0].length, h: rows.length, at: (x, y) => (rows[y][x] === '.' ? null : (rows[y][x] === '#' ? 'T' : (rows[y][x] as Ink))) };
}

export function textBlock(lines: string[]): Block {
  const glyphs = lines.map((line) => [...line].map((ch) => (ch === ' ' ? null : fromRows(GLYPHS[ch] ?? (() => { throw new Error(`no glyph: ${ch}`); })()))));
  const widths = glyphs.map((g) => g.reduce((w, b) => w + (b ? b.w : 3), 0) + LETTER_GAP * (g.length - 1));
  const w = Math.max(...widths);
  const h = lines.length * GLYPH_ROWS + (lines.length - 1) * LINE_GAP;
  const grid: (Ink | null)[] = new Array(w * h).fill(null);
  glyphs.forEach((g, li) => {
    let x = Math.floor((w - widths[li]) / 2);
    const y0 = li * (GLYPH_ROWS + LINE_GAP);
    for (const b of g) {
      if (b) for (let y = 0; y < b.h; y++) for (let gx = 0; gx < b.w; gx++) grid[(y0 + y) * w + x + gx] ??= b.at(gx, y);
      x += (b ? b.w : 3) + LETTER_GAP;
    }
  });
  return { w, h, at: (x, y) => grid[y * w + x] };
}

const rotate180 = (b: Block): Block => ({ ...b, at: (x, y) => b.at(b.w - 1 - x, b.h - 1 - y) });

function collides(chart: Chart, b: Block, ox: number, oy: number, clearance: number): boolean {
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      if (!b.at(x, y)) continue;
      for (let dy = -clearance; dy <= clearance; dy++)
        for (let dx = -clearance; dx <= clearance; dx++) {
          const cx = ox + x + dx, cy = oy + y + dy;
          if (cx >= 0 && cy >= 0 && cx < chart.w && cy < chart.h && chart.cells[cy * chart.w + cx]) return true;
        }
    }
  return false;
}

function stamp(chart: Chart, b: Block, ox: number, oy: number) {
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) chart.cells[(oy + y) * chart.w + ox + x] ??= b.at(x, y);
}

// Text centred; florals in the top-left and bottom-right corners. The cloth grows taller until
// florals clear the lettering by a stitch, so any text fits.
export function layoutSampler(lines: string[], margin = 3, sidePad = 4): Chart {
  const text = textBlock(lines);
  const floral = fromRows(FLORAL);
  const w = text.w + 2 * (margin + sidePad);
  for (let h = text.h + 2 * margin; ; h++) {
    const chart: Chart = { w, h, cells: new Array(w * h).fill(null) };
    stamp(chart, text, Math.floor((w - text.w) / 2), Math.floor((h - text.h) / 2));
    const tl = [margin - 1, margin - 1] as const;
    const br = [w - margin + 1 - floral.w, h - margin + 1 - floral.h] as const;
    if (collides(chart, floral, ...tl, 1) || collides(chart, rotate180(floral), ...br, 1)) continue;
    stamp(chart, floral, ...tl);
    stamp(chart, rotate180(floral), ...br);
    return chart;
  }
}
