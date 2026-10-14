declare module 'virtual:wallpaper' {
  /** Wallpaper tile rendered at build time, as files beside index.html, best format first; null in dev, where it renders live. */
  export const baked: { urls: string[]; aspect: number; colour: string } | null;
}

/** A hash of the trim's drawing code (vite.config.ts): keys the painted lengths kept in OPFS, so a change to the code never serves stale pixels. */
declare const __TRIM_CODE__: string;
