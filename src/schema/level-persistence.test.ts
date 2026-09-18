import assert from "node:assert/strict";
import { afterEach, beforeEach, it } from "node:test";
import {
  LEVEL_LAW,
  MapLibraryFullError,
  capLevelLibrary,
  customMapId,
  deleteLevel,
  loadLevels,
  mergeLevelLibraries,
  newLevel,
  parseLevel,
  registerLevel,
  registerStoredLevels,
  saveLevel,
} from "./level.ts";
import { clearCustomMaps, mapById } from "./maps.ts";
import { emptyGarage, loadGarage, saveGarage } from "./xp.ts";
import { newLayoutWorld } from "../game/quarry-world.ts";

let previous: PropertyDescriptor | undefined;
it("the quarry lab retains its camera scale after custom-map view sizes are introduced", () => {
  const world = newLayoutWorld();
  assert.equal(world.arenaM, 64);
  assert.equal(world.viewM, world.arenaM);
});
beforeEach(() => {
  previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  });
  clearCustomMaps();
});
afterEach(() => {
  clearCustomMaps();
  if (previous) Object.defineProperty(globalThis, "localStorage", previous);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

it("saves invalid drafts without exposing them to gameplay, including after reload", () => {
  const doc = newLevel("forest", "medium");
  doc.spawns.player.x = 200;
  saveLevel(doc);
  assert.equal(loadLevels().length, 1);
  assert.equal(mapById(customMapId(doc)).id, "range");
  assert.throws(() => registerLevel(doc), /validation errors/);
  assert.deepEqual(registerStoredLevels(), []);
  assert.equal(mapById(customMapId(doc)).id, "range");
  doc.spawns.player.x = 0;
  saveLevel(doc);
  assert.equal(registerStoredLevels().length, 1);
  assert.equal(mapById(customMapId(doc)).id, customMapId(doc));
  doc.spawns.player.x = 200;
  saveLevel(doc);
  assert.equal(
    mapById(customMapId(doc)).id,
    "range",
    "editing a playable map into a draft removes its old blueprint",
  );
});

it("deleting the selected map clears storage, registry and selection while preserving garage progress", () => {
  const doc = saveLevel(newLevel("forest", "medium"));
  const garage = {
    ...emptyGarage(),
    xp: 500,
    credits: 123,
    mapId: customMapId(doc),
  };
  saveGarage(garage);
  deleteLevel(doc.id);
  assert.deepEqual(loadLevels(), []);
  assert.equal(mapById(customMapId(doc)).id, "range");
  assert.deepEqual(loadGarage(), { ...garage, mapId: "range" });
});

it("deleting a different map preserves the selection and registry reconciliation drops stale maps", () => {
  const selected = saveLevel(newLevel("forest", "medium"));
  const other = saveLevel(newLevel("snow", "medium"));
  saveGarage({ ...emptyGarage(), mapId: customMapId(selected) });
  deleteLevel(other.id);
  assert.equal(loadGarage().mapId, customMapId(selected));
  const ephemeral = newLevel("urban", "medium");
  registerLevel(ephemeral);
  registerStoredLevels();
  assert.equal(mapById(customMapId(ephemeral)).id, "range");
  assert.equal(mapById(customMapId(selected)).id, customMapId(selected));
});

it("parses valid docs from objects or JSON and rejects junk", () => {
  const doc = newLevel("forest", "medium");
  assert.equal(parseLevel(null), null);
  assert.equal(parseLevel("nope"), null);
  assert.equal(parseLevel({}), null);
  assert.equal(parseLevel(doc)?.id, doc.id);
  assert.equal(parseLevel(JSON.stringify(doc))?.id, doc.id);
});

it("merges two libraries by id, keeping the newer stamp", () => {
  const older = newLevel("forest", "medium");
  const newer = { ...older, name: "River fold", updatedAt: older.updatedAt + 50 };
  const other = newLevel("snow", "medium");
  const merged = mergeLevelLibraries([older, other], [newer]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((d) => d.id === older.id)?.name, "River fold");
  assert.ok(merged.some((d) => d.id === other.id));
});

it("caps a library at maxSaved, newest first", () => {
  assert.equal(LEVEL_LAW.maxSaved, 48);
  const many = Array.from({ length: LEVEL_LAW.maxSaved + 4 }, (_, i) => {
    const doc = newLevel("forest", "small");
    doc.updatedAt = i;
    return doc;
  });
  const capped = capLevelLibrary(many);
  assert.equal(capped.length, LEVEL_LAW.maxSaved);
  assert.equal(capped[0]?.updatedAt, LEVEL_LAW.maxSaved + 3);
  assert.equal(capped.at(-1)?.updatedAt, 4);
});

it("saves many maps on one device, then refuses a new one past the cap", () => {
  const ids: string[] = [];
  for (let i = 0; i < LEVEL_LAW.maxSaved; i++) {
    const doc = newLevel("forest", "small");
    doc.name = `Yard ${i + 1}`;
    ids.push(saveLevel(doc).id);
  }
  assert.equal(loadLevels().length, LEVEL_LAW.maxSaved);
  assert.throws(() => saveLevel(newLevel("snow", "small")), MapLibraryFullError);
  const keep = loadLevels()[0];
  assert.ok(keep);
  keep.name = "Renamed yard";
  saveLevel(keep);
  assert.equal(loadLevels().length, LEVEL_LAW.maxSaved);
  assert.equal(loadLevels().find((d) => d.id === keep.id)?.name, "Renamed yard");
  assert.equal(new Set(ids).size, LEVEL_LAW.maxSaved);
});
