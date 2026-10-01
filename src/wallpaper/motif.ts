// Draws one repeat of the embossed motif as a height map: black = recessed, white = raised.
// An ogee lattice of beaded lines with a rosette in each cell, leaves around it and buds
// where the lattice meets. Drawn 3×3 times offset so shapes crossing an edge wrap.

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const grey = (v: number) => `rgb(${v * 255},${v * 255},${v * 255})`;

function lattice(ctx: Ctx, W: number, H: number) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.bezierCurveTo(W / 2, 0.22 * H, W, 0.28 * H, W, H / 2);
    ctx.bezierCurveTo(W, 0.72 * H, W / 2, 0.78 * H, W / 2, H);
    ctx.bezierCurveTo(W / 2, 0.78 * H, 0, 0.72 * H, 0, H / 2);
    ctx.bezierCurveTo(0, 0.28 * H, W / 2, 0.22 * H, W / 2, 0);
  };
  ctx.lineCap = 'round';
  path();
  ctx.strokeStyle = grey(0.5);
  ctx.lineWidth = 0.032 * W;
  ctx.stroke();
  path();
  ctx.strokeStyle = grey(0.72); // raised bead along the lattice
  ctx.lineWidth = 0.014 * W;
  ctx.stroke();
}

function petals(ctx: Ctx, x: number, y: number, n: number, dist: number, rx: number, ry: number, rot: number, v: number, vein: number) {
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot + (i * 2 * Math.PI) / n);
    ctx.beginPath();
    ctx.ellipse(0, -dist, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = grey(v);
    ctx.fill();
    ctx.beginPath(); // recessed vein
    ctx.moveTo(0, -dist + ry * 0.7);
    ctx.lineTo(0, -dist - ry * 0.7);
    ctx.strokeStyle = grey(vein);
    ctx.lineWidth = rx * 0.18;
    ctx.stroke();
    ctx.restore();
  }
}

function leaf(ctx: Ctx, x: number, y: number, angle: number, len: number, wid: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
  ctx.fillStyle = grey(0.62);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(len * 0.08, 0);
  ctx.lineTo(len * 0.9, 0);
  ctx.strokeStyle = grey(0.42);
  ctx.lineWidth = wid * 0.16;
  ctx.stroke();
  for (let t = 0.3; t < 0.85; t += 0.18) {
    ctx.beginPath(); // side veins
    ctx.moveTo(len * t, 0);
    ctx.lineTo(len * (t + 0.1), -wid * 0.45);
    ctx.moveTo(len * t, 0);
    ctx.lineTo(len * (t + 0.1), wid * 0.45);
    ctx.lineWidth = wid * 0.08;
    ctx.stroke();
  }
  ctx.restore();
}

// Small leaf pairs along the lattice, pointing into the cell.
function sprigs(ctx: Ctx, W: number, H: number) {
  for (const [x, y, a] of [
    [0.82 * W, 0.3 * H, Math.PI * 0.8],
    [0.18 * W, 0.3 * H, Math.PI * 0.2],
    [0.82 * W, 0.7 * H, -Math.PI * 0.8],
    [0.18 * W, 0.7 * H, -Math.PI * 0.2],
  ] as const) {
    leaf(ctx, x, y, a - 0.35, 0.11 * W, 0.035 * W);
    leaf(ctx, x, y, a + 0.35, 0.11 * W, 0.035 * W);
  }
}

function bud(ctx: Ctx, x: number, y: number, W: number) {
  petals(ctx, x, y, 4, 0.03 * W, 0.022 * W, 0.034 * W, Math.PI / 4, 0.7, 0.5);
  ctx.beginPath();
  ctx.arc(x, y, 0.016 * W, 0, Math.PI * 2);
  ctx.fillStyle = grey(0.9);
  ctx.fill();
}

function cell(ctx: Ctx, W: number, H: number) {
  lattice(ctx, W, H);
  sprigs(ctx, W, H);
  const cx = W / 2, cy = H / 2;
  for (const a of [-0.25, 0.25, 0.75, 1.25]) leaf(ctx, cx, cy, a * Math.PI, 0.32 * W, 0.08 * W);
  petals(ctx, cx, cy, 8, 0.11 * W, 0.06 * W, 0.1 * W, 0, 0.74, 0.52);
  petals(ctx, cx, cy, 8, 0.06 * W, 0.036 * W, 0.06 * W, Math.PI / 8, 0.86, 0.66);
  ctx.beginPath(); // central boss
  ctx.arc(cx, cy, 0.038 * W, 0, Math.PI * 2);
  ctx.fillStyle = grey(1);
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 0.028 * W, cy + Math.sin(a) * 0.028 * W, 0.006 * W, 0, Math.PI * 2);
    ctx.fillStyle = grey(0.78);
    ctx.fill();
  }
  bud(ctx, W / 2, 0, W); // lattice vertices: top here, bottom/right come from neighbouring cells
  bud(ctx, 0, H / 2, W);
}

export function drawMotif(ctx: Ctx, W: number, H: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  for (const oy of [-H, 0, H]) {
    for (const ox of [-W, 0, W]) {
      ctx.save();
      ctx.translate(ox, oy);
      cell(ctx, W, H);
      ctx.restore();
    }
  }
}
