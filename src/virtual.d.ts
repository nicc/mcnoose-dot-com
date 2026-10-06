declare module 'virtual:wallpaper' {
  /** Wallpaper tile rendered at build time; null in dev, where it renders live. */
  export const baked: { url: string; aspect: number } | null;
}

/** A hash of the trim's drawing code (vite.config.ts): keys the painted lengths kept in OPFS, so a change to the code never serves stale pixels. */
declare const __TRIM_CODE__: string;
