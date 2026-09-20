import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analogFromPointer, driveFromStick } from "./stick.ts";

describe("touch analog", () => {
  it("deadzones the center", () => {
    const v = analogFromPointer(0.05, 0.04);
    assert.equal(v.x, 0);
    assert.equal(v.y, 0);
  });

  it("screen up is forward, screen left is +steer (A)", () => {
    const up = driveFromStick(0, -1);
    assert.ok(up.throttle > 0.9, "up throttle " + up.throttle);
    const left = driveFromStick(-1, 0);
    assert.ok(left.steer > 0.9, "left steer " + left.steer);
  });
});
