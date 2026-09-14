import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RIVER_LAW,
  inUncrossableWater,
  nearestCrossingPoint,
  polylineAt,
  pushOutRivers,
  riverBlocksSegment,
  riverLengthM,
  riverSpeedMul,
  smoothPolyline,
  type River,
} from "./river.ts";

const straight: River = {
  id: "r",
  points: [
    { x: -40, y: 0 },
    { x: 40, y: 0 },
  ],
  widthM: 6,
  crossings: [
    { id: "ford", kind: "ford", atM: 30, lengthM: 8 },
    { id: "bridge", kind: "bridge", atM: 60, lengthM: 6 },
  ],
};

describe("RIVER LAW", () => {
  it("water stops tracks only", () => {
    assert.deepEqual([...RIVER_LAW.blocks], ["motion"]);
    assert.deepEqual([...RIVER_LAW.passes], ["ring", "hull", "shot"]);
  });

  it("arclength and point lookup", () => {
    assert.equal(riverLengthM(straight), 80);
    const p = polylineAt(straight.points, 30);
    assert.equal(p.x, -10);
    assert.equal(p.y, 0);
    assert.equal(p.tx, 1);
  });

  it("smoothing keeps the end points and adds points", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 },
    ];
    const s = smoothPolyline(pts);
    assert.deepEqual(s[0], { x: 0, y: 0 });
    assert.deepEqual(s[s.length - 1], { x: 20, y: 0 });
    assert.ok(s.length > pts.length);
  });

  it("mid-river is uncrossable, a ford is not", () => {
    assert.equal(inUncrossableWater([straight], 0, 0), true);
    assert.equal(inUncrossableWater([straight], -10, 0), false, "ford at x=-10");
    assert.equal(inUncrossableWater([straight], 20, 1), false, "bridge at x=20");
    assert.equal(inUncrossableWater([straight], 0, 10), false, "dry land");
  });

  it("push-out moves a hull onto the bank, keeps a ford", () => {
    const pos = { x: 0, y: 1 };
    assert.equal(pushOutRivers(pos, [straight], 1.7), true);
    assert.ok(pos.y >= 3 + 1.7 + RIVER_LAW.bankPadM - 1e-9, "bank " + pos.y);
    const ford = { x: -10, y: 0 };
    assert.equal(pushOutRivers(ford, [straight], 1.7), false);
    assert.deepEqual(ford, { x: -10, y: 0 });
  });

  it("ford slows, bridge and dry land do not", () => {
    assert.equal(riverSpeedMul([straight], -10, 0), RIVER_LAW.fordSpeedMul);
    assert.equal(riverSpeedMul([straight], 20, 0), 1);
    assert.equal(riverSpeedMul([straight], 0, 12), 1);
  });

  it("a run across open water is blocked; through a crossing it is not", () => {
    assert.equal(riverBlocksSegment(0, -10, 0, 10, [straight]), true);
    assert.equal(riverBlocksSegment(-10, -10, -10, 10, [straight]), false);
    assert.equal(riverBlocksSegment(-30, -10, 30, -10, [straight]), false);
  });

  it("routes through the crossing with the shortest detour", () => {
    const via = nearestCrossingPoint([straight], 22, -20, 22, 20);
    assert.ok(via);
    assert.equal(Math.round(via!.x), 20, "bridge is nearer than the ford");
    assert.ok(via!.y > 3, "exit lands on the far bank, y=" + via!.y);
  });
});
