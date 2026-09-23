import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SPATIAL_LAW, spatialMix } from "./sfx.ts";

describe("SPATIAL LAW v1", () => {
  it("is full and centred up close", () => {
    assert.deepEqual(spatialMix(0, 0, 0, 3), { gain: 1, pan: 0 });
  });

  it("gets quieter with distance and is silent past hearing range", () => {
    const g = [10, 30, 60, 100].map((d) => spatialMix(0, 0, 0, d).gain);
    for (let i = 1; i < g.length; i++) assert.ok(g[i] < g[i - 1], `rolls off at step ${i}`);
    assert.equal(spatialMix(0, 0, 0, SPATIAL_LAW.hearM + 1).gain, 0);
    assert.ok(spatialMix(0, 0, 0, SPATIAL_LAW.hearM - 1).gain < 0.02, "fades to the edge");
  });

  it("pans toward the side the source is on, within limits", () => {
    assert.ok(spatialMix(0, 0, 20, 0).pan > 0.3);
    assert.ok(spatialMix(0, 0, -20, 0).pan < -0.3);
    assert.equal(spatialMix(0, 0, 500, 0).pan, 0, "out of range is silent anyway");
    assert.equal(spatialMix(0, 0, 100, 0).pan, SPATIAL_LAW.maxPan);
  });
});
