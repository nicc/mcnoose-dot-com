// The wallpaper as seen in a curved tile's reflection: a small copy of the pattern repeat,
// sampled by repeat coordinates once its image has loaded.
import type { RGB } from './reflect';

const SIZE = 96; // px across the repeat: reflections are blurred, detail is wasted
let url = '';
let data: ImageData | undefined;

export function loadPaper(src: string, onReady: () => void) {
  if (src === url) return;
  url = src;
  const img = new Image();
  img.onload = () => {
    if (src !== url) return;
    const c = document.createElement('canvas');
    c.width = SIZE;
    c.height = Math.max(1, Math.round((SIZE * img.naturalHeight) / img.naturalWidth));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    data = ctx.getImageData(0, 0, c.width, c.height);
    onReady();
  };
  img.src = src;
}

// u, v: position within the repeat, any real number (wraps).
export function paperAt(u: number, v: number): RGB | undefined {
  if (!data) return;
  const x = Math.floor((((u % 1) + 1) % 1) * data.width), y = Math.floor((((v % 1) + 1) % 1) * data.height);
  const i = (y * data.width + x) * 4;
  return [data.data[i], data.data[i + 1], data.data[i + 2]];
}
