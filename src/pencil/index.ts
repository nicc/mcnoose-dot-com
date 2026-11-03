// What the pencil drawing (boot.ts, its own script inlined into index.html) shares with the main
// bundle, through `window.__pencil`: the projects it started loading, and how far loading has got.
import type { Config } from '../config';
import type { Project } from '../projects';

export interface Pencil {
  projects: Promise<Project[]>;
  started(): void; // the main script is running
  progress(share: number): void; // of the scene's work (prints, paper, trim, sampler), settled; boot.ts also watches html[data-printed]
  replay?(c: Config, loadMs: number): void; // dev: draw it again, as if the page took loadMs to load
}

declare global {
  interface Window {
    __pencil?: Pencil;
  }
}

export const pencil = (): Pencil | undefined => window.__pencil;
