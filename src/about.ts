// The about page: a note handwritten on the back of the framed sampler (turned over by frame.ts).
// The text is about.md beside
// index.html, fetched at load like projects.json, so it can be edited on the server. A small,
// forgiving subset of markdown: blank lines separate paragraphs, single line breaks are kept,
// "# " makes a heading, "- " lines a list, [text](https://…) a link. Built as DOM, never as HTML.
import fontUrl from '@fontsource/homemade-apple/files/homemade-apple-latin-400-normal.woff2?url';

export async function loadAbout(): Promise<string> {
  try {
    const res = await fetch('about.md', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    console.warn('about.md could not be loaded:', e);
    return '';
  }
}

// Handwriting, bundled: the note is fitted once it has loaded (metrics change).
const hand = new FontFace('Homemade Apple', `url(${fontUrl}) format('woff2')`, { display: 'swap' });
document.fonts.add(hand);
export const handReady: Promise<unknown> = hand.load().catch((e) => console.warn('handwriting font failed:', e));

const SAFE_LINK = /^(https?:|mailto:)/i;

export type Inline = { text: string; href?: string };
export type Block = { kind: 'heading' | 'para' | 'list'; lines: Inline[][] };

function inline(text: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (m.index! > at) out.push({ text: text.slice(at, m.index) });
    out.push(SAFE_LINK.test(m[2]) ? { text: m[1], href: m[2] } : { text: m[1] }); // only web and mail links
    at = m.index! + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

export function parseNote(md: string): Block[] {
  const blocks = md.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
  return blocks.map((lines): Block => {
    if (lines.length === 1 && /^#{1,6}\s/.test(lines[0])) return { kind: 'heading', lines: [inline(lines[0].replace(/^#{1,6}\s+/, ''))] };
    if (lines.every((l) => /^[-*]\s/.test(l))) return { kind: 'list', lines: lines.map((l) => inline(l.replace(/^[-*]\s+/, ''))) };
    return { kind: 'para', lines: lines.map(inline) };
  });
}

const nodes = (line: Inline[]): Node[] =>
  line.map(({ text, href }) => {
    if (!href) return document.createTextNode(text);
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text;
    return a;
  });

export function noteNodes(md: string): HTMLElement[] {
  return parseNote(md).map(({ kind, lines }) => {
    if (kind === 'heading') {
      const h = document.createElement('h2');
      h.append(...nodes(lines[0]));
      return h;
    }
    if (kind === 'list') {
      const ul = document.createElement('ul');
      for (const line of lines) {
        const li = document.createElement('li');
        li.append(...nodes(line));
        ul.append(li);
      }
      return ul;
    }
    const p = document.createElement('p');
    lines.forEach((line, i) => (i && p.append(document.createElement('br')), p.append(...nodes(line))));
    return p;
  });
}

// Largest font size (css px) at which the note fits its box.
export function fitNote(note: HTMLElement): void {
  if (!note.isConnected || !note.clientHeight) return;
  let lo = 4, hi = 40;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    note.style.fontSize = `${mid}px`;
    if (note.scrollHeight <= note.clientHeight + 0.5 && note.scrollWidth <= note.clientWidth + 0.5) lo = mid;
    else hi = mid;
  }
  note.style.fontSize = `${lo}px`;
}
