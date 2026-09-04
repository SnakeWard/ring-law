import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COVER_LAW,
  LOS_LAW,
  M2A4,
  T28,
  canSee,
  concealDrawAlpha,
  instantiateHull,
  mainTurret,
  resolveLos,
  stepConceal,
  type Cover,
} from "./index.ts";

describe("LOS LAW freeze", () => {
  it("is hull + main ring, same both ways", () => {
    assert.equal(LOS_LAW.version, 1);
    assert.equal(LOS_LAW.hullRangeM, 12);
    assert.equal(LOS_LAW.ringRangeM, 34);
    assert.equal(LOS_LAW.ringHalfConeDeg, 38);
    assert.equal(LOS_LAW.sameBothWays, true);
    assert.deepEqual([...LOS_LAW.ringViewStates], ["live", "jammed"]);
  });

  it("hull sees all-around inside 12 m even if the ring looks away", () => {
    const v = instantiateHull(M2A4, { id: "v", x: 0, y: 0, yawDeg: 0 });
    const main = mainTurret(v)!;
    main.facingDeg = 180;
    const r = resolveLos(v, { x: 8, y: 0 }, Infinity);
    assert.equal(r.channel, "hull");
    assert.equal(canSee(v, { x: 8, y: 0 }), true);
  });

  it("ring cone sees 28 m ahead and not 90° off", () => {
    const v = instantiateHull(T28, { id: "v", x: 0, y: 0, yawDeg: 0 });
    assert.equal(resolveLos(v, { x: 0, y: 28 }, Infinity).channel, "ring");
    assert.equal(resolveLos(v, { x: 28, y: 0 }, Infinity).channel, "none");
  });

  it("crew-killed ring is hull-only; jammed ring still sees", () => {
    const v = instantiateHull(M2A4, { id: "v", x: 0, y: 0, yawDeg: 0 });
    const main = mainTurret(v)!;
    main.state = "jammed";
    assert.equal(resolveLos(v, { x: 0, y: 28 }, Infinity).channel, "ring");
    main.state = "crew_killed";
    assert.equal(resolveLos(v, { x: 0, y: 28 }, Infinity).channel, "none");
    assert.equal(resolveLos(v, { x: 0, y: 10 }, Infinity).channel, "hull");
  });

  it("muzzle flash reveals outside the cone", () => {
    const v = instantiateHull(M2A4, { id: "v", x: 0, y: 0, yawDeg: 0 });
    const main = mainTurret(v)!;
    main.facingDeg = 180;
    assert.equal(resolveLos(v, { x: 0, y: 28 }, Infinity).channel, "none");
    assert.equal(resolveLos(v, { x: 0, y: 28 }, 0.4).channel, "muzzle");
    assert.equal(resolveLos(v, { x: 0, y: 28 }, 2).channel, "none");
  });
});

describe("COVER LAW freeze", () => {
  it("bushes block ring not hull; wrecks block both; muzzle ignores", () => {
    assert.deepEqual([...COVER_LAW.bushBlocks], ["ring"]);
    assert.equal(COVER_LAW.muzzleIgnoresCover, true);
    const v = instantiateHull(T28, { id: "v", x: 0, y: 0, yawDeg: 0 });
    const bush: Cover = { id: "b", kind: "bush", x: 0, y: 14, halfW: 2, halfL: 2 };
    assert.equal(resolveLos(v, { x: 0, y: 28 }, Infinity, [bush]).channel, "none");
    const close = instantiateHull(T28, { id: "c", x: 0, y: 0, yawDeg: 0 });
    const nearBush: Cover = { id: "nb", kind: "bush", x: 0, y: 4, halfW: 2, halfL: 1.5 };
    assert.equal(resolveLos(close, { x: 0, y: 8 }, Infinity, [nearBush]).channel, "hull");
    const wreck: Cover = { id: "w", kind: "wreck", x: 0, y: 5, halfW: 1.5, halfL: 2 };
    const far = instantiateHull(T28, { id: "f", x: 0, y: 0, yawDeg: 0 });
    assert.equal(resolveLos(far, { x: 0, y: 10 }, Infinity, [wreck]).channel, "none");
    assert.equal(resolveLos(far, { x: 0, y: 28 }, 0.2, [wreck]).channel, "muzzle");
  });

  it("occupying a bush hides from the ring, hull still sees close", () => {
    assert.equal(COVER_LAW.occupyHidesRing, true);
    const v = instantiateHull(T28, { id: "v", x: 0, y: 0, yawDeg: 0 });
    const camo: Cover = { id: "c", kind: "bush", x: 0, y: 28, halfW: 2, halfL: 2 };
    assert.equal(resolveLos(v, { x: 0, y: 28 }, Infinity, [camo]).channel, "none");
    const close = instantiateHull(T28, { id: "c", x: 0, y: 0, yawDeg: 0 });
    const near: Cover = { id: "n", kind: "bush", x: 0, y: 8, halfW: 2, halfL: 2 };
    assert.equal(resolveLos(close, { x: 0, y: 8 }, Infinity, [near]).channel, "hull");
  });

  it("conceal fade goes translucent then recovers", () => {
    assert.equal(COVER_LAW.concealAlpha, 0.38);
    let a = 0;
    for (let i = 0; i < 40; i++) a = stepConceal(a, true, 1 / 60);
    assert.ok(a > 0.85);
    assert.ok(concealDrawAlpha(a) < 0.5);
    for (let i = 0; i < 40; i++) a = stepConceal(a, false, 1 / 60);
    assert.ok(a < 0.15);
    assert.ok(concealDrawAlpha(a) > 0.9);
  });
});
