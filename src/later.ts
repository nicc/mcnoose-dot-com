// Drawing held back from the first paint. `later`: things not on screen yet (the back of the frame,
// the skirting below the fold) — run when the browser is next idle, or at once when something needs
// them (flush): a flip, a fall, the skirting nearing the screen. `soon`: things on screen but slow
// to draw (the painted rail, the sampler) — run straight after the first paint, so the wallpaper and
// tiles show first. Keyed, so a later render can replace a job that hasn't run yet.
const jobs = new Map<string, () => void>();
let queued = false;

// Calls fn with `more`: whether there's idle time left after a job. Safari has no
// requestIdleCallback: one job per timeout there, the first after a pause, the rest a few frames apart.
const idle: (fn: (more: () => boolean) => void, again: boolean) => void = 'requestIdleCallback' in window
  ? (fn) => window.requestIdleCallback((d) => fn(() => d.timeRemaining() > 0), { timeout: 1500 })
  : (fn, again) => setTimeout(() => fn(() => false), again ? 50 : 400);

export function later(key: string, job: () => void): void {
  jobs.set(key, job);
  schedule();
}

// Run waiting jobs while the browser stays idle (at least one per call), the rest next time, so a
// pile of them (trim lengths queued during a window drag) never blocks a frame all at once.
function schedule(again = false): void {
  if (queued || !jobs.size) return;
  queued = true;
  idle((more) => {
    queued = false;
    try {
      for (const [k, job] of jobs) {
        jobs.delete(k);
        job();
        if (!more()) break;
      }
    } finally {
      schedule(true);
    }
  }, again);
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
        try {
          for (const [k, j] of soonJobs) {
            soonJobs.delete(k);
            j();
          }
        } finally {
          resolve(); // a job that throws mustn't leave every later one waiting forever
        }
      }, 0),
    ),
  ));
}

// Whatever `soon` jobs are waiting (for tests and screenshots: the scene is fully painted after).
export const soonSettled = () => soonDone ?? Promise.resolve();
