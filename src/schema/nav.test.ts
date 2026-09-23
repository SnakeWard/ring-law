import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Cover } from "./cover.ts";
import { buildNavField, buildWaterField, findNavPath, navClear, navKey, NAV_LAW } from "./nav.ts";
import { pointInCover } from "./cover.ts";
import { createWorld, stepWorld, botRoute } from "../game/sim.ts";

/** A 30 m wall across the middle of a small yard, gap only at the far ends. */
const WALL: Cover = { id: "wall", kind: "wreck", x: 0, y: 0, halfW: 15, halfL: 1 };

function field(cover: Cover[], arenaM = 36) {
  return buildNavField(cover, buildWaterField([], arenaM));
}

describe("nav field", () => {
  it("blocks hard cover padded by hull clearance, not bushes or hull wrecks", () => {
    const f = field([
      WALL,
      { id: "b", kind: "bush", x: 0, y: 10, halfW: 3, halfL: 3 },
      { id: "w", kind: "wreck", x: 0, y: -10, halfW: 2, halfL: 3, pushable: true },
    ]);
    const at = (x: number, y: number) => {
      const i = Math.floor((x - f.originM) / f.cellM);
      const j = Math.floor((y - f.originM) / f.cellM);
      return f.blocked[j * f.n + i];
    };
    assert.equal(at(0, 0), 1, "wall");
    assert.equal(at(0, 2.2), 1, "clearance");
    assert.equal(at(0, 10), 0, "bush is passable");
    assert.equal(at(0, -10), 0, "shoveable wreck is passable");
  });

  it("the key changes when hard cover changes", () => {
    const a = navKey([WALL]);
    assert.notEqual(a, navKey([{ ...WALL, x: 3 }]));
    assert.notEqual(a, navKey([]));
    assert.equal(a, navKey([WALL, { id: "b", kind: "bush", x: 0, y: 0, halfW: 1, halfL: 1 }]));
  });
});

describe("findNavPath", () => {
  it("routes around a wall instead of into it", () => {
    const f = field([WALL]);
    const path = findNavPath(f, { x: 0, y: 12 }, { x: 0, y: -12 });
    assert.ok(path && path.length >= 2, "needs at least one turn");
    let prev = { x: 0, y: 12 };
    for (const p of path!) {
      assert.ok(navClear(f, prev, p), `leg ${prev.x},${prev.y} → ${p.x},${p.y} is clear`);
      assert.ok(!pointInCover(WALL, p.x, p.y, 1), "waypoint off the wall");
      prev = p;
    }
    assert.deepEqual(path!.at(-1), { x: 0, y: -12 });
  });

  it("goes straight when nothing is in the way", () => {
    const f = field([]);
    const path = findNavPath(f, { x: -10, y: -10 }, { x: 10, y: 12 });
    assert.deepEqual(path, [{ x: 10, y: 12 }]);
  });

  it("snaps a goal inside cover to open ground", () => {
    const f = field([WALL]);
    const path = findNavPath(f, { x: 0, y: 12 }, { x: 0, y: 0 });
    assert.ok(path);
    const end = path!.at(-1)!;
    assert.ok(!pointInCover(WALL, end.x, end.y, NAV_LAW.hullRadiusM - 0.6), `end ${end.x},${end.y}`);
  });

  it("returns null when the goal is sealed off", () => {
    const box: Cover[] = [
      { id: "n", kind: "wreck", x: 0, y: 8, halfW: 8, halfL: 0.5 },
      { id: "s", kind: "wreck", x: 0, y: -8, halfW: 8, halfL: 0.5 },
      { id: "e", kind: "wreck", x: 8, y: 0, halfW: 0.5, halfL: 8 },
      { id: "w", kind: "wreck", x: -8, y: 0, halfW: 0.5, halfL: 8 },
    ];
    assert.equal(findNavPath(field(box), { x: 20, y: 20 }, { x: 0, y: 0 }), null);
  });

  it("stays fast on the largest yard", () => {
    const cover: Cover[] = [];
    for (let i = 0; i < 300; i++) {
      cover.push({
        id: `c${i}`,
        kind: "wreck",
        x: ((i * 37) % 220) - 110,
        y: ((i * 53) % 220) - 110,
        halfW: 1 + (i % 3),
        halfL: 1 + (i % 4),
        yawDeg: (i * 29) % 90,
      });
    }
    const t0 = performance.now();
    const f = field(cover, 128);
    const t1 = performance.now();
    for (let k = 0; k < 10; k++) findNavPath(f, { x: -120, y: -120 }, { x: 120, y: 120 });
    const t2 = performance.now();
    assert.ok(t1 - t0 < 250, `field build ${Math.round(t1 - t0)} ms`);
    assert.ok((t2 - t1) / 10 < 60, `path ${((t2 - t1) / 10).toFixed(1)} ms`);
  });
});

describe("bots use the nav route", () => {
  it("a bot behind a wall drives around it toward the player", () => {
    const w = createWorld("m2a4", 0, "ap", "range");
    w.cover = [WALL];
    w.player.x = 0;
    w.player.y = -20;
    w.dummy.x = 0;
    w.dummy.y = 10;
    w.dummy.yawDeg = 180;
    w.lastPlayerSeenX = 0;
    w.lastPlayerSeenY = -20;
    const idle = { throttle: 0, steer: 0, justFire: false, aimX: 0, aimY: 0, hasAim: false };
    let minY = w.dummy.y;
    for (let i = 0; i < 60 * 25 && w.dummy.hp > 0; i++) {
      stepWorld(w, idle, 1 / 60);
      minY = Math.min(minY, w.dummy.y);
      if (w.dummy.y < -3) break;
    }
    assert.ok(minY < -3, `bot never got past the wall (min y ${minY.toFixed(1)}); route ${JSON.stringify(botRoute(w, "dummy"))}`);
  });
});
