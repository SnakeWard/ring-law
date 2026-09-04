import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AMMO_LAW,
  M2A4,
  T28,
  instantiateHull,
  tryAmmoCook,
  formatAmmo,
} from "./index.ts";
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

describe("AMMO LAW freeze", () => {
  it("is side/rear chance, not bingo", () => {
    assert.equal(AMMO_LAW.version, 1);
    assert.equal(AMMO_LAW.bounceNeverRacks, true);
    assert.equal(AMMO_LAW.chance.hull_front, 0);
    assert.equal(AMMO_LAW.chance.hull_side, 0.22);
    assert.equal(AMMO_LAW.chance.hull_rear, 0.4);
    assert.equal(AMMO_LAW.chance.turret_rear, 0.15);
    assert.equal(AMMO_LAW.cookFrac, 0.32);
  });

  it("bounce and hull front never cook", () => {
    const h = instantiateHull(T28);
    assert.equal(tryAmmoCook(h, hit("hull_rear", "bounce"), () => 0).cooked, false);
    assert.equal(tryAmmoCook(h, hit("hull_front"), () => 0).cooked, false);
    assert.equal(h.onFire, false);
  });

  it("forced roll cooks side/rear: burst + fire", () => {
    const h = instantiateHull(M2A4);
    const hp0 = h.hp;
    const r = tryAmmoCook(h, hit("hull_side"), () => 0);
    assert.equal(r.cooked, true);
    assert.equal(r.damage, Math.round(180 * 0.32));
    assert.equal(h.hp, hp0 - r.damage);
    assert.equal(h.onFire, true);
    assert.match(formatAmmo(r), /AMMO/);
  });

  it("high roll misses even on rear", () => {
    const h = instantiateHull(T28);
    const r = tryAmmoCook(h, hit("hull_rear"), () => 0.99);
    assert.equal(r.cooked, false);
    assert.equal(h.hp, h.hpMax);
  });
});
