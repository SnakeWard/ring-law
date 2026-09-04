import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { CATALOG_HULLS } from "./catalog.ts";
import { SKIN_LAW, SKINS, COVER_SKINS, FLOOR_SKIN, assertSkinCoverage, skinFor } from "./skin.ts";

function publicPath(url: string): string {
  return `public${url}`;
}

describe("SKIN LAW", () => {
  it("covers every catalog hull", () => {
    assert.equal(SKIN_LAW.art, true);
    assert.deepEqual(assertSkinCoverage(), []);
    assert.equal(Object.keys(SKINS).length, CATALOG_HULLS.length);
  });

  it("starter hulls have unique hull + turret files on disk", () => {
    for (const id of ["m2a4", "t-28", "tiger-i"] as const) {
      const s = skinFor(id);
      assert.ok(s, id);
      assert.equal(existsSync(publicPath(s!.hull)), true, s!.hull);
      for (const [tid, src] of Object.entries(s!.turrets)) {
        assert.equal(existsSync(publicPath(src)), true, `${tid} ${src}`);
      }
    }
    const t28 = skinFor("t-28")!;
    assert.ok(t28.turrets["t28-main"]);
    assert.ok(t28.turrets["t28-mg-port"]);
    assert.ok(t28.turrets["t28-mg-starboard"]);
  });

  it("casemates have hull art and no turret png", () => {
    for (const id of ["jagdpanther", "m7-priest", "su-76", "wespe"] as const) {
      const s = skinFor(id)!;
      assert.equal(s.casemate, true);
      assert.deepEqual(s.turrets, {});
      assert.equal(existsSync(publicPath(s.hull)), true, s.hull);
    }
  });

  it("cover sprites exist", () => {
    assert.equal(existsSync(publicPath(COVER_SKINS.bush)), true);
    assert.equal(existsSync(publicPath(COVER_SKINS.wreck)), true);
    assert.equal(SKIN_LAW.floor, "dirt");
    assert.equal(existsSync(publicPath(FLOOR_SKIN)), true);
  });

  it("unique family hulls and turrets are not aliased to their parents", () => {
    assert.equal(SKIN_LAW.version, 5);
    const family = {
      "m5-stuart": "m3-stuart",
      "m4a3e8": "m4a3-sherman",
      "m46-patton": "m26-pershing",
      "m47-patton": "m46-patton",
      "m48-patton": "m46-patton",
      "t-28e": "t-28",
      "t-34-85": "t-34",
      "t-44": "t-34-85",
      "t-44-100": "t-44",
      "t-54b": "t-54",
      "t-62": "t-54",
      "t-64a": "t-54",
      "panther-g": "panther",
      "panther-f": "panther",
      "e-50": "panther",
      "e-75": "tiger-ii",
      "standardpanzer": "leopard-1",
    } as const;
    for (const id of SKIN_LAW.uniqueFamilies) {
      const s = skinFor(id)!;
      const parent = skinFor(family[id])!;
      assert.notEqual(s.hull, parent.hull, `${id} hull still aliased`);
      const turret = Object.values(s.turrets)[0];
      const parentTurret = Object.values(parent.turrets)[0];
      assert.notEqual(turret, parentTurret, `${id} turret still aliased`);
      assert.equal(existsSync(publicPath(s.hull)), true, s.hull);
      assert.equal(existsSync(publicPath(turret)), true, turret);
    }
    const t28e = skinFor("t-28e")!;
    const t28 = skinFor("t-28")!;
    assert.notEqual(t28e.turrets["t28e-main"], t28.turrets["t28-main"]);
    assert.notEqual(t28e.turrets["t28e-mg-port"], t28.turrets["t28-mg-port"]);
    assert.equal(existsSync(publicPath(t28e.turrets["t28e-mg-port"])), true);
    assert.notEqual(skinFor("panther-g")!.hull, skinFor("panther-f")!.hull);
    assert.notEqual(
      Object.values(skinFor("panther-g")!.turrets)[0],
      Object.values(skinFor("panther-f")!.turrets)[0],
    );
  });

  it("turret PNG bodies sit on the image center (ring pivot)", () => {
    execFileSync("python3", ["scripts/check-turret-center.py"], { stdio: "inherit" });
  });
});
