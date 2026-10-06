// Painted trim (dado rail, skirting), built from lengths about one tile wide. Each length is lit by
// the room's lights at its own position on the wall (dynamic lighting, like every other surface):
// at both its ends, blended across, so neighbouring lengths meet without a step.
// Grain, brush strokes, wear and scuffs are generated in wall coordinates, so lengths join
// seamlessly; each is cached by its trim and its place on the wall.
// The pixels are painted in workers (worker.ts, paint.ts): a length's canvas is handed back at once,
// blank (the strip's plain paint shows through), and filled when its job comes back. Lengths on
// screen go first; the rest (overscan, the skirting below the fold) wait behind them.
import type { RGB } from '../colour';
import { sampleProfile } from '../wood/paint';
import type { Profile } from './profile';
import type { LengthJob, TrimLight } from './paint';
import type { LengthRequest, LengthResult } from './worker';
import LengthWorker from './worker?worker&inline';

export type { TrimLight } from './paint';

export interface TrimStyle {
  profile: Profile;
  colour: RGB;
  paint: { grain: number; brush: number; buildup: number; yellowing: number; sheen: number; gloss: number };
  wear: number;
  grime: number;
  scuffs?: { amount: number; low: number; faceTopCm: number }; // knocks on the flat face (skirting; see scuffs.ts)
  ledgeCm?: number; // the top ledge seen from above, foreshortened (rail, skirting): drawn above the profile
}

export interface Length {
  canvas: HTMLCanvasElement;
  done: Promise<void>; // painted (or superseded)
}

const cache = new Map<string, Length & { key: string }>();
export const lengthCounts = { painted: 0, cached: 0 }; // dev panel readout: how many came back from the OPFS store (worker.ts)
export const forgetLengths = () => cache.clear(); // their pixels were lost (see main.ts)

interface Queued extends Length {
  id: string;
  key: string;
  job: LengthJob;
  urgent: boolean; // on screen: before anything that isn't
  resolve: () => void;
}
const queue = new Map<string, Queued>(); // by id, in the order queued
const inflight = new Map<Worker, Queued>();
let workers: Worker[] | undefined;
const WORKERS = 2; // at most: a length takes tens of ms, and there are a few dozen at a time

function pool(): Worker[] {
  return (workers ??= Array.from({ length: Math.max(1, Math.min(WORKERS, navigator.hardwareConcurrency || 1)) }, () => {
    const w = new LengthWorker();
    w.onmessage = (e: MessageEvent<LengthResult>) => finish(w, e.data);
    return w;
  }));
}

function pump(): void {
  for (const w of pool()) {
    if (inflight.has(w)) continue;
    let next: Queued | undefined;
    for (const q of queue.values()) {
      if (q.urgent || !next) next = q;
      if (q.urgent) break;
    }
    if (!next) return;
    queue.delete(next.id);
    inflight.set(w, next);
    w.postMessage({ id: next.id, key: next.key, job: next.job } satisfies LengthRequest);
  }
}

function finish(w: Worker, r: LengthResult): void {
  const q = inflight.get(w);
  inflight.delete(w);
  // Still wanted? The length may have been re-keyed (re-lit, resized) while this one was painting.
  if (q && q.key === r.key && cache.get(r.id)?.key === r.key) q.canvas.getContext('2d')!.putImageData(new ImageData(r.px as Uint8ClampedArray<ArrayBuffer>, q.job.len, q.job.total), 0, 0);
  lengthCounts[r.cached ? 'cached' : 'painted']++;
  q?.resolve();
  pump();
}

// Lengths whose id starts with `prefix` (a trim's name) go to the front: they're about to be seen.
export function promoteLengths(prefix: string): void {
  for (const q of queue.values()) if (q.id.startsWith(prefix)) q.urgent = true;
}

// trim: which piece ('rail', 'skirting'); index: which length along the wall; lenPx/heightPx in
// CSS px; pxPerCm: scene scale; start/end: the room's light at its left and right ends; urgent: on
// screen now (painted before lengths that aren't).
export function trimLength(trim: string, index: number, lenPx: number, heightPx: number, pxPerCm: number, dpr: number, start: TrimLight, end: TrimLight, s: TrimStyle, urgent: boolean): Length {
  const key = JSON.stringify([lenPx, heightPx, pxPerCm, dpr, start, end, s, s.profile.heightCm, s.profile.depthCm]);
  const id = `${trim}:${index}`;
  const hit = cache.get(id);
  if (hit && hit.key === key) {
    const q = queue.get(id);
    if (q && urgent) q.urgent = true;
    return hit;
  }
  const len = Math.max(1, Math.round(lenPx * dpr)), total = Math.max(2, Math.round(heightPx * dpr));
  const canvas = hit?.canvas ?? document.createElement('canvas');
  canvas.className = 'trim-length';
  canvas.setAttribute('aria-hidden', 'true');
  [canvas.width, canvas.height] = [len, total];
  const job: LengthJob = {
    trim, len, total, dpr, pxPerCm, start, end,
    colour: s.colour, paint: s.paint, wear: s.wear, grime: s.grime, scuffs: s.scuffs, ledgeCm: s.ledgeCm ?? 0,
    profile: { samples: sampleProfile(s.profile.at, s.profile.heightCm), heightCm: s.profile.heightCm, depthCm: s.profile.depthCm },
    u0: index * len,
  };
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const entry = { canvas, done, key };
  cache.set(id, entry);
  queue.get(id)?.resolve(); // superseded before it was painted
  queue.set(id, { ...entry, id, job, urgent, resolve });
  pump();
  return entry;
}
