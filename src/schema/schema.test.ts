import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  M2A4,
  M3_STUART,
  T28,
  T28E,
  T34,
  T34_85,
  T44,
  TIGER_I,
  TIGER_II,
  PANTHER,
  PANTHER_G,
  M5_STUART,
  M24_CHAFFEE,
  M4A3_SHERMAN,
  STARTER_HULLS,
  TURRET_INSTANCE_FIELDS,
  WEAPON_INSTANCE_FIELDS,
  assertCatalogLaws,
  bindsGreenReticle,
  classifyTurret,
  classifyWeapon,
  effectiveTraverseRate,
  greenReticleBound,
  hullBlueprintSchema,
  hullWeapons,
  instantiateHull,
  leftoverAimDeg,
  mainTurret,
  RING_LAW,
  SCHEMA_VERSION,
  setTurretFacing,
  setTurretState,
  turretCanFire,
  turretCanTraverse,
  validateStarterCatalog,
  weaponIsTurret,
  weaponsOnTurret,
} from "./index.ts";

function sorted(keys: readonly string[]): string[] {
  return [...keys].sort();
}

describe("RING LAW freeze", () => {
  it("is schema version 5", () => {
    assert.equal(SCHEMA_VERSION, 5);
    assert.equal(RING_LAW.version, 5);
    assert.deepEqual([...RING_LAW.starterHulls], ["m2a4", "t-28", "tiger-i"]);
  });

  it("TurretInstance and WeaponInstance field sets are frozen", () => {
    const hull = instantiateHull(T28, { id: "k", x: 0, y: 0, yawDeg: 0 });
    const turret = hull.turrets[0];
    const weapon = hull.weapons[0];
    assert.deepEqual(Object.keys(turret).sort(), sorted(TURRET_INSTANCE_FIELDS));
    assert.deepEqual(Object.keys(weapon).sort(), sorted(WEAPON_INSTANCE_FIELDS));
  });

  it("starter catalog passes zod and catalog laws", () => {
    const errors = validateStarterCatalog();
    assert.deepEqual(errors, []);
    for (const bp of STARTER_HULLS) {
      hullBlueprintSchema.parse(bp);
      assert.deepEqual(assertCatalogLaws(bp), []);
    }
  });

  it("M2A4 is one manual ring; sponsons and bow are not turrets", () => {
    assert.equal(M2A4.turrets.length, 1);
    assert.equal(M2A4.turrets[0].drive, "manual");
    const hull = instantiateHull(M2A4);
    assert.equal(hull.turrets.length, 1);
    assert.equal(hullWeapons(hull).length, 3);
    for (const w of hull.weapons) {
      assert.equal(weaponIsTurret(w), false);
      assert.equal(classifyWeapon(w).isTurret, false);
    }
    const sponsons = hull.weapons.filter((w) => w.kind === "sponson_fixed");
    assert.equal(sponsons.length, 2);
    assert.ok(sponsons.every((w) => w.mount === "hull_fixed" && w.turretId == null));
  });

  it("M3 Stuart is one manual ring; sponsons are not turrets", () => {
    assert.equal(M3_STUART.class, "light");
    assert.equal(M3_STUART.nation, "usa");
    assert.equal(M3_STUART.turrets.length, 1);
    assert.equal(M3_STUART.turrets[0].drive, "manual");
    const hull = instantiateHull(M3_STUART);
    assert.equal(hullWeapons(hull).length, 3);
    for (const w of hull.weapons) {
      assert.equal(weaponIsTurret(w), false);
    }
    const gun = hull.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.caliberMm, 37);
    assert.equal(gun.mountTraverseDeg, 0);
  });

  it("M5 Stuart is one hydraulic ring; no sponsons; leftover 0", () => {
    assert.equal(M5_STUART.turrets.length, 1);
    assert.equal(M5_STUART.turrets[0].drive, "hydraulic");
    assert.equal(M5_STUART.turrets[0].traverseRateDegPerSec, 24);
    assert.equal(M5_STUART.weapons.some((w) => w.kind === "sponson_fixed"), false);
    const hull = instantiateHull(M5_STUART);
    assert.equal(hullWeapons(hull).length, 1);
    const gun = hull.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.penMm, 56);
    assert.equal(gun.mountTraverseDeg, 0);
    assert.equal(leftoverAimDeg(hull), 0);
    const bow = hull.weapons.find((w) => w.kind === "bow_mg")!;
    assert.equal(bow.mount, "hull_ball");
    assert.equal(bow.turretId, null);
  });

  it("M24 Chaffee is one hydraulic ring; 75 mm M6; glacis 25 @ 60; leftover 0", () => {
    assert.equal(M24_CHAFFEE.class, "light");
    assert.equal(M24_CHAFFEE.nation, "usa");
    assert.equal(M24_CHAFFEE.turrets.length, 1);
    assert.equal(M24_CHAFFEE.turrets[0].drive, "hydraulic");
    assert.equal(M24_CHAFFEE.turrets[0].traverseRateDegPerSec, 24);
    assert.equal(M24_CHAFFEE.armor.hullFront.mm, 25);
    assert.equal(M24_CHAFFEE.armor.hullFront.slopeDeg, 60);
    const gun = M24_CHAFFEE.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.caliberMm, 75);
    assert.equal(gun.penMm, 109);
    assert.equal(gun.mountTraverseDeg, 0);
    const hull = instantiateHull(M24_CHAFFEE);
    const bow = hull.weapons.find((w) => w.kind === "bow_mg")!;
    assert.equal(bow.mount, "hull_ball");
    assert.equal(bow.turretId, null);
    assert.equal(leftoverAimDeg(hull), 0);
  });

  it("M4A3 Sherman is one hydraulic ring; 75 mm M3; glacis 64 @ 47; leftover 0", () => {
    assert.equal(M4A3_SHERMAN.class, "medium");
    assert.equal(M4A3_SHERMAN.nation, "usa");
    assert.equal(M4A3_SHERMAN.turrets.length, 1);
    assert.equal(M4A3_SHERMAN.turrets[0].drive, "hydraulic");
    assert.equal(M4A3_SHERMAN.armor.hullFront.mm, 64);
    assert.equal(M4A3_SHERMAN.armor.hullFront.slopeDeg, 47);
    const gun = M4A3_SHERMAN.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.caliberMm, 75);
    assert.equal(gun.penMm, 109);
    assert.equal(gun.mountTraverseDeg, 0);
    const hull = instantiateHull(M4A3_SHERMAN);
    const bow = hull.weapons.find((w) => w.kind === "bow_mg")!;
    assert.equal(bow.mount, "hull_ball");
    assert.equal(bow.turretId, null);
    assert.equal(leftoverAimDeg(hull), 0);
  });

  it("T-28 is three rings; MG turrets do not wrap", () => {
    assert.equal(T28.turrets.length, 3);
    const roles = T28.turrets.map((t) => t.role).sort();
    assert.deepEqual(roles, ["main", "mg_port", "mg_starboard"]);
    const subs = T28.turrets.filter((t) => t.role !== "main");
    assert.ok(subs.every((t) => t.wrap === false));
    assert.ok(subs.every((t) => t.arcMaxDeg - t.arcMinDeg === 165));
    const hull = instantiateHull(T28);
    assert.equal(hull.turrets.length, 3);
    assert.ok(hull.weapons.every((w) => w.turretId != null));
    for (const t of hull.turrets) {
      assert.equal(classifyTurret(t).isTurret, true);
    }
  });

  it("T-28E keeps three rings and thicker plates", () => {
    assert.equal(T28E.turrets.length, 3);
    assert.equal(T28E.armor.hullFront.mm, 50);
    assert.equal(T28E.armor.turretFront.mm, 50);
    assert.ok(T28E.armor.hullFront.mm > T28.armor.hullFront.mm);
    const subs = T28E.turrets.filter((t) => t.role !== "main");
    assert.ok(subs.every((t) => t.arcMaxDeg - t.arcMinDeg === 165));
    const gun = T28E.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.penMm, 34);
    assert.ok(T28E.forwardSpeedMps < T28.forwardSpeedMps);
  });

  it("T-34 is one electric ring; F-34; glacis 45 @ 60; leftover 0", () => {
    assert.equal(T34.class, "medium");
    assert.equal(T34.nation, "ussr");
    assert.equal(T34.turrets.length, 1);
    assert.equal(T34.turrets[0].drive, "electric");
    assert.equal(T34.armor.hullFront.mm, 45);
    assert.equal(T34.armor.hullFront.slopeDeg, 60);
    const gun = T34.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.caliberMm, 76.2);
    assert.equal(gun.penMm, 86);
    assert.equal(gun.mountTraverseDeg, 0);
    const hull = instantiateHull(T34);
    const bow = hull.weapons.find((w) => w.kind === "bow_mg")!;
    assert.equal(bow.mount, "hull_ball");
    assert.equal(bow.turretId, null);
    assert.equal(leftoverAimDeg(hull), 0);
  });

  it("T-34-85 is one electric ring; ZiS-S-53; turret 90; leftover 0", () => {
    assert.equal(T34_85.class, "medium");
    assert.equal(T34_85.nation, "ussr");
    assert.equal(T34_85.turrets.length, 1);
    assert.equal(T34_85.turrets[0].drive, "electric");
    assert.equal(T34_85.armor.hullFront.mm, 45);
    assert.equal(T34_85.armor.hullFront.slopeDeg, 60);
    assert.equal(T34_85.armor.turretFront.mm, 90);
    assert.ok(T34_85.armor.turretFront.mm > T34.armor.turretFront.mm);
    const gun = T34_85.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.caliberMm, 85);
    assert.equal(gun.penMm, 125);
    assert.equal(gun.mountTraverseDeg, 0);
    const hull = instantiateHull(T34_85);
    const bow = hull.weapons.find((w) => w.kind === "bow_mg")!;
    assert.equal(bow.mount, "hull_ball");
    assert.equal(bow.turretId, null);
    assert.equal(leftoverAimDeg(hull), 0);
  });

  it("T-44 is one electric ring; same 85 mm; glacis 90 @ 60; no bow MG", () => {
    assert.equal(T44.class, "medium");
    assert.equal(T44.nation, "ussr");
    assert.equal(T44.turrets.length, 1);
    assert.equal(T44.turrets[0].drive, "electric");
    assert.equal(T44.armor.hullFront.mm, 90);
    assert.equal(T44.armor.hullFront.slopeDeg, 60);
    assert.ok(T44.armor.hullFront.mm > T34_85.armor.hullFront.mm);
    const gun = T44.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.caliberMm, 85);
    assert.equal(gun.penMm, 125);
    assert.equal(T44.weapons.some((w) => w.kind === "bow_mg"), false);
    assert.equal(leftoverAimDeg(instantiateHull(T44)), 0);
  });

  it("Tiger I is one hydraulic ring; bow MG is hull", () => {
    assert.equal(TIGER_I.turrets.length, 1);
    assert.equal(TIGER_I.turrets[0].drive, "hydraulic");
    const hull = instantiateHull(TIGER_I);
    const bow = hull.weapons.find((w) => w.kind === "bow_mg");
    assert.ok(bow);
    assert.equal(bow.mount, "hull_ball");
    assert.equal(bow.turretId, null);
    assert.equal(hullWeapons(hull).length, 1);
    assert.equal(weaponsOnTurret(hull, "tiger-main").length, 2);
  });

  it("Tiger II is one hydraulic ring; thicker face; leftover 0", () => {
    assert.equal(TIGER_II.turrets.length, 1);
    assert.equal(TIGER_II.turrets[0].drive, "hydraulic");
    assert.ok(TIGER_II.armor.hullFront.mm > TIGER_I.armor.hullFront.mm);
    assert.ok(TIGER_II.armor.turretFront.mm > TIGER_I.armor.turretFront.mm);
    const gun = TIGER_II.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.caliberMm, 88);
    assert.equal(gun.mountTraverseDeg, 0);
    assert.ok(gun.penMm > 132);
    const hull = instantiateHull(TIGER_II);
    const bow = hull.weapons.find((w) => w.kind === "bow_mg")!;
    assert.equal(bow.mount, "hull_ball");
    assert.equal(bow.turretId, null);
  });

  it("Panther is one hydraulic ring; KwK 42; glacis 80 @ 55; leftover 0", () => {
    assert.equal(PANTHER.class, "medium");
    assert.equal(PANTHER.nation, "germany");
    assert.equal(PANTHER.turrets.length, 1);
    assert.equal(PANTHER.turrets[0].drive, "hydraulic");
    assert.equal(PANTHER.turrets[0].traverseRateDegPerSec, 6);
    assert.equal(PANTHER.armor.hullFront.mm, 80);
    assert.equal(PANTHER.armor.hullFront.slopeDeg, 55);
    const gun = PANTHER.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.caliberMm, 75);
    assert.equal(gun.penMm, 138);
    assert.equal(gun.mountTraverseDeg, 0);
    const hull = instantiateHull(PANTHER);
    const bow = hull.weapons.find((w) => w.kind === "bow_mg")!;
    assert.equal(bow.mount, "hull_ball");
    assert.equal(bow.turretId, null);
    assert.equal(leftoverAimDeg(hull), 0);
  });

  it("Panther G is one hydraulic ring; same KwK 42; sides 50 @ 30", () => {
    assert.equal(PANTHER_G.class, "medium");
    assert.equal(PANTHER_G.turrets.length, 1);
    assert.equal(PANTHER_G.turrets[0].drive, "hydraulic");
    assert.equal(PANTHER_G.armor.hullFront.mm, PANTHER.armor.hullFront.mm);
    assert.equal(PANTHER_G.armor.hullSide.mm, 50);
    assert.equal(PANTHER_G.armor.hullSide.slopeDeg, 30);
    assert.ok(PANTHER_G.armor.hullSide.mm > PANTHER.armor.hullSide.mm);
    const gun = PANTHER_G.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.caliberMm, 75);
    assert.equal(gun.penMm, 138);
    assert.equal(leftoverAimDeg(instantiateHull(PANTHER_G)), 0);
  });

  it("parentHullId is the instance id, not the blueprint id", () => {
    const hull = instantiateHull(M2A4, {
      id: "spawn-1",
      x: 0,
      y: 0,
      yawDeg: 0,
    });
    assert.equal(hull.id, "spawn-1");
    assert.ok(hull.turrets.every((t) => t.parentHullId === "spawn-1"));
    assert.ok(hull.weapons.every((w) => w.parentHullId === "spawn-1"));
  });

  it("green reticle binds only to a firing main ring", () => {
    let hull = instantiateHull(T28);
    assert.equal(greenReticleBound(hull), true);
    const main = mainTurret(hull);
    assert.ok(main);
    assert.equal(bindsGreenReticle(main), true);
    assert.equal(turretCanTraverse("live"), true);
    assert.equal(turretCanFire("jammed"), true);
    assert.equal(turretCanTraverse("jammed"), false);
    assert.equal(turretCanFire("destroyed"), false);
    hull = setTurretState(hull, main.id, "jammed");
    assert.equal(greenReticleBound(hull), true);
    hull = setTurretState(hull, main.id, "destroyed");
    assert.equal(greenReticleBound(hull), false);
    hull = setTurretState(hull, main.id, "crew_killed");
    assert.equal(greenReticleBound(hull), false);
  });

  it("M2A4 leftover aim is ±10 when the ring jams, 0 when destroyed", () => {
    let hull = instantiateHull(M2A4);
    assert.equal(leftoverAimDeg(hull), 0);
    hull = setTurretState(hull, "m2a4-main", "jammed");
    assert.equal(leftoverAimDeg(hull), 10);
    hull = setTurretState(hull, "m2a4-main", "crew_killed");
    assert.equal(leftoverAimDeg(hull), 10);
    hull = setTurretState(hull, "m2a4-main", "destroyed");
    assert.equal(leftoverAimDeg(hull), 0);
  });

  it("Tiger leftover aim is 0 — no mount traverse", () => {
    let hull = instantiateHull(TIGER_I);
    hull = setTurretState(hull, "tiger-main", "jammed");
    assert.equal(leftoverAimDeg(hull), 0);
  });

  it("hydraulic rate scales with engine; dead ring rate is 0", () => {
    const hull = instantiateHull(TIGER_I);
    const t = mainTurret(hull);
    assert.ok(t);
    const idle = effectiveTraverseRate(t, 0);
    const full = effectiveTraverseRate(t, 1);
    assert.ok(idle < full);
    assert.equal(Math.round(idle * 100) / 100, 2.1);
    assert.equal(full, 12);
    const dead = { ...t, state: "jammed" as const };
    assert.equal(effectiveTraverseRate(dead, 1), 0);
  });

  it("T-28 port facing clamps to 165° arc", () => {
    let hull = instantiateHull(T28);
    hull = setTurretFacing(hull, "t28-mg-port", 90);
    const port = hull.turrets.find((t) => t.id === "t28-mg-port");
    assert.equal(port?.facingDeg, 0);
    hull = setTurretFacing(hull, "t28-mg-port", -90);
    const port2 = hull.turrets.find((t) => t.id === "t28-mg-port");
    assert.equal(port2?.facingDeg, -90);
  });

  it("rejects a hull that promotes a sponson to a turret role", () => {
    const bad = {
      ...M2A4,
      id: "bad",
      turrets: [
        ...M2A4.turrets,
        {
          ...M2A4.turrets[0],
          id: "fake-sponson",
          role: "mg_port" as const,
          wrap: true,
          defaultWeaponId: "m2a4-sponson-l",
        },
      ],
    };
    const errors = assertCatalogLaws(bad);
    assert.ok(errors.some((e) => e.includes("only main may wrap")));
  });
});
