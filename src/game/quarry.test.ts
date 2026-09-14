import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pointInCover } from "../schema/cover.ts";
import { QUARRY_COVER, QUARRY_ROUTES, QUARRY_CONNECTORS, QUARRY_STARTS } from "./quarry.ts";
import { newLayoutWorld } from "./quarry-world.ts";
import { stepWorld, STEP } from "./sim.ts";
import { worldAngleTo } from "./math.ts";

describe("Quarry layout", () => {
  it("all authored routes and cross-links clear the real hull collision margin", () => {
    for (const points of [...QUARRY_ROUTES.map((r) => r.points), ...QUARRY_CONNECTORS]) {
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1],
          [bx, by] = points[i];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
        for (let s = 0; s <= steps; s++) {
          const x = ax + ((bx - ax) * s) / steps,
            y = ay + ((by - ay) * s) / steps;
          assert.ok(
            !QUARRY_COVER.some((c) => c.kind === "wreck" && pointInCover(c, x, y, 1.7)),
            `blocked at ${x},${y}`,
          );
        }
      }
    }
  });
  it("every approach starts clear of solid cover", () => {
    for (const s of QUARRY_STARTS)
      assert.ok(!QUARRY_COVER.some((c) => c.kind === "wreck" && pointInCover(c, s.x, s.y, 1.7)));
  });
  it("the existing tank simulation can traverse each complete route", () => {
    for (const route of QUARRY_ROUTES) {
      const w = newLayoutWorld();
      let next = 1;
      for (let frame = 0; frame < 60 * 180 && next < route.points.length; frame++) {
        const [x, y] = route.points[next];
        if (Math.hypot(x - w.player.x, y - w.player.y) < 1.5) {
          next++;
          continue;
        }
        const desired = worldAngleTo(w.player.x, w.player.y, x, y);
        const error = ((desired - w.player.yawDeg + 540) % 360) - 180;
        stepWorld(
          w,
          {
            throttle: Math.abs(error) > 8 ? 0 : 0.3,
            steer: Math.abs(error) > 1 ? Math.sign(error) : 0,
            justFire: false,
            aimX: x,
            aimY: y,
            hasAim: true,
          },
          STEP,
          { practice: true },
        );
      }
      assert.equal(next, route.points.length, `${route.name} stuck at ${w.player.x},${w.player.y}`);
    }
  });
  it("practice driving uses existing steering and collision without an attacking opponent", () => {
    for (const steer of [1, -1]) {
      const w = newLayoutWorld();
      for (let i = 0; i < 60; i++)
        stepWorld(
          w,
          { throttle: 1, steer, justFire: false, aimX: 0, aimY: 50, hasAim: false },
          STEP,
          { practice: true },
        );
      assert.ok(w.speed > 0);
      assert.ok(w.player.y > -50);
      assert.ok(steer === 1 ? w.player.x < 0 : w.player.x > 0);
      assert.equal(w.dummy.x, 1000);
      assert.equal(w.tracers.length, 0);
      assert.equal(w.complete, false);
    }
    const w = newLayoutWorld();
    w.player.x = -15;
    w.player.y = -30;
    for (let i = 0; i < 300; i++)
      stepWorld(
        w,
        { throttle: 1, steer: 0, justFire: false, aimX: 0, aimY: 50, hasAim: false },
        STEP,
        { practice: true },
      );
    assert.ok(w.player.y <= -25.7 + 1e-8, "tank must stop at house boundary plus hull margin");
  });
});
