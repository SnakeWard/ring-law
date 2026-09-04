import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CRIT_LAW,
  M2A4,
  T28,
  TIGER_I,
  applyCrit,
  formatCrit,
  instantiateHull,
  leftoverAimDeg,
  mainTurret,
  tickFire,
  turretCanFire,
  turretCanTraverse,
} from "./index.ts";
import type { HitReport } from "./armor.ts";

function hit(facet: HitReport["facet"], kind: HitReport["kind"] = "pen"): HitReport {
  return {
    kind,
    facet,
    nominalMm: 30,
    effectiveMm: 30,
    impactDeg: 10,
    damage: kind === "bounce" ? 0 : 55,
  };
}

describe("CRIT LAW freeze", () => {
  it("is catalog v3, bounce never crits, fire 12 hp/s", () => {
    assert.equal(CRIT_LAW.version, 3);
    assert.equal(CRIT_LAW.bounceNeverCrits, true);
    assert.equal(CRIT_LAW.fireHpPerSec, 12);
    assert.equal(CRIT_LAW.facet.hull_front, "hp_only");
    assert.equal(CRIT_LAW.facet.hull_side, "fire");
    assert.equal(CRIT_LAW.facet.hull_rear, "fire_engine");
    assert.equal(CRIT_LAW.facet.turret_front, "jam_ladder");
    assert.equal(CRIT_LAW.facet.turret_side, "crew_killed");
    assert.equal(CRIT_LAW.facet.turret_rear, "destroyed");
  });

  it("bounce applies no module", () => {
    const h = instantiateHull(T28);
    const c = applyCrit(h, hit("turret_rear", "bounce"));
    assert.equal(c.kind, "none");
    assert.equal(mainTurret(h)?.state, "live");
    assert.equal(h.onFire, false);
  });

  it("hull front is HP only", () => {
    const h = instantiateHull(T28);
    const c = applyCrit(h, hit("hull_front"));
    assert.equal(c.kind, "none");
    assert.equal(h.onFire, false);
    assert.equal(mainTurret(h)?.state, "live");
  });

  it("hull side lights fire; rear dumps engine", () => {
    const h = instantiateHull(TIGER_I);
    applyCrit(h, hit("hull_side"));
    assert.equal(h.onFire, true);
    assert.equal(h.engineNorm, TIGER_I.defaultEngineNorm);
    const rear = instantiateHull(TIGER_I);
    const c = applyCrit(rear, hit("hull_rear"));
    assert.equal(c.kind, "fire");
    assert.equal(rear.onFire, true);
    assert.equal(rear.engineNorm, CRIT_LAW.engineOnRearFire);
  });

  it("turret front walks jam → crew → destroyed", () => {
    const h = instantiateHull(M2A4);
    const t = mainTurret(h)!;
    assert.equal(applyCrit(h, hit("turret_front")).kind, "jam");
    assert.equal(t.state, "jammed");
    assert.equal(turretCanTraverse(t.state), false);
    assert.equal(turretCanFire(t.state), true);
    assert.equal(leftoverAimDeg(h), 10);
    assert.equal(applyCrit(h, hit("turret_front")).kind, "crew_killed");
    assert.equal(turretCanFire(t.state), false);
    assert.equal(applyCrit(h, hit("turret_front")).kind, "destroyed");
    assert.equal(t.state, "destroyed");
    assert.equal(leftoverAimDeg(h), 0);
  });

  it("turret side kills crew; turret rear and overmatch kill the ring", () => {
    const side = instantiateHull(T28);
    assert.equal(applyCrit(side, hit("turret_side")).kind, "crew_killed");
    assert.equal(mainTurret(side)?.state, "crew_killed");
    const rear = instantiateHull(T28);
    assert.equal(applyCrit(rear, hit("turret_rear")).kind, "destroyed");
    const om = instantiateHull(M2A4);
    const c = applyCrit(om, hit("turret_front", "overmatch"));
    assert.equal(c.kind, "destroyed");
    assert.equal(mainTurret(om)?.state, "destroyed");
    assert.match(formatCrit(c), /RING DEAD/);
  });

  it("fire ticks HP", () => {
    const h = instantiateHull(M2A4);
    h.onFire = true;
    const hp0 = h.hp;
    tickFire(h, 1);
    assert.equal(h.hp, hp0 - 12);
  });
});
