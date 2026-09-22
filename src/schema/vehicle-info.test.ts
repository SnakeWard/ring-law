import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_HULLS,
  NATIONS,
  VEHICLE_INFO_ROSTER,
  assertVehicleInfoCoverage,
  vehicleInfoSheetFor,
} from "./index.ts";

describe("vehicle information sheets", () => {
  it("covers all 39 garage vehicles exactly once", () => {
    assert.equal(CATALOG_HULLS.length, 39);
    assert.equal(VEHICLE_INFO_ROSTER.length, 39);
    assert.deepEqual(assertVehicleInfoCoverage(), []);
    assert.equal(new Set(VEHICLE_INFO_ROSTER.map((entry) => entry.hullId)).size, 39);
  });

  it("provides thirteen sheets per nation", () => {
    for (const nation of NATIONS) {
      assert.equal(VEHICLE_INFO_ROSTER.filter((entry) => entry.nation === nation).length, 13);
    }
  });

  it("derives technical, armor, armament and audio data from the catalog", () => {
    for (const hull of CATALOG_HULLS) {
      const sheet = vehicleInfoSheetFor(hull.id);
      assert.ok(sheet, hull.id);
      assert.equal(sheet.hull, hull);
      assert.equal(sheet.armor.length, 6);
      assert.ok(sheet.technical.length >= 10);
      assert.ok(sheet.features.length >= 6);
      assert.equal(sheet.brief.hullId, hull.id);
      assert.ok(hull.weapons.includes(sheet.mainWeapon));
    }
  });

  it("keeps SPGs identifiable with their starter tier", () => {
    for (const id of ["m7-priest", "su-76", "wespe"]) {
      assert.equal(vehicleInfoSheetFor(id)?.tierLabel, "TIER 1 SPG");
      assert.equal(vehicleInfoSheetFor(id)?.mainTurret, undefined);
    }
  });
});
