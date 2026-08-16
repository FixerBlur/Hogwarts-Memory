export const rand = (a, b) => a + Math.random() * (b - a);

export const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeIn = t => t * t * t;
export const easeOut = t => 1 - Math.pow(1 - t, 3);

const active = new Set();

export function tween({ duration, ease = easeInOut, onUpdate, onDone }) {
  const tw = { t: 0, duration, ease, onUpdate, onDone };
  active.add(tw);
  return tw;
}

export function updateTweens(dt) {
  for (const tw of active) {
    tw.t = Math.min(tw.t + dt / tw.duration, 1);
    tw.onUpdate?.(tw.ease(tw.t));
    if (tw.t >= 1) {
      active.delete(tw);
      tw.onDone?.();
    }
  }
}
