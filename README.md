# RING LAW

Top-down tank range: USA / USSR / Germany trees, artillery class, photoreal skins, and baked garage briefings.

This is the playable game. Schema freeze notes from the earlier handoff live in `schema/` and `HANDOFF.md`.

## Run

```bash
npm install
npm run dev
```

## Briefs

Garage **Listen** plays `public/audio/briefs/{hullId}.mp3` (baked once). There is no runtime ElevenLabs call.

## Level editor

`/editor` (or **Level editor** on the range brief) is a built-in map editor for the 2D yard.

- **Theaters:** snow, desert, jungle, forest, urban. Each ships a kit of assets with its own
  collision profile (stops tracks / stops shells / blocks ring sight / blocks hull sight / hides
  the occupant / destructible HP). Rules live in `src/schema/biomes.ts`; the engine reads them via
  `coverRules` in `src/schema/cover.ts`.
- **Sizes:** small 72 m, medium 128 m, large 192 m across. Large maps keep the 128 m camera.
- **Rivers** are polylines with a width. Water stops tracks and nothing else. Add **fords**
  (passable, 55% speed) or **bridges** (full speed) as crossings. The plate AI routes through the
  nearest crossing.
- **Roads** are cosmetic. **Spawns** are draggable.
- **Presets:** one authored opener per theater with rotational symmetry. Nothing is random.
- **Check:** a map is playable only when both spawns stand on dry, open ground and a hull-wide
  path connects them (grid search over cover and water). Test drive is gated on that.
- Maps save to `localStorage` (`ring-levels-v1`). Invalid drafts remain available in the
  editor; only playable maps appear in the range picker. Deployment rechecks saved maps.
  Deleting the selected map resets selection to the dirt range. JSON export/import is in the panel.
- Assets without a baked PNG are painted procedurally at runtime (`src/game/gen-assets.ts`,
  `gen:<biome>/<asset>#<variant>` skins). Drop a PNG under `public/skins/maps/<biome>/` and point
  the asset's `skin` at it to upgrade.

## Integrated local advances

- Seven built-in maps, including Quarry & village and Siberian Surprise.
- `/quarry`: seeded layout generation, density choices, combat/free driving, overview and
  chassis-follow cameras, and layout/Tiled exports.
- `/proving-ground`: the existing 3D traversal and destruction trial.
- Existing engine sound effects, garage progress and baked tank briefings are preserved.
- On Windows, `startup.ps1` maintains the existing dependency mirror and starts the preview.

Editor regression coverage: `src/schema/level-persistence.test.ts`, `src/schema/river.test.ts`,
and `scripts/editor-integration-check.mjs` (takes a local preview URL).
