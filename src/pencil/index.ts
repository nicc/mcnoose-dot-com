// What the pencil drawing (boot.ts, its own script inlined into index.html) shares with the main
// bundle, through `window.__pencil`: the projects it started loading, and the points loading reaches.
import type { Config } from '../config';
import type { Project } from '../projects';

// `bundle`: the main script is running (the rail and tiles may be drawn). `printed`: the scene is
// ready (the last strokes may be drawn). boot.ts watches html[data-printed] for itself.
export type Gate = 'bundle' | 'printed';

export interface Pencil {
  projects: Promise<Project[]>;
  reach(gate: Gate): void;
  replay?(c: Config, loadMs: number): void; // dev: draw it again, as if the page took loadMs to load
}

declare global {
  interface Window {
    __pencil?: Pencil;
  }
}

export const pencil = (): Pencil | undefined => window.__pencil;
