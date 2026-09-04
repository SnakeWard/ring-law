import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOWITZER_LAW,
  RANGE_COVER,
  howitzerBlastDamage,
  howitzerBlocked,
  howitzerCanFire,
  howitzerCanLob,
  howitzerChipHp,
  howitzerDamage,
  howitzerSplashM,
  isHowitzer,
  lobInRange,
} from "./index.ts";

describe("HOWITZER LAW v6", () => {
  it("scales chip and splash off 105 mm", () => {
    assert.equal(HOWITZER_LAW.version, 6);
    assert.equal(HOWITZER_LAW.maxRangeM, 110);
    assert.equal(howitzerChipHp(105), 50);
    assert.equal(howitzerChipHp(76.2), 36);
    assert.equal(howitzerSplashM(105), 8);
    assert.equal(isHowitzer({ kind: "howitzer" }), true);
    assert.equal(isHowitzer({ kind: "main_gun" }), false);
  });

  it("chips inside splash, misses outside, refuses short range", () => {
    assert.equal(howitzerDamage(28, 0, 105), 50);
    assert.equal(howitzerDamage(10, 0, 105), 0);
    assert.equal(howitzerDamage(28, 20, 105), 0);
    assert.ok(howitzerDamage(28, 4, 105) < 50);
    assert.ok(howitzerDamage(28, 4, 105) > 0);
  });

  it("blast falls off inside 2 m at 105 mm", () => {
    assert.equal(howitzerBlastDamage(0, 105), 50);
    assert.equal(howitzerBlastDamage(2, 105), 0);
    assert.ok(howitzerBlastDamage(1, 105) < 50);
  });

  it("can fire in cone at range; wreck blocks, bush does not", () => {
    const gun = { kind: "howitzer" as const, state: "live" as const };
    assert.equal(howitzerCanFire(gun, 28, 0), true);
    assert.equal(howitzerCanFire(gun, 10, 0), false);
    assert.equal(howitzerCanFire(gun, 28, 9), false);
    assert.equal(howitzerCanFire(gun, 120, 0), false);
    assert.equal(howitzerCanLob(gun, 80), true);
    assert.equal(howitzerCanLob(gun, 80) && howitzerCanFire(gun, 80, 20), false);
    assert.equal(lobInRange(28), true);
    assert.equal(lobInRange(10), false);
    assert.equal(lobInRange(120), false);
    const wreck = RANGE_COVER.find((c) => c.kind === "wreck")!;
    const bush = RANGE_COVER.find((c) => c.kind === "bush")!;
    assert.ok(howitzerBlocked(wreck.x, wreck.y - 4, wreck.x, wreck.y + 4, [wreck]));
    assert.equal(howitzerBlocked(bush.x, bush.y - 4, bush.x, bush.y + 4, [bush]), null);
  });
});