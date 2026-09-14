// src/schema/maps/siberia.ts
//
// Siberian Surprise — snowy taiga battlefield with a frozen lake center.
//
// Tactical structure (design-sheet only; not encoded in MapBlueprint):
//   Route A "Timberline"     — west pine forest, close-range brawl
//   Route B "The Crossing"   — frozen lake, fastest & most exposed
//   Route C "Granite Spine"  — east rocky ridge, medium-long positional lanes
//
// Skins fall back to the generic COVER_SKINS / FLOOR_SKIN paths.
// Winter-themed art is a follow-up asset task.

import type { MapBlueprint } from "../maps.ts";
import { COVER_SKINS, FLOOR_SKIN } from "../skin.ts";

export const SIBERIA_MAP: MapBlueprint = {
  id: "siberia",
  name: "Siberian Surprise",
  arenaM: 64,
  spawnY: 56,
  floor: FLOOR_SKIN,
  bushSkin: COVER_SKINS.bush,
  wreckSkin: COVER_SKINS.wreck,
  weather: "snow",
  visMul: 0.85,
  cover: [
    // ── Hard cover (wreck) ─────────────────────────────────────────────
    // Spawn screens (south & north)
    { id: "hc01", kind: "wreck", x: -6, y: -50, halfW: 2.0, halfL: 1.3 },
    { id: "hc02", kind: "wreck", x: 6, y: -50, halfW: 2.0, halfL: 1.3 },
    { id: "hc03", kind: "wreck", x: -6, y: 50, halfW: 2.0, halfL: 1.3 },
    { id: "hc04", kind: "wreck", x: 6, y: 50, halfW: 2.0, halfL: 1.3 },
    // West forest (Route A "Timberline")
    { id: "hc05", kind: "wreck", x: -42, y: -22, halfW: 2.5, halfL: 1.5 },
    { id: "hc06", kind: "wreck", x: -45, y: 6, halfW: 1.6, halfL: 3.0 },
    { id: "hc07", kind: "wreck", x: -42, y: 40, halfW: 2.2, halfL: 1.4 },
    { id: "hc08", kind: "wreck", x: -46, y: -6, halfW: 1.4, halfL: 2.2 },
    // Frozen lake (Route B "The Crossing")
    { id: "hc09", kind: "wreck", x: -8, y: -6, halfW: 2.2, halfL: 1.4 },
    { id: "hc10", kind: "wreck", x: 8, y: 6, halfW: 2.2, halfL: 1.4 },
    { id: "hc11", kind: "wreck", x: 0, y: -22, halfW: 1.5, halfL: 1.5 },
    { id: "hc12", kind: "wreck", x: 0, y: 22, halfW: 1.5, halfL: 1.5 },
    // East ridge (Route C "Granite Spine")
    { id: "hc13", kind: "wreck", x: 34, y: -26, halfW: 1.8, halfL: 1.8 },
    { id: "hc14", kind: "wreck", x: 44, y: -4, halfW: 2.4, halfL: 1.6 },
    { id: "hc15", kind: "wreck", x: 30, y: 18, halfW: 1.6, halfL: 2.4 },
    { id: "hc16", kind: "wreck", x: 40, y: 30, halfW: 1.8, halfL: 1.4 },
    { id: "hc17", kind: "wreck", x: 22, y: -42, halfW: 1.6, halfL: 1.8 },
    { id: "hc18", kind: "wreck", x: 22, y: 42, halfW: 1.6, halfL: 1.8 },

    // ── Soft cover (bush) ──────────────────────────────────────────────
    // West forest concealment
    { id: "sc01", kind: "bush", x: -30, y: -35, halfW: 6, halfL: 3 },
    { id: "sc02", kind: "bush", x: -48, y: -12, halfW: 4, halfL: 5 },
    { id: "sc03", kind: "bush", x: -30, y: 12, halfW: 5, halfL: 6 },
    { id: "sc04", kind: "bush", x: -48, y: 30, halfW: 5, halfL: 4 },
    { id: "sc05", kind: "bush", x: -25, y: 38, halfW: 6, halfL: 3 },
    // Lake fringe / shore reeds
    { id: "sc06", kind: "bush", x: -18, y: -18, halfW: 3, halfL: 2 },
    { id: "sc07", kind: "bush", x: 18, y: 18, halfW: 3, halfL: 2 },
    { id: "sc08", kind: "bush", x: -14, y: 28, halfW: 4, halfL: 2 },
    { id: "sc09", kind: "bush", x: 14, y: -28, halfW: 4, halfL: 2 },
    // East ridge scrub
    { id: "sc10", kind: "bush", x: 28, y: -8, halfW: 5, halfL: 4 },
    { id: "sc11", kind: "bush", x: 38, y: 12, halfW: 4, halfL: 5 },
    { id: "sc12", kind: "bush", x: 50, y: -18, halfW: 3, halfL: 4 },
    // Spawn-side snowbanks
    { id: "sc13", kind: "bush", x: -14, y: -46, halfW: 4, halfL: 2 },
    { id: "sc14", kind: "bush", x: 14, y: 46, halfW: 4, halfL: 2 },
    // North ridge shoulder + east boundary discouragement
    { id: "sc15", kind: "bush", x: 42, y: 42, halfW: 4, halfL: 3 },
    { id: "sc16", kind: "bush", x: 52, y: 12, halfW: 3, halfL: 4 },
  ],
};
