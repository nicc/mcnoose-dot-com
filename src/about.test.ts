import { describe, expect, it, vi } from 'vitest';

vi.mock('@fontsource/homemade-apple/files/homemade-apple-latin-400-normal.woff2?url', () => ({ default: '' }));
vi.stubGlobal('FontFace', class { load = () => Promise.resolve(); });
vi.stubGlobal('document', { fonts: { add: () => {} } });
const { parseNote } = await import('./about');

describe('parseNote', () => {
  it('reads headings, paragraphs with kept line breaks, and lists', () => {
    expect(parseNote('# Hi\n\nOne\ntwo\n\n- a\n- b')).toEqual([
      { kind: 'heading', lines: [[{ text: 'Hi' }]] },
      { kind: 'para', lines: [[{ text: 'One' }], [{ text: 'two' }]] },
      { kind: 'list', lines: [[{ text: 'a' }], [{ text: 'b' }]] },
    ]);
  });

  it('makes web and mail links, and leaves anything else as plain text', () => {
    expect(parseNote('See [me](https://x.y) or [mail](mailto:a@b.c) not [this](javascript:alert(1))')[0].lines[0]).toEqual([
      { text: 'See ' },
      { text: 'me', href: 'https://x.y' },
      { text: ' or ' },
      { text: 'mail', href: 'mailto:a@b.c' },
      { text: ' not ' },
      { text: 'this' },
      { text: ')' },
    ]);
  });

  it('copes with Windows line endings and stray blank lines', () => {
    expect(parseNote('\r\n\r\nA\r\n\r\n\r\nB\r\n')).toHaveLength(2);
  });
});
