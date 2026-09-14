/** Canvas camera: positive yaw rotates the battlefield clockwise, cancelling
 * the hull's counterclockwise sprite rotation. Coordinates are CSS pixels. */
export function cameraRotation(overview: boolean, follow: boolean, yawDeg: number) {
  return !overview && follow ? (yawDeg * Math.PI) / 180 : 0;
}

export function inverseCameraOffset(x: number, y: number, rotation: number) {
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  return { x: x * c + y * s, y: -x * s + y * c };
}
