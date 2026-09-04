import { wrapDeg } from "../schema/index.ts";

/** Yaw 0 faces +Y (north). +yaw is CCW: nose moves left on a north-up map. */
export function forward(yawDeg: number): { x: number; y: number } {
  const r = (yawDeg * Math.PI) / 180;
  return { x: -Math.sin(r), y: Math.cos(r) };
}

export function right(yawDeg: number): { x: number; y: number } {
  const r = (yawDeg * Math.PI) / 180;
  return { x: Math.cos(r), y: Math.sin(r) };
}

export function worldAngleTo(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  return (Math.atan2(-dx, dy) * 180) / Math.PI;
}

export function stepDeg(current: number, target: number, maxStep: number): number {
  const d = wrapDeg(target - current);
  if (Math.abs(d) <= maxStep) return wrapDeg(target);
  return wrapDeg(current + Math.sign(d) * maxStep);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
