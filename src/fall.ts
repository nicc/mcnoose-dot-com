// An experiment (EMBROIDERY_FALL): turned past EMBROIDERY_FALL_DEG and not held, the frame slips off
// its nail. It drops straight down, keeping any spin it had, until its lowest corner meets the top of
// the dado rail. There it pivots on that corner: pitching forward off the rail's lip (top towards
// you) and, if its centre isn't over the corner, turning in its own plane. Once it's past the
// horizontal it leaves the lip and falls on, tumbling, off the bottom of the screen. Not a physics
// engine: each phase is a simple rigid-body rule, joined so position and angle stay continuous.
// The frame is moved into a fixed 3D layer so it can leave the header; its sides and papered back
// show as it turns. A nail is left on the wall; it comes back on reload (or with the toggle off).
import type { Config } from './config';
import { drawPending } from './embroidery';
import { roomFromConfig } from './room';

let fallen = false;
export const isFallen = () => fallen;
export const resetFall = () => void (fallen = false);

const DEG = Math.PI / 180;
const G = 981; // cm/s²
const LIP_BIAS = 0.15; // rad: the rail holds its foot out from the wall, so it starts already leaning off
const RELEASE_PITCH = 100 * DEG; // past horizontal: it slides off the lip
const RELEASE_ROLL = 70 * DEG; // or it rolls off the corner sideways

type V = { x: number; y: number };

// The frame's corners on screen, hanging from the nail at the middle of its top edge, turned by tilt.
export function corners(box: { x: number; y: number; w: number; h: number }, tiltDeg: number, drop = 0): V[] {
  const c = Math.cos(tiltDeg * DEG), s = Math.sin(tiltDeg * DEG), nx = box.x + box.w / 2, ny = box.y + drop;
  return [[0, 0], [box.w, 0], [box.w, box.h], [0, box.h]].map(([x, y]) => {
    const dx = x - box.w / 2;
    return { x: nx + dx * c - y * s, y: ny + dx * s + y * c };
  });
}

export interface FallStyle {
  g: number; // px/s²
  kick: number;
  tumble: number;
}

export function fallStyle(c: Config, pxPerCm: number): FallStyle {
  return { g: G * pxPerCm * c.EMBROIDERY_FALL_GRAVITY, kick: c.EMBROIDERY_FALL_KICK, tumble: c.EMBROIDERY_FALL_TUMBLE };
}

// Tipping on the rail: pitch Φ (about the rail's edge, a stick falling from its foot) and roll Δθ
// (in the wall's plane, gravity acting on the centre's offset from the corner). One step of dt.
export function tipStep(st: { pitch: number; pitchRate: number; roll: number; rollRate: number }, dt: number, h: number, w: number, dx: number, s: FallStyle) {
  const pitchAcc = ((3 * s.g) / (2 * h)) * Math.sin(st.pitch + LIP_BIAS) * s.tumble;
  const rollAcc = ((s.g * dx) / ((w * w + h * h) / 3)) * s.tumble; // about a corner, per unit mass
  const pitchRate = st.pitchRate + pitchAcc * dt, rollRate = st.rollRate + rollAcc * dt;
  return { pitch: st.pitch + pitchRate * dt, pitchRate, roll: st.roll + rollRate * dt, rollRate };
}

export const offLip = (st: { pitch: number; roll: number }) => st.pitch > RELEASE_PITCH || Math.abs(st.roll) > RELEASE_ROLL;

export function fall(shadow: HTMLElement, tiltDeg: number, spinDegS: number, c: Config, pxPerCm: number, done: () => void): void {
  if (fallen) return;
  fallen = true;
  drawPending(); // it's about to show its sides and back
  const rail = document.querySelector('.rail')?.getBoundingClientRect().top ?? innerHeight;
  const r = shadow.getBoundingClientRect(); // the unturned box (its wrapper isn't rotated)
  const box = { x: r.left, y: r.top, w: r.width, h: r.height };
  const s = fallStyle(c, pxPerCm);

  // Into a fixed 3D layer over the page, keeping its place on screen.
  const layer = document.createElement('div');
  layer.className = 'fall-layer';
  // Seen from where the viewer stands: their eye is above the embroidery and back from the wall.
  const room = roomFromConfig(c), eyeY = box.y + box.h / 2 - (room.eyeCm - room.embroidery.y) * pxPerCm;
  Object.assign(layer.style, { perspective: `${room.viewCm * pxPerCm}px`, perspectiveOrigin: `${box.x + box.w / 2}px ${eyeY}px` });
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  layer.append(shadow);
  Object.assign(shadow.style, { left: '0', top: '0', width: `${box.w}px`, height: `${box.h}px`, transformOrigin: '0 0', filter: 'none', transformStyle: 'preserve-3d', pointerEvents: 'none' });
  const frame = shadow.querySelector<HTMLElement>('.frame')!;
  Object.assign(frame.style, { transform: 'none', perspective: 'none', transformStyle: 'preserve-3d' });
  const hanging = (tilt: number, drop: number) => `translate(${box.x}px, ${box.y + drop}px) translate(${box.w / 2}px, 0) rotate(${tilt}deg) translate(${-box.w / 2}px, 0)`;
  shadow.style.transform = hanging(tiltDeg, 0);
  queueMicrotask(done); // the wall redraws without it (and with the nail), after the fall is under way

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return void layer.remove();

  const t0 = performance.now();
  let phase: 'drop' | 'tip' | 'away' = 'drop', last = t0;
  let pivot: V = { x: 0, y: 0 }, impact = '', dx = 0, st = { pitch: 0, pitchRate: 0, roll: 0, rollRate: 0 }, away = { t: 0, pitch: 0, roll: 0 };
  const tick = (now: number) => {
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (phase === 'drop') {
      const tilt = tiltDeg + spinDegS * t, drop = 0.5 * s.g * t * t;
      const cs = corners(box, tilt, drop), low = cs.reduce((a, b) => (b.y > a.y ? b : a));
      shadow.style.transform = hanging(tilt, drop);
      if (low.y >= rail) {
        // Caught: pivot on the corner that hit first, pitched forward by the impact.
        phase = 'tip';
        pivot = low;
        impact = hanging(tilt, drop);
        const centre = { x: (cs[0].x + cs[2].x) / 2, y: (cs[0].y + cs[2].y) / 2 };
        dx = centre.x - pivot.x;
        st = { pitch: 0, pitchRate: (s.kick * s.g * t) / box.h, roll: 0, rollRate: 0 };
      }
    } else if (phase === 'tip') {
      for (let i = 0; i < 4; i++) st = tipStep(st, dt / 4, box.h, box.w, dx, s);
      if (offLip(st)) (phase = 'away'), (away = { t, pitch: st.pitch, roll: st.roll });
    }
    if (phase !== 'drop') {
      // Pitch forward (top towards the viewer) and roll, about the rail's edge; then fall on, spinning.
      const ta = phase === 'away' ? t - away.t : 0;
      const pitch = phase === 'away' ? away.pitch + st.pitchRate * ta : st.pitch, roll = phase === 'away' ? away.roll + st.rollRate * ta : st.roll;
      const drop = 0.5 * s.g * ta * ta;
      shadow.style.transform = `translate(${pivot.x}px, ${pivot.y + drop}px) rotateX(${-pitch}rad) rotate(${roll}rad) translate(${-pivot.x}px, ${-pivot.y}px) ${impact}`;
      if (pivot.y + drop - Math.hypot(box.w, box.h) > innerHeight) return void layer.remove(); // gone
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
