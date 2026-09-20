/** Radial analog from a unit-square pointer offset. +x right, +y down. */
export function analogFromPointer(
  dx: number,
  dy: number,
  dead = 0.16,
): { x: number; y: number } {
  const m = Math.hypot(dx, dy);
  if (m < dead || m === 0) return { x: 0, y: 0 };
  const capped = Math.min(m, 1);
  const scale = ((capped - dead) / (1 - dead)) / m;
  return { x: dx * scale, y: dy * scale };
}

/** Drive stick: screen up = throttle, screen left = hull left (same as A). */
export function driveFromStick(x: number, y: number): { throttle: number; steer: number } {
  return { throttle: -y, steer: -x };
}
