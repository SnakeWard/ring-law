import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_HULLS,
  JAGDPANTHER,
  M7_PRIEST,
  SU_76,
  WESPE,
  M4A3E8,
  T44_100,
  assertCatalogLaws,
  canPlay,
  emptyGarage,
  greenReticleBound,
  hullBlueprintSchema,
  instantiateHull,
  isCasemate,
  leftoverAimDeg,
  validateStarterCatalog,
  weaponIsTurret,
} from "./index.ts";

describe("Expert freeze catalog", () => {
  it("catalog passes zod, tree, and artillery laws", () => {
    assert.deepEqual(validateStarterCatalog(), []);
    assert.ok(CATALOG_HULLS.length >= 33);
  });

  it("Priest is a howitzer casemate, not a ring", () => {
    hullBlueprintSchema.parse(M7_PRIEST);
    assert.deepEqual(assertCatalogLaws(M7_PRIEST), []);
    assert.equal(M7_PRIEST.class, "artillery");
    assert.equal(M7_PRIEST.turrets.length, 0);
    assert.equal(isCasemate(M7_PRIEST), true);
    const gun = M7_PRIEST.weapons.find((w) => w.kind === "howitzer")!;
    assert.equal(gun.mount, "hull_casemate");
    assert.equal(gun.caliberMm, 105);
    assert.equal(gun.mountTraverseDeg, 30);
    const hull = instantiateHull(M7_PRIEST);
    assert.equal(leftoverAimDeg(hull), 30);
    assert.equal(greenReticleBound(hull), true);
    assert.ok(hull.weapons.every((w) => weaponIsTurret(w) === false));
    assert.equal(canPlay(emptyGarage(), "m7-priest"), true);
  });

  it("SU-76 and Wespe are casemate howitzers", () => {
    assert.equal(SU_76.turrets.length, 0);
    assert.equal(WESPE.turrets.length, 0);
    assert.equal(SU_76.weapons[0].kind, "howitzer");
    assert.equal(WESPE.weapons[0].caliberMm, 105);
    assert.equal(leftoverAimDeg(instantiateHull(SU_76)), 15);
    assert.equal(leftoverAimDeg(instantiateHull(WESPE)), 16);
  });

  it("Jagdpanther leftover is always 11 and is not a ring", () => {
    assert.equal(JAGDPANTHER.class, "heavy");
    assert.equal(JAGDPANTHER.turrets.length, 0);
    const gun = JAGDPANTHER.weapons.find((w) => w.kind === "main_gun")!;
    assert.equal(gun.mount, "hull_casemate");
    assert.equal(gun.penMm, 202);
    assert.equal(leftoverAimDeg(instantiateHull(JAGDPANTHER)), 11);
  });

  it("T6 hulls sit on the line", () => {
    assert.equal(M4A3E8.class, "medium");
    assert.equal(M4A3E8.weapons.find((w) => w.kind === "main_gun")?.caliberMm, 76.2);
    assert.equal(T44_100.weapons.find((w) => w.kind === "main_gun")?.caliberMm, 100);
    assert.ok(T44_100.armor.hullFront.mm >= 90);
  });
});