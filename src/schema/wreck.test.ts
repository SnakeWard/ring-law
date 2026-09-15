import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WRECK_LAW,
  burstWreckSmoke,
  canTossRing,
  hullById,
  hullWreckCover,
  instantiateHull,
  shouldTossRing,
  shovePushableWreck,
  stepTossedRing,
  launchTossedRing,
  mainTurret,
} from "./index.ts";

describe("WRECK LAW", () => {
  it("casemates never toss a ring; T-28 can", () => {
    assert.equal(WRECK_LAW.version, 1);
    const priest = instantiateHull(hullById("m7-priest")!, { id: "p", x: 0, y: 0, yawDeg: 0 });
    const t28 = instantiateHull(hullById("t-28")!, { id: "t", x: 0, y: 0, yawDeg: 0 });
    assert.equal(canTossRing(priest), false);
    assert.equal(shouldTossRing(priest, () => 0), false);
    assert.equal(canTossRing(t28), true);
    assert.equal(shouldTossRing(t28, () => 0), true);
    assert.equal(shouldTossRing(t28, () => 0.99), false);
  });

  it("lays a pushable hull wreck the size of the plate", () => {
    const t28 = instantiateHull(hullById("t-28")!, { id: "t", x: 4, y: -3, yawDeg: 40 });
    const wreck = hullWreckCover(t28, ["t28-main"]);
    assert.equal(wreck.kind, "wreck");
    assert.equal(wreck.pushable, true);
    assert.equal(wreck.sourceId, "t");
    assert.equal(wreck.hullId, "t-28");
    assert.equal(wreck.x, 4);
    assert.equal(wreck.yawDeg, 40);
    assert.ok((wreck.halfL ?? 0) > (wreck.halfW ?? 0));
    assert.deepEqual(wreck.tossedTurretIds, ["t28-main"]);
  });

  it("death burst lays a smoke plume", () => {
    const t28 = instantiateHull(hullById("t-28")!, { id: "t", x: 0, y: 0, yawDeg: 0 });
    const wreck = hullWreckCover(t28);
    const smoke: { x: number; y: number; vx: number; vy: number; r: number; ttl: number; life: number }[] = [];
    burstWreckSmoke(wreck, smoke, () => 0.4);
    assert.equal(smoke.length, WRECK_LAW.smokeBurst);
    assert.ok(smoke[0]!.r > 0.3);
  });

  it("a live hull slowly shoves a hull wreck instead of popping through", () => {
    const wreck = hullWreckCover(
      instantiateHull(hullById("m2a4")!, { id: "d", x: 0, y: 0, yawDeg: 0 }),
    );
    const hull = { x: 0.2, y: 0 };
    const x0 = wreck.x;
    shovePushableWreck(hull, wreck, 1 / 60);
    assert.ok(wreck.x !== x0 || wreck.y !== 0, "wreck should slide");
    assert.ok(Math.abs(wreck.x - x0) < 0.2, "slide is slow");
  });

  it("tossed ring arcs then lands", () => {
    const t28 = instantiateHull(hullById("t-28")!, { id: "t", x: 0, y: 0, yawDeg: 0 });
    const main = mainTurret(t28)!;
    const ring = launchTossedRing(t28, main, () => 0.2);
    assert.ok(ring.lift >= 0);
    assert.equal(ring.landed, false);
    for (let i = 0; i < 180; i++) stepTossedRing(ring, 1 / 60, 36);
    assert.equal(ring.landed, true);
    assert.equal(ring.lift, 0);
  });
});
