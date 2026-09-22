# ForgeFrame — artillery expansion (2026-09-22)

Intent: strengthen ineffective starter lob hits and expand every nation's artillery roster at tiers 5 and 10, preserving the detailed top-down art and field-card UI.

Workflow: research a nation's tank line to T5/T10; its artillery milestone becomes playable automatically; select it in Garage; inspect its Info card; deploy and fire direct or lob HE. Starter artillery remains free. Existing researched saves immediately qualify. No save schema migration.

Source of truth: catalog-artillery.ts defines six actual vehicles, artillery.ts/tree.ts define tiers and nations, xp.ts gates play, howitzer.ts defines damage/footprint/reload, sim.ts applies identical combat rules to player and bots. Matchmaking uses actual artillery tiers.

Roster: USA M12 GMC / M43 HMC; USSR SU-122 / ISU-152; Germany Hummel / Sturmtiger. Closed assault guns and the rocket mortar are explicitly described as such. Common lob behavior, durability, speed and armor values are simplified gameplay assumptions, not historical simulation claims.

Combat: 105 mm HE 150 HP (previously 50); 76.2 mm 109 HP (previously 36). Full damage anywhere on the rotated hull footprint; external blast falls off to zero. Blast radius scales by square root of caliber, reload linearly above 105 mm. This buffs both direct and lob artillery HE. Ordinary tank HE remains unchanged.

Preservation: original tanks, artwork, tank progression, save format, authentication and platform branding remain. Existing unrelated dirty files are excluded from the commit. Risk: medium combat-balance change, including friendly splash. Rollback: revert only this task's commit; no database rollback needed.

Art: built-in image_gen, using public/skins/m7-priest/hull.png as style reference. Prompt set: one distinct historical vehicle per asset; strict orthographic overhead, nose/barrel upward, full silhouette, weathered muted steel and dark tracks, isolated transparent PNG; M12/M43 muzzle brakes corrected to plain barrel ends. Sturmtiger required generated magenta-background export and the project's generate2dsprite chroma-key processor after alpha requests failed. Final assets: public/skins/{m12-gmc,m43-hmc,su-122,isu-152,hummel,sturmtiger}/hull.png. These are stylized generated representations, not engineering drawings.

Audio: new written briefs use existing browser-speech fallback (no missing MP3 requests); gun/engine sounds reuse declared family recordings. No new paid audio generation.

Historical references consulted:
- https://www.historyofwar.org/articles/weapons_M43_8in_HMC.html
- https://www.hmdb.org/m.asp?m=193501
- https://tankmuseum.org/article/sturmtigers_fire_power
- https://www.kskdivniy.ru/museum/eksponaty/isu-152/
- https://mwi.westpoint.edu/world-war-ii-capabilities-need-todays-urban-battlefield/

Validation evidence: all 537 repository tests passed before the final matchup/armament-label polish; 68 targeted tests passed, including actual sim bow hits against Tiger, tier gates, save roundtrip and rotated footprint checks. Typecheck passed. Final build/browser and git publication evidence to be appended after completion. Browser CLI repeatedly lost its daemon connection after internet interruption; interactive QA falls back to Playwright per browser-qa.md.

Incidental required typecheck repair: map existing marsh/steppe/coast/industrial biomes to forest/dirt/desert/urban camouflage. No new palette or map behavior.

Hollow verdict: existing architecture preserved; no new backend or auth work required. Next action: finish browser/build verification, commit only task files, push to existing origin/main as requested.

Final verification (Real): final npm run build and npm run typecheck passed; all 537 tests passed, followed by 17 targeted tests after final matchup/card-label changes. Authenticated browser QA with a synthetic local QA garage confirmed all six unlock buttons enabled, all six info cards and PNG loads, desktop/mobile card layout, no page errors or horizontal overflow, M12 deployment and A-left/D-right steering. Desktop and mobile dev smoke passed; production smoke matched the dev baseline with zero console/page errors and no brand/auth warnings.

Production-preview caveat: the existing Nitro build omits PGLite pglite.data/pglite.wasm/initdb.wasm when DATABASE_URL is absent. The raw preview crashed before rendering. For local QA only, those installed dependency assets were copied to the built server's _libs directory; no source/config change or generated build output is committed. Deployed database connectivity was not verified and no deployment was requested. Preview was run through npm run preview because the repository's preview:restart helper requires Linux /proc and this workspace is Windows.

Verdict: Ready with caveats (local production database-fallback packaging above). Scope reviewed; only artillery-related files, required camouflage typecheck repair, assets and this record staged for GitHub. Existing unrelated work preserved. Next action: publish this reviewed commit to origin/main.
