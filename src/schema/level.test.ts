import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import {
  BIOMES,
  BIOME_IDS,
  MAP_SIZES,
  PRESETS,
  buildPreset,
  compileLevel,
  coverRules,
  customMapId,
  gridReachable,
  importLevel,
  exportLevel,
  levelIsPlayable,
  mapById,
  newLevel,
  passabilityGrid,
  registerLevel,
  validateLevel,
  unregisterCustomMap,
  isGeneratedSkin,
  parseGeneratedSkin,
  RULES_BY_KIND,
  occupyBush,
  pushOutWrecks,
  firstCoverHit,
  pointInCover,
  type Cover,
} from "./index.ts";
import { createWorld, stepWorld, dummyGoal } from "../game/sim.ts";
import { hasGenerator } from "../game/gen-assets.ts";

function publicPath(src: string) {
  return src.replace(/^\//, "public/");
}

describe("COVER LAW v3 rules", () => {
  it("kind defaults match v2 behaviour", () => {
    assert.deepEqual(coverRules({ kind: "bush" }), RULES_BY_KIND.bush);
    assert.deepEqual(coverRules({ kind: "wreck" }), RULES_BY_KIND.wreck);
  });

  it("a low wall stops tracks and shells but not the ring", () => {
    const wall: Cover = {
      id: "w",
      kind: "wreck",
      x: 0,
      y: 0,
      halfW: 4,
      halfL: 0.8,
      rules: { ring: false, hull: false },
    };
    assert.equal(firstCoverHit(0, -10, 0, 10, [wall], "ring"), null);
    assert.equal(firstCoverHit(0, -10, 0, 10, [wall], "shot"), wall);
    const pos = { x: 0, y: 0 };
    pushOutWrecks(pos, [wall], 1.7);
    assert.ok(Math.abs(pos.y) >= 0.8 + 1.7 - 1e-9);
  });

  it("a passable shot-blocker is promoted to a motion blocker", () => {
    const r = coverRules({ kind: "bush", rules: { shot: true } });
    assert.equal(r.motion, true);
  });

  it("a tank trap stops tracks only; a crater stops nothing", () => {
    const trap: Cover = {
      id: "t",
      kind: "wreck",
      x: 0,
      y: 0,
      halfW: 1.4,
      halfL: 1.4,
      rules: { shot: false, ring: false, hull: false },
    };
    assert.equal(firstCoverHit(0, -10, 0, 10, [trap], "shot"), null);
    assert.equal(firstCoverHit(0, -10, 0, 10, [trap], "ring"), null);
    const pos = { x: 0, y: 0 };
    pushOutWrecks(pos, [trap], 1.7);
    assert.ok(Math.abs(pos.x) + Math.abs(pos.y) > 2);
    const crater: Cover = {
      id: "c",
      kind: "bush",
      x: 0,
      y: 0,
      halfW: 2,
      halfL: 2,
      rules: { ring: false, conceal: false },
    };
    assert.equal(occupyBush(0, 0, [crater]), null);
    assert.equal(firstCoverHit(0, -10, 0, 10, [crater], "ring"), null);
  });
});

describe("COVER LAW v4 oriented footprints", () => {
  it("yaw 0 matches the old AABB", () => {
    const wall: Cover = {
      id: "w",
      kind: "wreck",
      x: 0,
      y: 0,
      halfW: 4,
      halfL: 0.8,
      rules: { ring: false, hull: false },
    };
    assert.equal(pointInCover(wall, 3, 0), true);
    assert.equal(pointInCover(wall, 0, 2), false);
    assert.equal(firstCoverHit(0, -10, 0, 10, [wall], "shot"), wall);
    const pos = { x: 0, y: 0 };
    pushOutWrecks(pos, [wall], 1.7);
    assert.ok(Math.abs(pos.y) >= 0.8 + 1.7 - 1e-9);
    assert.equal(pos.x, 0);
  });

  it("a 90° wall swaps its axes", () => {
    const wall: Cover = {
      id: "w",
      kind: "wreck",
      x: 0,
      y: 0,
      halfW: 4,
      halfL: 0.8,
      yawDeg: 90,
      rules: { ring: false, hull: false },
    };
    assert.equal(pointInCover(wall, 3, 0), false);
    assert.equal(pointInCover(wall, 0, 3), true);
    assert.equal(firstCoverHit(-10, 0, 10, 0, [wall], "shot"), wall);
    assert.equal(firstCoverHit(0, -10, 0, 10, [wall], "shot"), wall);
    const pos = { x: 0, y: 0 };
    pushOutWrecks(pos, [wall], 1.7);
    assert.ok(Math.abs(pos.x) >= 0.8 + 1.7 - 1e-9);
  });

  it("compileLevel copies yaw; missing yaw parses as unrotated", () => {
    const doc = newLevel("forest", "medium");
    doc.props.push({
      id: "w",
      asset: "wall",
      x: 10,
      y: 10,
      halfW: 5,
      halfL: 0.8,
      variant: 2,
      yawDeg: 45,
    });
    const bp = compileLevel(doc);
    assert.equal(bp.cover.find((c) => c.id === "w")?.yawDeg, 45);
    const raw = JSON.parse(exportLevel(doc)) as {
      props: Array<{ yawDeg?: number }>;
    };
    delete raw.props[0].yawDeg;
    const back = importLevel(JSON.stringify(raw));
    assert.equal(back.props[0].yawDeg, undefined);
    assert.equal(compileLevel(back).cover[0].yawDeg, undefined);
  });
});

describe("BIOME LAW", () => {
  it("five theaters, every asset has a floor, rules, and a real or generated skin", () => {
    assert.deepEqual([...BIOME_IDS], ["snow", "desert", "jungle", "forest", "urban"]);
    for (const id of BIOME_IDS) {
      const b = BIOMES[id];
      assert.ok(b.assets.length >= 5, id + " kit");
      for (const src of [b.floor, b.bushSkin, b.wreckSkin, ...b.assets.map((a) => a.skin)]) {
        if (isGeneratedSkin(src)) continue;
        assert.equal(existsSync(publicPath(src)), true, src);
      }
      assert.ok(
        b.assets.some((a) => coverRules(a).conceal),
        id + " needs concealment",
      );
      assert.ok(
        b.assets.some((a) => coverRules(a).motion && coverRules(a).shot),
        id + " needs hard cover",
      );
      for (const a of b.assets) {
        const r = coverRules(a);
        if (r.shot) assert.equal(r.motion, true, `${id}/${a.id}: shot implies motion`);
        assert.ok(a.minHalf <= a.halfW && a.halfW <= a.maxHalf, `${id}/${a.id} size`);
        if (isGeneratedSkin(a.skin)) {
          const parsed = parseGeneratedSkin(a.skin);
          assert.ok(parsed, `${id}/${a.id} gen skin`);
          assert.equal(hasGenerator(parsed!.key), true, parsed!.key);
        }
      }
    }
  });
});

describe("LEVEL LAW", () => {
  it("a blank map is playable and compiles to a blueprint the sim accepts", () => {
    const doc = newLevel("forest", "medium");
    const issues = validateLevel(doc);
    assert.equal(
      issues.some((i) => i.level === "error"),
      false,
    );
    assert.ok(issues.some((i) => i.code === "empty"));
    const bp = compileLevel(doc);
    assert.equal(bp.arenaM, 64);
    assert.equal(bp.viewM, 64);
    assert.equal(bp.floor, BIOMES.forest.floor);
    registerLevel(doc);
    const w = createWorld("m2a4", 0, "ap", customMapId(doc));
    assert.equal(w.mapId, customMapId(doc));
    assert.equal(w.player.y, -28);
    unregisterCustomMap(customMapId(doc));
    assert.equal(mapById(customMapId(doc)).id, "range");
  });

  it("large maps keep the 64 m view", () => {
    const doc = newLevel("desert", "large");
    const bp = compileLevel(doc);
    assert.equal(bp.arenaM, 96);
    assert.equal(bp.viewM, 64);
    assert.equal(bp.spawns?.player.y, -44);
  });

  it("a river across the yard with no crossing is unplayable; a ford fixes it", () => {
    const doc = newLevel("jungle", "medium");
    doc.rivers.push({
      id: "r",
      points: [
        { x: -70, y: 0 },
        { x: 70, y: 0 },
      ],
      widthM: 8,
      crossings: [],
    });
    const issues = validateLevel(doc);
    assert.ok(
      issues.some((i) => i.code === "unreachable"),
      issues.map((i) => i.code).join(","),
    );
    doc.rivers[0].crossings.push({ id: "f", kind: "ford", atM: 70, lengthM: 8 });
    assert.equal(levelIsPlayable(doc), true);
  });

  it("a wall of hard cover across the yard is unplayable", () => {
    const doc = newLevel("urban", "small");
    doc.props.push({ id: "b1", asset: "block", x: -20, y: 0, halfW: 24, halfL: 3, variant: 0 });
    doc.props.push({ id: "b2", asset: "block", x: 20, y: 0, halfW: 24, halfL: 3, variant: 0 });
    const issues = validateLevel(doc);
    assert.ok(issues.some((i) => i.code === "unreachable"));
    const g = passabilityGrid(doc);
    assert.equal(gridReachable(g, doc.spawns.player, doc.spawns.dummy), false);
  });

  it("a spawn inside a wall or the water is an error", () => {
    const doc = newLevel("snow", "medium");
    doc.props.push({ id: "r", asset: "rock", x: 0, y: -28, halfW: 3, halfL: 3, variant: 0 });
    assert.ok(validateLevel(doc).some((i) => i.code === "spawn-blocked" && i.ref?.id === "player"));
    doc.props = [];
    doc.spawns.dummy = { x: 0, y: 70, yawDeg: 180 };
    assert.ok(validateLevel(doc).some((i) => i.code === "spawn-bounds" && i.ref?.id === "dummy"));
  });

  it("props compile with their asset rules, hp, and variant skins", () => {
    const doc = newLevel("forest", "medium");
    doc.props.push({ id: "w", asset: "wall", x: 10, y: 10, halfW: 5, halfL: 0.8, variant: 2 });
    doc.props.push({ id: "o", asset: "oak", x: -10, y: 10, halfW: 3, halfL: 3, variant: 0 });
    const bp = compileLevel(doc);
    const wall = bp.cover.find((c) => c.id === "w")!;
    assert.equal(wall.destructible, true);
    assert.equal(wall.hpMax, 60);
    assert.equal(wall.skin, "gen:forest/wall#2");
    assert.equal(coverRules(wall).ring, false);
    const oak = bp.cover.find((c) => c.id === "o")!;
    assert.equal(oak.kind, "bush");
    assert.equal(oak.skin, "gen:forest/oak");
  });

  it("round-trips through JSON", () => {
    const doc = buildPreset(PRESETS[0], "medium");
    const back = importLevel(exportLevel(doc));
    assert.equal(back.id, doc.id);
    assert.equal(back.props.length, doc.props.length);
    assert.throws(() => importLevel('{"version":1}'));
  });
});

describe("PRESET LAW", () => {
  it("every preset is playable on every size with rotational symmetry", () => {
    for (const p of PRESETS) {
      for (const size of MAP_SIZES) {
        const doc = buildPreset(p, size);
        const issues = validateLevel(doc);
        const errs = issues.filter((i) => i.level === "error");
        assert.equal(errs.length, 0, `${p.id} ${size}: ${errs.map((e) => e.message).join(" | ")}`);
        assert.ok(doc.rivers.length >= 1, p.id + " river");
        assert.ok(
          doc.rivers.every((r) => r.crossings.length >= 1),
          p.id + " crossings",
        );
        for (const prop of doc.props) {
          const twin = doc.props.find(
            (q) =>
              q.asset === prop.asset &&
              Math.abs(q.x + prop.x) < 0.02 &&
              Math.abs(q.y + prop.y) < 0.02,
          );
          assert.ok(twin, `${p.id} ${size}: ${prop.id} has no mirror`);
        }
      }
    }
  });

  it("one preset per theater", () => {
    for (const id of BIOME_IDS)
      assert.ok(
        PRESETS.some((p) => p.biome === id),
        id,
      );
  });
});

describe("river in the sim", () => {
  function riverWorld() {
    const doc = newLevel("forest", "medium");
    doc.rivers.push({
      id: "r",
      points: [
        { x: -70, y: 0 },
        { x: 70, y: 0 },
      ],
      widthM: 8,
      crossings: [{ id: "b", kind: "bridge", atM: 100, lengthM: 8 }],
    });
    registerLevel(doc);
    const w = createWorld("m2a4", 0, "ap", customMapId(doc));
    return { w, id: customMapId(doc) };
  }

  it("the player cannot drive through open water", () => {
    const { w, id } = riverWorld();
    w.player.x = 0;
    w.player.y = -8;
    for (let i = 0; i < 600; i++) {
      stepWorld(
        w,
        { throttle: 1, steer: 0, justFire: false, aimX: 0, aimY: 20, hasAim: true },
        1 / 60,
      );
    }
    assert.ok(w.player.y < -4 - 1.7, "held at the bank, y=" + w.player.y);
    unregisterCustomMap(id);
  });

  it("the plate routes for the bridge when water is between it and the player", () => {
    const { w, id } = riverWorld();
    w.dummy.x = 0;
    w.dummy.y = 20;
    w.lastPlayerSeenX = 0;
    w.lastPlayerSeenY = -20;
    const goal = dummyGoal(w);
    assert.equal(goal.waypoint, true);
    assert.equal(Math.round(goal.x), 30, "bridge exit x");
    assert.ok(goal.y < -4, "exit is on the player's bank, y=" + goal.y);
    w.dummy.x = 30;
    w.dummy.y = -7;
    assert.equal(dummyGoal(w).waypoint, false);
    unregisterCustomMap(id);
  });
});
