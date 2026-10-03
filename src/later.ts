// Drawing held back from the first paint: things not on screen yet (the back of the frame, the
// skirting below the fold). Each job runs when the browser is next idle, or at once when something
// needs it (flush) — a flip, a fall, the skirting nearing the screen. Keyed, so a later render can
// replace a job that hasn't run yet.
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
  for (const [k, job] of jobs) {
    if (!k.startsWith(prefix)) continue;
    jobs.delete(k);
    job();
  }
}
