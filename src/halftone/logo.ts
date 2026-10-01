// Loads a logo (SVG or raster) as an image that can be drawn to canvas in every browser.

const SVG_INTRINSIC_PX = 1024; // large enough that browsers rasterising at intrinsic size stay sharp

// Firefox can't drawImage an SVG with no width/height; derive them from the viewBox.
export function withIntrinsicSize(svg: string): string {
  const open = svg.match(/<svg\b[^>]*>/i);
  if (!open || /\swidth\s*=/.test(open[0])) return svg;
  const vb = open[0].match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  const [w, h] = vb ? [Number(vb[1]), Number(vb[2])] : [1, 1];
  const k = SVG_INTRINSIC_PX / Math.max(w, h);
  const tag = open[0].replace(/^<svg/i, `<svg width="${w * k}" height="${h * k}"`);
  return svg.replace(open[0], tag);
}

const isSvg = (url: string) => url.startsWith('data:image/svg+xml') || /\.svg(\?|$)/i.test(url);

const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadLogo(url: string): Promise<HTMLImageElement> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      const src = isSvg(url)
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withIntrinsicSize(await (await fetch(url)).text()))}`
        : url;
      const img = new Image();
      // onload rather than decode(): WebKit has rejected decode() for some SVGs.
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`logo failed to load: ${url.slice(0, 60)}`));
        img.src = src;
      });
      return img;
    })();
    cache.set(url, p);
  }
  return p;
}
