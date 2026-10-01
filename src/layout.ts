// Pure layout maths. Everything visual hangs off these numbers.

export interface LayoutInput {
  width: number; // viewport width, excluding scrollbar
  height: number; // small viewport height (svh)
  tileMax: number;
  grout: number;
  minPeek: number;
}

export interface Layout {
  tile: number; // square tile edge
  pitch: number; // tile + grout
  columns: number; // full columns (projects live here)
  peek: number; // visible px of each edge partial tile
  gridWidth: number; // columns + 2 edge tiles, grout between
  gridLeft: number; // x of grid's left edge relative to viewport (≤ 0)
}

const EPS = 1e-6;

export function computeLayout({ width, height, tileMax, grout, minPeek }: LayoutInput): Layout {
  // A full tile, its two grout joints, and minPeek of a tile either side must fit in both axes.
  const span = 1 + 2 * minPeek;
  const tile = Math.max(1, Math.min(tileMax, (width - 2 * grout) / span, (height - 2 * grout) / span));
  const pitch = tile + grout;

  // N full tiles occupy N·tile + (N+1)·grout; the rest is split between the edge partials.
  // Add a column only while doing so still leaves minPeek visible on each side.
  let columns = 1;
  let rest = width - tile - 2 * grout;
  while (rest - pitch >= 2 * minPeek * tile - EPS) {
    columns++;
    rest -= pitch;
  }

  const peek = rest / 2;
  const gridWidth = (columns + 2) * tile + (columns + 1) * grout;
  return { tile, pitch, columns, peek, gridWidth, gridLeft: (width - gridWidth) / 2 };
}

export interface StripInput {
  width: number;
  tile: number;
  grout: number;
  widthRatio: number;
  offset: number; // 0–1 of a bull-nose pitch
}

export interface Strip {
  width: number; // one bull-nose tile
  pitch: number;
  start: number; // x of the first tile's left edge (≤ 0)
  count: number;
}

// Bull-nose joints are anchored to page centre plus an arbitrary offset, so the
// row reads as a patch of wall rather than a centred composition.
export function computeStrip({ width, tile, grout, widthRatio, offset }: StripInput): Strip {
  const w = tile * widthRatio;
  const pitch = w + grout;
  const anchor = width / 2 + offset * pitch;
  const start = (((anchor % pitch) + pitch) % pitch) - pitch;
  return { width: w, pitch, start, count: Math.ceil((width - start) / pitch) };
}

export function rowCount(projects: number, columns: number, trailing: number): number {
  return Math.ceil(projects / columns) + trailing;
}
