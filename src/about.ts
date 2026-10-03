// The about note on the back of the framed sampler (turned over by frame.ts): Nic's own handwriting,
// from a photo. tools/prepare-note.py cuts the kept lines out of it as ink-only images (crossings-
// out left behind, lines straightened); here they're laid out on the paper — zoom and line spacing
// from config — and inked in ABOUT_INK, the ink multiplied into the paper (CSS) so it takes the
// paper's light and stains. The email line carries a mailto link; the text is there for screen
// readers.
import note from './about/note.json';

const urls = import.meta.glob<string>('./about/line-*.png', { eager: true, query: '?url', import: 'default' });
const WIDEST = Math.max(...note.lines.map((l) => l.w)); // image px of the widest line
const PITCH = 66; // image px between baselines, as written

let images: Promise<HTMLImageElement[]> | undefined;
const loadLines = () =>
  (images ??= Promise.all(
    note.lines.map(
      (l) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = urls[`./about/${l.file}`];
        }),
    ),
  ));

export interface NoteStyle {
  zoom: number; // 1 = the widest line spans the note's width
  spacing: number; // 1 = as written
  ink: string;
  strength: number; // ink density: <1 fainter, >1 blacker
}

export interface NoteLayout {
  scale: number; // css px per image px
  lines: { x: number; y: number; w: number; h: number }[]; // css px, top-left of each line's image
}

// Where each line goes in a note `width` css px wide.
export function noteLayout(width: number, s: NoteStyle): NoteLayout {
  const scale = (s.zoom * width) / WIDEST;
  let base = note.lines[0].baseline * scale;
  const lines = note.lines.map((l, i) => {
    if (i) base += PITCH * s.spacing * (1 + l.gapBefore) * scale;
    return { x: l.x * scale, y: base - l.baseline * scale, w: l.w * scale, h: l.h * scale };
  });
  return { scale, lines };
}

const EMAIL = note.lines.find((l) => l.text.includes('@'))!.text;
export const NOTE_TEXT = note.lines.map((l) => l.text);

// The note for a box on the back (css px), its canvas drawn once the line images have loaded.
export function noteElement(box: { x: number; y: number; w: number; h: number }, s: NoteStyle, dpr: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'note';
  Object.assign(wrap.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(box.w * dpr));
  canvas.height = Math.max(1, Math.round(box.h * dpr));
  canvas.setAttribute('aria-hidden', 'true');
  const layout = noteLayout(box.w, s);
  const said = document.createElement('p');
  said.className = 'sr-only';
  said.textContent = NOTE_TEXT.filter((t) => t !== EMAIL).join(' ');
  const link = document.createElement('a');
  link.className = 'note-link';
  link.href = `mailto:${EMAIL}`;
  link.textContent = EMAIL;
  const at = layout.lines[note.lines.findIndex((l) => l.text === EMAIL)];
  Object.assign(link.style, { left: `${at.x}px`, top: `${at.y}px`, width: `${at.w}px`, height: `${at.h}px` });
  wrap.append(canvas, said, link);
  loadLines().then((imgs) => {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    imgs.forEach((img, i) => ctx.drawImage(img, layout.lines[i].x, layout.lines[i].y, layout.lines[i].w, layout.lines[i].h));
    // Ink density: alpha → 1 − (1 − alpha)^strength (blacker strokes, fuller edges), then the colour.
    if (s.strength !== 1) {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 3; i < d.data.length; i += 4) d.data[i] = 255 * (1 - (1 - d.data[i] / 255) ** s.strength);
      ctx.putImageData(d, 0, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = s.ink;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    wrap.dataset.inked = 'true';
  }, (e) => console.warn('note images failed:', e));
  return wrap;
}
