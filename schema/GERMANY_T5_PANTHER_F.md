# Germany T5 freeze — Panther Ausf. F (Schmalturm)

**Mode:** SCHEMA
**TREE LAW:** v15 (apply when repo source is present)
**Evidence:** Assumed 100 m AP (catalog law). Schmalturm plates from Panzer Tracts / Tank Encyclopedia.
**Mount:** 2026-09-03 — App Builder source still absent. This file is the contract, not the game.

## Decision

Germany T5 is `panther-f`. One hydraulic ring. Same KwK 42 ballistics. Hull is Ausf. G. Bump is the narrow turret.

| | Panther G (T4) | Panther F (T5) |
|---|---|---|
| Class | medium | medium |
| Gun | 7.5 cm KwK 42 L/70, 138 pen, 135 dmg | **same numbers** (KwK 44/1 deferred as same ammo) |
| Glacis | 80 @ 55° | **same** |
| Sides | 50 @ 30° | **same** |
| Turret front | 100 | **120 @ 20°** |
| Turret side / rear | 45 | **60 @ 25°** |
| Ring | hydraulic 6°/s L4 | **same** |
| Dummy | tiger-ii | **tiger-ii** |

KwK 42 still bounces Tiger II front. F glacis still stops Tiger I and T-34-85 AP.

## Blueprint (drop into `src/schema/catalog.ts`)

```
id: panther-f
name: Pz.Kpfw. V Panther Ausf. F
shortName: Panther F
class: medium
nation: germany
lengthM: 6.87
widthM: 3.27
hullYawRateDegPerSec: 22
forwardSpeedMps: 12.5
defaultEngineNorm: 1
hp: 800
armor:
  hullFront: plate(80, 55)
  hullSide: plate(50, 30)
  hullRear: plate(40)
  turretFront: plate(120, 20)
  turretSide: plate(60, 25)
  turretRear: plate(60, 25)
turrets[0]:
  id: panther-f-main
  role: main
  wrap: true
  traverseRateDegPerSec: 6
  drive: hydraulic
  leftover: 0
weapons:
  panther-f-kwk42  main_gun  turret_ring  75 mm  pen 138  dmg 135
  panther-f-coax   coax      slaved
  panther-f-bow    bow_mg    hull_ball   (not a turret)
```

Notes: Ausf. F Schmalturm. Same 7.5 cm KwK 42 L/70 ballistics. L4 hydraulic 6°/s. Turret 120 @ 20. Hull is G. Saukopf / stereoscopic RF / IR / KwK 44/1 as a distinct gun deferred. Armor/pen assumed 100 m AP.

## TREE / XP / sim

```
TREE_LAW.version = 15
TREE_LAW.t5.germany = { hullId: "panther-f", class: "medium" }
deferred: drop "Germany T5"; add "KwK 44/1 distinct gun", "IR night sight", "stereoscopic RF"
XP: fifth win on panther-g researches panther-f (t5Cost 1000)
dummyIdFor("panther-f") = "tiger-ii"
reloadFor("panther-f") = 4.4
```

## Tests when source is present

- RING: one hydraulic ring; turret 120 @ 20; leftover 0; bow hull_ball
- PEN: glacis still stops Tiger I; KwK 42 still pens Tiger I and bounces Tiger II
- TREE: t5.germany === "panther-f"; STARTER_TREE length stays 15
- XP: applyWin(panther-g) after T4 researched → researchedHullId "panther-f"
- SIM: createWorld("panther-f").dummy.blueprintId === "tiger-ii"

## Preserve

RING / PEN / CRIT / LOS / COVER / AMMO / TRACK / CREDIT / REPAIR / APCR / HE.
USA T5 M4A3 and USSR T5 T-44. Artillery locked. No fake T6.
Do not patch Entertainment.
