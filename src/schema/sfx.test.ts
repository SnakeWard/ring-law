import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { CATALOG_HULLS } from "./catalog.ts";
import {
  ENGINE_SFX_BY_HULL,
  ENGINE_TAKES,
  GUN_SFX_BY_HULL,
  GUN_TAKES,
  SFX_LAW,
  assertEngineSfxCoverCatalog,
  assertGunSfxCoverCatalog,
  enginePlaybackRate,
  gunSfxId,
} from "./sfx.ts";

describe("SFX LAW v2 guns + engines", () => {
  it("maps every catalog hull onto a baked gun take", () => {
    assertGunSfxCoverCatalog();
    assert.equal(Object.keys(GUN_SFX_BY_HULL).length, CATALOG_HULLS.length);
    for (const id of GUN_TAKES) {
      assert.ok(existsSync(`public${SFX_LAW.gunDir}/${id}.mp3`), id);
    }
    assert.equal(gunSfxId("m2a4"), "37-m5");
    assert.equal(gunSfxId("wespe"), "105-lefh");
  });

  it("maps every catalog hull onto a family engine and scales rate with load", () => {
    assertEngineSfxCoverCatalog();
    assert.equal(Object.keys(ENGINE_SFX_BY_HULL).length, CATALOG_HULLS.length);
    for (const id of ENGINE_TAKES) {
      assert.ok(existsSync(`public${SFX_LAW.engineDir}/${id}.mp3`), id);
    }
    assert.equal(ENGINE_SFX_BY_HULL["t-34-85"]?.take, "v2-34");
    assert.equal(ENGINE_SFX_BY_HULL["tiger-ii"]?.take, "hl230-tiger");
    assert.ok(ENGINE_SFX_BY_HULL["tiger-ii"]!.base < ENGINE_SFX_BY_HULL["tiger-i"]!.base);
    const idle = enginePlaybackRate(0.22, 1);
    const full = enginePlaybackRate(1, 1);
    assert.ok(full > idle);
    assert.ok(full <= 1.55);
  });
});
