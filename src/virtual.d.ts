declare module 'virtual:wallpaper' {
  /** Wallpaper tile rendered at build time; null in dev, where it renders live. */
  export const baked: { url: string; aspect: number } | null;
}
