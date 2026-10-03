// The framed sampler as something you can handle. A click, tap or Enter turns it over (the about
// note is on the back); again turns it back. A drag turns it on its nail at the top centre: the
// point you grab stays under the pointer, so a grab far from the nail turns it slowly and one near
// it quickly. On touch, press and hold before dragging (a plain swipe scrolls the page).
//
// Let go and it swings back like what it is: a rectangle hanging from a point at its top edge (a
// physical pendulum, its period from its real size), damped, with the sawtooth's friction able to
// hold it a little off its resting tilt. While it moves, the glass reflection holds still on screen;
// the frame's own lighting turns with it once it settles. With EMBROIDERY_FALL on, past
// EMBROIDERY_FALL_DEG and not held, it slips off its nail (fall.ts).
import type { Config } from './config';
import { turnReflection } from './embroidery';
import { fall } from './fall';

let flipped = false;
let settled: { tilt: number; base: number } | undefined; // where it came to rest; base: the config tilt then
let live: number | undefined; // the tilt while it's held or swinging

// The frame's tilt: live while moving, else where it settled, unless the configured tilt has changed.
export const frameTilt = (c: Config): number => live ?? (settled && settled.base === c.EMBROIDERY_TILT_DEG ? settled.tilt : c.EMBROIDERY_TILT_DEG);

let relight: () => void = () => {};
export const onFrameTurned = (fn: () => void) => (relight = fn);

const MAX_HELD = 60; // degrees you can turn it by hand
const MAX_SWING = 80; // it can't go over the top of its nail
const MAX_THROW = 360; // deg/s: the fastest it can be let go
const HOLD_MS = 300; // touch: press this long before a drag turns the frame
const SLOP_PX = 5; // movement that makes a press a drag
const G = 981; // cm/s²
const DEG = Math.PI / 180;

const current = () => document.querySelector<HTMLElement>('.frame');
const show = (tilt: number) => {
  current()?.style.setProperty('--frame-tilt', `${tilt}deg`);
  turnReflection(tilt);
};

// Natural angular frequency (rad/s) of a w × h rectangle swinging about the middle of its top edge.
export function swingRate(wCm: number, hCm: number): number {
  const d = hCm / 2, inertia = (wCm * wCm + hCm * hCm) / 12 + d * d; // per unit mass, about the pivot
  return Math.sqrt((G * d) / inertia);
}

export interface SwingStyle {
  rest: number; // degrees: where it hangs
  rate: number; // rad/s, from swingRate
  damping: number; // damping ratio
  stick: number; // degrees off rest that friction can hold
}

// One step of the swing. Angles in degrees, omega in deg/s. Returns undefined once it has stopped.
export function swingStep(theta: number, omega: number, dt: number, s: SwingStyle): { theta: number; omega: number } | undefined {
  const off = (theta - s.rest) * DEG, w = omega * DEG, w0 = s.rate;
  const gravity = -w0 * w0 * Math.sin(off), friction = w0 * w0 * Math.sin(s.stick * DEG);
  if (Math.abs(w) < 0.05 && Math.abs(gravity) <= friction) return undefined; // the sawtooth holds it
  const acc = gravity - 2 * s.damping * w0 * w - friction * Math.sign(w || gravity);
  const next = w + acc * dt, to = theta + (next / DEG) * dt;
  if (Math.abs(to - s.rest) > MAX_SWING) return { theta: s.rest + Math.sign(to - s.rest) * MAX_SWING, omega: -0.3 * (next / DEG) }; // knocks back off the nail's limit
  return { theta: to, omega: next / DEG };
}

let swinging = 0; // animation frame id
const moving = (on: boolean) => (document.documentElement.dataset.frame = on ? 'moving' : 'still'); // for tests

const tooFar = (c: Config, theta: number) => c.EMBROIDERY_FALL && Math.abs(theta) > c.EMBROIDERY_FALL_DEG;

function drop(theta: number, omega: number, c: Config, pxPerCm: number) {
  cancelAnimationFrame(swinging);
  moving(false);
  live = undefined;
  settled = undefined;
  const shadow = current()?.parentElement;
  if (shadow) fall(shadow, theta, omega, c, pxPerCm, relight);
}

function swing(theta: number, omega: number, c: Config, size: { wCm: number; hCm: number }, pxPerCm: number) {
  cancelAnimationFrame(swinging);
  if (tooFar(c, theta)) return drop(theta, omega, c, pxPerCm);
  const s: SwingStyle = { rest: c.EMBROIDERY_TILT_DEG, rate: swingRate(size.wCm, size.hCm), damping: c.EMBROIDERY_SWING_DAMPING, stick: c.EMBROIDERY_SWING_STICK_DEG };
  let last = performance.now();
  moving(true);
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (let i = 0; i < 4; i++) {
      const next = swingStep(theta, omega, dt / 4, s);
      if (!next) {
        live = undefined;
        settled = { tilt: theta, base: c.EMBROIDERY_TILT_DEG };
        show(theta);
        relight();
        moving(false);
        return;
      }
      ({ theta, omega } = next);
      if (tooFar(c, theta)) return drop(theta, omega, c, pxPerCm); // swung off its nail
    }
    live = theta;
    show(theta);
    swinging = requestAnimationFrame(tick);
  };
  swinging = requestAnimationFrame(tick);
}

export function bindFrame(frame: HTMLElement, card: HTMLElement, back: HTMLElement, c: Config, pxPerCm: number): void {
  const sync = () => {
    card.classList.toggle('flipped', flipped);
    frame.setAttribute('aria-pressed', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
  };
  frame.tabIndex = 0;
  frame.setAttribute('role', 'button');
  frame.setAttribute('aria-label', 'Turn the sampler over to read the note on the back');
  sync();
  const flip = () => {
    flipped = !flipped;
    sync();
  };

  // The nail: top centre of the frame's unturned box (its wrapper isn't rotated).
  const box = () => (frame.parentElement as HTMLElement).getBoundingClientRect();
  const nail = () => {
    const r = box();
    return { x: r.left + r.width / 2, y: r.top };
  };
  let press: { id: number; x: number; y: number; from: number; touch: boolean; armed: boolean; turning: boolean; moved: number; timer?: number } | undefined;
  let trail: { t: number; tilt: number }[] = []; // recent tilts, for the speed it's let go at
  const turnTo = (x: number, y: number) => {
    const n = nail(), p = press!;
    const delta = Math.atan2(y - n.y, x - n.x) - Math.atan2(p.y - n.y, p.x - n.x);
    live = Math.max(-MAX_HELD, Math.min(MAX_HELD, p.from + delta / DEG));
    const t = performance.now();
    trail = [...trail.filter((s) => t - s.t < 80), { t, tilt: live }];
    show(live);
  };

  frame.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const touch = e.pointerType !== 'mouse';
    cancelAnimationFrame(swinging); // catch it mid-swing
    moving(true);
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, from: frameTilt(c), touch, armed: !touch, turning: false, moved: 0 };
    trail = [];
    if (touch) press.timer = window.setTimeout(() => press && (press.armed = true, frame.classList.add('held')), HOLD_MS);
  });
  frame.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    press.moved = Math.max(press.moved, Math.hypot(e.clientX - press.x, e.clientY - press.y));
    if (!press.turning && press.moved > SLOP_PX) {
      if (!press.armed) return void (clearTimeout(press.timer), (press = undefined)); // a swipe: let it scroll
      press.turning = true;
      frame.setPointerCapture(e.pointerId);
    }
    if (press.turning) turnTo(e.clientX, e.clientY);
  });
  // Once a touch is holding the frame, moving turns it rather than scrolling the page.
  frame.addEventListener('touchmove', (e) => press?.armed && e.cancelable && e.preventDefault(), { passive: false });
  frame.addEventListener('contextmenu', (e) => press?.touch && e.preventDefault()); // long-press menus
  const release = (e: PointerEvent, cancelled: boolean) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = undefined;
    clearTimeout(p.timer);
    frame.classList.remove('held');
    if (p.turning || live !== undefined) {
      const [a, b] = [trail[0], trail[trail.length - 1]];
      const thrown = a && b && b.t > a.t ? ((b.tilt - a.tilt) / (b.t - a.t)) * 1000 : 0;
      const omega = Math.max(-MAX_THROW, Math.min(MAX_THROW, thrown));
      const r = box();
      swing(live ?? frameTilt(c), omega, c, { wCm: r.width / pxPerCm, hCm: r.height / pxPerCm }, pxPerCm);
      if (!p.turning && !cancelled && p.moved <= SLOP_PX && !(e.target as Element).closest('a')) flip(); // caught mid-swing and tapped
    } else {
      moving(false); // a click or tap: it never moved
      if (!cancelled && p.moved <= SLOP_PX && !(e.target as Element).closest('a')) flip();
    }
  };
  frame.addEventListener('pointerup', (e) => release(e, false));
  frame.addEventListener('pointercancel', (e) => release(e, true)); // the browser took it for a scroll

  frame.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if ((e.target as Element).closest('a')) return;
    e.preventDefault();
    flip();
  });
}
