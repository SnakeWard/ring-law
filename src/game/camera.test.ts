import test from "node:test";
import assert from "node:assert/strict";
import { cameraRotation, inverseCameraOffset } from "./camera.ts";
test("chassis forward stays screen-up at every heading, including wrap and reverse headings", () => {
  for (const deg of [-180, -179, -90, -32, 0, 32, 90, 179, 180, 270, 360]) {
    const r = cameraRotation(false, true, deg);
    const worldForward = { x: -Math.sin(r), y: -Math.cos(r) };
    const screenX = worldForward.x * Math.cos(r) - worldForward.y * Math.sin(r);
    const screenY = worldForward.x * Math.sin(r) + worldForward.y * Math.cos(r);
    assert.ok(Math.abs(screenX) < 1e-9);
    assert.ok(Math.abs(screenY + 1) < 1e-9);
    const back = inverseCameraOffset(screenX, screenY, r);
    assert.ok(Math.abs(back.x - worldForward.x) < 1e-9);
    assert.ok(Math.abs(back.y - worldForward.y) < 1e-9);
    assert.equal(cameraRotation(true, true, deg), 0);
    assert.equal(cameraRotation(false, false, deg), 0);
  }
});
test("arbitrary pointer offsets round-trip through rotated camera", () => {
  for (const deg of [0, 35, 90, 180, 290])
    for (const [x, y] of [
      [123, -78],
      [-15, 230],
      [0, 0],
    ]) {
      const r = cameraRotation(false, true, deg),
        c = Math.cos(r),
        s = Math.sin(r);
      const p = inverseCameraOffset(x * c - y * s, x * s + y * c, r);
      assert.ok(Math.abs(p.x - x) < 1e-8);
      assert.ok(Math.abs(p.y - y) < 1e-8);
    }
});
