import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAMO_ENVS,
  CAMO_LAW,
  NATIONS,
  allCamoSchemes,
  camoEnvForMap,
  camoScheme,
  camoStyleOf,
} from "./index.ts";

describe("CAMO LAW freeze", () => {
  it("holds nation styles and theater list", () => {
    assert.equal(CAMO_LAW.version, 1);
    assert.equal(camoStyleOf("germany"), "ambush");
    assert.equal(camoStyleOf("usa"), "block");
    assert.equal(camoStyleOf("ussr"), "amoeba");
    assert.deepEqual([...CAMO_ENVS], ["dirt", "snow", "urban", "jungle", "forest", "desert"]);
  });

  it("covers every nation × environment with a unique name and 3+ swatches", () => {
    const schemes = allCamoSchemes();
    assert.equal(schemes.length, NATIONS.length * CAMO_ENVS.length);
    const names = new Set(schemes.map((s) => `${s.nation}:${s.name}`));
    assert.equal(names.size, schemes.length);
    for (const s of schemes) {
      assert.ok(s.colors.length >= 3, s.name);
      assert.equal(s.style, camoStyleOf(s.nation));
    }
  });

  it("same theater, three nations: different field colours", () => {
    for (const env of CAMO_ENVS) {
      const a = camoScheme("usa", env).colors[0].join(",");
      const b = camoScheme("ussr", env).colors[0].join(",");
      const c = camoScheme("germany", env).colors[0].join(",");
      assert.notEqual(a, b, env);
      assert.notEqual(b, c, env);
      assert.notEqual(a, c, env);
    }
  });

  it("same nation, different theaters: different field colours", () => {
    for (const nation of NATIONS) {
      const fields = CAMO_ENVS.map((e) => camoScheme(nation, e).colors[0].join(","));
      assert.equal(new Set(fields).size, CAMO_ENVS.length, nation);
    }
  });
});

describe("camoEnvForMap", () => {
  it("maps baked theaters onto camo environments", () => {
    assert.equal(camoEnvForMap({ id: "range" }), "dirt");
    assert.equal(camoEnvForMap({ id: "snow" }), "snow");
    assert.equal(camoEnvForMap({ id: "urban" }), "urban");
    assert.equal(camoEnvForMap({ id: "tropical" }), "jungle");
    assert.equal(camoEnvForMap({ id: "mountains" }), "forest");
    assert.equal(camoEnvForMap({ id: "quarry" }), "desert");
    assert.equal(camoEnvForMap({ id: "siberia" }), "snow");
  });

  it("custom map biome wins over id", () => {
    assert.equal(camoEnvForMap({ id: "custom:x", biome: "jungle" }), "jungle");
    assert.equal(camoEnvForMap({ id: "custom:x", biome: "desert" }), "desert");
    assert.equal(camoEnvForMap({ id: "unknown" }), "dirt");
  });
});
