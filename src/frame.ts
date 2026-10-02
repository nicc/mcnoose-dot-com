// The framed sampler as something you can handle. A click, tap or Enter turns it over (the about
// note is on the back); again turns it back. A drag turns it on its nail at the top centre: the
// point you grab stays under the pointer, so a grab far from the nail turns it slowly and one near
// it quickly. On touch, press and hold before dragging (a plain swipe scrolls the page). Its
// lighting turns with it, so it's re-lit when you let go.
import type { Config } from './config';

let flipped = false;
let dragged: { tilt: number; base: number } | undefined; // base: the config tilt it was dragged from

// The frame's tilt: where it was left, unless the configured tilt has since changed.
export const frameTilt = (c: Config): number => (dragged && dragged.base === c.EMBROIDERY_TILT_DEG ? dragged.tilt : c.EMBROIDERY_TILT_DEG);

let relight: () => void = () => {};
export const onFrameTurned = (fn: () => void) => (relight = fn);

const MAX_TILT = 45;
const HOLD_MS = 300; // touch: press this long before a drag turns the frame
const SLOP_PX = 5; // movement that makes a press a drag

export function bindFrame(frame: HTMLElement, card: HTMLElement, back: HTMLElement, c: Config): void {
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
  const nail = () => {
    const r = (frame.parentElement as HTMLElement).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top };
  };
  let press: { id: number; x: number; y: number; from: number; touch: boolean; armed: boolean; turning: boolean; moved: number; timer?: number } | undefined;
  let tilt = frameTilt(c);
  const turnTo = (x: number, y: number) => {
    const n = nail(), p = press!;
    const delta = Math.atan2(y - n.y, x - n.x) - Math.atan2(p.y - n.y, p.x - n.x);
    tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, p.from + (delta * 180) / Math.PI));
    frame.style.setProperty('--frame-tilt', `${tilt}deg`);
  };

  frame.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const touch = e.pointerType !== 'mouse';
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, from: tilt, touch, armed: !touch, turning: false, moved: 0 };
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
    if (p.turning) {
      dragged = { tilt, base: c.EMBROIDERY_TILT_DEG };
      relight();
    } else if (!cancelled && p.moved <= SLOP_PX && !(e.target as Element).closest('a')) flip();
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
