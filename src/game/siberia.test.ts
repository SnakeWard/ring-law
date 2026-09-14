import assert from "node:assert/strict";
import { it } from "node:test";
import { createWorld, stepWorld, STEP } from "./sim.ts";
import { worldAngleTo } from "./math.ts";
import { pointInCover } from "../schema/cover.ts";
import { SIBERIA_MAP } from "../schema/maps/siberia.ts";
import { tickWeather } from "../schema/maps.ts";

it("Siberia spawns, cover bounds and snow work in the real world constructor", () => {
  const w = createWorld("m2a4", 0, "ap", "siberia");
  assert.equal(w.cover.length, 34);
  assert.equal(new Set(w.cover.map((c) => c.id)).size, 34);
  assert.equal(w.player.y, -56);
  assert.equal(w.dummy.y, 56);
  for (const c of w.cover) {
    assert.ok(Math.abs(c.x) + c.halfW < 64 && Math.abs(c.y) + c.halfL < 64);
    for (const h of [w.player, w.dummy]) assert.ok(!pointInCover(c, h.x, h.y, 1.7));
  }
  w.time = w.weatherUntil;
  assert.equal(tickWeather(w), "squall");
  assert.equal(w.weather, "snow");
  assert.equal(w.visMul, 0.85);
  assert.notEqual(w.cover[0], SIBERIA_MAP.cover[0]);
});

for (const [name, points] of [
  [
    "HC06/HC08 west corridor",
    [
      [-55, 0],
      [-35, 0],
    ],
  ],
  [
    "lake crossing with HC09/HC10 and end-rock detours",
    [
      [0, -56],
      [0, -30],
      [5, -27],
      [5, -17],
      [0, -12],
      [0, 12],
      [-5, 17],
      [-5, 27],
      [0, 32],
      [0, 56],
    ],
  ],
] as const)
  it(`actual tank can drive ${name} in both directions`, () => {
    for (const reverse of [false, true]) {
      const route = reverse ? [...points].reverse() : [...points];
      const w = createWorld("m2a4", 0, "ap", "siberia");
      [w.player.x, w.player.y] = route[0];
      w.dummy.x = w.dummy.y = 1000;
      let next = 1;
      for (let frame = 0; frame < 60 * 180 && next < route.length; frame++) {
        const [x, y] = route[next];
        if (Math.hypot(x - w.player.x, y - w.player.y) < 0.7) {
          next++;
          continue;
        }
        const err =
          ((worldAngleTo(w.player.x, w.player.y, x, y) - w.player.yawDeg + 540) % 360) - 180;
        stepWorld(
          w,
          {
            throttle: Math.abs(err) > 8 ? 0 : 0.25,
            steer: Math.abs(err) > 1 ? Math.sign(err) : 0,
            justFire: false,
            aimX: x,
            aimY: y,
            hasAim: true,
          },
          STEP,
          { practice: true },
        );
      }
      assert.equal(next, route.length, `stuck at ${w.player.x},${w.player.y}`);
    }
  });
