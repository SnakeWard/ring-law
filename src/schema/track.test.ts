import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TRACK_LAW, M2A4, instantiateHull, tryBreakTrack, formatTrack } from "./index.ts";
import type { HitReport } from "./armor.ts";

function hit(facet: HitReport["facet"], kind: HitReport["kind"] = "pen"): HitReport {
  return {
    kind,
    facet,
    nominalMm: 25,
    effectiveMm: 25,
    impactDeg: 8,
    damage: kind === "bounce" ? 0 : 55,
  };
}

describe("TRACK LAW freeze", () => {
  it("is side pen pin, ring stays free", () => {
    assert.equal(TRACK_LAW.version, 1);
    assert.equal(TRACK_LAW.bounceNeverTracks, true);
    assert.equal(TRACK_LAW.chance.hull_side, 0.55);
    assert.equal(TRACK_LAW.chance.hull_rear, 0.12);
    assert.equal(TRACK_LAW.chance.hull_front, 0);
    assert.equal(TRACK_LAW.pinned.ring, true);
    assert.equal(TRACK_LAW.pinned.translate, false);
  });

  it("bounce and turret never break a track", () => {
    const h = instantiateHull(M2A4);
    assert.equal(tryBreakTrack(h, hit("hull_side", "bounce"), () => 0).broken, false);
    assert.equal(tryBreakTrack(h, hit("turret_front"), () => 0).broken, false);
    assert.equal(h.tracked, false);
  });

  it("forced side pen pins; already tracked stays pinned", () => {
    const h = instantiateHull(M2A4);
    const r = tryBreakTrack(h, hit("hull_side"), () => 0);
    assert.equal(r.broken, true);
    assert.equal(h.tracked, true);
    assert.match(formatTrack(r, false), /TRACK/);
    assert.equal(formatTrack(tryBreakTrack(h, hit("hull_side"), () => 0), true), "");
  });

  it("high roll on side misses", () => {
    const h = instantiateHull(M2A4);
    assert.equal(tryBreakTrack(h, hit("hull_side"), () => 0.99).broken, false);
  });
});
