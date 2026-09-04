import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { MAPS, MAP_IDS, MAP_LAW, WEATHER_LAW, mapById, tickWeather, weatherPulse } from "./maps.ts";
import { hitDestructible } from "./cover.ts";
import { createWorld } from "../game/sim.ts";
import { LOS_LAW, resolveLos } from "./los.ts";

function publicPath(src: string) {
  return src.replace(/^\//, "public/");
}

describe("MAP LAW", () => {
  it("ships five maps and range stays 36 m", () => {
    assert.deepEqual([...MAP_IDS], ["range", "snow", "urban", "tropical", "mountains"]);
    assert.equal(MAPS.range.arenaM, 36);
    assert.equal(MAPS.snow.arenaM, MAP_LAW.theaterArenaM);
    assert.equal(mapById("nope").id, "range");
  });

  it("theaters have hard wrecks and soft bushes", () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      assert.ok(m.cover.some((c) => c.kind === "wreck"), id + " wreck");
      assert.ok(m.cover.some((c) => c.kind === "bush"), id + " bush");
      assert.equal(existsSync(publicPath(m.floor)), true, m.floor);
      assert.equal(existsSync(publicPath(m.bushSkin)), true, m.bushSkin);
      assert.equal(existsSync(publicPath(m.wreckSkin)), true, m.wreckSkin);
    }
  });

  it("snow world is larger and weather cuts ring range", () => {
    const range = createWorld("m2a4");
    const snow = createWorld("m2a4", 0, "ap", "snow");
    assert.equal(range.arenaM, 36);
    assert.equal(snow.arenaM, 64);
    assert.equal(snow.weather, WEATHER_LAW.start);
    assert.equal(snow.visMul, WEATHER_LAW.homeVis);
    assert.ok(snow.cover.length > range.cover.length);
    const dummy = { x: 0, y: 28 };
    const viewer = {
      x: 0,
      y: 0,
      yawDeg: 0,
      turrets: [{ role: "main", facingDeg: 0, state: "live", offsetForwardM: 0, offsetRightM: 0 }],
    };
    assert.equal(resolveLos(viewer, dummy, Infinity, [], 1).channel, "ring");
    assert.equal(resolveLos(viewer, dummy, Infinity, [], 0.5).channel, "none");
    assert.ok(LOS_LAW.ringRangeM * MAPS.snow.visMul < 28);
  });

  it("weather pulse is 1 in the clear", () => {
    assert.equal(weatherPulse(12, "clear"), 1);
    assert.ok(weatherPulse(1.2, "fog") < 1);
  });

  it("clear holds then a squall drops vis, then it clears again", () => {
    const host = {
      time: 0,
      weather: WEATHER_LAW.start,
      visMul: WEATHER_LAW.homeVis,
      weatherUntil: WEATHER_LAW.firstShiftS,
      mapId: "urban" as const,
    };
    assert.equal(tickWeather(host), null);
    host.time = WEATHER_LAW.firstShiftS;
    assert.equal(tickWeather(host), "squall");
    assert.equal(host.weather, "rain");
    assert.ok(host.visMul < 1);
    host.time = host.weatherUntil;
    assert.equal(tickWeather(host), "clear");
    assert.equal(host.weather, "clear");
    assert.equal(host.visMul, 1);
  });

  it("urban buildings fall from hits, not a timer", () => {
    const urban = createWorld("m2a4", 0, "ap", "urban");
    const b = urban.cover.find((c) => c.destructible);
    assert.ok(b);
    const id = b!.id;
    hitDestructible(urban.cover, b!.x, b!.y, 80);
    assert.equal(urban.cover.find((c) => c.id === id)?.kind, "wreck");
    hitDestructible(urban.cover, b!.x, b!.y, 200);
    assert.equal(urban.cover.find((c) => c.id === id)?.kind, "bush");
  });

  it("mountain pass is open on the north-south spine", () => {
    const m = MAPS.mountains;
    const blocked = m.cover.filter((c) => c.kind === "wreck" && Math.abs(c.x) < 4 && Math.abs(c.y) < 20);
    assert.equal(blocked.length, 0);
    assert.ok(m.cover.some((c) => c.skin?.includes("ridge")));
  });
});
