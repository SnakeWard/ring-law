import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTEL_LAW,
  M2A4,
  instantiateHull,
  minimapPoint,
  stepIntel,
  teamColor,
  teamOf,
  type HullInstance,
} from "./index.ts";

function mk(id: string, x = 0, y = 0): HullInstance {
  return instantiateHull(M2A4, { id, x, y, yawDeg: 0 });
}

const never = () => false;
const always = () => true;

describe("INTEL LAW freeze", () => {
  it("holds the frozen values", () => {
    assert.equal(INTEL_LAW.version, 1);
    assert.equal(INTEL_LAW.staleDecayS, 4);
    assert.equal(INTEL_LAW.teamShared, true);
    assert.equal(INTEL_LAW.minimap.anchor, "top-right");
    assert.equal(INTEL_LAW.minimap.sizePx, 148);
    assert.equal(INTEL_LAW.minimap.show, "always");
  });

  it("teamOf maps all four id shapes", () => {
    assert.equal(teamOf({ id: "player" }), "friendly");
    assert.equal(teamOf({ id: "ally-1" }), "friendly");
    assert.equal(teamOf({ id: "dummy" }), "enemy");
    assert.equal(teamOf({ id: "foe-0" }), "enemy");
    assert.equal(teamOf({ id: "dummy" }, "dummy"), "friendly");
    assert.equal(teamOf({ id: "player" }, "dummy"), "enemy");
  });

  it("teamColor returns the palette; stale enemies dim", () => {
    assert.equal(teamColor("friendly"), INTEL_LAW.color.friendly);
    assert.equal(teamColor("enemy"), INTEL_LAW.color.enemy);
    assert.equal(teamColor("enemy", "stale"), INTEL_LAW.color.stale);
    assert.equal(teamColor("enemy", "live"), INTEL_LAW.color.enemy);
  });
});

describe("stepIntel", () => {
  it("no LOS, no prior: friendly marks only", () => {
    const marks = stepIntel({}, 0, [mk("player"), mk("ally-0")], [mk("dummy")], never, false);
    assert.ok(marks["player"]);
    assert.ok(marks["ally-0"]);
    assert.equal(marks["player"].state, "live");
    assert.equal(marks["player"].team, "friendly");
    assert.equal(marks["dummy"], undefined);
  });

  it("sees one foe: that foe live, others absent", () => {
    const foeA = mk("dummy", 5, 5);
    const foeB = mk("foe-0", -5, -5);
    const marks = stepIntel({}, 1, [mk("player")], [foeA, foeB], (_f, t) => t.id === "dummy", false);
    assert.equal(marks["dummy"]?.state, "live");
    assert.equal(marks["dummy"]?.x, 5);
    assert.equal(marks["foe-0"], undefined);
  });

  it("aerial marks every living enemy regardless of sees", () => {
    const marks = stepIntel({}, 2, [mk("player")], [mk("dummy"), mk("foe-0")], never, true);
    assert.equal(marks["dummy"]?.state, "aerial");
    assert.equal(marks["foe-0"]?.state, "aerial");
  });

  it("lost mark goes stale at frozen position, then decays", () => {
    const foe = mk("dummy", 3, 7);
    let marks = stepIntel({}, 10, [mk("player")], [foe], always, false);
    assert.equal(marks["dummy"].state, "live");
    foe.x = 20;
    foe.y = 20;
    marks = stepIntel(marks, 12, [mk("player")], [foe], never, false);
    assert.equal(marks["dummy"].state, "stale");
    assert.equal(marks["dummy"].x, 3);
    assert.equal(marks["dummy"].y, 7);
    marks = stepIntel(marks, 10 + INTEL_LAW.staleDecayS, [mk("player")], [foe], never, false);
    assert.equal(marks["dummy"], undefined);
  });

  it("dead enemies never marked; a dead plate's mark drops", () => {
    const foe = mk("dummy");
    foe.hp = 0;
    let marks = stepIntel({}, 0, [mk("player")], [foe], always, false);
    assert.equal(marks["dummy"], undefined);
    const live = mk("dummy");
    marks = stepIntel({}, 0, [mk("player")], [live], always, false);
    assert.ok(marks["dummy"]);
    live.hp = 0;
    marks = stepIntel(marks, 0.1, [mk("player")], [live], always, false);
    assert.equal(marks["dummy"], undefined);
  });

  it("teamShared: ally-only LOS marks when shared, not otherwise", () => {
    const seesFromAlly = (from: HullInstance) => from.id === "ally-0";
    const team = [mk("player"), mk("ally-0")];
    const shared = stepIntel({}, 0, team, [mk("dummy")], seesFromAlly, false, true);
    assert.ok(shared["dummy"]);
    const solo = stepIntel({}, 0, team, [mk("dummy")], seesFromAlly, false, false);
    assert.equal(solo["dummy"], undefined);
  });
});

describe("minimapPoint", () => {
  it("centre maps to centre, edges to edges, beyond clamps", () => {
    assert.deepEqual(minimapPoint(0, 0, 36, 148), { px: 74, py: 74 });
    assert.deepEqual(minimapPoint(36, 36, 36, 148), { px: 148, py: 0 });
    assert.deepEqual(minimapPoint(-36, -36, 36, 148), { px: 0, py: 148 });
    assert.deepEqual(minimapPoint(999, -999, 36, 148), { px: 148, py: 148 });
  });
});
