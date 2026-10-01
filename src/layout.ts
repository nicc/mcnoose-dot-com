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

// The wall's fixed world position, chosen once (centred) and kept across resizes so
// the window reads as a portal onto a wall rather than a layout that reflows.
export interface Anchor {
  tile: number;
  grout: number;
  pitch: number;
  originX: number; // left edge of tile column 0, in viewport px
  centreX: number; // first-render viewport centre: embroidery and bull-nose reference
}

export function initialAnchor(input: LayoutInput): Anchor {
  const l = computeLayout(input);
  return { tile: l.tile, grout: input.grout, pitch: l.pitch, originX: l.gridLeft, centreX: input.width / 2 };
}

export interface Columns {
  first: number; // leftmost column index (relative to origin) with any part visible
  count: number;
  full: number[]; // indices of fully visible columns: projects go here
}

export function visibleColumns(a: Anchor, width: number): Columns {
  const first = Math.floor((-a.originX - a.tile) / a.pitch + EPS) + 1;
  const last = Math.ceil((width - a.originX) / a.pitch - EPS) - 1;
  const full: number[] = [];
  for (let k = first; k <= last; k++) {
    const x = a.originX + k * a.pitch;
    if (x >= -EPS && x + a.tile <= width + EPS) full.push(k);
  }
  return { first, count: last - first + 1, full };
}

// The anchor holds while some full tile still shows minPeek of each neighbour and fits the height.
export function anchorFits(a: Anchor, width: number, height: number, minPeek: number): boolean {
  if (a.tile > (height - 2 * a.grout) / (1 + 2 * minPeek) + EPS) return false;
  const margin = a.grout + minPeek * a.tile - EPS;
  const k = Math.ceil((margin - a.originX) / a.pitch - EPS); // first column clearing the left margin
  return a.originX + k * a.pitch + a.tile <= width - margin;
}

export interface StripInput {
  width: number;
  origin: number; // fixed reference x for the joint pattern
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

// Bull-nose joints sit at a fixed origin plus an arbitrary offset, so the row reads
// as a patch of wall rather than a centred composition.
export function computeStrip({ width, origin, tile, grout, widthRatio, offset }: StripInput): Strip {
  const w = tile * widthRatio;
  const pitch = w + grout;
  const anchor = origin + offset * pitch;
  const start = (((anchor % pitch) + pitch) % pitch) - pitch;
  return { width: w, pitch, start, count: Math.ceil((width - start) / pitch) };
}

export function rowCount(projects: number, columns: number, trailing: number): number {
  return Math.ceil(projects / columns) + trailing;
}
