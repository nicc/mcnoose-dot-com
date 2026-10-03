// Drawing held back from the first paint. `later`: things not on screen yet (the back of the frame,
// the skirting below the fold) — run when the browser is next idle, or at once when something needs
// them (flush): a flip, a fall, the skirting nearing the screen. `soon`: things on screen but slow
// to draw (the painted rail, the sampler) — run straight after the first paint, so the wallpaper and
// tiles show first. Keyed, so a later render can replace a job that hasn't run yet.
const jobs = new Map<string, () => void>();
let queued = false;

const idle: (fn: () => void) => void = 'requestIdleCallback' in window
  ? (fn) => window.requestIdleCallback(fn, { timeout: 1500 })
  : (fn) => setTimeout(fn, 400); // Safari has no requestIdleCallback

export function later(key: string, job: () => void): void {
  jobs.set(key, job);
  if (queued) return;
  queued = true;
  idle(() => {
    queued = false;
    flush();
  });
}

// Run what's waiting: all of it, or only the jobs whose key starts with `prefix`.
export function flush(prefix = ''): void {
  for (const map of [soonJobs, jobs])
    for (const [k, job] of map) {
      if (!k.startsWith(prefix)) continue;
      map.delete(k);
      job();
    }
}

const soonJobs = new Map<string, () => void>();
let soonDone: Promise<void> | undefined;

// Run `job` just after the next paint (all such jobs together, in one task). Resolves when done.
export function soon(key: string, job: () => void): Promise<void> {
  soonJobs.set(key, job);
  return (soonDone ??= new Promise<void>((resolve) =>
    requestAnimationFrame(() =>
      setTimeout(() => {
        soonDone = undefined;
        for (const [k, j] of soonJobs) {
          soonJobs.delete(k);
          j();
        }
        resolve();
      }, 0),
    ),
  ));
}

// Whatever `soon` jobs are waiting (for tests and screenshots: the scene is fully painted after).
export const soonSettled = () => soonDone ?? Promise.resolve();
