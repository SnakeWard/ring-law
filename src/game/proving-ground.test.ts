import test from "node:test";
import assert from "node:assert/strict";
import {
  createGround,
  makeLayout,
  stepGround,
  fireGround,
  surfaceAt,
  screenedFrom,
  fallenCanopy,
  overlaps,
  VEHICLE_RADIUS,
  segmentEntry,
} from "./proving-ground.ts";

const drive = { throttle: 1, steer: 0, fire: false };
function run(s: ReturnType<typeof createGround>, seconds: number, input = drive) {
  for (let i = 0; i < seconds * 60; i++) stepGround(s, input, 1 / 60);
}
test("all three approaches are connected with actual vehicle clearance in both layouts", () => {
  for (const id of ["crossroads", "offset"] as const) {
    const m = makeLayout(id),
      seen = new Set<string>(),
      queue: [[number, number]] = [[0, -48]];
    const open = (x: number, y: number) =>
      Math.abs(x) <= 56 &&
      Math.abs(y) <= 56 &&
      !m.assets.some((a) => overlaps(a, { x, y }, VEHICLE_RADIUS + 0.15));
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i],
        key = `${x},${y}`;
      if (seen.has(key) || !open(x, y)) continue;
      seen.add(key);
      for (const [dx, dy] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (!seen.has(`${nx},${ny}`) && open(nx, ny)) queue.push([nx, ny]);
      }
    }
    for (const target of [...m.checkpoints, ...m.starts])
      assert.ok(
        [...seen].some((k) => {
          const [x, y] = k.split(",").map(Number);
          return Math.hypot(x - target.x, y - target.y) < 4;
        }),
        `${id}: ${target.name} unreachable`,
      );
  }
});
test("mud reduces travel; left and right agree with north-facing hull", () => {
  const firm = createGround(),
    mud = createGround();
  firm.layout.assets = [];
  mud.layout.assets = [];
  mud.layout.surfaces = [{ x: 0, y: -40, rx: 30, ry: 30, kind: "mud" }];
  run(firm, 1);
  run(mud, 1);
  assert.ok(firm.speed > mud.speed * 1.5);
  assert.ok(firm.distance > mud.distance);
  run(firm, 0.5, { ...drive, steer: 1 });
  assert.ok(firm.player.x < 0);
  assert.ok(firm.player.yaw > 0);
  const right = createGround();
  run(right, 0.5, { ...drive, steer: -1 });
  assert.ok(right.player.x > 0);
  assert.ok(right.player.yaw < 0);
});
test("ramming tree makes a traversable canopy in impact direction and adds concealment", () => {
  const s = createGround("crossroads", 3),
    tree = s.layout.assets.find((a) => a.kind === "tree" && a.x === 39)!;
  run(s, 2);
  assert.equal(tree.hp, 0);
  assert.ok(s.player.y > tree.y - 2);
  assert.equal(tree.fallYaw, 0);
  const c = fallenCanopy(tree);
  assert.ok(c.y > tree.y);
  s.player.x = c.x;
  s.player.y = c.y;
  assert.equal(surfaceAt(s, s.player).name, "Fallen branches");
  assert.equal(screenedFrom(s, { x: 39, y: 54 }), true);
  // The fallen tree no longer intercepts shells.
  s.layout.assets = [tree];
  s.reload = 0;
  s.player.y = tree.y - 5;
  s.player.turret = 0;
  fireGround(s);
  assert.ok(s.shots.at(-1)!.b.y > tree.y + 20);
});
test("building takes three shots, opens a passage, and rubble slows traversal", () => {
  const s = createGround(),
    b = s.layout.assets.find((a) => a.kind === "building")!;
  s.layout.assets = [b];
  s.player.x = b.x;
  s.player.y = b.y - b.halfL - 5;
  s.player.turret = 0;
  fireGround(s);
  assert.equal(b.hp, 80);
  s.reload = 0;
  fireGround(s);
  assert.equal(b.hp, 40);
  s.reload = 0;
  fireGround(s);
  assert.equal(b.hp, 0);
  run(s, 2);
  assert.ok(s.player.y > b.y - b.halfL);
  assert.equal(surfaceAt(s, { x: b.x, y: b.y }).name, "Rubble");
  assert.equal(screenedFrom(s, { x: b.x, y: 54 }), false);
});
test("solid buildings stop a tank and nearer obstacles intercept shells first", () => {
  const s = createGround(),
    b = s.layout.assets.find((a) => a.kind === "building")!;
  s.layout.assets = [b];
  s.player.x = b.x;
  s.player.y = b.y - b.halfL - 5;
  run(s, 2);
  assert.ok(s.player.y <= b.y - b.halfL - VEHICLE_RADIUS);
  assert.equal(b.hp, b.maxHp);
  assert.equal(segmentEntry({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 5 }, 1, 1), 0.4);
  const fence = {
    ...b,
    id: "near",
    kind: "fence" as const,
    y: b.y - 10,
    halfW: 3,
    halfL: 0.25,
    hp: 40,
    maxHp: 40,
  };
  s.layout.assets = [b, fence];
  s.player.y = b.y - 20;
  s.player.turret = 0;
  fireGround(s);
  assert.equal(fence.hp, 0);
  assert.equal(b.hp, 120);
});
test("resets are independent; variants reuse the kit at unchanged size", () => {
  const a = createGround(),
    b = createGround("offset");
  assert.equal(a.layout.halfSize, b.layout.halfSize);
  assert.deepEqual(
    a.layout.assets.map((x) => [x.kind, x.halfW, x.halfL]),
    b.layout.assets.map((x) => [x.kind, x.halfW, x.halfL]),
  );
  a.layout.assets[0].hp = 0;
  assert.equal(createGround().layout.assets[0].hp, 120);
  assert.notEqual(a.layout.assets[0].x, b.layout.assets[0].x);
});
